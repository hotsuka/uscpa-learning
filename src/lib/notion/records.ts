import { getNotionClient, getDbIds } from "./client"
import type { Subject, RecordType, StudyRecord } from "@/types"

// 学習記録を取得
export async function getRecords(options?: {
  startDate?: string
  endDate?: string
  subject?: Subject
  recordType?: RecordType
  limit?: number
}): Promise<StudyRecord[]> {
  const notion = getNotionClient()
  const dbIds = getDbIds()

  if (!dbIds.records) {
    throw new Error("NOTION_RECORDS_DB_ID is not set")
  }

  const filter: any[] = []

  if (options?.startDate) {
    filter.push({
      property: "演習日",
      date: { on_or_after: options.startDate },
    })
  }
  if (options?.endDate) {
    filter.push({
      property: "演習日",
      date: { on_or_before: options.endDate },
    })
  }
  if (options?.subject) {
    filter.push({
      property: "科目",
      select: { equals: options.subject },
    })
  }

  const response = await notion.databases.query({
    database_id: dbIds.records,
    filter: filter.length > 0 ? { and: filter } : undefined,
    sorts: [{ property: "演習日", direction: "descending" }],
    page_size: options?.limit || 100,
  })

  return response.results.map((page: any) => {
    const props = page.properties
    return {
      id: props["recordId"]?.rich_text?.[0]?.text?.content || page.id,
      recordType: (props["記録タイプ"]?.select?.name || "practice") as RecordType,
      subject: (props["科目"]?.select?.name || "FAR") as Subject,
      subtopic: props["テーマ"]?.rich_text?.[0]?.text?.content || null,
      studyMinutes: props["学習時間(分)"]?.number || 0,
      totalQuestions: props["問題数"]?.number || null,
      correctAnswers: props["正解数"]?.number || null,
      roundNumber: props["周回数"]?.number || null,
      chapter: props["章"]?.rich_text?.[0]?.text?.content || null,
      pageRange: props["ページ範囲"]?.rich_text?.[0]?.text?.content || null,
      studiedAt: props["演習日"]?.date?.start || new Date().toISOString().split("T")[0],
      memo: props["メモ"]?.rich_text?.[0]?.text?.content || null,
      // 監査証跡用（v1.11追加）
      source: (props["作成元"]?.select?.name || "manual") as import("@/types").RecordSource,
      sessionId: props["セッションID"]?.rich_text?.[0]?.text?.content || null,
      deviceId: props["デバイスID"]?.rich_text?.[0]?.text?.content || "",
      createdAt: props["作成日時"]?.date?.start || page.created_time,
      updatedAt: props["更新日時"]?.date?.start || page.last_edited_time,
    }
  })
}

// 学習記録を1件取得
export async function getRecordById(pageId: string): Promise<StudyRecord | null> {
  const notion = getNotionClient()

  try {
    const page = await notion.pages.retrieve({ page_id: pageId }) as any
    const props = page.properties

    return {
      id: props["recordId"]?.rich_text?.[0]?.text?.content || page.id,
      recordType: (props["記録タイプ"]?.select?.name || "practice") as RecordType,
      subject: (props["科目"]?.select?.name || "FAR") as Subject,
      subtopic: props["テーマ"]?.rich_text?.[0]?.text?.content || null,
      studyMinutes: props["学習時間(分)"]?.number || 0,
      totalQuestions: props["問題数"]?.number || null,
      correctAnswers: props["正解数"]?.number || null,
      roundNumber: props["周回数"]?.number || null,
      chapter: props["章"]?.rich_text?.[0]?.text?.content || null,
      pageRange: props["ページ範囲"]?.rich_text?.[0]?.text?.content || null,
      studiedAt: props["演習日"]?.date?.start || new Date().toISOString().split("T")[0],
      memo: props["メモ"]?.rich_text?.[0]?.text?.content || null,
      // 監査証跡用（v1.11追加）
      source: (props["作成元"]?.select?.name || "manual") as import("@/types").RecordSource,
      sessionId: props["セッションID"]?.rich_text?.[0]?.text?.content || null,
      deviceId: props["デバイスID"]?.rich_text?.[0]?.text?.content || "",
      createdAt: props["作成日時"]?.date?.start || page.created_time,
      updatedAt: props["更新日時"]?.date?.start || page.last_edited_time,
    }
  } catch {
    return null
  }
}

// 学習記録を作成（v1.11: 新フィールド対応）
interface CreateRecordInput {
  recordId?: string  // ローカル生成UUID
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
  source: import("@/types").RecordSource
  sessionId: string | null
  deviceId: string
  createdAt?: string
  updatedAt: string
}

export async function createRecord(
  record: CreateRecordInput
): Promise<StudyRecord> {
  const notion = getNotionClient()
  const dbIds = getDbIds()

  if (!dbIds.records) {
    throw new Error("NOTION_RECORDS_DB_ID is not set")
  }

  // 名前を自動生成: "2026/01/17 FAR Ch.5"
  const subtopicPart = record.subtopic ? ` ${record.subtopic}` : ""
  const name = `${record.studiedAt} ${record.subject}${subtopicPart}`

  const properties: Record<string, any> = {
    名前: {
      title: [{ text: { content: name } }],
    },
    科目: { select: { name: record.subject } },
    演習日: { date: { start: record.studiedAt } },
    記録タイプ: { select: { name: record.recordType } },
    作成元: { select: { name: record.source } },
  }

  // recordId（ローカルUUID）
  if (record.recordId) {
    properties["recordId"] = { rich_text: [{ text: { content: record.recordId } }] }
  }

  // 学習時間
  if (record.studyMinutes !== null && record.studyMinutes !== undefined) {
    properties["学習時間(分)"] = { number: record.studyMinutes }
  }

  // オプショナルフィールド
  if (record.subtopic) {
    properties["テーマ"] = { rich_text: [{ text: { content: record.subtopic } }] }
  }
  if (record.totalQuestions !== null && record.totalQuestions !== undefined) {
    properties["問題数"] = { number: record.totalQuestions }
  }
  if (record.correctAnswers !== null && record.correctAnswers !== undefined) {
    properties["正解数"] = { number: record.correctAnswers }
  }
  if (record.roundNumber !== null && record.roundNumber !== undefined) {
    properties["周回数"] = { number: record.roundNumber }
  }
  if (record.chapter) {
    properties["章"] = { rich_text: [{ text: { content: record.chapter } }] }
  }
  if (record.pageRange) {
    properties["ページ範囲"] = { rich_text: [{ text: { content: record.pageRange } }] }
  }
  if (record.memo) {
    properties["メモ"] = { rich_text: [{ text: { content: record.memo } }] }
  }
  if (record.sessionId) {
    properties["セッションID"] = { rich_text: [{ text: { content: record.sessionId } }] }
  }
  if (record.deviceId) {
    properties["デバイスID"] = { rich_text: [{ text: { content: record.deviceId } }] }
  }
  if (record.createdAt) {
    properties["作成日時"] = { date: { start: record.createdAt } }
  }
  if (record.updatedAt) {
    properties["更新日時"] = { date: { start: record.updatedAt } }
  }

  const response = await notion.pages.create({
    parent: { database_id: dbIds.records },
    properties,
  })

  return {
    id: record.recordId || response.id,
    recordType: record.recordType,
    subject: record.subject,
    subtopic: record.subtopic,
    studyMinutes: record.studyMinutes,
    totalQuestions: record.totalQuestions,
    correctAnswers: record.correctAnswers,
    roundNumber: record.roundNumber,
    chapter: record.chapter,
    pageRange: record.pageRange,
    studiedAt: record.studiedAt,
    memo: record.memo,
    source: record.source,
    sessionId: record.sessionId,
    deviceId: record.deviceId,
    createdAt: record.createdAt || (response as any).created_time,
    updatedAt: record.updatedAt,
  }
}

// 学習記録を更新（v1.11: 新フィールド対応）
export async function updateRecord(
  pageId: string,
  updates: Partial<Omit<StudyRecord, "id" | "createdAt" | "deviceId" | "source" | "sessionId">>
): Promise<void> {
  const notion = getNotionClient()

  const properties: Record<string, any> = {}

  if (updates.recordType !== undefined) {
    properties["記録タイプ"] = { select: { name: updates.recordType } }
  }
  if (updates.subject !== undefined) {
    properties["科目"] = { select: { name: updates.subject } }
  }
  if (updates.subtopic !== undefined) {
    properties["テーマ"] = updates.subtopic
      ? { rich_text: [{ text: { content: updates.subtopic } }] }
      : { rich_text: [] }
  }
  if (updates.studyMinutes !== undefined) {
    properties["学習時間(分)"] = updates.studyMinutes !== null
      ? { number: updates.studyMinutes }
      : { number: null }
  }
  if (updates.totalQuestions !== undefined) {
    properties["問題数"] = updates.totalQuestions !== null
      ? { number: updates.totalQuestions }
      : { number: null }
  }
  if (updates.correctAnswers !== undefined) {
    properties["正解数"] = updates.correctAnswers !== null
      ? { number: updates.correctAnswers }
      : { number: null }
  }
  if (updates.roundNumber !== undefined) {
    properties["周回数"] = updates.roundNumber !== null
      ? { number: updates.roundNumber }
      : { number: null }
  }
  if (updates.chapter !== undefined) {
    properties["章"] = updates.chapter
      ? { rich_text: [{ text: { content: updates.chapter } }] }
      : { rich_text: [] }
  }
  if (updates.pageRange !== undefined) {
    properties["ページ範囲"] = updates.pageRange
      ? { rich_text: [{ text: { content: updates.pageRange } }] }
      : { rich_text: [] }
  }
  if (updates.memo !== undefined) {
    properties["メモ"] = updates.memo
      ? { rich_text: [{ text: { content: updates.memo } }] }
      : { rich_text: [] }
  }
  if (updates.studiedAt !== undefined) {
    properties["演習日"] = { date: { start: updates.studiedAt } }
  }
  if (updates.updatedAt !== undefined) {
    properties["更新日時"] = { date: { start: updates.updatedAt } }
  }

  await notion.pages.update({
    page_id: pageId,
    properties,
  })
}

// 学習記録を削除（アーカイブ）
export async function deleteRecord(pageId: string): Promise<void> {
  const notion = getNotionClient()

  await notion.pages.update({
    page_id: pageId,
    archived: true,
  })
}

// 今日の記録を取得
export async function getTodayRecords(): Promise<StudyRecord[]> {
  const today = new Date().toISOString().split("T")[0]
  return getRecords({ startDate: today, endDate: today })
}

// 科目別の正答率を計算
export async function getSubjectAccuracy(
  subject: Subject,
  startDate?: string
): Promise<{ totalQuestions: number; correctAnswers: number; accuracy: number }> {
  const records = await getRecords({
    subject,
    recordType: "practice",
    startDate,
  })

  let totalQuestions = 0
  let correctAnswers = 0

  for (const record of records) {
    if (record.totalQuestions && record.correctAnswers) {
      totalQuestions += record.totalQuestions
      correctAnswers += record.correctAnswers
    }
  }

  const accuracy = totalQuestions > 0
    ? Math.round((correctAnswers / totalQuestions) * 100)
    : 0

  return { totalQuestions, correctAnswers, accuracy }
}
