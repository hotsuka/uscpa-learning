"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/common/ConfirmDialog"
import {
  listBackups,
  createManualBackup,
  restoreBackup,
  deleteBackup,
  type BackupItem,
} from "@/lib/backup/utils"
import { downloadCurrentStateAsJson, importFromJsonFile } from "@/lib/backup/exportImport"
import { Download, Upload, Save, RotateCcw, Trash2, Database } from "lucide-react"

const formatDateTime = (iso: string): string => {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

const labelOfOriginalKey = (key: string): string => {
  if (key === "uscpa-question-bank") return "問題バンク"
  if (key === "uscpa-tbs-bank") return "TBS問題"
  return key
}

export function BackupRestoreCard() {
  const [items, setItems] = useState<BackupItem[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<{
    type: "restore" | "delete" | "import"
    backupKey?: string
    file?: File
    title: string
    description: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(() => {
    setItems(listBackups())
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const handleManualBackup = (): void => {
    const result = createManualBackup()
    if (result.savedKeys.length === 0) {
      alert("バックアップ対象のデータがありません")
      return
    }
    reload()
  }

  const handleRestoreClick = (item: BackupItem): void => {
    setPendingAction({
      type: "restore",
      backupKey: item.backupKey,
      title: `${labelOfOriginalKey(item.originalKey)}を復元しますか？`,
      description: `${formatDateTime(item.createdAt)} のバックアップで現在のデータを上書きします。復元後はページがリロードされます。`,
    })
    setConfirmOpen(true)
  }

  const handleDeleteClick = (item: BackupItem): void => {
    setPendingAction({
      type: "delete",
      backupKey: item.backupKey,
      title: "このバックアップを削除しますか？",
      description: `${labelOfOriginalKey(item.originalKey)} / ${formatDateTime(item.createdAt)} のバックアップを削除します。`,
    })
    setConfirmOpen(true)
  }

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingAction({
      type: "import",
      file,
      title: "JSONから復元しますか？",
      description: `${file.name} の内容で現在のデータを上書きします。復元後はページがリロードされます。`,
    })
    setConfirmOpen(true)
    // 同じファイルを再選択できるようにリセット
    e.target.value = ""
  }

  const handleConfirm = async (): Promise<void> => {
    if (!pendingAction) return
    if (pendingAction.type === "restore" && pendingAction.backupKey) {
      // 復元前のスナップショットを取る
      createManualBackup()
      const restored = restoreBackup(pendingAction.backupKey)
      if (restored) {
        window.location.reload()
      } else {
        alert("復元に失敗しました")
        reload()
      }
    } else if (pendingAction.type === "delete" && pendingAction.backupKey) {
      deleteBackup(pendingAction.backupKey)
      reload()
    } else if (pendingAction.type === "import" && pendingAction.file) {
      // 復元前のスナップショットを取る
      createManualBackup()
      const result = await importFromJsonFile(pendingAction.file)
      if (result.ok) {
        window.location.reload()
      } else {
        alert(`インポートに失敗しました: ${result.error ?? "不明なエラー"}`)
        reload()
      }
    }
    setPendingAction(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          データバックアップ
        </CardTitle>
        <CardDescription>
          問題バンク・TBS問題の回答履歴を保護します（Notion同期対象外のデータ）。データ更新の前には自動的にスナップショットが取られます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 操作ボタン */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleManualBackup}>
            <Save className="w-4 h-4 mr-1.5" />
            今すぐバックアップ
          </Button>
          <Button variant="outline" size="sm" onClick={downloadCurrentStateAsJson}>
            <Download className="w-4 h-4 mr-1.5" />
            JSONをダウンロード
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1.5" />
            JSONから復元
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleFileSelected}
          />
        </div>

        {/* バックアップ一覧 */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">バックアップ一覧 ({items.length}件)</h4>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              バックアップはまだありません。「今すぐバックアップ」ボタンで手動作成できます。
            </p>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {items.map((item) => (
                <div
                  key={item.backupKey}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-muted/30 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Badge variant="outline" className="shrink-0">
                      {labelOfOriginalKey(item.originalKey)}
                    </Badge>
                    <Badge
                      variant={item.type === "pre-migrate" ? "secondary" : "default"}
                      className="shrink-0 text-xs"
                    >
                      {item.type === "pre-migrate" ? "自動(移行前)" : "手動"}
                    </Badge>
                    <span className="text-muted-foreground truncate">
                      {formatDateTime(item.createdAt)}
                    </span>
                    <span className="text-muted-foreground text-xs shrink-0">
                      {item.recordCount !== null ? `${item.recordCount}件` : "-"} / {formatBytes(item.byteSize)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRestoreClick(item)}
                      title="復元"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(item)}
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={pendingAction?.title ?? ""}
        description={pendingAction?.description ?? ""}
        confirmLabel={pendingAction?.type === "delete" ? "削除する" : "復元する"}
        variant="destructive"
        onConfirm={handleConfirm}
      />
    </Card>
  )
}
