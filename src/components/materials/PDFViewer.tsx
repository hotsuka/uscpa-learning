"use client"

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react"
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

// 外部から参照可能なメソッド
export interface PDFViewerRef {
  goToPrevPage: () => void
  goToNextPage: () => void
  zoomIn: () => void
  zoomOut: () => void
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

  const containerRef = useRef<HTMLDivElement>(null)

  // 外部からのページ変更を反映
  useEffect(() => {
    if (currentPage && currentPage !== pageNumber) {
      setPageNumber(currentPage)
    }
  }, [currentPage])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setIsLoading(false)
    onTotalPagesChange?.(numPages)
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

  // 外部からのアクセス用メソッドを公開
  useImperativeHandle(ref, () => ({
    goToPrevPage,
    goToNextPage,
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
  }), [numPages, pageNumber])

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
      </div>

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
