"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SubjectSelector } from "@/components/timer/SubjectSelector"
import { SubtopicSelector } from "@/components/timer/SubtopicSelector"
import { SUBJECTS, type Subject, type Material } from "@/types"
import { EmptyState } from "@/components/common/EmptyState"
import { ConfirmDialog } from "@/components/common/ConfirmDialog"
import {
  savePDFToIndexedDB,
  exportPDFFromIndexedDB,
  deleteAllPDFsForMaterial,
} from "@/lib/indexeddb"
import { pdfjs } from "react-pdf"
import JSZip from "jszip"
import {
  groupMaterialFiles,
  type MaterialFileGroup,
} from "@/lib/materials/parseMaterialFileName"
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
  Download,
} from "lucide-react"

const STORAGE_KEY = "uscpa-materials"

// PDF.jsワーカーの設定（PDFViewerと同じCDNを使う）
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

// PDFの内容ハッシュ。教材名を変えて再アップロードしても同一と判定するために使う
const getContentHash = async (file: File): Promise<string | undefined> => {
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  } catch (error) {
    console.error("Failed to hash file:", error)
    return undefined
  }
}

// PDFの実ページ数を読む。失敗しても登録は続行したいので0を返す。
// 大きいPDFやworkerのCDN取得で止まることがあるため、待ち続けない
const PAGE_COUNT_TIMEOUT_MS = 8000

const getPdfPageCount = async (file: File): Promise<number> => {
  try {
    const buffer = await file.arrayBuffer()
    // pdf.jsは渡したバッファをdetachするため、コピーを渡す
    const task = pdfjs.getDocument({ data: new Uint8Array(buffer) })
    const doc = await Promise.race([
      task.promise,
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), PAGE_COUNT_TIMEOUT_MS),
      ),
    ])
    if (!doc) {
      void task.destroy()
      return 0
    }
    const pageCount = doc.numPages
    await doc.destroy()
    return pageCount
  } catch (error) {
    console.error("Failed to read page count:", error)
    return 0
  }
}

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

  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [isBulkDownloading, setIsBulkDownloading] = useState(false)

  // 複数選択削除用state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteSelectedDialog, setShowDeleteSelectedDialog] = useState(false)

  // 一括アップロード用state
  const [bulkGroups, setBulkGroups] = useState<MaterialFileGroup[]>([])
  const [isBulkUploading, setIsBulkUploading] = useState(false)
  const [bulkDoneCount, setBulkDoneCount] = useState(0)

  const fileInputWithoutRef = useRef<HTMLInputElement>(null)
  const fileInputWithRef = useRef<HTMLInputElement>(null)
  const bulkInputRef = useRef<HTMLInputElement>(null)

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownload = async (material: Material, type: "without" | "with") => {
    setDownloadingId(`${material.id}-${type}`)
    try {
      const blob = await exportPDFFromIndexedDB(material.id, type)
      if (!blob) {
        alert("PDFが見つかりませんでした")
        return
      }
      const suffix = type === "with" ? "_回答あり" : ""
      const filename = `${material.name}${suffix}.pdf`
      triggerDownload(blob, filename)
    } catch (error) {
      console.error("Failed to export PDF:", error)
      alert("PDFのダウンロードに失敗しました")
    } finally {
      setDownloadingId(null)
    }
  }

  const handleBulkDownload = async () => {
    setIsBulkDownloading(true)
    let successCount = 0
    let failCount = 0
    try {
      const zip = new JSZip()

      // 教材名が重複してもZIP内で上書きされないよう連番を付ける
      const usedNames = new Set<string>()
      const addToZip = (filename: string, blob: Blob) => {
        let name = filename
        for (let i = 2; usedNames.has(name); i++) {
          name = `${filename.replace(/\.pdf$/, "")} (${i}).pdf`
        }
        usedNames.add(name)
        zip.file(name, blob)
      }

      for (const material of materials) {
        if (material.pdfWithoutAnswers?.startsWith("indexeddb:")) {
          const blob = await exportPDFFromIndexedDB(material.id, "without")
          if (blob) {
            addToZip(`${material.name}.pdf`, blob)
            successCount++
          } else {
            failCount++
          }
        }
        if (material.pdfWithAnswers?.startsWith("indexeddb:")) {
          const blob = await exportPDFFromIndexedDB(material.id, "with")
          if (blob) {
            addToZip(`${material.name}_回答あり.pdf`, blob)
            successCount++
          } else {
            failCount++
          }
        }
      }

      if (successCount === 0) {
        alert("ダウンロードできる教材がありませんでした")
        return
      }

      // PDFは既に圧縮済みなので再圧縮せず格納のみ（生成時間を抑える）
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "STORE",
      })
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "")
      triggerDownload(zipBlob, `uscpa-materials-${stamp}.zip`)

      if (failCount > 0) {
        alert(
          `${successCount}件をZIPにまとめました。${failCount}件は取得できませんでした`,
        )
      }
    } catch (error) {
      console.error("Failed to bulk export PDFs:", error)
      alert("一括ダウンロード中にエラーが発生しました")
    } finally {
      setIsBulkDownloading(false)
    }
  }

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

  // 同じ教材名で二重に登録されたものを検出する。
  // 教材名を変えて再アップロードすると重複スキップが効かないため後片付けが要る
  const duplicateGroups = (() => {
    const byName = new Map<string, Material[]>()
    for (const m of materials) {
      byName.set(m.name, [...(byName.get(m.name) ?? []), m])
    }
    return [...byName.values()].filter((g) => g.length > 1)
  })()

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // 選択した教材をまとめて削除する（絞り込みと組み合わせて科目単位で消せる）
  const handleDeleteSelected = async () => {
    const ids = [...selectedIds]
    for (const id of ids) {
      try {
        await deleteAllPDFsForMaterial(id)
      } catch (error) {
        console.error(`Failed to delete PDFs for ${id}:`, error)
      }
    }
    const kept = materials.filter((m) => !selectedIds.has(m.id))
    setMaterials(kept)
    saveMaterials(kept)
    setSelectedIds(new Set())
  }

  // 重複のうち最新の1件だけを残し、古い方を削除する
  const handleDedupe = async () => {
    const removeIds: string[] = []
    for (const group of duplicateGroups) {
      const sorted = [...group].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      )
      removeIds.push(...sorted.slice(1).map((m) => m.id))
    }
    if (removeIds.length === 0) return

    for (const id of removeIds) {
      try {
        await deleteAllPDFsForMaterial(id)
      } catch (error) {
        console.error(`Failed to delete PDFs for ${id}:`, error)
      }
    }

    const kept = materials.filter((m) => !removeIds.includes(m.id))
    setMaterials(kept)
    saveMaterials(kept)
    alert(`${removeIds.length}件の重複を削除しました`)
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

      const totalPages = await getPdfPageCount(pdfWithoutAnswers)

      // メタデータのみをlocalStorageに保存（blob URLは保存しない）
      const newMaterial: Material = {
        id: materialId,
        name: uploadName,
        subject: uploadSubject,
        subtopic: uploadSubtopic || null,
        pdfWithoutAnswers: `indexeddb:${materialId}-without`, // IndexedDBへの参照
        pdfWithAnswers: pdfWithAnswers ? `indexeddb:${materialId}-with` : null,
        totalPages,
        contentHash: await getContentHash(pdfWithoutAnswers),
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

  // 一括アップロード：ファイル名から科目・分野・回答あり版を判定してプレビューを作る
  const handleBulkFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setBulkGroups(groupMaterialFiles(Array.from(fileList)))
    setBulkDoneCount(0)
  }

  const handleBulkUpload = async () => {
    const targets = bulkGroups.filter((g) => g.without || g.with)
    if (targets.length === 0) return

    setIsBulkUploading(true)
    setBulkDoneCount(0)

    // 登録済みのものは飛ばす。名前だけで見ると教材名を変えたときに二重登録されるため、
    // PDFの内容ハッシュでも判定する
    const existingNames = new Set(materials.map((m) => m.name))
    const existingHashes = new Set(
      materials.map((m) => m.contentHash).filter((h): h is string => !!h),
    )
    let current = materials
    let addedCount = 0
    let skippedCount = 0
    const failedNames: string[] = []

    for (const [index, group] of targets.entries()) {
      setBulkDoneCount(index + 1)

      // 回答なし版がなければ回答あり版を主PDFとして登録する
      const primary = group.without ?? group.with
      if (!primary) continue

      const hash = await getContentHash(primary)
      if (existingNames.has(group.baseName) || (hash && existingHashes.has(hash))) {
        skippedCount++
        continue
      }

      try {
        const materialId = `${Date.now()}-${index}`
        const hasPair = Boolean(group.without && group.with)

        await savePDFToIndexedDB(materialId, primary, "without")
        if (hasPair && group.with) {
          await savePDFToIndexedDB(materialId, group.with, "with")
        }

        const material: Material = {
          id: materialId,
          name: group.baseName,
          subject: group.subject ?? uploadSubject,
          subtopic: group.subtopic,
          pdfWithoutAnswers: `indexeddb:${materialId}-without`,
          pdfWithAnswers: hasPair ? `indexeddb:${materialId}-with` : null,
          totalPages: await getPdfPageCount(primary),
          contentHash: hash,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        // 1件ごとに保存する。途中で失敗してもここまでの分は残る
        current = [material, ...current]
        existingNames.add(material.name)
        setMaterials(current)
        saveMaterials(current)
        addedCount++
      } catch (error) {
        console.error(`Failed to upload ${group.baseName}:`, error)
        failedNames.push(group.baseName)
      }
    }

    setBulkGroups([])
    if (bulkInputRef.current) bulkInputRef.current.value = ""
    setIsBulkUploading(false)

    if (skippedCount > 0 || failedNames.length > 0) {
      const lines = [`${addedCount}件を登録しました`]
      if (skippedCount > 0) {
        lines.push(`${skippedCount}件は登録済みのため飛ばしました`)
      }
      if (failedNames.length > 0) {
        lines.push(
          `${failedNames.length}件は失敗しました:`,
          ...failedNames,
          "もう一度同じファイルを選び直すと、失敗した分だけ登録されます。",
        )
      }
      alert(lines.join("\n"))
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

        {/* 問題バンクカード */}
        <Link href="/materials/questions">
          <Card className="border-blue-200 bg-blue-50/50 hover:bg-blue-50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900">問題バンク</h3>
                  <p className="text-sm text-blue-700">
                    FAR・BAR の四択演習（科目は画面上部で切替）
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  New
                </Badge>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* TBS 問題バンクカード */}
        <Link href="/materials/tbs">
          <Card className="border-purple-200 bg-purple-50/50 hover:bg-purple-50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                  <BookOpen className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-purple-900">FAR TBS 問題バンク</h3>
                  <p className="text-sm text-purple-700">
                    Task Based Simulation — シナリオ形式の演習問題
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 bg-purple-100 text-purple-700">
                  New
                </Badge>
              </div>
            </CardContent>
          </Card>
        </Link>

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
            <Select
              value={filterSubtopic}
              onValueChange={setFilterSubtopic}
            >
              <SelectTrigger className="w-[180px] shrink-0">
                <SelectValue placeholder="テーマで絞り込み" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全テーマ</SelectItem>
                {availableSubtopics.map((subtopic) => (
                  <SelectItem key={subtopic} value={subtopic}>
                    {subtopic}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* アクションボタン */}
          <div className="flex gap-2 shrink-0">
            {materials.length > 0 && (
              <Button
                variant="outline"
                onClick={handleBulkDownload}
                disabled={isBulkDownloading}
              >
                <Download className="h-4 w-4 mr-2" />
                {isBulkDownloading ? "ZIP作成中..." : "一括DL"}
              </Button>
            )}
            <input
              ref={bulkInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={(e) => handleBulkFilesSelected(e.target.files)}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => bulkInputRef.current?.click()}
              disabled={isBulkUploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              一括アップロード
            </Button>
            <Button onClick={() => setShowUploadForm(!showUploadForm)}>
              <Plus className="h-4 w-4 mr-2" />
              アップロード
            </Button>
          </div>
        </div>

        {/* 一括アップロードのプレビュー */}
        {bulkGroups.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                一括アップロード（{bulkGroups.length}件）
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                ファイル名から科目・分野・回答あり版を判定しました。
                科目を判定できなかったものは {uploadSubject} として登録します。
              </p>
              <div className="max-h-80 overflow-y-auto space-y-2">
                {bulkGroups.map((group) => (
                  <div
                    key={group.baseName}
                    className="flex items-center justify-between gap-2 border-b pb-2 text-sm"
                  >
                    <span className="truncate">{group.baseName}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant="outline">
                        {group.subject ?? uploadSubject}
                      </Badge>
                      {group.without && group.with && (
                        <Badge variant="secondary" className="text-xs">
                          回答あり版あり
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={isBulkUploading}
                  onClick={() => {
                    setBulkGroups([])
                    if (bulkInputRef.current) bulkInputRef.current.value = ""
                  }}
                >
                  キャンセル
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleBulkUpload}
                  disabled={isBulkUploading}
                >
                  {isBulkUploading
                    ? `登録中... (${bulkDoneCount}/${bulkGroups.length})`
                    : `${bulkGroups.length}件を登録`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* 選択操作・重複整理 */}
        {filteredMaterials.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={filteredMaterials.every((m) => selectedIds.has(m.id))}
                onChange={(e) => {
                  const checked = e.target.checked
                  setSelectedIds((prev) => {
                    const next = new Set(prev)
                    for (const m of filteredMaterials) {
                      if (checked) next.add(m.id)
                      else next.delete(m.id)
                    }
                    return next
                  })
                }}
                className="h-4 w-4"
              />
              表示中の{filteredMaterials.length}件を選択
            </label>

            {selectedIds.size > 0 && (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteSelectedDialog(true)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  選択した{selectedIds.size}件を削除
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  選択解除
                </Button>
              </>
            )}

            {duplicateGroups.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleDedupe}>
                重複{duplicateGroups.reduce((s, g) => s + g.length - 1, 0)}件を整理
              </Button>
            )}
          </div>
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
                          <input
                            type="checkbox"
                            checked={selectedIds.has(material.id)}
                            onChange={() => {}}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              toggleSelect(material.id)
                            }}
                            className="h-4 w-4 shrink-0 cursor-pointer"
                            aria-label={`${material.name} を選択`}
                          />
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

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          <span>
                            更新: {new Date(material.updatedAt).toLocaleDateString("ja-JP")}
                          </span>
                        </div>
                        <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-muted-foreground hover:text-foreground"
                            disabled={downloadingId === `${material.id}-without`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownload(material, "without")
                            }}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          {material.pdfWithAnswers && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-muted-foreground hover:text-foreground"
                              disabled={downloadingId === `${material.id}-with`}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDownload(material, "with")
                              }}
                            >
                              <Download className="h-3.5 w-3.5 mr-1" />
                              <Eye className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
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
        open={showDeleteSelectedDialog}
        onOpenChange={setShowDeleteSelectedDialog}
        title="選択した教材を削除"
        description={`選択した${selectedIds.size}件の教材とPDFを削除します。元に戻せません。`}
        confirmLabel={`${selectedIds.size}件を削除`}
        variant="destructive"
        onConfirm={handleDeleteSelected}
      />
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
