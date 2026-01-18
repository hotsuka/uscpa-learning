import { getNotionClient, getDbIds } from "./client"
import type { Subject } from "@/types"

export interface NotionSettings {
  id: string
  name: string
  weekdayTargetHours: number
  weekendTargetHours: number
  examDates: Record<Subject, string | null>
  subjectTargetHours: Record<Subject, number>
}

// 設定を取得（最初の1件のみ）
export async function getSettings(): Promise<NotionSettings | null> {
  const notion = getNotionClient()
  const dbIds = getDbIds()

  if (!dbIds.settings) {
    throw new Error("NOTION_SETTINGS_DB_ID is not set")
  }

  const response = await notion.databases.query({
    database_id: dbIds.settings,
    page_size: 1,
  })

  if (response.results.length === 0) {
    return null
  }

  const page = response.results[0] as any
  const props = page.properties

  return {
    id: page.id,
    name: props["名前"]?.title?.[0]?.text?.content || "マイ設定",
    weekdayTargetHours: props["平日目標時間"]?.number ?? 3,
    weekendTargetHours: props["休日目標時間"]?.number ?? 5,
    examDates: {
      FAR: props["FAR試験日"]?.date?.start || null,
      AUD: props["AUD試験日"]?.date?.start || null,
      REG: props["REG試験日"]?.date?.start || null,
      BAR: props["BAR試験日"]?.date?.start || null,
    },
    subjectTargetHours: {
      FAR: props["FAR目標時間"]?.number ?? 400,
      AUD: props["AUD目標時間"]?.number ?? 250,
      REG: props["REG目標時間"]?.number ?? 250,
      BAR: props["BAR目標時間"]?.number ?? 200,
    },
  }
}

// 設定を作成
export async function createSettings(
  settings: Omit<NotionSettings, "id">
): Promise<NotionSettings> {
  const notion = getNotionClient()
  const dbIds = getDbIds()

  if (!dbIds.settings) {
    throw new Error("NOTION_SETTINGS_DB_ID is not set")
  }

  const response = await notion.pages.create({
    parent: { database_id: dbIds.settings },
    properties: {
      名前: {
        title: [{ text: { content: settings.name } }],
      },
      平日目標時間: { number: settings.weekdayTargetHours },
      休日目標時間: { number: settings.weekendTargetHours },
      FAR試験日: settings.examDates.FAR
        ? { date: { start: settings.examDates.FAR } }
        : { date: null },
      AUD試験日: settings.examDates.AUD
        ? { date: { start: settings.examDates.AUD } }
        : { date: null },
      REG試験日: settings.examDates.REG
        ? { date: { start: settings.examDates.REG } }
        : { date: null },
      BAR試験日: settings.examDates.BAR
        ? { date: { start: settings.examDates.BAR } }
        : { date: null },
      FAR目標時間: { number: settings.subjectTargetHours.FAR },
      AUD目標時間: { number: settings.subjectTargetHours.AUD },
      REG目標時間: { number: settings.subjectTargetHours.REG },
      BAR目標時間: { number: settings.subjectTargetHours.BAR },
    },
  })

  return {
    id: response.id,
    ...settings,
  }
}

// 設定を更新
export async function updateSettings(
  pageId: string,
  updates: Partial<Omit<NotionSettings, "id">>
): Promise<void> {
  const notion = getNotionClient()

  const properties: Record<string, any> = {}

  if (updates.name !== undefined) {
    properties["名前"] = { title: [{ text: { content: updates.name } }] }
  }
  if (updates.weekdayTargetHours !== undefined) {
    properties["平日目標時間"] = { number: updates.weekdayTargetHours }
  }
  if (updates.weekendTargetHours !== undefined) {
    properties["休日目標時間"] = { number: updates.weekendTargetHours }
  }
  if (updates.examDates) {
    if (updates.examDates.FAR !== undefined) {
      properties["FAR試験日"] = updates.examDates.FAR
        ? { date: { start: updates.examDates.FAR } }
        : { date: null }
    }
    if (updates.examDates.AUD !== undefined) {
      properties["AUD試験日"] = updates.examDates.AUD
        ? { date: { start: updates.examDates.AUD } }
        : { date: null }
    }
    if (updates.examDates.REG !== undefined) {
      properties["REG試験日"] = updates.examDates.REG
        ? { date: { start: updates.examDates.REG } }
        : { date: null }
    }
    if (updates.examDates.BAR !== undefined) {
      properties["BAR試験日"] = updates.examDates.BAR
        ? { date: { start: updates.examDates.BAR } }
        : { date: null }
    }
  }
  if (updates.subjectTargetHours) {
    if (updates.subjectTargetHours.FAR !== undefined) {
      properties["FAR目標時間"] = { number: updates.subjectTargetHours.FAR }
    }
    if (updates.subjectTargetHours.AUD !== undefined) {
      properties["AUD目標時間"] = { number: updates.subjectTargetHours.AUD }
    }
    if (updates.subjectTargetHours.REG !== undefined) {
      properties["REG目標時間"] = { number: updates.subjectTargetHours.REG }
    }
    if (updates.subjectTargetHours.BAR !== undefined) {
      properties["BAR目標時間"] = { number: updates.subjectTargetHours.BAR }
    }
  }

  await notion.pages.update({
    page_id: pageId,
    properties,
  })
}
