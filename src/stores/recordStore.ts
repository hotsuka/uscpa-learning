import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Subject, RecordType, StudyRecord, RecordSource } from "@/types";
import { generateUUID, getDeviceId, getJSTDateString } from "@/lib/utils";
import { mergeNotionRecords } from "@/lib/sync/mergeRecords";
import { planNotionPush, type NotionPushPlan } from "@/lib/sync/pushPlan";

// 記録作成時の入力データ（source, sessionIdを含む）
interface RecordInput {
  recordType: RecordType;
  subject: Subject;
  subtopic: string | null;
  studyMinutes: number;
  totalQuestions: number | null;
  correctAnswers: number | null;
  roundNumber: number | null;
  chapter: string | null;
  pageRange: string | null;
  studiedAt: string;
  memo: string | null;
  fromQuestionBank?: boolean; // 問題バンクからの演習か
  // 監査証跡用（v1.11追加）
  source?: RecordSource; // デフォルトは "manual"
  sessionId?: string | null; // タイマーからの記録時に設定
}

interface RecordState {
  // 記録データ
  records: StudyRecord[];

  // 今日の学習時間（タイマーから同期、分単位）
  todayStudyMinutes: Record<Subject, number>;

  // Notion同期用
  isSyncing: boolean;
  lastSyncedAt: string | null;
  // ローカルIDとNotionページIDのマッピング
  notionIdMap: Record<string, string>;

  // アクション
  addRecord: (record: RecordInput) => void;
  updateRecord: (
    id: string,
    updates: Partial<
      Omit<
        StudyRecord,
        "id" | "createdAt" | "deviceId" | "source" | "sessionId"
      >
    >,
  ) => void;
  deleteRecord: (id: string) => void;
  getRecordById: (id: string) => StudyRecord | undefined;
  updateTodayStudyMinutes: (subject: Subject, minutes: number) => void;
  addTodayStudyMinutes: (subject: Subject, minutes: number) => void;
  resetTodayStudyMinutes: () => void;

  // Notion同期アクション
  syncRecordToNotion: (record: StudyRecord) => Promise<string | null>;
  fetchRecordsFromNotion: () => Promise<void>;
  deleteRecordFromNotion: (id: string) => Promise<void>;
  // Notionに届いていない作成・編集を送り直す
  pushPendingToNotion: (plan: NotionPushPlan) => Promise<void>;

  // 集計
  getTotalStudyHours: (subject: Subject) => number;
  getTodayTotalMinutes: () => number;
  getSubjectTodayMinutes: (subject: Subject) => number;
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
        const now = new Date().toISOString();
        const newRecord: StudyRecord = {
          ...record,
          id: generateUUID(),
          fromQuestionBank: record.fromQuestionBank ?? false,
          source: record.source ?? "manual",
          sessionId: record.sessionId ?? null,
          deviceId: getDeviceId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          records: [newRecord, ...state.records],
        }));

        // バックグラウンドでNotion同期
        get().syncRecordToNotion(newRecord).catch(console.error);
      },

      updateRecord: (id, updates) => {
        const updatedAt = new Date().toISOString();
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt } : r,
          ),
        }));

        // Notionへ反映する。IDはサーバー側でrecordIdからページIDに変換される
        // 失敗しても次回の同期で、Notionより新しい記録として送り直される
        const notionId = get().notionIdMap[id] ?? id;
        fetch("/api/notion/records", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: notionId, ...updates, updatedAt }),
        })
          .then(async (response) => {
            if (!response.ok) {
              console.error(
                "[Sync] Failed to update record in Notion:",
                id,
                response.status,
                await response.text(),
              );
            }
          })
          .catch((error) =>
            console.error("[Sync] Failed to update record in Notion:", id, error),
          );
      },

      deleteRecord: (id) => {
        // Notionから削除
        get().deleteRecordFromNotion(id).catch(console.error);

        set((state) => ({
          records: state.records.filter((r) => r.id !== id),
          notionIdMap: Object.fromEntries(
            Object.entries(state.notionIdMap).filter(([key]) => key !== id),
          ),
        }));
      },

      getRecordById: (id) => {
        return get().records.find((r) => r.id === id);
      },

      updateTodayStudyMinutes: (subject, minutes) => {
        set((state) => ({
          todayStudyMinutes: {
            ...state.todayStudyMinutes,
            [subject]: minutes,
          },
        }));
      },

      addTodayStudyMinutes: (subject, minutes) => {
        set((state) => ({
          todayStudyMinutes: {
            ...state.todayStudyMinutes,
            [subject]: state.todayStudyMinutes[subject] + minutes,
          },
        }));
      },

      resetTodayStudyMinutes: () => {
        set({
          todayStudyMinutes: {
            FAR: 0,
            AUD: 0,
            REG: 0,
            BAR: 0,
          },
        });
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
              fromQuestionBank: record.fromQuestionBank,
              // 監査証跡用（v1.11追加）
              source: record.source,
              sessionId: record.sessionId,
              deviceId: record.deviceId,
              createdAt: record.createdAt,
              updatedAt: record.updatedAt,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            set((state) => ({
              notionIdMap: {
                ...state.notionIdMap,
                [record.id]: result.id,
              },
            }));
            return result.id;
          }
          // 失敗しても次回の同期で送り直される
          console.error(
            "[Sync] Failed to create record in Notion:",
            record.id,
            response.status,
            await response.text(),
          );
          return null;
        } catch (error) {
          console.error("[Sync] Failed to create record in Notion:", record.id, error);
          return null;
        }
      },

      fetchRecordsFromNotion: async () => {
        set({ isSyncing: true });

        try {
          const response = await fetch("/api/notion/records");
          if (response.ok) {
            const notionRecords: StudyRecord[] = await response.json();

            // 既存のローカル記録とマージ（Last-Write-Wins戦略）
            const { records: mergedRecords, notionIdMap: newNotionIdMap } =
              mergeNotionRecords(
                get().records,
                notionRecords,
                get().notionIdMap,
              );

            set({
              records: mergedRecords,
              notionIdMap: newNotionIdMap,
              lastSyncedAt: new Date().toISOString(),
            });

            // Notionに届いていない作成・編集を送り直す（バックグラウンド）
            const plan = planNotionPush({
              localRecords: mergedRecords,
              notionRecords,
              notionIdMap: newNotionIdMap,
              deviceId: getDeviceId(),
            });
            if (plan.toCreate.length > 0 || plan.toUpdate.length > 0) {
              get().pushPendingToNotion(plan).catch(console.error);
            }
          }
        } catch (error) {
          console.error("Failed to fetch records from Notion:", error);
        } finally {
          set({ isSyncing: false });
        }
      },

      deleteRecordFromNotion: async (id) => {
        // IDはサーバー側でrecordIdからページIDに変換される
        const notionId = get().notionIdMap[id] ?? id;

        try {
          const response = await fetch(
            `/api/notion/records?id=${encodeURIComponent(notionId)}`,
            { method: "DELETE" },
          );
          if (!response.ok) {
            console.error(
              "[Sync] Failed to delete record from Notion:",
              id,
              response.status,
              await response.text(),
            );
          }
        } catch (error) {
          console.error("[Sync] Failed to delete record from Notion:", id, error);
        }
      },

      pushPendingToNotion: async ({ toCreate, toUpdate }) => {
        console.log(
          `[Sync] Pushing to Notion: create ${toCreate.length}, update ${toUpdate.length}`,
        );
        // Notion APIのレート制限（3リクエスト/秒）を超えないよう1件ずつ送る
        const wait = () => new Promise((resolve) => setTimeout(resolve, 400));
        for (const record of toCreate) {
          await get().syncRecordToNotion(record);
          await wait();
        }
        for (const record of toUpdate) {
          try {
            const response = await fetch("/api/notion/records", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: get().notionIdMap[record.id] ?? record.id,
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
                fromQuestionBank: record.fromQuestionBank,
                updatedAt: record.updatedAt,
              }),
            });
            if (!response.ok) {
              console.error(
                "[Sync] Failed to push update to Notion:",
                record.id,
                response.status,
                await response.text(),
              );
            }
          } catch (error) {
            console.error("[Sync] Failed to push update to Notion:", record.id, error);
          }
          await wait();
        }
      },

      // 科目別の累計学習時間（時間単位）
      getTotalStudyHours: (subject) => {
        const records = get().records.filter((r) => r.subject === subject);
        const totalMinutes = records.reduce(
          (sum, r) => sum + (r.studyMinutes || 0),
          0,
        );
        return Math.round((totalMinutes / 60) * 10) / 10; // 小数点1桁
      },

      // 今日の全科目合計（分単位）- recordsから計算
      getTodayTotalMinutes: () => {
        const today = getJSTDateString();
        const todayRecords = get().records.filter((r) => r.studiedAt === today);
        return todayRecords.reduce((sum, r) => sum + (r.studyMinutes || 0), 0);
      },

      // 科目別の今日の学習時間（分単位）
      getSubjectTodayMinutes: (subject) => {
        return get().todayStudyMinutes[subject];
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
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as object),
        todayStudyMinutes: {
          FAR: 0,
          AUD: 0,
          REG: 0,
          BAR: 0,
          ...(((persisted as Record<string, unknown>)
            ?.todayStudyMinutes as Record<string, number>) || {}),
        },
      }),
    },
  ),
);

// 日付が変わったかチェックして、変わっていたらリセットする
export function checkAndResetDailyMinutes() {
  const lastDate = localStorage.getItem("uscpa-last-study-date");
  const today = getJSTDateString();

  if (lastDate !== today) {
    useRecordStore.getState().resetTodayStudyMinutes();
    localStorage.setItem("uscpa-last-study-date", today);
  }
}
