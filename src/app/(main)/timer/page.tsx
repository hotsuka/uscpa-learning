"use client"

import { useEffect } from "react"
import { useTimer } from "@/hooks/useTimer"
import { Header } from "@/components/layout/Header"
import { Card, CardContent } from "@/components/ui/card"
import {
  TimerDisplay,
  TimerControls,
  SubjectSelector,
  SubtopicSelector,
  ModeToggle,
} from "@/components/timer"
import { formatMinutes } from "@/lib/utils"
import { SUBJECTS } from "@/types"
import { useRecordStore, checkAndResetDailyMinutes } from "@/stores/recordStore"

export default function TimerPage() {
  const {
    subject,
    subtopic,
    mode,
    displayTime,
    isBreak,
    isRunning,
    isPaused,
    isIdle,
    elapsedSeconds,
    setSubject,
    setSubtopic,
    setMode,
    start,
    pause,
    stop,
    reset,
  } = useTimer()

  const { addTodayStudyMinutes, getTodayTotalMinutes } = useRecordStore()

  // 日付チェック（日付が変わっていたらリセット）
  useEffect(() => {
    checkAndResetDailyMinutes()
  }, [])

  // 今日の全科目の学習時間
  const todayTotalMinutes = getTodayTotalMinutes()

  const handleStop = async () => {
    const session = stop()
    if (session) {
      // 記録ストアに今日の学習時間を追加
      const minutes = Math.floor(session.durationSeconds / 60)
      addTodayStudyMinutes(session.subject, minutes)

      // Notionにセッションを保存（バックグラウンド）
      fetch("/api/notion/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: session.subject,
          subtopic: session.subtopic,
          studyMinutes: minutes,
          startedAt: new Date(session.startTime).toISOString(),
          endedAt: new Date(session.endTime).toISOString(),
        }),
      }).catch((error) => {
        console.error("Failed to save session to Notion:", error)
      })

      const subtopicText = session.subtopic ? ` (${session.subtopic})` : ""
      alert(
        `${SUBJECTS[session.subject].name}${subtopicText}の学習を記録しました\n` +
        `学習時間: ${formatMinutes(minutes)}`
      )
    }
  }

  return (
    <>
      <Header title="タイマー" />
      <div className="p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* モード切替 */}
          <div className="flex justify-center">
            <ModeToggle
              mode={mode}
              onChange={setMode}
              disabled={!isIdle}
            />
          </div>

          {/* 科目・サブテーマ選択 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <SubjectSelector
              value={subject}
              onChange={setSubject}
              disabled={!isIdle}
            />
            <SubtopicSelector
              subject={subject}
              value={subtopic ?? ""}
              onChange={(value) => setSubtopic(value || null)}
              disabled={!isIdle}
              className="w-full sm:w-[200px]"
            />
          </div>

          {/* 現在の選択表示 */}
          <div className="text-center">
            <span className="text-sm text-muted-foreground">
              {SUBJECTS[subject].name}
              {subtopic && <span className="ml-2">/ {subtopic}</span>}
            </span>
          </div>

          {/* タイマー表示 */}
          <Card className="border-2">
            <CardContent className="py-12">
              <TimerDisplay
                time={displayTime}
                isBreak={isBreak}
              />
            </CardContent>
          </Card>

          {/* コントロール */}
          <TimerControls
            isRunning={isRunning}
            isPaused={isPaused}
            onStart={start}
            onPause={pause}
            onStop={handleStop}
            onReset={reset}
          />

          {/* 今日の累計 */}
          <Card>
            <CardContent className="py-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">今日の学習時間（タイマー累計）</p>
                <p className="text-2xl font-bold mt-1">
                  {formatMinutes(todayTotalMinutes + Math.floor(elapsedSeconds / 60))}
                </p>
                {todayTotalMinutes > 0 && elapsedSeconds > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    (記録済み: {formatMinutes(todayTotalMinutes)} + 現在: {formatMinutes(Math.floor(elapsedSeconds / 60))})
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 使い方ヒント */}
          {isIdle && (
            <div className="text-center text-sm text-muted-foreground">
              <p>科目とサブテーマを選択して、スタートボタンを押してください</p>
              <p className="mt-1">
                ポモドーロモード: 25分作業 → 5分休憩
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
