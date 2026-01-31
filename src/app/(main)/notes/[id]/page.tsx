"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/common/EmptyState"
import { ConfirmDialog } from "@/components/common/ConfirmDialog"
import { SubjectSelector } from "@/components/timer/SubjectSelector"
import { MarkdownPreview } from "@/components/notes/MarkdownPreview"
import { useNotesStore } from "@/stores/notesStore"
import { noteSchema } from "@/lib/validations/note"
import { SUBJECTS, type Subject } from "@/types"
import { formatDate } from "@/lib/utils"
import {
  Pencil,
  Save,
  X,
  Plus,
  Trash2,
  Calendar,
  Tag,
  FileText,
} from "lucide-react"

export default function NoteDetailPage() {
  const router = useRouter()
  const params = useParams()
  const noteId = params.id as string
  const { getNoteById, updateNote, deleteNote } = useNotesStore()

  const note = getNoteById(noteId)
  const [isEditing, setIsEditing] = useState(false)
  const [editedTitle, setEditedTitle] = useState("")
  const [editedContent, setEditedContent] = useState("")
  const [editedSubject, setEditedSubject] = useState<Subject>("FAR")
  const [editedTags, setEditedTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // ノートデータを編集用ステートに設定
  useEffect(() => {
    if (note) {
      setEditedTitle(note.title)
      setEditedContent(note.content ?? "")
      setEditedSubject(note.subject ?? "FAR")
      setEditedTags([...note.tags])
    }
  }, [note])

  // ノートが見つからない場合
  if (!note) {
    return (
      <>
        <Header title="ノート詳細" />
        <div className="p-4 md:p-8">
          <div className="max-w-3xl mx-auto">
            <Card>
              <CardContent className="text-center">
                <EmptyState message="ノートが見つかりません" icon={FileText}>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => router.push("/notes")}
                  >
                    ノート一覧に戻る
                  </Button>
                </EmptyState>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    )
  }

  const subjectInfo = note.subject ? SUBJECTS[note.subject] : null

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim()
    if (trimmedTag && !editedTags.includes(trimmedTag)) {
      setEditedTags([...editedTags, trimmedTag])
      setTagInput("")
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setEditedTags(editedTags.filter((tag) => tag !== tagToRemove))
  }

  const handleSave = async () => {
    setValidationError(null)

    const input = {
      title: editedTitle,
      content: editedContent,
      subject: editedSubject,
      tags: editedTags,
    }

    const result = noteSchema.safeParse(input)
    if (!result.success) {
      setValidationError(result.error.errors[0]?.message || "入力内容に誤りがあります")
      return
    }

    setIsSaving(true)
    updateNote(noteId, input)
    setIsEditing(false)
    setIsSaving(false)
  }

  const handleDelete = () => {
    deleteNote(noteId)
    router.push("/notes")
  }

  const handleCancel = () => {
    setEditedTitle(note.title)
    setEditedContent(note.content ?? "")
    setEditedSubject(note.subject ?? "FAR")
    setEditedTags([...note.tags])
    setIsEditing(false)
  }

  return (
    <>
      <Header title={isEditing ? "ノート編集" : "ノート詳細"} />
      <div className="p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                {isEditing ? (
                  <Input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="text-xl font-bold"
                  />
                ) : (
                  <CardTitle className="text-xl">{note.title}</CardTitle>
                )}
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancel}
                      >
                        <X className="h-4 w-4 mr-1" />
                        キャンセル
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={isSaving}>
                        <Save className="h-4 w-4 mr-1" />
                        {isSaving ? "保存中..." : "保存"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        編集
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowDeleteDialog(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        削除
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* メタ情報 */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-4">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Label>科目:</Label>
                    <SubjectSelector
                      value={editedSubject}
                      onChange={(subject) => setEditedSubject(subject)}
                    />
                  </div>
                ) : (
                  subjectInfo && (
                    <Badge
                      style={{
                        backgroundColor: subjectInfo.lightColor,
                        color: subjectInfo.color,
                      }}
                    >
                      {note.subject}
                    </Badge>
                  )
                )}

                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  作成: {formatDate(note.createdAt)}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  更新: {formatDate(note.updatedAt)}
                </div>
              </div>

              {/* タグ */}
              <div className="mt-4">
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleAddTag()
                          }
                        }}
                        placeholder="タグを追加"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddTag}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {editedTags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => handleRemoveTag(tag)}
                        >
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                          <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {note.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )
                )}
              </div>
            </CardHeader>

            {isEditing && validationError && (
              <div className="px-6 pb-2">
                <p className="text-sm text-destructive">{validationError}</p>
              </div>
            )}

            <CardContent>
              {isEditing ? (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Markdown形式で入力できます（# 見出し、**太字**、- リスト など）
                  </Label>
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="flex min-h-[400px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono"
                    placeholder="ノートの内容を入力...&#10;&#10;# 見出し1&#10;## 見出し2&#10;&#10;- リスト項目1&#10;- リスト項目2&#10;&#10;**太字** や *イタリック* も使えます"
                  />
                </div>
              ) : (
                <MarkdownPreview content={note.content ?? ""} />
              )}
            </CardContent>
          </Card>

          {/* 戻るボタン */}
          <div className="mt-6">
            <Button variant="outline" onClick={() => router.push("/notes")}>
              ノート一覧に戻る
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="ノートを削除"
        description="このノートを削除しますか？"
        confirmLabel="削除"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  )
}
