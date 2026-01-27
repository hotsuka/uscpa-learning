"use client"

import { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ResizableVerticalPanel } from "@/components/ui/resizable-panel"
import { Save, Trash2, MessageSquare } from "lucide-react"
import { cn, generateUUID, getDeviceId } from "@/lib/utils"

export interface PageMemoData {
  id?: string  // ローカルUUID（Notion同期用）
  materialId: string
  pageNumber: number
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

// localStorageからメモを読み込む
const loadMemos = (materialId: string): Record<number, PageMemoData> => {
  if (typeof window === "undefined") return {}
  const stored = localStorage.getItem(MEMO_STORAGE_KEY)
  if (!stored) return {}
  const allMemos: Record<string, Record<number, PageMemoData>> = JSON.parse(stored)
  return allMemos[materialId] || {}
}

// localStorageにメモを保存
const saveMemos = (materialId: string, memos: Record<number, PageMemoData>) => {
  if (typeof window === "undefined") return
  const stored = localStorage.getItem(MEMO_STORAGE_KEY)
  const allMemos: Record<string, Record<number, PageMemoData>> = stored ? JSON.parse(stored) : {}
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
        title: `P.${memo.pageNumber} メモ`,
        content: memo.content,
        subject: null,
        tags: [],
        materialId: memo.materialId,
        pageNumber: memo.pageNumber,
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
  const [memos, setMemos] = useState<Record<number, PageMemoData>>({})
  const [currentContent, setCurrentContent] = useState("")
  const [isDirty, setIsDirty] = useState(false)

  // refで最新の値を保持
  const currentContentRef = useRef(currentContent)
  const currentPageRef = useRef(currentPage)
  const memosRef = useRef(memos)
  const isDirtyRef = useRef(isDirty)
  const prevPageRef = useRef(currentPage)

  // ページ変更を検知して自動保存
  if (currentPage !== prevPageRef.current) {
    // 前のページに未保存の変更がある場合は保存
    if (isDirtyRef.current && currentContentRef.current.trim()) {
      const now = new Date().toISOString()
      const prevPage = prevPageRef.current
      const content = currentContentRef.current
      const currentMemos = memosRef.current
      const existingMemo = currentMemos[prevPage]

      const updatedMemo: PageMemoData = {
        id: existingMemo?.id || generateUUID(),
        materialId,
        pageNumber: prevPage,
        content: content,
        createdAt: existingMemo?.createdAt || now,
        updatedAt: now,
        notionSynced: false,
      }

      const updatedMemos = { ...currentMemos, [prevPage]: updatedMemo }
      saveMemos(materialId, updatedMemos)

      // 非同期でNotionに同期
      syncMemoToNotion(updatedMemo).catch(console.error)
    }

    prevPageRef.current = currentPage
  }

  // refを同期的に更新
  currentContentRef.current = currentContent
  currentPageRef.current = currentPage
  memosRef.current = memos
  isDirtyRef.current = isDirty

  // 初回読み込み
  useEffect(() => {
    const loadedMemos = loadMemos(materialId)
    setMemos(loadedMemos)
  }, [materialId])

  // ページ変更時にlocalStorageから最新のメモを読み込む
  useEffect(() => {
    // localStorageから最新の状態を取得（自動保存後の反映のため）
    const latestMemos = loadMemos(materialId)
    setMemos(latestMemos)
    const memo = latestMemos[currentPage]
    setCurrentContent(memo?.content || "")
    setIsDirty(false)
  }, [currentPage, materialId])

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

  // 内部保存処理
  const handleSaveInternal = useCallback(() => {
    const now = new Date().toISOString()
    const existingMemo = memos[currentPage]

    const updatedMemo: PageMemoData = {
      id: existingMemo?.id || generateUUID(),
      materialId,
      pageNumber: currentPage,
      content: currentContent,
      createdAt: existingMemo?.createdAt || now,
      updatedAt: now,
      notionSynced: false,
    }

    const updatedMemos = { ...memos }

    if (currentContent.trim()) {
      updatedMemos[currentPage] = updatedMemo
      setMemos(updatedMemos)
      saveMemos(materialId, updatedMemos)
      setIsDirty(false)

      syncMemoToNotion(updatedMemo).then((synced) => {
        if (synced) {
          const currentMemos = loadMemos(materialId)
          if (currentMemos[currentPage]) {
            currentMemos[currentPage].notionSynced = true
            saveMemos(materialId, currentMemos)
          }
        }
      }).catch(console.error)
    } else {
      const memoToDelete = existingMemo
      delete updatedMemos[currentPage]
      setMemos(updatedMemos)
      saveMemos(materialId, updatedMemos)
      setIsDirty(false)

      if (memoToDelete?.id) {
        deleteMemoFromNotion(memoToDelete.id).catch(console.error)
      }
    }
  }, [memos, currentPage, currentContent, materialId])

  // 外部からのアクセス用メソッドを公開
  useImperativeHandle(ref, () => ({
    isDirty: () => isDirtyRef.current,
    save: () => {
      // refから最新の値を取得して保存（クロージャーの古い値問題を回避）
      const content = currentContentRef.current
      const page = currentPageRef.current
      const currentMemos = memosRef.current

      if (!isDirtyRef.current) return

      const now = new Date().toISOString()
      const existingMemo = currentMemos[page]

      const updatedMemo: PageMemoData = {
        id: existingMemo?.id || generateUUID(),
        materialId,
        pageNumber: page,
        content: content,
        createdAt: existingMemo?.createdAt || now,
        updatedAt: now,
        notionSynced: false,
      }

      const updatedMemos = { ...currentMemos }

      if (content.trim()) {
        updatedMemos[page] = updatedMemo
        setMemos(updatedMemos)
        saveMemos(materialId, updatedMemos)
        setIsDirty(false)

        syncMemoToNotion(updatedMemo).then((synced) => {
          if (synced) {
            const latestMemos = loadMemos(materialId)
            if (latestMemos[page]) {
              latestMemos[page].notionSynced = true
              saveMemos(materialId, latestMemos)
            }
          }
        }).catch(console.error)
      } else {
        const memoToDelete = existingMemo
        delete updatedMemos[page]
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
    if (confirm("このページのメモを削除しますか？")) {
      const memoToDelete = memos[currentPage]
      const updatedMemos = { ...memos }
      delete updatedMemos[currentPage]
      setMemos(updatedMemos)
      saveMemos(materialId, updatedMemos)
      setCurrentContent("")
      setIsDirty(false)

      // Notionからも削除（バックグラウンド）
      if (memoToDelete?.id) {
        deleteMemoFromNotion(memoToDelete.id).catch(console.error)
      }
    }
  }

  // メモがあるページの一覧
  const pagesWithMemos = Object.keys(memos)
    .map(Number)
    .sort((a, b) => a - b)

  const memoCount = pagesWithMemos.length

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
          {memos[currentPage] && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
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
          <p className="text-sm text-muted-foreground">
            まだメモがありません
          </p>
        ) : (
          <div className="space-y-2 h-full overflow-y-auto pr-1">
            {pagesWithMemos.map((page) => {
              const memo = memos[page]
              return (
                <div
                  key={page}
                  onClick={() => onPageSelect?.(page)}
                  className={cn(
                    "p-2 rounded border text-sm cursor-pointer hover:bg-muted/50 transition-colors",
                    page === currentPage && "border-primary bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-xs">
                      P.{page}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(memo.updatedAt).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {memo.content}
                  </p>
                </div>
              )
            })}
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
    </div>
  )
})
