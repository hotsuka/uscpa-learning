"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubjectSelector } from "@/components/timer/SubjectSelector"
import { SUBJECTS, type Subject, type Material } from "@/types"
import { savePDFToIndexedDB } from "@/lib/indexeddb"
import {
  Plus,
  FileText,
  Upload,
  Calendar,
  BookOpen,
  Eye,
  Trash2,
  AlertTriangle,
} from "lucide-react"

const STORAGE_KEY = "uscpa-materials"

// 教材データが有効かどうかチェック
// indexeddb: で始まるか、pdfWithoutAnswersがnull（PDFなし）の場合のみ有効
// blob: で始まる場合は無効（古い形式）
const isValidMaterial = (m: Material): boolean => {
  // PDFがない場合は有効
  if (m.pdfWithoutAnswers === null) return true
  // indexeddb:で始まる場合は有効
  if (m.pdfWithoutAnswers.startsWith("indexeddb:")) return true
  // それ以外（blob:など）は無効
  return false
}

// ローカルストレージから全ての教材を読み込む（無効なものも含む）
const loadAllMaterials = (): Material[] => {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return []
  return JSON.parse(stored)
}

// ローカルストレージから有効な教材のみを読み込む
const loadMaterials = (): Material[] => {
  const materials = loadAllMaterials()
  return materials.filter(isValidMaterial)
}

// 無効な教材（古いblob形式）を取得
const loadInvalidMaterials = (): Material[] => {
  const materials = loadAllMaterials()
  return materials.filter(m => !isValidMaterial(m))
}

// ローカルストレージに教材を保存
const saveMaterials = (materials: Material[]) => {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(materials))
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [invalidMaterials, setInvalidMaterials] = useState<Material[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploadName, setUploadName] = useState("")
  const [uploadSubject, setUploadSubject] = useState<Subject>("FAR")
  const [pdfWithoutAnswers, setPdfWithoutAnswers] = useState<File | null>(null)
  const [pdfWithAnswers, setPdfWithAnswers] = useState<File | null>(null)

  const fileInputWithoutRef = useRef<HTMLInputElement>(null)
  const fileInputWithRef = useRef<HTMLInputElement>(null)

  // 初回読み込み時にローカルストレージから教材を取得
  useEffect(() => {
    setMaterials(loadMaterials())
    setInvalidMaterials(loadInvalidMaterials())
  }, [])

  // 無効な教材を削除
  const handleDeleteInvalidMaterial = (id: string) => {
    // 現在のlocalStorageから直接読み込み
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return

    const allMaterials: Material[] = JSON.parse(stored)
    const updatedMaterials = allMaterials.filter(m => m.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedMaterials))

    // stateを更新
    setInvalidMaterials(updatedMaterials.filter(m => !isValidMaterial(m)))
    setMaterials(updatedMaterials.filter(isValidMaterial))
  }

  // 全ての無効な教材を一括削除
  const handleDeleteAllInvalidMaterials = () => {
    if (confirm("古い形式の教材をすべて削除しますか？")) {
      // 有効な教材のみを保持
      const validOnly = materials.filter(isValidMaterial)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validOnly))
      setInvalidMaterials([])
      setMaterials(validOnly)
    }
  }

  const handleUpload = async () => {
    if (!uploadName || !pdfWithoutAnswers) {
      alert("教材名と回答なしPDFは必須です")
      return
    }

    setIsUploading(true)

    try {
      const materialId = `${Date.now()}`

      // PDFファイルをIndexedDBに保存
      await savePDFToIndexedDB(materialId, pdfWithoutAnswers, "without")
      if (pdfWithAnswers) {
        await savePDFToIndexedDB(materialId, pdfWithAnswers, "with")
      }

      // メタデータのみをlocalStorageに保存（blob URLは保存しない）
      const newMaterial: Material = {
        id: materialId,
        name: uploadName,
        subject: uploadSubject,
        pdfWithoutAnswers: `indexeddb:${materialId}-without`, // IndexedDBへの参照
        pdfWithAnswers: pdfWithAnswers ? `indexeddb:${materialId}-with` : null,
        totalPages: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const updatedMaterials = [newMaterial, ...materials]
      setMaterials(updatedMaterials)
      saveMaterials(updatedMaterials)
      setShowUploadForm(false)
      setUploadName("")
      setPdfWithoutAnswers(null)
      setPdfWithAnswers(null)
    } catch (error) {
      console.error("Failed to save PDF:", error)
      alert("PDFの保存に失敗しました")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <>
      <Header title="教材" />
      <div className="p-4 md:p-8 space-y-6">
        {/* 古い形式の教材の警告 */}
        {invalidMaterials.length > 0 && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="font-medium text-destructive">
                      古い形式の教材が {invalidMaterials.length} 件あります
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      以前のバージョンでアップロードされた教材は、ページをリロードすると読み込めなくなります。
                      削除して再アップロードしてください。
                    </p>
                  </div>
                  <div className="space-y-2">
                    {invalidMaterials.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between bg-background rounded p-2"
                      >
                        <span className="text-sm truncate">{m.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive shrink-0"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDeleteInvalidMaterial(m.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDeleteAllInvalidMaterials()
                      }}
                    >
                      すべて削除
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        // 強制的にlocalStorageをクリアして再読み込み
                        if (confirm("すべての教材データを削除してページを再読み込みしますか？")) {
                          localStorage.removeItem(STORAGE_KEY)
                          window.location.reload()
                        }
                      }}
                    >
                      全データリセット
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* データリセットボタン（デバッグ用） */}
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={() => {
            if (confirm("すべての教材データを削除しますか？")) {
              localStorage.removeItem(STORAGE_KEY)
              setMaterials([])
              setInvalidMaterials([])
            }
          }}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          全データ削除
        </Button>

        {/* アップロードボタン */}
        <Button onClick={() => setShowUploadForm(!showUploadForm)}>
          <Plus className="h-4 w-4 mr-2" />
          教材をアップロード
        </Button>

        {/* アップロードフォーム */}
        {showUploadForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">新規教材アップロード</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">教材名</Label>
                <Input
                  id="name"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="例: FAR Vol.1 - Financial Statements"
                />
              </div>

              <div className="space-y-2">
                <Label>科目</Label>
                <SubjectSelector
                  value={uploadSubject}
                  onChange={setUploadSubject}
                  className="w-full"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* 回答なし版 */}
                <div className="space-y-2">
                  <Label>PDF（回答なし版）*</Label>
                  <input
                    ref={fileInputWithoutRef}
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setPdfWithoutAnswers(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputWithoutRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {pdfWithoutAnswers ? pdfWithoutAnswers.name : "ファイルを選択"}
                  </Button>
                </div>

                {/* 回答あり版 */}
                <div className="space-y-2">
                  <Label>PDF（回答あり版）任意</Label>
                  <input
                    ref={fileInputWithRef}
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setPdfWithAnswers(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputWithRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {pdfWithAnswers ? pdfWithAnswers.name : "ファイルを選択"}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                回答なし版と回答あり版を同じページ数のPDFでアップロードすると、
                同じページ内でタブ切り替えして表示できます。
              </p>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => setShowUploadForm(false)}
                  className="flex-1"
                >
                  キャンセル
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={isUploading || !uploadName || !pdfWithoutAnswers}
                  className="flex-1"
                >
                  {isUploading ? "アップロード中..." : "アップロード"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 教材一覧 */}
        {materials.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">教材がまだありません</p>
              <Button
                variant="link"
                className="mt-2"
                onClick={() => setShowUploadForm(true)}
              >
                最初の教材をアップロード
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {materials.map((material) => {
              const subjectInfo = SUBJECTS[material.subject]
              return (
                <Link key={material.id} href={`/materials/${material.id}`}>
                  <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <h3 className="font-medium line-clamp-2">{material.name}</h3>
                        </div>
                        <Badge
                          style={{
                            backgroundColor: subjectInfo.lightColor,
                            color: subjectInfo.color,
                          }}
                          className="shrink-0"
                        >
                          {material.subject}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{material.totalPages}ページ</span>
                        <span className="flex items-center gap-1">
                          {material.pdfWithAnswers ? (
                            <>
                              <Eye className="h-3 w-3" />
                              回答あり版あり
                            </>
                          ) : (
                            "回答なし版のみ"
                          )}
                        </span>
                      </div>

                      <div className="flex items-center text-xs text-muted-foreground pt-2 border-t">
                        <Calendar className="h-3 w-3 mr-1" />
                        <span>
                          更新: {new Date(material.updatedAt).toLocaleDateString("ja-JP")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
