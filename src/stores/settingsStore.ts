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
  // カスタムサブテーマ
  customSubtopics: Record<Subject, string[]>

  // Notion同期用
  notionPageId: string | null
  lastSyncedAt: string | null
  isSyncing: boolean

  // アクション
  setExamDate: (subject: Subject, date: string) => void
  setSubjectTargetHours: (subject: Subject, hours: number) => void
  setWeekdayTargetHours: (hours: number) => void
  setWeekendTargetHours: (hours: number) => void
  setPomodoroMinutes: (minutes: number) => void
  setBreakMinutes: (minutes: number) => void
  addCustomSubtopic: (subject: Subject, subtopic: string) => void
  removeCustomSubtopic: (subject: Subject, subtopic: string) => void

  // Notion同期アクション
  setNotionPageId: (id: string | null) => void
  syncToNotion: () => Promise<void>
  fetchFromNotion: () => Promise<void>

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
      customSubtopics: {
        FAR: [],
        AUD: [],
        REG: [],
        BAR: [],
      },

      // Notion同期用
      notionPageId: null,
      lastSyncedAt: null,
      isSyncing: false,

      // アクション
      setExamDate: (subject, date) => {
        set((state) => ({
          examDates: { ...state.examDates, [subject]: date },
        }))
        // 自動同期（バックグラウンド）
        get().syncToNotion().catch(console.error)
      },

      setSubjectTargetHours: (subject, hours) => {
        set((state) => ({
          subjectTargetHours: { ...state.subjectTargetHours, [subject]: hours },
        }))
        get().syncToNotion().catch(console.error)
      },

      setWeekdayTargetHours: (hours) => {
        set({ weekdayTargetHours: hours })
        get().syncToNotion().catch(console.error)
      },

      setWeekendTargetHours: (hours) => {
        set({ weekendTargetHours: hours })
        get().syncToNotion().catch(console.error)
      },

      setPomodoroMinutes: (minutes) => {
        set({ pomodoroMinutes: minutes })
      },

      setBreakMinutes: (minutes) => {
        set({ breakMinutes: minutes })
      },

      addCustomSubtopic: (subject, subtopic) => {
        set((state) => {
          const existing = state.customSubtopics[subject] || []
          if (existing.includes(subtopic)) return state
          return {
            customSubtopics: {
              ...state.customSubtopics,
              [subject]: [...existing, subtopic],
            },
          }
        })
      },

      removeCustomSubtopic: (subject, subtopic) => {
        set((state) => ({
          customSubtopics: {
            ...state.customSubtopics,
            [subject]: (state.customSubtopics[subject] || []).filter(
              (s) => s !== subtopic
            ),
          },
        }))
      },

      // Notion同期アクション
      setNotionPageId: (id) => {
        set({ notionPageId: id })
      },

      syncToNotion: async () => {
        const state = get()
        if (state.isSyncing) return

        set({ isSyncing: true })

        try {
          // Notionの設定DBスキーマに合わせてデータを変換
          // totalTargetHours = 科目別目標時間の合計
          const totalTargetHours = Object.values(state.subjectTargetHours).reduce(
            (sum, hours) => sum + hours,
            0
          )

          const data = {
            name: "マイ設定",
            totalTargetHours,
            examDates: state.examDates,
          }

          if (state.notionPageId) {
            // 更新
            await fetch("/api/notion/settings", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: state.notionPageId, ...data }),
            })
          } else {
            // 新規作成
            const response = await fetch("/api/notion/settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            })
            if (response.ok) {
              const result = await response.json()
              set({ notionPageId: result.id })
            }
          }

          set({ lastSyncedAt: new Date().toISOString() })
        } catch (error) {
          console.error("Failed to sync settings to Notion:", error)
        } finally {
          set({ isSyncing: false })
        }
      },

      fetchFromNotion: async () => {
        set({ isSyncing: true })

        try {
          const response = await fetch("/api/notion/settings")
          if (response.ok) {
            const data = await response.json()
            // Notionから取得した試験日をローカルに反映
            // totalTargetHoursはNotionの目標学習時間（合計）
            // 科目別の時間はローカルで管理するため、ここでは更新しない
            set({
              notionPageId: data.id,
              examDates: {
                FAR: data.examDates?.FAR || "",
                AUD: data.examDates?.AUD || "",
                REG: data.examDates?.REG || "",
                BAR: data.examDates?.BAR || "",
              },
              lastSyncedAt: new Date().toISOString(),
            })
          }
        } catch (error) {
          console.error("Failed to fetch settings from Notion:", error)
        } finally {
          set({ isSyncing: false })
        }
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
      partialize: (state) => ({
        examDates: state.examDates,
        subjectTargetHours: state.subjectTargetHours,
        weekdayTargetHours: state.weekdayTargetHours,
        weekendTargetHours: state.weekendTargetHours,
        pomodoroMinutes: state.pomodoroMinutes,
        breakMinutes: state.breakMinutes,
        customSubtopics: state.customSubtopics,
        notionPageId: state.notionPageId,
        lastSyncedAt: state.lastSyncedAt,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as object),
        customSubtopics: {
          FAR: [],
          AUD: [],
          REG: [],
          BAR: [],
          ...((persisted as Record<string, unknown>)?.customSubtopics as Record<string, string[]> || {}),
        },
      }),
    }
  )
)
