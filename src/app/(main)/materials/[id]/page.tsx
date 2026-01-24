"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { useRouter, useParams } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageMemo, type PageMemoRef } from "@/components/materials/PageMemo"
import { MiniTimer } from "@/components/materials/MiniTimer"
import { ResizableHorizontalPanel, ResizableVerticalPanel } from "@/components/ui/resizable-panel"
import { SUBJECTS, type Material } from "@/types"
import { getPDFFromIndexedDB, deleteAllPDFsForMaterial } from "@/lib/indexeddb"
import { useIsDesktop } from "@/hooks/useMediaQuery"
import { useTimer } from "@/hooks/useTimer"

// PDFViewerはクライアントサイドのみで読み込む
const PDFViewer = dynamic(
  () => import("@/components/materials/PDFViewer").then((mod) => mod.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">PDFビューアを読み込み中...</p>
      </div>
    ),
  }
)
import {
  ArrowLeft,
  FileText,
  Eye,
  EyeOff,
  Trash2,
  PanelRightClose,
  PanelRightOpen,
  Columns,
  Rows,
} from "lucide-react"

type LayoutMode = "horizontal" | "vertical"

const LAYOUT_STORAGE_KEY = "uscpa-material-layout-mode"

// レイアウトモードをlocalStorageから読み込み
const loadLayoutMode = (): LayoutMode => {
  if (typeof window === "undefined") return "horizontal"
  const stored = localStorage.getItem(LAYOUT_STORAGE_KEY)
  return (stored as LayoutMode) || "horizontal"
}

// レイアウトモードをlocalStorageに保存
const saveLayoutMode = (mode: LayoutMode) => {
  if (typeof window === "undefined") return
  localStorage.setItem(LAYOUT_STORAGE_KEY, mode)
}

// ローカルストレージから教材データを取得
const getMaterial = (id: string): Material | null => {
  if (typeof window !== "undefined") {
    const storedMaterials = localStorage.getItem("uscpa-materials")
    if (storedMaterials) {
      const materials: Material[] = JSON.parse(storedMaterials)
      const found = materials.find(m => m.id === id)
      if (found) return found
    }
  }
  return null
}

export default function MaterialDetailPage() {
  const router = useRouter()
  const params = useParams()
  const materialId = params.id as string

  const [material, setMaterial] = useState<Material | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAnswers, setShowAnswers] = useState(false)
  const [pdfUrlWithout, setPdfUrlWithout] = useState<string | null>(null)
  const [pdfUrlWith, setPdfUrlWith] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [showMemoPanel, setShowMemoPanel] = useState(true)
  const [isMemoUnsaved, setIsMemoUnsaved] = useState(false)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("horizontal")

  // PC/モバイル判定
  const isDesktop = useIsDesktop()

  // タイマー操作用
  const { isRunning, isPaused, isIdle, start, pause } = useTimer()

  // レイアウトモードの読み込み
  useEffect(() => {
    setLayoutMode(loadLayoutMode())
  }, [])

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S: メモを保存
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        memoRef.current?.save()
        return
      }

      // Space: タイマー操作（input/textareaにフォーカスがある時は無視）
      if (e.key === " " && e.code === "Space") {
        const activeElement = document.activeElement
        const isInputFocused = activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement?.getAttribute("contenteditable") === "true"

        if (!isInputFocused) {
          e.preventDefault()
          if (isRunning) {
            pause()
          } else {
            start()
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isRunning, isPaused, isIdle, start, pause])

  // レイアウトモード切り替え
  const toggleLayoutMode = () => {
    const newMode: LayoutMode = layoutMode === "horizontal" ? "vertical" : "horizontal"
    setLayoutMode(newMode)
    saveLayoutMode(newMode)
  }

  // PageMemoコンポーネントへの参照
  const memoRef = useRef<PageMemoRef>(null)

  useEffect(() => {
    let urlWithout: string | null = null
    let urlWith: string | null = null

    const loadMaterial = async () => {
      const data = getMaterial(materialId)
      setMaterial(data)

      if (data) {
        // IndexedDBからPDFを読み込み
        if (data.pdfWithoutAnswers?.startsWith("indexeddb:")) {
          urlWithout = await getPDFFromIndexedDB(materialId, "without")
          setPdfUrlWithout(urlWithout)
        }
        if (data.pdfWithAnswers?.startsWith("indexeddb:")) {
          urlWith = await getPDFFromIndexedDB(materialId, "with")
          setPdfUrlWith(urlWith)
        }
      }

      setIsLoading(false)
    }

    loadMaterial()

    // クリーンアップ: blob URLを解放
    return () => {
      if (urlWithout) URL.revokeObjectURL(urlWithout)
      if (urlWith) URL.revokeObjectURL(urlWith)
    }
  }, [materialId])

  // ページ選択時の処理（未保存チェック付き）
  const handlePageSelect = (page: number) => {
    if (page === currentPage) return

    // 未保存の変更がある場合は確認
    if (isMemoUnsaved) {
      const shouldProceed = memoRef.current?.confirmUnsavedChanges()
      if (!shouldProceed) return
    }
    setCurrentPage(page)
  }

  // 戻るボタンの処理（未保存チェック付き）
  const handleBack = () => {
    if (isMemoUnsaved) {
      const shouldProceed = memoRef.current?.confirmUnsavedChanges()
      if (!shouldProceed) return
    }
    router.push("/materials")
  }

  // メモの未保存状態変更ハンドラ
  const handleMemoUnsavedChange = (isDirty: boolean) => {
    setIsMemoUnsaved(isDirty)
  }

  // PDFビューアからのページ変更（未保存チェック付き）
  const handlePageChange = (page: number) => {
    if (page === currentPage) return

    // 未保存の変更がある場合は確認
    if (isMemoUnsaved) {
      const shouldProceed = memoRef.current?.confirmUnsavedChanges()
      if (!shouldProceed) return
    }
    setCurrentPage(page)
  }

  const handleDeleteMaterial = async () => {
    if (confirm("この教材を削除しますか？メモも全て削除されます。")) {
      try {
        // IndexedDBからPDFを削除
        await deleteAllPDFsForMaterial(materialId)

        // localStorageから教材メタデータを削除
        const storedMaterials = localStorage.getItem("uscpa-materials")
        if (storedMaterials) {
          const materials: Material[] = JSON.parse(storedMaterials)
          const updatedMaterials = materials.filter(m => m.id !== materialId)
          localStorage.setItem("uscpa-materials", JSON.stringify(updatedMaterials))
        }

        // メモも削除
        const storedMemos = localStorage.getItem("uscpa-page-memos")
        if (storedMemos) {
          const allMemos = JSON.parse(storedMemos)
          delete allMemos[materialId]
          localStorage.setItem("uscpa-page-memos", JSON.stringify(allMemos))
        }

        router.push("/materials")
      } catch (error) {
        console.error("Failed to delete material:", error)
        alert("教材の削除に失敗しました")
      }
    }
  }

  if (isLoading) {
    return (
      <>
        <Header title="教材" />
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </>
    )
  }

  if (!material) {
    return (
      <>
        <Header title="教材" />
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <p className="text-muted-foreground">教材が見つかりません</p>
          <Button onClick={() => router.push("/materials")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            教材一覧に戻る
          </Button>
        </div>
      </>
    )
  }

  const subjectInfo = SUBJECTS[material.subject]
  const currentPdfUrl = showAnswers && pdfUrlWith ? pdfUrlWith : pdfUrlWithout

  // PDFがない場合
  if (!currentPdfUrl) {
    return (
      <>
        <Header title={material.name} />
        <div className="p-4 md:p-8">
          <div className="flex flex-col items-center justify-center h-96 gap-4">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">PDFファイルがアップロードされていません</p>
            <Button onClick={() => router.push("/materials")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              教材一覧に戻る
            </Button>
          </div>
        </div>
      </>
    )
  }

  // PDFビューアパネル
  const pdfPanel = (
    <PDFViewer
      pdfUrl={currentPdfUrl}
      currentPage={currentPage}
      onPageChange={handlePageChange}
      onTotalPagesChange={setTotalPages}
      className="h-full"
    />
  )

  // メモパネル（PC用）
  const memoPanel = (
    <div className="h-full bg-background p-4 overflow-hidden">
      <PageMemo
        ref={memoRef}
        materialId={materialId}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageSelect={handlePageSelect}
        onDirtyChange={handleMemoUnsavedChange}
      />
    </div>
  )

  return (
    <>
      <Header title={material.name} />
      <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-0rem)]">
        {/* ヘッダーバー */}
        <div className="flex items-center justify-between p-2 border-b bg-background flex-wrap gap-2">
          <div className="flex items-center gap-2 md:gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">戻る</span>
            </Button>
            <div className="flex items-center gap-2">
              <Badge
                style={{
                  backgroundColor: subjectInfo.lightColor,
                  color: subjectInfo.color,
                }}
              >
                {material.subject}
              </Badge>
              <span className="font-medium text-sm truncate max-w-[120px] sm:max-w-[200px] md:max-w-none">
                {material.name}
              </span>
            </div>
          </div>

          {/* ミニタイマー（中央） */}
          <MiniTimer className="hidden sm:flex" />

          <div className="flex items-center gap-2">
            {/* 回答あり/なし切り替え */}
            {pdfUrlWith && (
              <Button
                variant={showAnswers ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAnswers(!showAnswers)}
              >
                {showAnswers ? (
                  <>
                    <Eye className="h-4 w-4 mr-1" />
                    回答あり
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4 mr-1" />
                    回答なし
                  </>
                )}
              </Button>
            )}

            {/* メモパネル表示切り替え */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMemoPanel(!showMemoPanel)}
            >
              {showMemoPanel ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </Button>

            {/* レイアウト切り替え（PC版のみ） */}
            {isDesktop && showMemoPanel && (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleLayoutMode}
                title={layoutMode === "horizontal" ? "上下レイアウトに切り替え" : "左右レイアウトに切り替え"}
              >
                {layoutMode === "horizontal" ? (
                  <Rows className="h-4 w-4" />
                ) : (
                  <Columns className="h-4 w-4" />
                )}
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDeleteMaterial}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* モバイル用ミニタイマー（ヘッダー下） */}
        <div className="sm:hidden border-b bg-muted/30 p-2 flex justify-center">
          <MiniTimer />
        </div>

        {/* メインコンテンツ - PC */}
        {isDesktop && (
          <div className="flex-1 overflow-hidden">
            {showMemoPanel ? (
              layoutMode === "horizontal" ? (
                <ResizableHorizontalPanel
                  leftPanel={pdfPanel}
                  rightPanel={memoPanel}
                  defaultLeftWidth={66}
                  minLeftWidth={40}
                  maxLeftWidth={85}
                  storageKey="material-panel-horizontal-split"
                />
              ) : (
                <ResizableVerticalPanel
                  topPanel={pdfPanel}
                  bottomPanel={memoPanel}
                  defaultTopHeight={60}
                  minTopHeight={30}
                  maxTopHeight={80}
                  storageKey="material-panel-vertical-split"
                />
              )
            ) : (
              <div className="h-full">{pdfPanel}</div>
            )}
          </div>
        )}

        {/* メインコンテンツ - モバイル */}
        {!isDesktop && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className={showMemoPanel ? "flex-1" : "h-full"}>
              {pdfPanel}
            </div>
            {/* モバイル用メモパネル（下部に表示） */}
            {showMemoPanel && (
              <div className="border-t bg-background p-4 h-[40vh] overflow-hidden">
                <PageMemo
                  ref={memoRef}
                  materialId={materialId}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageSelect={handlePageSelect}
                  onDirtyChange={handleMemoUnsavedChange}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
