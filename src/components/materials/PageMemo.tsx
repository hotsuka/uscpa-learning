"use client"

import { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ResizableVerticalPanel } from "@/components/ui/resizable-panel"
import { Save, Trash2, MessageSquare, Plus } from "lucide-react"
import { EmptyState } from "@/components/common/EmptyState"
import { ConfirmDialog } from "@/components/common/ConfirmDialog"
import { cn, generateUUID, getDeviceId } from "@/lib/utils"

export interface PageMemoData {
  id?: string  // ローカルUUID（Notion同期用）
  materialId: string
  pageNumber: number
  roundNumber: number  // 周回数（1始まり）
  content: string
  createdAt: string
  updatedAt: string
  notionSynced?: boolean  // Notion同期済みフラグ
}

interface PageMemoProps {
  materialId: string
  currentPage: number
  totalPages: number
  onPageSelect?: (page: number) => void
  onDirtyChange?: (isDirty: boolean) => void
  className?: string
}

// 外部から参照可能なメソッド
export interface PageMemoRef {
  isDirty: () => boolean
  save: () => void
  confirmUnsavedChanges: () => boolean
}

const MEMO_STORAGE_KEY = "uscpa-page-memos"

// 新形式: materialId -> pageNumber -> roundNumber -> PageMemoData
type MemoStore = Record<number, Record<number, PageMemoData>>

// localStorageからメモを読み込む（旧形式のマイグレーション付き）
const loadMemos = (materialId: string): MemoStore => {
  if (typeof window === "undefined") return {}
  const stored = localStorage.getItem(MEMO_STORAGE_KEY)
  if (!stored) return {}
  const allMemos: Record<string, Record<string, unknown>> = JSON.parse(stored)
  const materialMemos = allMemos[materialId]
  if (!materialMemos) return {}

  // マイグレーション: 旧形式チェック & 変換
  const migrated: MemoStore = {}
  let needsMigration = false

  for (const [pageStr, value] of Object.entries(materialMemos)) {
    const page = Number(pageStr)
    if (value && typeof value === "object" && "content" in value) {
      // 旧形式: PageMemoData が直接入っている → round 1 として変換
      needsMigration = true
      const oldMemo = value as PageMemoData
      migrated[page] = { 1: { ...oldMemo, roundNumber: 1 } }
    } else {
      // 新形式: Record<number, PageMemoData>
      migrated[page] = value as Record<number, PageMemoData>
    }
  }

  // マイグレーションが必要な場合は新形式で上書き保存
  if (needsMigration) {
    saveMemos(materialId, migrated)
  }

  return migrated
}

// localStorageにメモを保存
const saveMemos = (materialId: string, memos: MemoStore) => {
  if (typeof window === "undefined") return
  const stored = localStorage.getItem(MEMO_STORAGE_KEY)
  const allMemos: Record<string, MemoStore> = stored ? JSON.parse(stored) : {}
  allMemos[materialId] = memos
  localStorage.setItem(MEMO_STORAGE_KEY, JSON.stringify(allMemos))
}

// Notionにメモを同期（バックグラウンド）
const syncMemoToNotion = async (memo: PageMemoData): Promise<boolean> => {
  try {
    const response = await fetch("/api/notion/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        noteId: memo.id,
        noteType: "page_memo",
        title: `P.${memo.pageNumber} R${memo.roundNumber} メモ`,
        content: memo.content,
        subject: null,
        tags: [],
        materialId: memo.materialId,
        pageNumber: memo.pageNumber,
        roundNumber: memo.roundNumber,
        deviceId: getDeviceId(),
        createdAt: memo.createdAt,
        updatedAt: memo.updatedAt,
      }),
    })
    return response.ok
  } catch (error) {
    console.error("Failed to sync memo to Notion:", error)
    return false
  }
}

// Notionからメモを削除（バックグラウンド）
const deleteMemoFromNotion = async (memoId: string): Promise<void> => {
  if (!memoId) return
  try {
    await fetch(`/api/notion/notes?id=${memoId}`, {
      method: "DELETE",
    })
  } catch (error) {
    console.error("Failed to delete memo from Notion:", error)
  }
}

export const PageMemo = forwardRef<PageMemoRef, PageMemoProps>(
  function PageMemo({ materialId, currentPage, totalPages, onPageSelect, onDirtyChange, className }, ref) {
  const [memos, setMemos] = useState<MemoStore>({})
  const [currentContent, setCurrentContent] = useState("")
  const [currentRound, setCurrentRound] = useState(1)
  const [pendingRound, setPendingRound] = useState<number | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // refで最新の値を保持
  const currentContentRef = useRef(currentContent)
  const currentPageRef = useRef(currentPage)
  const currentRoundRef = useRef(currentRound)
  const memosRef = useRef(memos)
  const isDirtyRef = useRef(isDirty)
  const prevPageRef = useRef(currentPage)

  // ページ変更を検知して自動保存
  if (currentPage !== prevPageRef.current) {
    // 前のページに未保存の変更がある場合は保存
    if (isDirtyRef.current && currentContentRef.current.trim()) {
      const now = new Date().toISOString()
      const prevPage = prevPageRef.current
      const round = currentRoundRef.current
      const content = currentContentRef.current
      const currentMemos = memosRef.current
      const existingMemo = (currentMemos[prevPage] || {})[round]

      const updatedMemo: PageMemoData = {
        id: existingMemo?.id || generateUUID(),
        materialId,
        pageNumber: prevPage,
        roundNumber: round,
        content: content,
        createdAt: existingMemo?.createdAt || now,
        updatedAt: now,
        notionSynced: false,
      }

      const updatedPageMemos = { ...(currentMemos[prevPage] || {}), [round]: updatedMemo }
      const updatedMemos = { ...currentMemos, [prevPage]: updatedPageMemos }
      saveMemos(materialId, updatedMemos)

      // 非同期でNotionに同期
      syncMemoToNotion(updatedMemo).catch(console.error)
    }

    prevPageRef.current = currentPage
  }

  // refを同期的に更新
  currentContentRef.current = currentContent
  currentPageRef.current = currentPage
  currentRoundRef.current = currentRound
  memosRef.current = memos
  isDirtyRef.current = isDirty

  // 初回読み込み
  useEffect(() => {
    const loadedMemos = loadMemos(materialId)
    setMemos(loadedMemos)
  }, [materialId])

  // ページ変更時にlocalStorageから最新のメモを読み込む
  useEffect(() => {
    const latestMemos = loadMemos(materialId)
    setMemos(latestMemos)
    const pageMemos = latestMemos[currentPage] || {}
    const rounds = Object.keys(pageMemos).map(Number).sort((a, b) => a - b)

    if (pendingRound !== null && pageMemos[pendingRound]) {
      // メモ一覧からのクリックで特定周回が指定されている
      setCurrentRound(pendingRound)
      setCurrentContent(pageMemos[pendingRound]?.content || "")
      setPendingRound(null)
    } else {
      // 最大の周回を自動選択（なければ1）
      const maxRound = rounds.length > 0 ? rounds[rounds.length - 1] : 1
      setCurrentRound(maxRound)
      setCurrentContent(pageMemos[maxRound]?.content || "")
    }
    setIsDirty(false)
  }, [currentPage, materialId]) // pendingRound は意図的に依存配列に入れない

  // isDirty状態の変更を親コンポーネントに通知
  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  // ブラウザを閉じる/ページを離れる際の警告
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = "未保存のメモがあります。本当にページを離れますか？"
        return e.returnValue
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [isDirty])

  const handleContentChange = (value: string) => {
    setCurrentContent(value)
    setIsDirty(true)
  }

  // 周回切り替え
  const handleRoundChange = useCallback((round: number) => {
    // 未保存の変更がある場合は先に保存
    if (isDirtyRef.current && currentContentRef.current.trim()) {
      handleSaveInternal()
    }
    setCurrentRound(round)
    const memo = (memosRef.current[currentPageRef.current] || {})[round]
    setCurrentContent(memo?.content || "")
    setIsDirty(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 新しい周回を追加
  const handleAddNewRound = useCallback(() => {
    // 未保存の変更がある場合は先に保存
    if (isDirtyRef.current && currentContentRef.current.trim()) {
      handleSaveInternal()
    }
    const pageMemos = memosRef.current[currentPageRef.current] || {}
    const existingRounds = Object.keys(pageMemos).map(Number)
    const maxExisting = existingRounds.length > 0 ? Math.max(...existingRounds) : 0
    const nextRound = maxExisting + 1
    setCurrentRound(nextRound)
    setCurrentContent("")
    setIsDirty(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 内部保存処理
  const handleSaveInternal = useCallback(() => {
    const now = new Date().toISOString()
    const page = currentPageRef.current
    const round = currentRoundRef.current
    const content = currentContentRef.current
    const currentMemos = memosRef.current
    const existingMemo = (currentMemos[page] || {})[round]

    const updatedMemo: PageMemoData = {
      id: existingMemo?.id || generateUUID(),
      materialId,
      pageNumber: page,
      roundNumber: round,
      content: content,
      createdAt: existingMemo?.createdAt || now,
      updatedAt: now,
      notionSynced: false,
    }

    const updatedMemos = { ...currentMemos }

    if (content.trim()) {
      const updatedPageMemos = { ...(currentMemos[page] || {}), [round]: updatedMemo }
      updatedMemos[page] = updatedPageMemos
      setMemos(updatedMemos)
      saveMemos(materialId, updatedMemos)
      setIsDirty(false)

      syncMemoToNotion(updatedMemo).then((synced) => {
        if (synced) {
          const latestMemos = loadMemos(materialId)
          if (latestMemos[page]?.[round]) {
            latestMemos[page][round].notionSynced = true
            saveMemos(materialId, latestMemos)
          }
        }
      }).catch(console.error)
    } else {
      // 空のメモは削除
      const pageMemos = { ...(currentMemos[page] || {}) }
      const memoToDelete = pageMemos[round]
      delete pageMemos[round]

      if (Object.keys(pageMemos).length === 0) {
        delete updatedMemos[page]
      } else {
        updatedMemos[page] = pageMemos
      }
      setMemos(updatedMemos)
      saveMemos(materialId, updatedMemos)
      setIsDirty(false)

      if (memoToDelete?.id) {
        deleteMemoFromNotion(memoToDelete.id).catch(console.error)
      }
    }
  }, [materialId])

  // 外部からのアクセス用メソッドを公開
  useImperativeHandle(ref, () => ({
    isDirty: () => isDirtyRef.current,
    save: () => {
      if (!isDirtyRef.current) return

      const content = currentContentRef.current
      const page = currentPageRef.current
      const round = currentRoundRef.current
      const currentMemos = memosRef.current
      const existingMemo = (currentMemos[page] || {})[round]

      const now = new Date().toISOString()

      const updatedMemo: PageMemoData = {
        id: existingMemo?.id || generateUUID(),
        materialId,
        pageNumber: page,
        roundNumber: round,
        content: content,
        createdAt: existingMemo?.createdAt || now,
        updatedAt: now,
        notionSynced: false,
      }

      const updatedMemos = { ...currentMemos }

      if (content.trim()) {
        const updatedPageMemos = { ...(currentMemos[page] || {}), [round]: updatedMemo }
        updatedMemos[page] = updatedPageMemos
        setMemos(updatedMemos)
        saveMemos(materialId, updatedMemos)
        setIsDirty(false)

        syncMemoToNotion(updatedMemo).then((synced) => {
          if (synced) {
            const latestMemos = loadMemos(materialId)
            if (latestMemos[page]?.[round]) {
              latestMemos[page][round].notionSynced = true
              saveMemos(materialId, latestMemos)
            }
          }
        }).catch(console.error)
      } else {
        const pageMemos = { ...(currentMemos[page] || {}) }
        const memoToDelete = pageMemos[round]
        delete pageMemos[round]

        if (Object.keys(pageMemos).length === 0) {
          delete updatedMemos[page]
        } else {
          updatedMemos[page] = pageMemos
        }
        setMemos(updatedMemos)
        saveMemos(materialId, updatedMemos)
        setIsDirty(false)

        if (memoToDelete?.id) {
          deleteMemoFromNotion(memoToDelete.id).catch(console.error)
        }
      }
    },
    confirmUnsavedChanges: () => {
      if (!isDirtyRef.current) return true
      return confirm("未保存のメモがあります。保存せずに続行しますか？")
    },
  }), [materialId])

  // UIからの保存ボタンハンドラ
  const handleSave = () => {
    handleSaveInternal()
  }

  const handleDelete = () => {
    const pageMemos = { ...(memos[currentPage] || {}) }
    const memoToDelete = pageMemos[currentRound]
    delete pageMemos[currentRound]

    const updatedMemos = { ...memos }
    if (Object.keys(pageMemos).length === 0) {
      delete updatedMemos[currentPage]
    } else {
      updatedMemos[currentPage] = pageMemos
    }
    setMemos(updatedMemos)
    saveMemos(materialId, updatedMemos)
    setCurrentContent("")
    setIsDirty(false)

    // 残りの周回があればその最大周回に切り替え、なければ1
    const remainingRounds = Object.keys(pageMemos).map(Number).sort((a, b) => a - b)
    if (remainingRounds.length > 0) {
      const newRound = remainingRounds[remainingRounds.length - 1]
      setCurrentRound(newRound)
      setCurrentContent(pageMemos[newRound]?.content || "")
    } else {
      setCurrentRound(1)
    }

    // Notionからも削除（バックグラウンド）
    if (memoToDelete?.id) {
      deleteMemoFromNotion(memoToDelete.id).catch(console.error)
    }
  }

  // メモ一覧のクリックハンドラ
  const handleMemoItemClick = (page: number, round: number) => {
    if (page !== currentPage) {
      setPendingRound(round)
      onPageSelect?.(page)
    } else {
      handleRoundChange(round)
    }
  }

  // 現在のページの周回情報
  const pageRoundMemos = memos[currentPage] || {}
  const existingRounds = Object.keys(pageRoundMemos).map(Number).sort((a, b) => a - b)

  // メモがあるページ+周回のフラット化一覧
  const memosWithRounds = Object.entries(memos).flatMap(([pageStr, roundMemos]) => {
    const page = Number(pageStr)
    return Object.entries(roundMemos).map(([roundStr, memo]) => ({
      page,
      round: Number(roundStr),
      memo,
    }))
  }).sort((a, b) => a.page - b.page || a.round - b.round)

  const memoCount = memosWithRounds.length

  // 現在のページのメモ入力パネル
  const memoInputPanel = (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            ページ {currentPage} のメモ
          </CardTitle>
          {isDirty && (
            <Badge variant="secondary" className="text-xs">
              未保存
            </Badge>
          )}
        </div>
        {/* 周回タブ */}
        <div className="flex items-center gap-2 mt-2">
          {existingRounds.length > 0 || currentRound === 1 ? (
            <Tabs value={String(currentRound)} onValueChange={(v) => handleRoundChange(Number(v))}>
              <TabsList className="h-8">
                {(existingRounds.length > 0 ? existingRounds : [1]).map((round) => (
                  <TabsTrigger key={round} value={String(round)} className="text-xs px-2 py-1">
                    R{round}
                  </TabsTrigger>
                ))}
                {/* 新しい周回がまだ保存されていない場合もタブに表示 */}
                {!existingRounds.includes(currentRound) && currentRound > 1 && (
                  <TabsTrigger value={String(currentRound)} className="text-xs px-2 py-1">
                    R{currentRound}
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0"
            onClick={handleAddNewRound}
            title="新しい周回を追加"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-2 overflow-hidden pb-2">
        <Textarea
          value={currentContent}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="このページに関するメモを入力..."
          className="flex-1 min-h-0 resize-none"
        />
        <div className="flex gap-2 flex-shrink-0">
          <Button
            onClick={handleSave}
            disabled={!isDirty}
            className="flex-1"
            size="sm"
          >
            <Save className="h-4 w-4 mr-1" />
            保存
          </Button>
          {pageRoundMemos[currentRound] && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )

  // メモ一覧パネル
  const memoListPanel = (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-sm">
          メモ一覧 ({memoCount}件 / {totalPages}ページ中)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1 overflow-hidden pb-2">
        {memoCount === 0 ? (
          <EmptyState message="まだメモがありません" className="py-4" />
        ) : (
          <div className="space-y-2 h-full overflow-y-auto pr-1">
            {memosWithRounds.map(({ page, round, memo }) => (
              <div
                key={`${page}-${round}`}
                onClick={() => handleMemoItemClick(page, round)}
                className={cn(
                  "p-2 rounded border text-sm cursor-pointer hover:bg-muted/50 transition-colors",
                  page === currentPage && round === currentRound && "border-primary bg-primary/5"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">
                      P.{page}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      R{round}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(memo.updatedAt).toLocaleDateString("ja-JP")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {memo.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className={cn("h-full", className)}>
      <ResizableVerticalPanel
        topPanel={memoInputPanel}
        bottomPanel={memoListPanel}
        defaultTopHeight={55}
        minTopHeight={25}
        maxTopHeight={80}
        storageKey="memo-panel-vertical-split"
      />
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="メモを削除"
        description={`ページ ${currentPage} の周回 ${currentRound} のメモを削除しますか？`}
        confirmLabel="削除"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
})
