import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get("notion_access_token")?.value
  const userCookie = cookieStore.get("notion_user")?.value

  if (!accessToken || !userCookie) {
    return NextResponse.json({
      isAuthenticated: false,
      user: null,
    })
  }

  try {
    const userInfo = JSON.parse(userCookie)

    // Notionに接続してユーザー情報を検証（オプション）
    const response = await fetch("https://api.notion.com/v1/users/me", {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Notion-Version": "2022-06-28",
      },
    })

    if (!response.ok) {
      // トークンが無効な場合はCookieを削除
      cookieStore.delete("notion_access_token")
      cookieStore.delete("notion_user")
      return NextResponse.json({
        isAuthenticated: false,
        user: null,
      })
    }

    const notionUser = await response.json()

    return NextResponse.json({
      isAuthenticated: true,
      user: {
        id: notionUser.id,
        name: notionUser.name,
        avatarUrl: notionUser.avatar_url,
        ...userInfo,
      },
    })
  } catch {
    return NextResponse.json({
      isAuthenticated: false,
      user: null,
    })
  }
}
