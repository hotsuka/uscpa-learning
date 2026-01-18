import { Client } from "@notionhq/client"

// Notion クライアントのシングルトンインスタンス（Internal Integration用）
let notionClient: Client | null = null

/**
 * Internal Integration用のNotionクライアントを取得
 * 環境変数のAPIキーを使用
 */
export function getNotionClient(): Client {
  if (!notionClient) {
    const apiKey = process.env.NOTION_API_KEY?.trim()
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
    settings: process.env.NOTION_SETTINGS_DB_ID?.trim(),
    sessions: process.env.NOTION_SESSIONS_DB_ID?.trim(),
    records: process.env.NOTION_RECORDS_DB_ID?.trim(),
    notes: process.env.NOTION_NOTES_DB_ID?.trim(),
  }
}

// Notion APIが利用可能かチェック
export function isNotionConfigured(): boolean {
  return !!(
    process.env.NOTION_API_KEY?.trim() &&
    process.env.NOTION_SETTINGS_DB_ID?.trim() &&
    process.env.NOTION_SESSIONS_DB_ID?.trim() &&
    process.env.NOTION_RECORDS_DB_ID?.trim() &&
    process.env.NOTION_NOTES_DB_ID?.trim()
  )
}
