import { Client } from "@notionhq/client"
import { cookies } from "next/headers"

// Notion クライアントのシングルトンインスタンス（Internal Integration用）
let notionClient: Client | null = null

/**
 * Internal Integration用のNotionクライアントを取得
 * 環境変数のAPIキーを使用
 */
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

/**
 * ユーザーのアクセストークンを使用してNotionクライアントを取得
 * OAuth認証後にユーザーのワークスペースにアクセスするために使用
 */
export async function getNotionClientForUser(): Promise<Client | null> {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get("notion_access_token")?.value

  if (!accessToken) {
    return null
  }

  return new Client({ auth: accessToken })
}

/**
 * 認証済みユーザーのトークン、または環境変数のAPIキーを使用してクライアントを取得
 * ユーザーが認証済みの場合はユーザーのトークンを優先
 */
export async function getNotionClientAuto(): Promise<Client | null> {
  // まずユーザートークンを試す
  const userClient = await getNotionClientForUser()
  if (userClient) {
    return userClient
  }

  // フォールバック: 環境変数のAPIキー
  if (process.env.NOTION_API_KEY) {
    return getNotionClient()
  }

  return null
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
