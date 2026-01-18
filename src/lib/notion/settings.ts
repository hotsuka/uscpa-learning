import { getNotionClient, getDbIds } from "./client"
import type { Subject } from "@/types"

export interface NotionSettings {
  id: string
  name: string
  totalTargetHours: number
  examDates: Record<Subject, string | null>
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
    totalTargetHours: props["目標学習時間"]?.number ?? 1100,
    examDates: {
      FAR: props["FAR試験日"]?.date?.start || null,
      AUD: props["AUD試験日"]?.date?.start || null,
      REG: props["REG試験日"]?.date?.start || null,
      BAR: props["BAR試験日"]?.date?.start || null,
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
      目標学習時間: { number: settings.totalTargetHours },
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
  if (updates.totalTargetHours !== undefined) {
    properties["目標学習時間"] = { number: updates.totalTargetHours }
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

  await notion.pages.update({
    page_id: pageId,
    properties,
  })
}
