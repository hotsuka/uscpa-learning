import { getNotionClient, getDbIds } from "./client"
import type { Subject, StudySession } from "@/types"
import { formatMinutes } from "@/lib/utils"

// 学習セッションを取得
export async function getSessions(options?: {
  startDate?: string
  endDate?: string
  subject?: Subject
  limit?: number
}): Promise<StudySession[]> {
  const notion = getNotionClient()
  const dbIds = getDbIds()

  if (!dbIds.sessions) {
    throw new Error("NOTION_SESSIONS_DB_ID is not set")
  }

  const filter: any[] = []

  if (options?.startDate) {
    filter.push({
      property: "開始日時",
      date: { on_or_after: options.startDate },
    })
  }
  if (options?.endDate) {
    filter.push({
      property: "開始日時",
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
    database_id: dbIds.sessions,
    filter: filter.length > 0 ? { and: filter } : undefined,
    sorts: [{ property: "開始日時", direction: "descending" }],
    page_size: options?.limit || 100,
  })

  return response.results.map((page: any) => {
    const props = page.properties
    return {
      id: page.id,
      subject: (props["科目"]?.select?.name || "FAR") as Subject,
      subtopic: null,
      durationMinutes: props["学習時間(分)"]?.number || 0,
      startedAt: props["開始日時"]?.date?.start || new Date().toISOString(),
      endedAt: props["終了日時"]?.date?.start || new Date().toISOString(),
      createdAt: page.created_time,
    }
  })
}

// 学習セッションを作成
export async function createSession(
  session: Omit<StudySession, "id" | "createdAt">
): Promise<StudySession> {
  const notion = getNotionClient()
  const dbIds = getDbIds()

  if (!dbIds.sessions) {
    throw new Error("NOTION_SESSIONS_DB_ID is not set")
  }

  // 名前を自動生成: "2026/01/17 FAR 1h30m"
  const date = new Date(session.startedAt)
  const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`
  const durationStr = formatMinutes(session.durationMinutes)
  const name = `${dateStr} ${session.subject} ${durationStr}`

  const response = await notion.pages.create({
    parent: { database_id: dbIds.sessions },
    properties: {
      名前: {
        title: [{ text: { content: name } }],
      },
      科目: { select: { name: session.subject } },
      "学習時間(分)": { number: session.durationMinutes },
      開始日時: { date: { start: session.startedAt } },
      終了日時: { date: { start: session.endedAt } },
    },
  })

  return {
    id: response.id,
    ...session,
    createdAt: (response as any).created_time,
  }
}

// 学習セッションを削除（アーカイブ）
export async function deleteSession(pageId: string): Promise<void> {
  const notion = getNotionClient()

  await notion.pages.update({
    page_id: pageId,
    archived: true,
  })
}

// 今日の学習時間を集計
export async function getTodayStudyMinutes(): Promise<Record<Subject, number>> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString()

  const sessions = await getSessions({ startDate: todayStr })

  const result: Record<Subject, number> = {
    FAR: 0,
    AUD: 0,
    REG: 0,
    BAR: 0,
  }

  for (const session of sessions) {
    result[session.subject] += session.durationMinutes
  }

  return result
}

// 週間の学習時間を集計
export async function getWeeklyStudyMinutes(): Promise<number> {
  const now = new Date()
  const monday = new Date(now)
  const day = monday.getDay()
  const diff = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + diff)
  monday.setHours(0, 0, 0, 0)

  const sessions = await getSessions({ startDate: monday.toISOString() })

  return sessions.reduce((sum, s) => sum + s.durationMinutes, 0)
}
