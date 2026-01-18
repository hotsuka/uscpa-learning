import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Subject, RecordType, StudyRecord } from "@/types"

interface RecordState {
  // 記録データ
  records: StudyRecord[]

  // 今日の学習時間（タイマーから同期、分単位）
  todayStudyMinutes: Record<Subject, number>

  // Notion同期用
  isSyncing: boolean
  lastSyncedAt: string | null
  // ローカルIDとNotionページIDのマッピング
  notionIdMap: Record<string, string>

  // アクション
  addRecord: (record: Omit<StudyRecord, "id" | "createdAt">) => void
  updateRecord: (id: string, updates: Partial<Omit<StudyRecord, "id" | "createdAt">>) => void
  deleteRecord: (id: string) => void
  getRecordById: (id: string) => StudyRecord | undefined
  updateTodayStudyMinutes: (subject: Subject, minutes: number) => void
  addTodayStudyMinutes: (subject: Subject, minutes: number) => void
  resetTodayStudyMinutes: () => void

  // Notion同期アクション
  syncRecordToNotion: (record: StudyRecord) => Promise<string | null>
  fetchRecordsFromNotion: () => Promise<void>
  deleteRecordFromNotion: (id: string) => Promise<void>

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

      // Notion同期用
      isSyncing: false,
      lastSyncedAt: null,
      notionIdMap: {},

      addRecord: (record) => {
        const newRecord: StudyRecord = {
          ...record,
          id: `record-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
        }
        set((state) => ({
          records: [newRecord, ...state.records],
        }))

        // バックグラウンドでNotion同期
        get().syncRecordToNotion(newRecord).catch(console.error)
      },

      updateRecord: (id, updates) => {
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }))

        // NotionページIDがあれば同期
        const notionId = get().notionIdMap[id]
        if (notionId) {
          fetch("/api/notion/records", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: notionId, ...updates }),
          }).catch(console.error)
        }
      },

      deleteRecord: (id) => {
        // Notionから削除
        get().deleteRecordFromNotion(id).catch(console.error)

        set((state) => ({
          records: state.records.filter((r) => r.id !== id),
          notionIdMap: Object.fromEntries(
            Object.entries(state.notionIdMap).filter(([key]) => key !== id)
          ),
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

      // Notion同期アクション
      syncRecordToNotion: async (record) => {
        try {
          const response = await fetch("/api/notion/records", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recordType: record.recordType,
              subject: record.subject,
              subtopic: record.subtopic,
              studyMinutes: record.studyMinutes,
              totalQuestions: record.totalQuestions,
              correctAnswers: record.correctAnswers,
              roundNumber: record.roundNumber,
              chapter: record.chapter,
              pageRange: record.pageRange,
              memo: record.memo,
              studiedAt: record.studiedAt,
            }),
          })

          if (response.ok) {
            const result = await response.json()
            set((state) => ({
              notionIdMap: {
                ...state.notionIdMap,
                [record.id]: result.id,
              },
            }))
            return result.id
          }
          return null
        } catch (error) {
          console.error("Failed to sync record to Notion:", error)
          return null
        }
      },

      fetchRecordsFromNotion: async () => {
        set({ isSyncing: true })

        try {
          const response = await fetch("/api/notion/records")
          if (response.ok) {
            const notionRecords: StudyRecord[] = await response.json()

            // 既存のローカル記録とマージ
            const localRecords = get().records
            const notionIdMap: Record<string, string> = {}

            // NotionのIDをローカルIDとしても使用
            for (const record of notionRecords) {
              notionIdMap[record.id] = record.id
            }

            // ローカルにのみ存在する記録（まだNotion同期されていない）を保持
            const localOnlyRecords = localRecords.filter(
              (local) => !Object.keys(get().notionIdMap).includes(local.id)
            )

            set({
              records: [...notionRecords, ...localOnlyRecords],
              notionIdMap: { ...get().notionIdMap, ...notionIdMap },
              lastSyncedAt: new Date().toISOString(),
            })
          }
        } catch (error) {
          console.error("Failed to fetch records from Notion:", error)
        } finally {
          set({ isSyncing: false })
        }
      },

      deleteRecordFromNotion: async (id) => {
        const notionId = get().notionIdMap[id]
        if (!notionId) return

        try {
          await fetch(`/api/notion/records?id=${notionId}`, {
            method: "DELETE",
          })
        } catch (error) {
          console.error("Failed to delete record from Notion:", error)
        }
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
        notionIdMap: state.notionIdMap,
        lastSyncedAt: state.lastSyncedAt,
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
