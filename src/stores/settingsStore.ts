import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Subject } from "@/types"

interface SettingsState {
  // 科目別試験日
  examDates: Record<Subject, string>
  // 科目別目標学習時間（時間）
  subjectTargetHours: Record<Subject, number>
  // 平日・休日の目標学習時間（時間）
  weekdayTargetHours: number
  weekendTargetHours: number
  // ポモドーロ設定
  pomodoroMinutes: number
  breakMinutes: number

  // アクション
  setExamDate: (subject: Subject, date: string) => void
  setSubjectTargetHours: (subject: Subject, hours: number) => void
  setWeekdayTargetHours: (hours: number) => void
  setWeekendTargetHours: (hours: number) => void
  setPomodoroMinutes: (minutes: number) => void
  setBreakMinutes: (minutes: number) => void

  // 計算されたプロパティ用のヘルパー
  getTotalTargetHours: () => number
  getWeeklyTargetMinutes: () => number
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // 初期値
      examDates: {
        FAR: "2026-06-15",
        AUD: "2026-07-20",
        REG: "2026-08-25",
        BAR: "2026-05-10",
      },
      subjectTargetHours: {
        FAR: 400,
        AUD: 250,
        REG: 250,
        BAR: 200,
      },
      weekdayTargetHours: 4,
      weekendTargetHours: 6,
      pomodoroMinutes: 25,
      breakMinutes: 5,

      // アクション
      setExamDate: (subject, date) => {
        set((state) => ({
          examDates: { ...state.examDates, [subject]: date },
        }))
      },

      setSubjectTargetHours: (subject, hours) => {
        set((state) => ({
          subjectTargetHours: { ...state.subjectTargetHours, [subject]: hours },
        }))
      },

      setWeekdayTargetHours: (hours) => {
        set({ weekdayTargetHours: hours })
      },

      setWeekendTargetHours: (hours) => {
        set({ weekendTargetHours: hours })
      },

      setPomodoroMinutes: (minutes) => {
        set({ pomodoroMinutes: minutes })
      },

      setBreakMinutes: (minutes) => {
        set({ breakMinutes: minutes })
      },

      // 合計目標時間を計算
      getTotalTargetHours: () => {
        const { subjectTargetHours } = get()
        return Object.values(subjectTargetHours).reduce((sum, hours) => sum + hours, 0)
      },

      // 週間目標時間を分単位で計算（平日5日×平日時間 + 土日2日×休日時間）
      // 祝日は別途holidays.tsで計算するため、ここでは標準週として計算
      getWeeklyTargetMinutes: () => {
        const { weekdayTargetHours, weekendTargetHours } = get()
        return (weekdayTargetHours * 5 + weekendTargetHours * 2) * 60
      },
    }),
    {
      name: "uscpa-settings",
    }
  )
)
