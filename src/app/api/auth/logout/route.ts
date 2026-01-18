import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST() {
  const cookieStore = await cookies()

  // 認証関連のCookieを削除
  cookieStore.delete("notion_access_token")
  cookieStore.delete("notion_user")

  return NextResponse.json({ success: true })
}

export async function GET() {
  const cookieStore = await cookies()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  // 認証関連のCookieを削除
  cookieStore.delete("notion_access_token")
  cookieStore.delete("notion_user")

  // ログインページへリダイレクト
  return NextResponse.redirect(new URL("/login", baseUrl))
}
