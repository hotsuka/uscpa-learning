"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useRouter, useParams } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SUBJECTS, type Subject, type Material, type MaterialAnnotation } from "@/types"

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
  Save,
  Trash2,
} from "lucide-react"

// モックデータ - 実際にはNotion APIから取得
// 注意: デモデータにはPDFがないため、実際にアップロードした教材のみ閲覧可能
const getMockMaterial = (id: string): Material | null => {
  // ローカルストレージから教材データを取得（教材一覧でアップロードしたもの）
  if (typeof window !== "undefined") {
    const storedMaterials = localStorage.getItem("uscpa-materials")
    if (storedMaterials) {
      const materials: Material[] = JSON.parse(storedMaterials)
      const found = materials.find(m => m.id === id)
      if (found) return found
    }
  }

  // デモ用のモックデータ（PDFなし）
  return {
    id,
    name: "FAR Vol.1 - Financial Statements",
    subject: "FAR" as Subject,
    pdfWithoutAnswers: null, // PDFはアップロードが必要
    pdfWithAnswers: null,
    totalPages: 0,
    createdAt: "2026-01-10T10:00:00Z",
    updatedAt: "2026-01-15T14:30:00Z",
  }
}

export default function MaterialDetailPage() {
  const router = useRouter()
  const params = useParams()
  const materialId = params.id as string

  const [material, setMaterial] = useState<Material | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAnswers, setShowAnswers] = useState(false)
  const [annotations, setAnnotations] = useState<MaterialAnnotation[]>([])

  useEffect(() => {
    // 教材データを取得
    const data = getMockMaterial(materialId)
    setMaterial(data)
    setIsLoading(false)

    // TODO: アノテーションをNotion/ローカルストレージから取得
  }, [materialId])

  const handleAnnotationAdd = (
    annotation: Omit<MaterialAnnotation, "id" | "createdAt" | "updatedAt">
  ) => {
    const newAnnotation: MaterialAnnotation = {
      ...annotation,
      id: `${Date.now()}`,
      materialId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setAnnotations([...annotations, newAnnotation])

    // TODO: Notion/ローカルストレージに保存
    console.log("Annotation added:", newAnnotation)
  }

  const handleAnnotationDelete = (annotationId: string) => {
    setAnnotations(annotations.filter((a) => a.id !== annotationId))
    // TODO: Notion/ローカルストレージから削除
  }

  const handleSaveAnnotations = () => {
    // TODO: 全アノテーションを保存
    console.log("Saving annotations:", annotations)
    alert("メモを保存しました（デモ）")
  }

  const handleDeleteMaterial = () => {
    if (confirm("この教材を削除しますか？メモも全て削除されます。")) {
      // TODO: Notionから削除
      alert("教材を削除しました（デモ）")
      router.push("/materials")
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
  const currentPdfUrl = showAnswers && material.pdfWithAnswers
    ? material.pdfWithAnswers
    : material.pdfWithoutAnswers

  // PDFがない場合のフォールバック
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
            {material.pdfWithAnswers && (
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

            <Button variant="outline" size="sm" onClick={handleSaveAnnotations}>
              <Save className="h-4 w-4 mr-1" />
              保存
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

        {/* PDFビューア */}
        <div className="flex-1 overflow-hidden">
          <PDFViewer
            pdfUrl={currentPdfUrl}
            annotations={annotations}
            onAnnotationAdd={handleAnnotationAdd}
            onAnnotationDelete={handleAnnotationDelete}
            className="h-full"
          />
        </div>
      </div>
    </>
  )
}
