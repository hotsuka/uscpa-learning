"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { downloadCurrentStateAsJson } from "@/lib/backup/exportImport"
import { readBackupMeta, writeBackupMeta } from "@/lib/backup/autoBackup"
import { TARGET_KEYS } from "@/lib/backup/constants"
import { getJSTDateString } from "@/lib/utils"
import { Download, X, AlertTriangle } from "lucide-react"

// 最終JSONダウンロードからこの日数を超えたらリマインダーを表示する
const REMINDER_AFTER_DAYS = 7

/**
 * 回答履歴のJSONバックアップを促すバナー。
 * IndexedDBの自動バックアップは同一ブラウザ内の保護のため、
 * デバイス故障・サイトデータ削除に備えたファイルへの書き出しを定期的に促す。
 */
export function BackupReminderBanner() {
  const [visible, setVisible] = useState(false)
  const [daysSince, setDaysSince] = useState<number | null>(null)

  useEffect(() => {
    // 保護対象データが無ければ表示しない
    const hasData = TARGET_KEYS.some((key) => localStorage.getItem(key) !== null)
    if (!hasData) return

    const meta = readBackupMeta()
    const today = getJSTDateString(new Date())
    if (meta.reminderDismissedOn === today) return

    if (!meta.lastJsonDownloadAt) {
      // 一度もダウンロードしていない場合も表示する
      setDaysSince(null)
      setVisible(true)
      return
    }
    const days = Math.floor(
      (Date.now() - new Date(meta.lastJsonDownloadAt).getTime()) / (24 * 60 * 60 * 1000)
    )
    if (days >= REMINDER_AFTER_DAYS) {
      setDaysSince(days)
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  const handleDownload = (): void => {
    downloadCurrentStateAsJson()
    setVisible(false)
  }

  const handleDismiss = (): void => {
    writeBackupMeta({ reminderDismissedOn: getJSTDateString(new Date()) })
    setVisible(false)
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-900 text-sm">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1 min-w-0">
        {daysSince === null
          ? "回答履歴のバックアップファイルがまだありません。JSONを保存しておくとデバイス故障時にも復元できます。"
          : `最後のJSONバックアップから${daysSince}日経過しています。`}
      </span>
      <Button size="sm" variant="outline" className="shrink-0 h-7 border-amber-300 bg-white hover:bg-amber-100" onClick={handleDownload}>
        <Download className="w-3.5 h-3.5 mr-1" />
        JSONを保存
      </Button>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-1 rounded hover:bg-amber-100"
        title="今日は表示しない"
        aria-label="今日は表示しない"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
