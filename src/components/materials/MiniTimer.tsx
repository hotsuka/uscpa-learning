"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useTimer } from "@/hooks/useTimer"
import { Play, Pause, Square, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface MiniTimerProps {
  className?: string
}

export function MiniTimer({ className }: MiniTimerProps) {
  const {
    subject,
    displayTime,
    isRunning,
    isPaused,
    isIdle,
    start,
    pause,
    reset,
  } = useTimer()

  return (
    <div className={cn("flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5", className)}>
      {/* 科目バッジ */}
      <Badge variant="outline" className="text-xs">
        {subject}
      </Badge>

      {/* タイマー表示 */}
      <div className="flex items-center gap-1.5">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className={cn(
          "font-mono text-lg font-bold min-w-[80px]",
          isRunning && "text-green-600",
          isPaused && "text-yellow-600"
        )}>
          {displayTime}
        </span>
      </div>

      {/* コントロールボタン */}
      <div className="flex items-center gap-1">
        {isIdle || isPaused ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={start}
            className="h-8 w-8 p-0"
            title={isIdle ? "開始" : "再開"}
          >
            <Play className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={pause}
            className="h-8 w-8 p-0"
            title="一時停止"
          >
            <Pause className="h-4 w-4" />
          </Button>
        )}

        {!isIdle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm("タイマーをリセットしますか？記録は保存されません。")) {
                reset()
              }
            }}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            title="リセット"
          >
            <Square className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
