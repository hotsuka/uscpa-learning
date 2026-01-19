"use client"

import { useEffect, useCallback, useRef } from "react"
import { useTimerStore } from "@/stores/timerStore"
import { formatTime } from "@/lib/utils"

export function useTimer() {
  const store = useTimerStore()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const {
    subject,
    subtopic,
    mode,
    status,
    elapsedSeconds,
    isBreak,
    pomodoroMinutes,
    breakMinutes,
    totalQuestions,
    correctAnswers,
    memo,
    setSubject,
    setSubtopic,
    setMode,
    setTotalQuestions,
    setCorrectAnswers,
    setMemo,
    resetRecordFields,
    start,
    pause,
    stop,
    reset,
    tick,
    syncElapsed,
  } = store

  // 表示用の秒数を計算
  const displaySeconds = mode === "stopwatch"
    ? elapsedSeconds
    : Math.max(0, (isBreak ? breakMinutes : pomodoroMinutes) * 60 - elapsedSeconds)

  // フォーマット済みの時間
  const displayTime = formatTime(displaySeconds)

  // タイマーのtick処理
  useEffect(() => {
    if (status === "running") {
      intervalRef.current = setInterval(() => {
        tick()
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [status, tick])

  // Page Visibility API でバックグラウンド復帰時に同期
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncElapsed()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [syncElapsed])

  // beforeunload でデータロス防止
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (status === "running") {
        e.preventDefault()
        e.returnValue = "タイマーが動作中です。ページを離れると記録が失われる可能性があります。"
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [status])

  // 停止してセッションデータを返す
  const stopAndGetSession = useCallback(() => {
    return stop()
  }, [stop])

  return {
    // 状態
    subject,
    subtopic,
    mode,
    status,
    elapsedSeconds,
    displaySeconds,
    displayTime,
    isBreak,
    isRunning: status === "running",
    isPaused: status === "paused",
    isIdle: status === "idle",

    // 記録用フィールド
    totalQuestions,
    correctAnswers,
    memo,

    // アクション
    setSubject,
    setSubtopic,
    setMode,
    setTotalQuestions,
    setCorrectAnswers,
    setMemo,
    resetRecordFields,
    start,
    pause,
    stop: stopAndGetSession,
    reset,
  }
}
