"use client"

import { Timer, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TimerMode } from "@/types"
import { cn } from "@/lib/utils"

interface ModeToggleProps {
  mode: TimerMode
  onChange: (mode: TimerMode) => void
  disabled?: boolean
  className?: string
}

export function ModeToggle({
  mode,
  onChange,
  disabled = false,
  className,
}: ModeToggleProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant={mode === "stopwatch" ? "default" : "outline"}
        size="sm"
        onClick={() => onChange("stopwatch")}
        disabled={disabled}
        className="gap-2"
      >
        <Clock className="h-4 w-4" />
        ストップウォッチ
      </Button>
      <Button
        variant={mode === "pomodoro" ? "default" : "outline"}
        size="sm"
        onClick={() => onChange("pomodoro")}
        disabled={disabled}
        className="gap-2"
      >
        <Timer className="h-4 w-4" />
        ポモドーロ
      </Button>
    </div>
  )
}
