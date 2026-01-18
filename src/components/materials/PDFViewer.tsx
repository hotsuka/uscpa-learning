"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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
  Maximize2,
  Highlighter,
  MessageSquare,
  Pencil,
  Eraser,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { MaterialAnnotation } from "@/types"

// PDF.jsワーカーの設定（クライアントサイドでのみ実行）
// react-pdf 10.xは内部でpdfjs-dist 5.4.296を使用
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`
}

interface PDFViewerProps {
  pdfUrl: string
  annotations?: MaterialAnnotation[]
  onAnnotationAdd?: (annotation: Omit<MaterialAnnotation, "id" | "createdAt" | "updatedAt">) => void
  onAnnotationDelete?: (annotationId: string) => void
  className?: string
}

type ToolType = "select" | "highlight" | "note" | "drawing" | "eraser"

export function PDFViewer({
  pdfUrl,
  annotations = [],
  onAnnotationAdd,
  onAnnotationDelete,
  className,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTool, setActiveTool] = useState<ToolType>("select")
  const [selectedColor, setSelectedColor] = useState("#ffff00")
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPath, setDrawingPath] = useState<string>("")

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setIsLoading(false)
  }

  const onDocumentLoadError = (error: Error) => {
    console.error("Error loading PDF:", error)
    setIsLoading(false)
  }

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(1, prev - 1))
  }

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(numPages, prev + 1))
  }

  const handleZoomIn = () => {
    setScale((prev) => Math.min(3, prev + 0.25))
  }

  const handleZoomOut = () => {
    setScale((prev) => Math.max(0.5, prev - 0.25))
  }

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value)
    if (!isNaN(value) && value >= 1 && value <= numPages) {
      setPageNumber(value)
    }
  }

  // 現在のページのアノテーションをフィルタ
  const currentAnnotations = annotations.filter(
    (a) => a.pageNumber === pageNumber
  )

  // キャンバス上でのマウスイベント処理
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (activeTool === "select" || !canvasRef.current) return

      const rect = canvasRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left) / scale
      const y = (e.clientY - rect.top) / scale

      if (activeTool === "drawing") {
        setIsDrawing(true)
        setDrawingPath(`M ${x} ${y}`)
      } else if (activeTool === "highlight" || activeTool === "note") {
        // ハイライトまたはメモの開始点
        if (onAnnotationAdd) {
          onAnnotationAdd({
            materialId: "", // 親コンポーネントで設定
            pageNumber,
            x,
            y,
            width: 100,
            height: 20,
            type: activeTool,
            content: activeTool === "note" ? "" : "",
            color: selectedColor,
          })
        }
      }
    },
    [activeTool, pageNumber, scale, selectedColor, onAnnotationAdd]
  )

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !canvasRef.current) return

      const rect = canvasRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left) / scale
      const y = (e.clientY - rect.top) / scale

      setDrawingPath((prev) => `${prev} L ${x} ${y}`)
    },
    [isDrawing, scale]
  )

  const handleCanvasMouseUp = useCallback(() => {
    if (isDrawing && drawingPath && onAnnotationAdd) {
      onAnnotationAdd({
        materialId: "",
        pageNumber,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        type: "drawing",
        content: drawingPath,
        color: selectedColor,
      })
    }
    setIsDrawing(false)
    setDrawingPath("")
  }, [isDrawing, drawingPath, pageNumber, selectedColor, onAnnotationAdd])

  const toolColors = [
    { color: "#ffff00", name: "黄" },
    { color: "#ff9999", name: "赤" },
    { color: "#99ff99", name: "緑" },
    { color: "#9999ff", name: "青" },
  ]

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

        {/* 書き込みツール */}
        <div className="flex items-center gap-1">
          <Button
            variant={activeTool === "select" ? "default" : "outline"}
            size="icon"
            onClick={() => setActiveTool("select")}
            title="選択"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant={activeTool === "highlight" ? "default" : "outline"}
            size="icon"
            onClick={() => setActiveTool("highlight")}
            title="ハイライト"
          >
            <Highlighter className="h-4 w-4" />
          </Button>
          <Button
            variant={activeTool === "note" ? "default" : "outline"}
            size="icon"
            onClick={() => setActiveTool("note")}
            title="メモ"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button
            variant={activeTool === "drawing" ? "default" : "outline"}
            size="icon"
            onClick={() => setActiveTool("drawing")}
            title="描画"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant={activeTool === "eraser" ? "default" : "outline"}
            size="icon"
            onClick={() => setActiveTool("eraser")}
            title="消しゴム"
          >
            <Eraser className="h-4 w-4" />
          </Button>

          {/* カラー選択 */}
          <div className="flex items-center gap-1 ml-2">
            {toolColors.map(({ color, name }) => (
              <button
                key={color}
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-transform",
                  selectedColor === color
                    ? "border-foreground scale-110"
                    : "border-muted hover:scale-105"
                )}
                style={{ backgroundColor: color }}
                onClick={() => setSelectedColor(color)}
                title={name}
              />
            ))}
          </div>
        </div>
      </div>

      {/* PDFビューエリア */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/30 flex justify-center p-4"
      >
        <div className="relative">
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

          {/* アノテーションオーバーレイ */}
          <canvas
            ref={canvasRef}
            className={cn(
              "absolute top-0 left-0 w-full h-full",
              activeTool !== "select" && "cursor-crosshair"
            )}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          />

          {/* アノテーション表示 */}
          <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {currentAnnotations.map((annotation) => {
              if (annotation.type === "drawing") {
                return (
                  <path
                    key={annotation.id}
                    d={annotation.content}
                    stroke={annotation.color}
                    strokeWidth={2 / scale}
                    fill="none"
                  />
                )
              }
              if (annotation.type === "highlight") {
                return (
                  <rect
                    key={annotation.id}
                    x={annotation.x * scale}
                    y={annotation.y * scale}
                    width={annotation.width * scale}
                    height={annotation.height * scale}
                    fill={annotation.color}
                    opacity={0.3}
                  />
                )
              }
              return null
            })}
            {/* 現在描画中のパス */}
            {isDrawing && drawingPath && (
              <path
                d={drawingPath}
                stroke={selectedColor}
                strokeWidth={2 / scale}
                fill="none"
              />
            )}
          </svg>
        </div>
      </div>

      {/* ステータスバー */}
      <div className="flex items-center justify-between p-2 border-t bg-muted/50 text-sm text-muted-foreground">
        <span>
          {isLoading ? "読み込み中..." : `ページ ${pageNumber} / ${numPages}`}
        </span>
        <span>{currentAnnotations.length} 件のメモ</span>
      </div>
    </div>
  )
}
