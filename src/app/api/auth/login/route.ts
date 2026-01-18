import { NextResponse } from "next/server"

export async function GET() {
  const clientId = process.env.NOTION_CLIENT_ID
  const redirectUri = process.env.NOTION_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Notion OAuth is not configured" },
      { status: 503 }
    )
  }

  // Notion OAuth認可URLを構築
  const authUrl = new URL("https://api.notion.com/v1/oauth/authorize")
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("owner", "user")

  return NextResponse.redirect(authUrl.toString())
}
