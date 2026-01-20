"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ResizableVerticalPanel } from "@/components/ui/resizable-panel"
import { Save, Trash2, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNotesStore } from "@/stores/notesStore"
import type { StudyNote } from "@/types"

export interface PageMemoData {
  id: string  // ノートID（notesStore連携用）
  materialId: string
  pageNumber: number
  content: string
  createdAt: string
  updatedAt: string
}

interface PageMemoProps {
  materialId: string
  currentPage: number
  totalPages: number
  onPageSelect?: (page: number) => void
  className?: string
}

export function PageMemo({ materialId, currentPage, totalPages, onPageSelect, className }: PageMemoProps) {
  const { notes, addNote, updateNote, deleteNote, getPageMemosByMaterial } = useNotesStore()
  const [currentContent, setCurrentContent] = useState("")
  const [isDirty, setIsDirty] = useState(false)

  // この教材のページメモを取得
  const pageMemos = useMemo(() => {
    return getPageMemosByMaterial(materialId)
  }, [notes, materialId, getPageMemosByMaterial])

  // ページ番号→メモのマップを作成
  const memosByPage = useMemo(() => {
    const map: Record<number, StudyNote> = {}
    for (const memo of pageMemos) {
      if (memo.pageNumber !== null) {
        map[memo.pageNumber] = memo
      }
    }
    return map
  }, [pageMemos])

  // ページ変更時に現在のメモを読み込む
  useEffect(() => {
    const memo = memosByPage[currentPage]
    setCurrentContent(memo?.content || "")
    setIsDirty(false)
  }, [currentPage, memosByPage])

  const handleContentChange = (value: string) => {
    setCurrentContent(value)
    setIsDirty(true)
  }

  const handleSave = () => {
    const existingMemo = memosByPage[currentPage]

    if (currentContent.trim()) {
      if (existingMemo) {
        // 既存メモを更新
        updateNote(existingMemo.id, {
          content: currentContent,
        })
      } else {
        // 新規メモを作成
        addNote({
          noteType: "page_memo",
          title: `P.${currentPage} メモ`,
          content: currentContent,
          subject: null,
          tags: [],
          materialId,
          pageNumber: currentPage,
        })
      }
    } else if (existingMemo) {
      // 空の場合は削除
      deleteNote(existingMemo.id)
    }

    setIsDirty(false)
  }

  const handleDelete = () => {
    const existingMemo = memosByPage[currentPage]
    if (existingMemo && confirm("このページのメモを削除しますか？")) {
      deleteNote(existingMemo.id)
      setCurrentContent("")
      setIsDirty(false)
    }
  }

  // メモがあるページの一覧
  const pagesWithMemos = Object.keys(memosByPage)
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
          {memosByPage[currentPage] && (
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
              const memo = memosByPage[page]
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
