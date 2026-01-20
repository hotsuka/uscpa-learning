"use client"

import { useState, useEffect } from "react"
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
  className?: string
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

export function PageMemo({ materialId, currentPage, totalPages, onPageSelect, className }: PageMemoProps) {
  const [memos, setMemos] = useState<Record<number, PageMemoData>>({})
  const [currentContent, setCurrentContent] = useState("")
  const [isDirty, setIsDirty] = useState(false)

  // 初回読み込み
  useEffect(() => {
    const loadedMemos = loadMemos(materialId)
    setMemos(loadedMemos)
  }, [materialId])

  // ページ変更時に現在のメモを読み込む
  useEffect(() => {
    const memo = memos[currentPage]
    setCurrentContent(memo?.content || "")
    setIsDirty(false)
  }, [currentPage, memos])

  const handleContentChange = (value: string) => {
    setCurrentContent(value)
    setIsDirty(true)
  }

  const handleSave = () => {
    const now = new Date().toISOString()
    const existingMemo = memos[currentPage]

    const updatedMemo: PageMemoData = {
      id: existingMemo?.id || generateUUID(),  // 新規作成時はUUID生成
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
      // まずlocalStorageに保存（データ保護優先）
      setMemos(updatedMemos)
      saveMemos(materialId, updatedMemos)
      setIsDirty(false)

      // バックグラウンドでNotion同期（非同期・fire-and-forget）
      syncMemoToNotion(updatedMemo).then((synced) => {
        if (synced) {
          // 同期成功時にフラグを更新
          const currentMemos = loadMemos(materialId)
          if (currentMemos[currentPage]) {
            currentMemos[currentPage].notionSynced = true
            saveMemos(materialId, currentMemos)
          }
        }
      }).catch(console.error)
    } else {
      // 空の場合は削除
      const memoToDelete = existingMemo
      delete updatedMemos[currentPage]
      setMemos(updatedMemos)
      saveMemos(materialId, updatedMemos)
      setIsDirty(false)

      // Notionからも削除（バックグラウンド）
      if (memoToDelete?.id) {
        deleteMemoFromNotion(memoToDelete.id).catch(console.error)
      }
    }
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
}
