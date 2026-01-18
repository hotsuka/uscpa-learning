import { Client } from "@notionhq/client"

// Notion クライアントのシングルトンインスタンス
let notionClient: Client | null = null

export function getNotionClient(): Client {
  if (!notionClient) {
    const apiKey = process.env.NOTION_API_KEY
    if (!apiKey) {
      throw new Error("NOTION_API_KEY is not set")
    }
    notionClient = new Client({ auth: apiKey })
  }
  return notionClient
}

// 環境変数からデータベースIDを取得
export function getDbIds() {
  return {
    settings: process.env.NOTION_SETTINGS_DB_ID,
    sessions: process.env.NOTION_SESSIONS_DB_ID,
    records: process.env.NOTION_RECORDS_DB_ID,
    notes: process.env.NOTION_NOTES_DB_ID,
  }
}

// Notion APIが利用可能かチェック
export function isNotionConfigured(): boolean {
  return !!(
    process.env.NOTION_API_KEY &&
    process.env.NOTION_SETTINGS_DB_ID &&
    process.env.NOTION_SESSIONS_DB_ID &&
    process.env.NOTION_RECORDS_DB_ID &&
    process.env.NOTION_NOTES_DB_ID
  )
}
