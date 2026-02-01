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
import { SubtopicSelector } from "@/components/timer/SubtopicSelector"
import { SUBJECTS, type Subject, type Material } from "@/types"
import { EmptyState } from "@/components/common/EmptyState"
import { ConfirmDialog } from "@/components/common/ConfirmDialog"
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
  Search,
  X,
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
  const [uploadSubtopic, setUploadSubtopic] = useState("")
  const [pdfWithoutAnswers, setPdfWithoutAnswers] = useState<File | null>(null)
  const [pdfWithAnswers, setPdfWithAnswers] = useState<File | null>(null)

  // ConfirmDialog用state
  const [showDeleteInvalidDialog, setShowDeleteInvalidDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false)

  // 検索・フィルター用state
  const [searchQuery, setSearchQuery] = useState("")
  const [filterSubject, setFilterSubject] = useState<Subject | "all">("all")
  const [filterSubtopic, setFilterSubtopic] = useState<string | "all">("all")

  const fileInputWithoutRef = useRef<HTMLInputElement>(null)
  const fileInputWithRef = useRef<HTMLInputElement>(null)

  // 現在の科目フィルターに合致する教材からサブテーマ一覧を抽出
  const availableSubtopics = Array.from(
    new Set(
      materials
        .filter((m) => filterSubject === "all" || m.subject === filterSubject)
        .map((m) => m.subtopic ?? null)
        .filter((s): s is string => s !== null)
    )
  ).sort()

  // 検索・フィルター適用後の教材一覧
  const filteredMaterials = materials.filter((material) => {
    const matchesSearch = searchQuery === "" ||
      material.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSubject = filterSubject === "all" || material.subject === filterSubject
    const matchesSubtopic = filterSubtopic === "all" || (material.subtopic ?? null) === filterSubtopic
    return matchesSearch && matchesSubject && matchesSubtopic
  })

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
    const validOnly = materials.filter(isValidMaterial)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validOnly))
    setInvalidMaterials([])
    setMaterials(validOnly)
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
        subtopic: uploadSubtopic || null,
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
      setUploadSubtopic("")
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
                        setShowDeleteInvalidDialog(true)
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
                        setShowResetDialog(true)
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
          onClick={() => setShowDeleteAllDialog(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          全データ削除
        </Button>

        {/* 検索・フィルター・アップロードボタン */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* 検索ボックス */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="教材名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* 科目フィルター */}
          <div className="flex gap-2 flex-wrap">
            <Badge
              variant={filterSubject === "all" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => { setFilterSubject("all"); setFilterSubtopic("all") }}
            >
              すべて
            </Badge>
            {(Object.keys(SUBJECTS) as Subject[]).map((subject) => (
              <Badge
                key={subject}
                variant={filterSubject === subject ? "default" : "outline"}
                className="cursor-pointer"
                style={filterSubject === subject ? {
                  backgroundColor: SUBJECTS[subject].color,
                  color: "white",
                } : {
                  borderColor: SUBJECTS[subject].color,
                  color: SUBJECTS[subject].color,
                }}
                onClick={() => { setFilterSubject(subject); setFilterSubtopic("all") }}
              >
                {subject}
              </Badge>
            ))}
          </div>

          {/* サブテーマフィルター */}
          {availableSubtopics.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <Badge
                variant={filterSubtopic === "all" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setFilterSubtopic("all")}
              >
                全テーマ
              </Badge>
              {availableSubtopics.map((subtopic) => (
                <Badge
                  key={subtopic}
                  variant={filterSubtopic === subtopic ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setFilterSubtopic(subtopic)}
                >
                  {subtopic}
                </Badge>
              ))}
            </div>
          )}

          {/* アップロードボタン */}
          <Button onClick={() => setShowUploadForm(!showUploadForm)} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            教材をアップロード
          </Button>
        </div>

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
                  onChange={(v) => {
                    setUploadSubject(v)
                    setUploadSubtopic("")
                  }}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>サブテーマ（任意）</Label>
                <SubtopicSelector
                  subject={uploadSubject}
                  value={uploadSubtopic}
                  onChange={setUploadSubtopic}
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
            <CardContent className="text-center">
              <EmptyState message="教材がまだありません" icon={BookOpen}>
                <Button
                  variant="link"
                  className="mt-2"
                  onClick={() => setShowUploadForm(true)}
                >
                  最初の教材をアップロード
                </Button>
              </EmptyState>
            </CardContent>
          </Card>
        ) : filteredMaterials.length === 0 ? (
          <Card>
            <CardContent className="text-center">
              <EmptyState message="検索条件に一致する教材がありません" icon={Search}>
                <Button
                  variant="link"
                  className="mt-2"
                  onClick={() => {
                    setSearchQuery("")
                    setFilterSubject("all")
                    setFilterSubtopic("all")
                  }}
                >
                  フィルターをクリア
                </Button>
              </EmptyState>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredMaterials.map((material) => {
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
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge
                            style={{
                              backgroundColor: subjectInfo.lightColor,
                              color: subjectInfo.color,
                            }}
                          >
                            {material.subject}
                          </Badge>
                          {(material.subtopic ?? null) && (
                            <Badge variant="outline" className="text-xs">
                              {material.subtopic}
                            </Badge>
                          )}
                        </div>
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

      <ConfirmDialog
        open={showDeleteInvalidDialog}
        onOpenChange={setShowDeleteInvalidDialog}
        title="古い形式の教材を削除"
        description="古い形式の教材をすべて削除しますか？"
        confirmLabel="すべて削除"
        variant="destructive"
        onConfirm={handleDeleteAllInvalidMaterials}
      />

      <ConfirmDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        title="全データリセット"
        description="すべての教材データを削除してページを再読み込みしますか？"
        confirmLabel="リセット"
        variant="destructive"
        onConfirm={() => {
          localStorage.removeItem(STORAGE_KEY)
          window.location.reload()
        }}
      />

      <ConfirmDialog
        open={showDeleteAllDialog}
        onOpenChange={setShowDeleteAllDialog}
        title="全データ削除"
        description="すべての教材データを削除しますか？"
        confirmLabel="削除"
        variant="destructive"
        onConfirm={() => {
          localStorage.removeItem(STORAGE_KEY)
          setMaterials([])
          setInvalidMaterials([])
        }}
      />
    </>
  )
}
