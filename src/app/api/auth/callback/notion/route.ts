import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  // エラーチェック
  if (error) {
    console.error("OAuth error:", error)
    return NextResponse.redirect(new URL("/login?error=oauth_error", baseUrl))
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", baseUrl))
  }

  const clientId = process.env.NOTION_CLIENT_ID
  const clientSecret = process.env.NOTION_CLIENT_SECRET
  const redirectUri = process.env.NOTION_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL("/login?error=not_configured", baseUrl))
  }

  try {
    // トークンエクスチェンジ
    const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error("Token exchange failed:", tokenData)
      return NextResponse.redirect(new URL("/login?error=token_exchange_failed", baseUrl))
    }

    // Cookieストアを取得
    const cookieStore = await cookies()

    // アクセストークンをHTTP-Only Cookieに保存
    cookieStore.set("notion_access_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 31536000, // 1年
      path: "/",
    })

    // ユーザー情報をCookieに保存（クライアント側で読み取り可能）
    const userInfo = {
      botId: tokenData.bot_id,
      workspaceId: tokenData.workspace_id,
      workspaceName: tokenData.workspace_name || null,
      workspaceIcon: tokenData.workspace_icon || null,
    }
    cookieStore.set("notion_user", JSON.stringify(userInfo), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 31536000,
      path: "/",
    })

    // ダッシュボードへリダイレクト
    return NextResponse.redirect(new URL("/dashboard", baseUrl))
  } catch (err) {
    console.error("OAuth callback error:", err)
    return NextResponse.redirect(new URL("/login?error=unexpected_error", baseUrl))
  }
}
