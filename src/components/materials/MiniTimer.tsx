"use client"

import { forwardRef, useImperativeHandle, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useTimer } from "@/hooks/useTimer"
import { useRecordStore, checkAndResetDailyMinutes } from "@/stores/recordStore"
import { Play, Pause, Square, Clock, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

// 分を「Xh Xm」形式にフォーマット
function formatMinutesToHoursMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`
  } else if (hours > 0) {
    return `${hours}h`
  } else {
    return `${mins}m`
  }
}

interface MiniTimerProps {
  className?: string
}

// 外部から参照可能なメソッド
export interface MiniTimerRef {
  incrementQuestions: () => void
  decrementQuestions: () => void
  incrementCorrect: () => void
  decrementCorrect: () => void
}

export const MiniTimer = forwardRef<MiniTimerRef, MiniTimerProps>(function MiniTimer({ className }, ref) {
  const {
    subject,
    displayTime,
    isRunning,
    isPaused,
    isIdle,
    elapsedSeconds,
    totalQuestions,
    correctAnswers,
    start,
    pause,
    reset,
    setTotalQuestions,
    setCorrectAnswers,
  } = useTimer()

  // 今日の合計勉強時間（記録済み）- recordsから直接計算
  const recordedTodayMinutes = useRecordStore((state) => {
    const today = new Date().toISOString().split("T")[0]
    const todayRecords = state.records.filter((r) => r.studiedAt === today)
    return todayRecords.reduce((sum, r) => sum + (r.studyMinutes || 0), 0)
  })

  // 現在のセッション時間を分に変換して加算
  const currentSessionMinutes = Math.floor(elapsedSeconds / 60)
  const todayTotalMinutes = recordedTodayMinutes + currentSessionMinutes

  // 日付チェック（日付が変わったらリセット）
  useEffect(() => {
    checkAndResetDailyMinutes()
  }, [])

  // 外部からのアクセス用メソッドを公開
  useImperativeHandle(ref, () => ({
    incrementQuestions: () => {
      const current = Number(totalQuestions) || 0
      setTotalQuestions(String(current + 1))
    },
    decrementQuestions: () => {
      const current = Number(totalQuestions) || 0
      if (current > 0) {
        setTotalQuestions(String(current - 1))
        // 正解数が問題数を超えないように調整
        const correct = Number(correctAnswers) || 0
        if (correct > current - 1) {
          setCorrectAnswers(String(current - 1))
        }
      }
    },
    incrementCorrect: () => {
      const current = Number(correctAnswers) || 0
      const total = Number(totalQuestions) || 0
      // 問題数を超えないように
      if (total === 0 || current < total) {
        setCorrectAnswers(String(current + 1))
      }
    },
    decrementCorrect: () => {
      const current = Number(correctAnswers) || 0
      if (current > 0) {
        setCorrectAnswers(String(current - 1))
      }
    },
  }), [totalQuestions, correctAnswers, setTotalQuestions, setCorrectAnswers])

  return (
    <div className={cn("flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5", className)}>
      {/* 今日の合計勉強時間 */}
      <div className="flex items-center gap-1 text-muted-foreground" title="今日の合計勉強時間">
        <Calendar className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{formatMinutesToHoursMinutes(todayTotalMinutes)}</span>
      </div>

      {/* 区切り線 */}
      <div className="w-px h-5 bg-border" />

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

      {/* 区切り線 */}
      <div className="w-px h-6 bg-border mx-1" />

      {/* 問題数・正解数入力 */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground whitespace-nowrap">問題</span>
          <Input
            type="number"
            min={0}
            value={totalQuestions}
            onChange={(e) => setTotalQuestions(e.target.value)}
            className="w-14 h-7 text-sm px-2"
            placeholder="0"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground whitespace-nowrap">正解</span>
          <Input
            type="number"
            min={0}
            max={totalQuestions ? Number(totalQuestions) : undefined}
            value={correctAnswers}
            onChange={(e) => setCorrectAnswers(e.target.value)}
            className="w-14 h-7 text-sm px-2"
            placeholder="0"
          />
        </div>
        {/* 正答率表示 */}
        {Number(totalQuestions) > 0 && (
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              Number(correctAnswers) / Number(totalQuestions) >= 0.8 && "border-green-500 text-green-600",
              Number(correctAnswers) / Number(totalQuestions) >= 0.6 && Number(correctAnswers) / Number(totalQuestions) < 0.8 && "border-yellow-500 text-yellow-600",
              Number(correctAnswers) / Number(totalQuestions) < 0.6 && "border-red-500 text-red-600"
            )}
          >
            {Math.round((Number(correctAnswers) / Number(totalQuestions)) * 100)}%
          </Badge>
        )}
      </div>
    </div>
  )
})
