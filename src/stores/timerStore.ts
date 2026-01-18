import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Subject, TimerMode, TimerStatus } from "@/types"

interface TimerState {
  // 設定
  subject: Subject
  subtopic: string | null
  mode: TimerMode
  pomodoroMinutes: number
  breakMinutes: number

  // 状態
  status: TimerStatus
  startTime: number | null
  elapsedSeconds: number
  isBreak: boolean

  // アクション
  setSubject: (subject: Subject) => void
  setSubtopic: (subtopic: string | null) => void
  setMode: (mode: TimerMode) => void
  start: () => void
  pause: () => void
  stop: () => { subject: Subject; subtopic: string | null; durationSeconds: number; startTime: number; endTime: number } | null
  reset: () => void
  tick: () => void
  syncElapsed: () => void
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      // 初期設定
      subject: "FAR",
      subtopic: null,
      mode: "stopwatch",
      pomodoroMinutes: 25,
      breakMinutes: 5,

      // 初期状態
      status: "idle",
      startTime: null,
      elapsedSeconds: 0,
      isBreak: false,

      setSubject: (subject) => {
        const { status } = get()
        if (status === "idle") {
          set({ subject, subtopic: null }) // 科目変更時にサブテーマをリセット
        }
      },

      setSubtopic: (subtopic) => {
        const { status } = get()
        if (status === "idle") {
          set({ subtopic })
        }
      },

      setMode: (mode) => {
        const { status } = get()
        if (status === "idle") {
          set({ mode, elapsedSeconds: 0, isBreak: false })
        }
      },

      start: () => {
        const { status, startTime, elapsedSeconds } = get()
        if (status === "running") return

        const now = Date.now()
        // pauseから再開の場合は、経過時間を考慮してstartTimeを調整
        const newStartTime = startTime
          ? now - elapsedSeconds * 1000
          : now

        set({
          status: "running",
          startTime: newStartTime,
        })
      },

      pause: () => {
        const { status, startTime } = get()
        if (status !== "running" || !startTime) return

        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        set({
          status: "paused",
          elapsedSeconds: elapsed,
        })
      },

      stop: () => {
        const { status, startTime, subject, subtopic, elapsedSeconds } = get()
        if (status === "idle" || !startTime) return null

        const endTime = Date.now()
        const finalElapsed = status === "running"
          ? Math.floor((endTime - startTime) / 1000)
          : elapsedSeconds

        // 状態をリセット
        set({
          status: "idle",
          startTime: null,
          elapsedSeconds: 0,
          isBreak: false,
        })

        // 1分未満は記録しない
        if (finalElapsed < 60) return null

        return {
          subject,
          subtopic,
          durationSeconds: finalElapsed,
          startTime,
          endTime,
        }
      },

      reset: () => {
        set({
          status: "idle",
          startTime: null,
          elapsedSeconds: 0,
          isBreak: false,
        })
      },

      tick: () => {
        const { status, startTime, mode, pomodoroMinutes, breakMinutes, isBreak } = get()
        if (status !== "running" || !startTime) return

        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        set({ elapsedSeconds: elapsed })

        // ポモドーロモードの完了チェック
        if (mode === "pomodoro") {
          const limit = isBreak ? breakMinutes * 60 : pomodoroMinutes * 60
          if (elapsed >= limit) {
            if (!isBreak) {
              // 作業完了 → 休憩開始
              set({
                isBreak: true,
                startTime: Date.now(),
                elapsedSeconds: 0,
              })
            } else {
              // 休憩完了 → 停止
              set({
                status: "idle",
                startTime: null,
                elapsedSeconds: 0,
                isBreak: false,
              })
            }
          }
        }
      },

      // ブラウザ復帰時に経過時間を同期
      syncElapsed: () => {
        const { status, startTime } = get()
        if (status === "running" && startTime) {
          const elapsed = Math.floor((Date.now() - startTime) / 1000)
          set({ elapsedSeconds: elapsed })
        }
      },
    }),
    {
      name: "uscpa-timer",
      partialize: (state) => ({
        subject: state.subject,
        subtopic: state.subtopic,
        mode: state.mode,
        status: state.status,
        startTime: state.startTime,
        elapsedSeconds: state.elapsedSeconds,
        isBreak: state.isBreak,
      }),
    }
  )
)
