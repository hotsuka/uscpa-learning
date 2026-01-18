"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SUBJECTS, SUBJECT_OPTIONS, type Subject } from "@/types"
import { cn } from "@/lib/utils"

interface SubjectSelectorProps {
  value: Subject
  onChange: (value: Subject) => void
  disabled?: boolean
  className?: string
}

export function SubjectSelector({
  value,
  onChange,
  disabled = false,
  className,
}: SubjectSelectorProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as Subject)}
      disabled={disabled}
    >
      <SelectTrigger className={cn("w-[200px]", className)}>
        <SelectValue placeholder="科目を選択" />
      </SelectTrigger>
      <SelectContent>
        {SUBJECT_OPTIONS.map((subject) => (
          <SelectItem key={subject} value={subject}>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-3 h-3 rounded-full",
                  subject === "FAR" && "bg-blue-500",
                  subject === "AUD" && "bg-green-600",
                  subject === "REG" && "bg-purple-500",
                  subject === "BAR" && "bg-orange-500"
                )}
              />
              {SUBJECTS[subject].name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
