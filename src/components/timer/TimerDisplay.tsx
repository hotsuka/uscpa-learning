"use client"

import { cn } from "@/lib/utils"

interface TimerDisplayProps {
  time: string
  isBreak?: boolean
  className?: string
}

export function TimerDisplay({ time, isBreak = false, className }: TimerDisplayProps) {
  return (
    <div className={cn("text-center", className)}>
      <div
        className={cn(
          "timer-display text-7xl md:text-8xl font-bold tracking-tight",
          isBreak ? "text-green-500" : "text-foreground"
        )}
      >
        {time}
      </div>
      {isBreak && (
        <p className="text-green-500 text-lg mt-2">休憩中</p>
      )}
    </div>
  )
}
