"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubjectSelector } from "@/components/timer/SubjectSelector"
import { MarkdownPreview } from "@/components/notes/MarkdownPreview"
import { useNotesStore } from "@/stores/notesStore"
import type { Subject } from "@/types"
import { X, Plus, Eye, Edit } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { noteSchema } from "@/lib/validations/note"

export default function NewNotePage() {
  const router = useRouter()
  const { addNote } = useNotesStore()
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [subject, setSubject] = useState<Subject>("FAR")
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim()
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag])
      setTagInput("")
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    const input = { title, content, subject, tags }
    const result = noteSchema.safeParse(input)
    if (!result.success) {
      setValidationError(result.error.errors[0]?.message || "入力内容に誤りがあります")
      return
    }

    setIsSubmitting(true)
    addNote(input)
    router.push("/notes")
  }

  return (
    <>
      <Header title="新規ノート" />
      <div className="p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>学習ノートを作成</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">タイトル</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例: Revenue Recognition (ASC 606)"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>科目</Label>
                  <SubjectSelector
                    value={subject}
                    onChange={setSubject}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label>内容</Label>
                  <Tabs defaultValue="edit" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="edit" className="flex items-center gap-1">
                        <Edit className="h-4 w-4" />
                        編集
                      </TabsTrigger>
                      <TabsTrigger value="preview" className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        プレビュー
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="edit" className="mt-2">
                      <div className="space-y-1">
                        <textarea
                          id="content"
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          placeholder="ノートの内容を入力...&#10;&#10;# 見出し1&#10;## 見出し2&#10;&#10;- リスト項目1&#10;- リスト項目2&#10;&#10;**太字** や *イタリック* も使えます"
                          className="flex min-h-[250px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Markdown形式で入力できます（# 見出し、**太字**、- リスト など）
                        </p>
                      </div>
                    </TabsContent>
                    <TabsContent value="preview" className="mt-2">
                      <div className="min-h-[250px] rounded-md border border-input bg-background p-4">
                        <MarkdownPreview content={content} />
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="space-y-2">
                  <Label>タグ</Label>
                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="タグを入力してEnter"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddTag}
                      disabled={!tagInput.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => handleRemoveTag(tag)}
                        >
                          {tag}
                          <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    タグをクリックすると削除できます
                  </p>
                </div>

                {validationError && (
                  <p className="text-sm text-destructive">{validationError}</p>
                )}

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.back()}
                  >
                    キャンセル
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={!title || !content || isSubmitting}
                  >
                    {isSubmitting ? "保存中..." : "保存"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
