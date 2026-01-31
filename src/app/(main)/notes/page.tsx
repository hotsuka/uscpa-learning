"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/common/EmptyState"
import { Input } from "@/components/ui/input"
import { SUBJECTS, type Subject } from "@/types"
import { formatDate } from "@/lib/utils"
import { useNotesStore } from "@/stores/notesStore"
import {
  Plus,
  Search,
  FileText,
  Calendar,
  Tag,
  X,
} from "lucide-react"

export default function NotesPage() {
  const { notes } = useNotesStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSubject, setSelectedSubject] = useState<Subject | "all">("all")
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  // 全ノートから使用されているタグを抽出
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    notes.forEach((note) => {
      note.tags.forEach((tag) => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [notes])

  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      const matchesSearch =
        searchQuery === "" ||
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (note.content?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        note.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesSubject =
        selectedSubject === "all" || note.subject === selectedSubject

      const matchesTag =
        selectedTag === null || note.tags.includes(selectedTag)

      return matchesSearch && matchesSubject && matchesTag
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [notes, searchQuery, selectedSubject, selectedTag])

  // タグをクリックしてフィルタリング
  const handleTagClick = (tag: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedTag(selectedTag === tag ? null : tag)
  }

  return (
    <>
      <Header title="学習ノート" />
      <div className="p-4 md:p-8 space-y-6">
        {/* 検索とフィルター */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="タイトル、内容、タグで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedSubject === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedSubject("all")}
            >
              すべて
            </Button>
            {(Object.keys(SUBJECTS) as Subject[]).map((subject) => (
              <Button
                key={subject}
                variant={selectedSubject === subject ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSubject(subject)}
              >
                {subject}
              </Button>
            ))}
          </div>
        </div>

        {/* タグフィルター */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">タグ:</span>
            {allTags.map((tag) => (
              <Badge
                key={tag}
                variant={selectedTag === tag ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary/80 hover:text-primary-foreground transition-colors"
                onClick={(e) => handleTagClick(tag, e)}
              >
                <Tag className="h-3 w-3 mr-1" />
                {tag}
                {selectedTag === tag && (
                  <X className="h-3 w-3 ml-1" />
                )}
              </Badge>
            ))}
            {selectedTag && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setSelectedTag(null)}
              >
                クリア
              </Button>
            )}
          </div>
        )}

        {/* 新規作成ボタン */}
        <Link href="/notes/new">
          <Button className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            新規ノート作成
          </Button>
        </Link>

        {/* ノート一覧 */}
        {filteredNotes.length === 0 ? (
          <Card>
            <CardContent className="text-center">
              <EmptyState
                message={
                  searchQuery || selectedSubject !== "all"
                    ? "条件に一致するノートがありません"
                    : "ノートがまだありません"
                }
                icon={FileText}
              >
                {!searchQuery && selectedSubject === "all" && (
                  <Link href="/notes/new">
                    <Button variant="link" className="mt-2">
                      最初のノートを作成
                    </Button>
                  </Link>
                )}
              </EmptyState>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredNotes.map((note) => {
              const subjectInfo = note.subject ? SUBJECTS[note.subject] : null
              return (
                <Link key={note.id} href={`/notes/${note.id}`}>
                  <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium line-clamp-2">{note.title}</h3>
                        {subjectInfo && (
                          <Badge
                            style={{
                              backgroundColor: subjectInfo.lightColor,
                              color: subjectInfo.color,
                            }}
                            className="shrink-0"
                          >
                            {note.subject}
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {note.content ?? ""}
                      </p>

                      {note.tags.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {note.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant={selectedTag === tag ? "default" : "outline"}
                              className="text-xs cursor-pointer hover:bg-primary/80 hover:text-primary-foreground"
                              onClick={(e) => handleTagClick(tag, e)}
                            >
                              <Tag className="h-3 w-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center text-xs text-muted-foreground pt-2 border-t">
                        <Calendar className="h-3 w-3 mr-1" />
                        <span>更新: {formatDate(note.updatedAt)}</span>
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
