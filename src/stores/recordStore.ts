import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Subject, RecordType, StudyRecord } from "@/types"

interface RecordState {
  // 記録データ
  records: StudyRecord[]

  // 今日の学習時間（タイマーから同期、分単位）
  todayStudyMinutes: Record<Subject, number>

  // アクション
  addRecord: (record: Omit<StudyRecord, "id" | "createdAt">) => void
  updateRecord: (id: string, updates: Partial<Omit<StudyRecord, "id" | "createdAt">>) => void
  deleteRecord: (id: string) => void
  getRecordById: (id: string) => StudyRecord | undefined
  updateTodayStudyMinutes: (subject: Subject, minutes: number) => void
  addTodayStudyMinutes: (subject: Subject, minutes: number) => void
  resetTodayStudyMinutes: () => void

  // 集計
  getTotalStudyHours: (subject: Subject) => number
  getTodayTotalMinutes: () => number
  getSubjectTodayMinutes: (subject: Subject) => number
}

export const useRecordStore = create<RecordState>()(
  persist(
    (set, get) => ({
      records: [],
      todayStudyMinutes: {
        FAR: 0,
        AUD: 0,
        REG: 0,
        BAR: 0,
      },

      addRecord: (record) => {
        const newRecord: StudyRecord = {
          ...record,
          id: `record-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
        }
        set((state) => ({
          records: [newRecord, ...state.records],
        }))
      },

      updateRecord: (id, updates) => {
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }))
      },

      deleteRecord: (id) => {
        set((state) => ({
          records: state.records.filter((r) => r.id !== id),
        }))
      },

      getRecordById: (id) => {
        return get().records.find((r) => r.id === id)
      },

      updateTodayStudyMinutes: (subject, minutes) => {
        set((state) => ({
          todayStudyMinutes: {
            ...state.todayStudyMinutes,
            [subject]: minutes,
          },
        }))
      },

      addTodayStudyMinutes: (subject, minutes) => {
        set((state) => ({
          todayStudyMinutes: {
            ...state.todayStudyMinutes,
            [subject]: state.todayStudyMinutes[subject] + minutes,
          },
        }))
      },

      resetTodayStudyMinutes: () => {
        set({
          todayStudyMinutes: {
            FAR: 0,
            AUD: 0,
            REG: 0,
            BAR: 0,
          },
        })
      },

      // 科目別の累計学習時間（時間単位）
      getTotalStudyHours: (subject) => {
        const records = get().records.filter((r) => r.subject === subject)
        const totalMinutes = records.reduce((sum, r) => sum + (r.studyMinutes || 0), 0)
        return Math.round(totalMinutes / 60 * 10) / 10 // 小数点1桁
      },

      // 今日の全科目合計（分単位）
      getTodayTotalMinutes: () => {
        const todayMinutes = get().todayStudyMinutes
        return Object.values(todayMinutes).reduce((sum, m) => sum + m, 0)
      },

      // 科目別の今日の学習時間（分単位）
      getSubjectTodayMinutes: (subject) => {
        return get().todayStudyMinutes[subject]
      },
    }),
    {
      name: "uscpa-records",
      partialize: (state) => ({
        records: state.records,
        todayStudyMinutes: state.todayStudyMinutes,
      }),
    }
  )
)

// 日付が変わったかチェックして、変わっていたらリセットする
export function checkAndResetDailyMinutes() {
  const lastDate = localStorage.getItem("uscpa-last-study-date")
  const today = new Date().toISOString().split("T")[0]

  if (lastDate !== today) {
    useRecordStore.getState().resetTodayStudyMinutes()
    localStorage.setItem("uscpa-last-study-date", today)
  }
}
