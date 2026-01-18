"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { type Subject, SUBJECT_SUBTOPICS } from "@/types"

interface SubtopicSelectorProps {
  subject: Subject
  value: string
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
}

const NONE_VALUE = "__none__"

export function SubtopicSelector({
  subject,
  value,
  onChange,
  className,
  disabled,
}: SubtopicSelectorProps) {
  const subtopics = SUBJECT_SUBTOPICS[subject]

  const handleChange = (newValue: string) => {
    onChange(newValue === NONE_VALUE ? "" : newValue)
  }

  return (
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
        {subtopics.map((subtopic) => (
          <SelectItem key={subtopic} value={subtopic}>
            {subtopic}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
