"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useRouter, useParams } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageMemo } from "@/components/materials/PageMemo"
import { ResizableHorizontalPanel } from "@/components/ui/resizable-panel"
import { SUBJECTS, type Material } from "@/types"
import { getPDFFromIndexedDB, deleteAllPDFsForMaterial } from "@/lib/indexeddb"

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
} from "lucide-react"

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

  const handlePageSelect = (page: number) => {
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
      onPageChange={setCurrentPage}
      onTotalPagesChange={setTotalPages}
      className="h-full"
    />
  )

  // メモパネル（PC用）
  const memoPanel = (
    <div className="h-full bg-background p-4 overflow-hidden">
      <PageMemo
        materialId={materialId}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageSelect={handlePageSelect}
      />
    </div>
  )

  return (
    <>
      <Header title={material.name} />
      <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-0rem)]">
        {/* ヘッダーバー */}
        <div className="flex items-center justify-between p-2 border-b bg-background flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/materials")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              戻る
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
              <span className="font-medium text-sm truncate max-w-[200px] md:max-w-none">
                {material.name}
              </span>
            </div>
          </div>

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

        {/* メインコンテンツ - PC */}
        <div className="flex-1 overflow-hidden hidden md:block">
          {showMemoPanel ? (
            <ResizableHorizontalPanel
              leftPanel={pdfPanel}
              rightPanel={memoPanel}
              defaultLeftWidth={66}
              minLeftWidth={40}
              maxLeftWidth={85}
              storageKey="material-panel-horizontal-split"
            />
          ) : (
            <div className="h-full">{pdfPanel}</div>
          )}
        </div>

        {/* メインコンテンツ - モバイル */}
        <div className="flex-1 overflow-hidden md:hidden flex flex-col">
          <div className={showMemoPanel ? "flex-1" : "h-full"}>
            {pdfPanel}
          </div>
          {/* モバイル用メモパネル（下部に表示） */}
          {showMemoPanel && (
            <div className="border-t bg-background p-4 h-[40vh] overflow-hidden">
              <PageMemo
                materialId={materialId}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageSelect={handlePageSelect}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
