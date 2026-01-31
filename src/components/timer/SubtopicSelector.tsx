"use client"

import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { type Subject, SUBJECT_SUBTOPICS } from "@/types"
import { useSettingsStore } from "@/stores/settingsStore"

interface SubtopicSelectorProps {
  subject: Subject
  value: string
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
}

const NONE_VALUE = "__none__"
const ADD_NEW_VALUE = "__add_new__"

export function SubtopicSelector({
  subject,
  value,
  onChange,
  className,
  disabled,
}: SubtopicSelectorProps) {
  const presetSubtopics = SUBJECT_SUBTOPICS[subject]
  const customSubtopics = useSettingsStore((s) => s.customSubtopics?.[subject] ?? [])
  const addCustomSubtopic = useSettingsStore((s) => s.addCustomSubtopic)

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newSubtopic, setNewSubtopic] = useState("")
  const [error, setError] = useState<string | null>(null)

  const allSubtopics = [...presetSubtopics, ...customSubtopics]

  const handleChange = (newValue: string) => {
    if (newValue === ADD_NEW_VALUE) {
      // Selectのクローズ後にDialogを開く（フォーカス競合回避）
      requestAnimationFrame(() => setShowAddDialog(true))
      return
    }
    onChange(newValue === NONE_VALUE ? "" : newValue)
  }

  const handleAdd = () => {
    const trimmed = newSubtopic.trim()
    if (!trimmed) {
      setError("テーマ名を入力してください")
      return
    }
    if (allSubtopics.includes(trimmed)) {
      setError("同じ名前のテーマが既に存在します")
      return
    }
    addCustomSubtopic(subject, trimmed)
    onChange(trimmed)
    setNewSubtopic("")
    setError(null)
    setShowAddDialog(false)
  }

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setNewSubtopic("")
      setError(null)
      setShowAddDialog(false)
    }
  }

  return (
    <>
      <Select
        value={value || NONE_VALUE}
        onValueChange={handleChange}
        disabled={disabled}
      >
        <SelectTrigger className={className}>
          <SelectValue placeholder="サブテーマを選択..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>（指定なし）</SelectItem>
          {presetSubtopics.map((subtopic) => (
            <SelectItem key={subtopic} value={subtopic}>
              {subtopic}
            </SelectItem>
          ))}
          {customSubtopics.length > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>カスタムテーマ</SelectLabel>
                {customSubtopics.map((subtopic) => (
                  <SelectItem key={subtopic} value={subtopic}>
                    {subtopic}
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          )}
          <SelectSeparator />
          <SelectItem value={ADD_NEW_VALUE} className="text-primary">
            + 新しいテーマを追加...
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={showAddDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>カスタムテーマを追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              value={newSubtopic}
              onChange={(e) => {
                setNewSubtopic(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleAdd()
                }
              }}
              placeholder="テーマ名を入力..."
              autoFocus
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogClose(false)}>
              キャンセル
            </Button>
            <Button onClick={handleAdd} disabled={!newSubtopic.trim()}>
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
