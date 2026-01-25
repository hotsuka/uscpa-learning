"use client"

import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Search,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

// PDF.jsワーカーの設定（クライアントサイドでのみ実行）
// react-pdf 9.x は pdfjs-dist 4.x を使用
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

interface PDFViewerProps {
  pdfUrl: string
  currentPage?: number
  onPageChange?: (page: number) => void
  onTotalPagesChange?: (totalPages: number) => void
  className?: string
}

// 検索結果の型
interface SearchResult {
  pageNumber: number
  matchIndex: number
}

// 外部から参照可能なメソッド
export interface PDFViewerRef {
  goToPrevPage: () => void
  goToNextPage: () => void
  zoomIn: () => void
  zoomOut: () => void
  openSearch: () => void
}

export const PDFViewer = forwardRef<PDFViewerRef, PDFViewerProps>(function PDFViewer({
  pdfUrl,
  currentPage,
  onPageChange,
  onTotalPagesChange,
  className,
}, ref) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState(currentPage || 1)
  const [scale, setScale] = useState(1.0)
  const [isLoading, setIsLoading] = useState(true)

  // 検索機能の状態
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [currentResultIndex, setCurrentResultIndex] = useState(-1)
  const [isSearching, setIsSearching] = useState(false)
  const [pageTexts, setPageTexts] = useState<Map<number, string>>(new Map())

  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const pdfDocRef = useRef<pdfjs.PDFDocumentProxy | null>(null)

  // 外部からのページ変更を反映
  useEffect(() => {
    if (currentPage && currentPage !== pageNumber) {
      setPageNumber(currentPage)
    }
  }, [currentPage])

  const onDocumentLoadSuccess = (pdf: pdfjs.PDFDocumentProxy) => {
    pdfDocRef.current = pdf
    setNumPages(pdf.numPages)
    setIsLoading(false)
    onTotalPagesChange?.(pdf.numPages)
  }

  const onDocumentLoadError = (error: Error) => {
    console.error("Error loading PDF:", error)
    setIsLoading(false)
  }

  const goToPrevPage = () => {
    const newPage = Math.max(1, pageNumber - 1)
    setPageNumber(newPage)
    onPageChange?.(newPage)
  }

  const goToNextPage = () => {
    const newPage = Math.min(numPages, pageNumber + 1)
    setPageNumber(newPage)
    onPageChange?.(newPage)
  }

  const handleZoomIn = () => {
    setScale((prev) => Math.min(3, prev + 0.25))
  }

  const handleZoomOut = () => {
    setScale((prev) => Math.max(0.5, prev - 0.25))
  }

  // 検索を開く
  const openSearch = useCallback(() => {
    setShowSearch(true)
    setTimeout(() => searchInputRef.current?.focus(), 100)
  }, [])

  // 検索を閉じる
  const closeSearch = useCallback(() => {
    setShowSearch(false)
    setSearchQuery("")
    setSearchResults([])
    setCurrentResultIndex(-1)
  }, [])

  // PDFからテキストを抽出
  const extractTextFromPage = useCallback(async (pdf: pdfjs.PDFDocumentProxy, pageNum: number): Promise<string> => {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    return textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
  }, [])

  // 検索を実行
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || !pdfDocRef.current) {
      setSearchResults([])
      setCurrentResultIndex(-1)
      return
    }

    setIsSearching(true)
    const results: SearchResult[] = []
    const pdf = pdfDocRef.current
    const queryLower = query.toLowerCase()

    try {
      // 各ページを検索
      for (let i = 1; i <= numPages; i++) {
        let text = pageTexts.get(i)
        if (!text) {
          text = await extractTextFromPage(pdf, i)
          setPageTexts(prev => new Map(prev).set(i, text!))
        }

        const textLower = text.toLowerCase()
        let matchIndex = 0
        let pos = 0
        while ((pos = textLower.indexOf(queryLower, pos)) !== -1) {
          results.push({ pageNumber: i, matchIndex })
          matchIndex++
          pos += queryLower.length
        }
      }

      setSearchResults(results)
      if (results.length > 0) {
        setCurrentResultIndex(0)
        // 最初の結果のページに移動
        const firstResult = results[0]
        if (firstResult.pageNumber !== pageNumber) {
          setPageNumber(firstResult.pageNumber)
          onPageChange?.(firstResult.pageNumber)
        }
      } else {
        setCurrentResultIndex(-1)
      }
    } finally {
      setIsSearching(false)
    }
  }, [numPages, pageTexts, extractTextFromPage, pageNumber, onPageChange])

  // 次の検索結果へ
  const goToNextResult = useCallback(() => {
    if (searchResults.length === 0) return
    const nextIndex = (currentResultIndex + 1) % searchResults.length
    setCurrentResultIndex(nextIndex)
    const result = searchResults[nextIndex]
    if (result.pageNumber !== pageNumber) {
      setPageNumber(result.pageNumber)
      onPageChange?.(result.pageNumber)
    }
  }, [searchResults, currentResultIndex, pageNumber, onPageChange])

  // 前の検索結果へ
  const goToPrevResult = useCallback(() => {
    if (searchResults.length === 0) return
    const prevIndex = currentResultIndex <= 0 ? searchResults.length - 1 : currentResultIndex - 1
    setCurrentResultIndex(prevIndex)
    const result = searchResults[prevIndex]
    if (result.pageNumber !== pageNumber) {
      setPageNumber(result.pageNumber)
      onPageChange?.(result.pageNumber)
    }
  }, [searchResults, currentResultIndex, pageNumber, onPageChange])

  // 検索クエリ変更時に検索実行
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        performSearch(searchQuery)
      } else {
        setSearchResults([])
        setCurrentResultIndex(-1)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, performSearch])

  // 外部からのアクセス用メソッドを公開
  useImperativeHandle(ref, () => ({
    goToPrevPage,
    goToNextPage,
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    openSearch,
  }), [numPages, pageNumber, openSearch])

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value)
    if (!isNaN(value) && value >= 1 && value <= numPages) {
      setPageNumber(value)
      onPageChange?.(value)
    }
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* ツールバー */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/50 flex-wrap gap-2">
        {/* ページナビゲーション */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={1}
              max={numPages}
              value={pageNumber}
              onChange={handlePageInputChange}
              className="w-16 text-center"
            />
            <span className="text-sm text-muted-foreground">/ {numPages}</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* ズーム */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm w-12 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="outline" size="icon" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        {/* 検索ボタン */}
        <Button
          variant={showSearch ? "default" : "outline"}
          size="icon"
          onClick={() => showSearch ? closeSearch() : openSearch()}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* 検索バー */}
      {showSearch && (
        <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 h-8"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                if (e.shiftKey) {
                  goToPrevResult()
                } else {
                  goToNextResult()
                }
              } else if (e.key === "Escape") {
                closeSearch()
              }
            }}
          />
          {searchResults.length > 0 && (
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {currentResultIndex + 1} / {searchResults.length}
            </span>
          )}
          {searchQuery && searchResults.length === 0 && !isSearching && (
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              見つかりません
            </span>
          )}
          {isSearching && (
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              検索中...
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevResult}
            disabled={searchResults.length === 0}
            className="h-8 w-8"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextResult}
            disabled={searchResults.length === 0}
            className="h-8 w-8"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeSearch}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* PDFビューエリア */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/30 flex justify-center p-4"
      >
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex items-center justify-center h-96">
              <p className="text-muted-foreground">PDFを読み込み中...</p>
            </div>
          }
          error={
            <div className="flex items-center justify-center h-96">
              <p className="text-destructive">PDFの読み込みに失敗しました</p>
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>

      {/* ステータスバー */}
      <div className="flex items-center justify-between p-2 border-t bg-muted/50 text-sm text-muted-foreground">
        <span>
          {isLoading ? "読み込み中..." : `ページ ${pageNumber} / ${numPages}`}
        </span>
      </div>
    </div>
  )
})
