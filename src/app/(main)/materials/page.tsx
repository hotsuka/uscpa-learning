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
import {
  Plus,
  FileText,
  Upload,
  Calendar,
  BookOpen,
  Eye,
} from "lucide-react"

const STORAGE_KEY = "uscpa-materials"

// ローカルストレージから教材を読み込む
const loadMaterials = (): Material[] => {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

// ローカルストレージに教材を保存
const saveMaterials = (materials: Material[]) => {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(materials))
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
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
  }, [])

  const handleUpload = async () => {
    if (!uploadName || !pdfWithoutAnswers) {
      alert("教材名と回答なしPDFは必須です")
      return
    }

    setIsUploading(true)

    // TODO: 実際のアップロード処理
    // - PDFをストレージにアップロード
    // - Notionにメタデータを保存

    const newMaterial: Material = {
      id: `${Date.now()}`,
      name: uploadName,
      subject: uploadSubject,
      pdfWithoutAnswers: URL.createObjectURL(pdfWithoutAnswers),
      pdfWithAnswers: pdfWithAnswers ? URL.createObjectURL(pdfWithAnswers) : null,
      totalPages: 0, // TODO: PDFから取得
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
    setIsUploading(false)
  }

  return (
    <>
      <Header title="教材" />
      <div className="p-4 md:p-8 space-y-6">
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
