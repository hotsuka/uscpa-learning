import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Subject, RecordType, StudyRecord, RecordSource } from "@/types"
import { generateUUID, getDeviceId } from "@/lib/utils"

// 記録作成時の入力データ（source, sessionIdを含む）
interface RecordInput {
  recordType: RecordType
  subject: Subject
  subtopic: string | null
  studyMinutes: number
  totalQuestions: number | null
  correctAnswers: number | null
  roundNumber: number | null
  chapter: string | null
  pageRange: string | null
  studiedAt: string
  memo: string | null
  // 監査証跡用（v1.11追加）
  source?: RecordSource  // デフォルトは "manual"
  sessionId?: string | null  // タイマーからの記録時に設定
}

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
  addRecord: (record: RecordInput) => void
  updateRecord: (id: string, updates: Partial<Omit<StudyRecord, "id" | "createdAt" | "deviceId" | "source" | "sessionId">>) => void
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
        const now = new Date().toISOString()
        const newRecord: StudyRecord = {
          ...record,
          id: generateUUID(),
          source: record.source ?? "manual",
          sessionId: record.sessionId ?? null,
          deviceId: getDeviceId(),
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({
          records: [newRecord, ...state.records],
        }))

        // バックグラウンドでNotion同期
        get().syncRecordToNotion(newRecord).catch(console.error)
      },

      updateRecord: (id, updates) => {
        const updatedAt = new Date().toISOString()
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt } : r
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
              recordId: record.id,
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
              // 監査証跡用（v1.11追加）
              source: record.source,
              sessionId: record.sessionId,
              deviceId: record.deviceId,
              createdAt: record.createdAt,
              updatedAt: record.updatedAt,
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

            // 既存のローカル記録とマージ（Last-Write-Wins戦略）
            const localRecords = get().records
            const existingNotionIdMap = get().notionIdMap
            const newNotionIdMap: Record<string, string> = { ...existingNotionIdMap }

            // NotionレコードのIDでマップを作成
            const notionRecordMap = new Map<string, StudyRecord>()
            for (const record of notionRecords) {
              notionRecordMap.set(record.id, record)
              newNotionIdMap[record.id] = record.id
            }

            // マージされた記録リスト
            const mergedRecords: StudyRecord[] = []

            // ローカル記録を処理
            for (const localRecord of localRecords) {
              const notionId = existingNotionIdMap[localRecord.id]
              if (notionId && notionRecordMap.has(notionId)) {
                // Notionにも存在する → updatedAtで比較（Last-Write-Wins）
                const notionRecord = notionRecordMap.get(notionId)!
                const localUpdated = new Date(localRecord.updatedAt).getTime()
                const notionUpdated = new Date(notionRecord.updatedAt).getTime()

                if (localUpdated >= notionUpdated) {
                  // ローカルが新しい → ローカルを採用
                  mergedRecords.push(localRecord)
                } else {
                  // Notionが新しい → Notionを採用
                  mergedRecords.push(notionRecord)
                }
                // 処理済みとしてマークからNotionレコードを削除
                notionRecordMap.delete(notionId)
              } else {
                // まだNotion同期されていないローカル記録、または
                // notionIdマッピングがあるがNotion側にない場合 → ローカルを保持
                // （ローカルデータを優先保護）
                mergedRecords.push(localRecord)
              }
            }

            // Notionにのみ存在する記録を追加
            for (const notionRecord of notionRecordMap.values()) {
              mergedRecords.push(notionRecord)
            }

            // 日付の新しい順にソート
            mergedRecords.sort((a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )

            set({
              records: mergedRecords,
              notionIdMap: newNotionIdMap,
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

      // 今日の全科目合計（分単位）- recordsから計算
      getTodayTotalMinutes: () => {
        const today = new Date().toISOString().split("T")[0]
        const todayRecords = get().records.filter((r) => r.studiedAt === today)
        return todayRecords.reduce((sum, r) => sum + (r.studyMinutes || 0), 0)
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
