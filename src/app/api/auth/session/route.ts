import { NextResponse } from "next/server"
import { isNotionConfigured, getNotionClient } from "@/lib/notion/client"

export async function GET() {
  // Internal Integrationの場合は環境変数のAPI Keyで接続確認
  if (!isNotionConfigured()) {
    return NextResponse.json({
      isAuthenticated: false,
      isConfigured: false,
      user: null,
      message: "Notion APIが設定されていません",
    })
  }

  try {
    const client = getNotionClient()

    // Notionに接続してボット情報を取得
    const response = await client.users.me({})

    return NextResponse.json({
      isAuthenticated: true,
      isConfigured: true,
      user: {
        id: response.id,
        name: response.name,
        avatarUrl: response.avatar_url,
        type: response.type,
      },
    })
  } catch (error) {
    console.error("Notion connection check failed:", error)
    return NextResponse.json({
      isAuthenticated: false,
      isConfigured: true,
      user: null,
      message: "Notionへの接続に失敗しました",
    })
  }
}
