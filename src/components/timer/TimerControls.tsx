"use client"

import { Play, Pause, Square, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface TimerControlsProps {
  isRunning: boolean
  isPaused: boolean
  onStart: () => void
  onPause: () => void
  onStop: () => void
  onReset: () => void
  className?: string
}

export function TimerControls({
  isRunning,
  isPaused,
  onStart,
  onPause,
  onStop,
  onReset,
  className,
}: TimerControlsProps) {
  return (
    <div className={cn("flex items-center justify-center gap-4", className)}>
      {!isRunning && !isPaused && (
        <Button
          size="lg"
          onClick={onStart}
          className="h-auto min-w-20 px-6 py-4 rounded-full flex flex-col items-center gap-1"
        >
          <Play className="h-6 w-6" />
          <span className="text-xs font-medium">Start</span>
        </Button>
      )}

      {isRunning && (
        <Button
          size="lg"
          variant="outline"
          onClick={onPause}
          className="h-auto min-w-20 px-6 py-4 rounded-full flex flex-col items-center gap-1"
        >
          <Pause className="h-6 w-6" />
          <span className="text-xs font-medium">Pause</span>
        </Button>
      )}

      {isPaused && (
        <>
          <Button
            size="lg"
            onClick={onStart}
            className="h-auto min-w-20 px-6 py-4 rounded-full flex flex-col items-center gap-1"
          >
            <Play className="h-6 w-6" />
            <span className="text-xs font-medium">Resume</span>
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={onReset}
            className="h-auto min-w-20 px-6 py-4 rounded-full flex flex-col items-center gap-1"
          >
            <RotateCcw className="h-5 w-5" />
            <span className="text-xs font-medium">Reset</span>
          </Button>
        </>
      )}

      {(isRunning || isPaused) && (
        <Button
          size="lg"
          variant="destructive"
          onClick={onStop}
          className="h-auto min-w-20 px-6 py-4 rounded-full flex flex-col items-center gap-1"
        >
          <Square className="h-5 w-5" />
          <span className="text-xs font-medium">Record</span>
        </Button>
      )}
    </div>
  )
}
