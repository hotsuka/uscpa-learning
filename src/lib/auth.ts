import { cookies } from "next/headers"

/**
 * サーバーサイドでNotionアクセストークンを取得
 * Cookieからトークンを読み取り、Notion API呼び出しに使用
 */
export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get("notion_access_token")?.value || null
}

/**
 * サーバーサイドでユーザー情報を取得
 */
export async function getUserInfo(): Promise<{
  botId: string
  workspaceId: string
  workspaceName: string | null
  workspaceIcon: string | null
} | null> {
  const cookieStore = await cookies()
  const userCookie = cookieStore.get("notion_user")?.value

  if (!userCookie) return null

  try {
    return JSON.parse(userCookie)
  } catch {
    return null
  }
}

/**
 * 認証済みかどうかをチェック
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getAccessToken()
  return !!token
}
