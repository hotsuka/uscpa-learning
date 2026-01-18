import { NextResponse } from "next/server"
import { isNotionConfigured, getNotionClient, getDbIds } from "@/lib/notion"

export async function GET() {
  try {
    const configured = isNotionConfigured()

    if (!configured) {
      return NextResponse.json({
        configured: false,
        connected: false,
        message: "Notion API is not configured. Please set environment variables.",
      })
    }

    // 接続テスト
    try {
      const notion = getNotionClient()
      const dbIds = getDbIds()

      // 設定DBの存在確認
      if (dbIds.settings) {
        await notion.databases.retrieve({ database_id: dbIds.settings })
      }

      return NextResponse.json({
        configured: true,
        connected: true,
        databases: {
          settings: !!dbIds.settings,
          sessions: !!dbIds.sessions,
          records: !!dbIds.records,
          notes: !!dbIds.notes,
        },
      })
    } catch (connectionError: any) {
      return NextResponse.json({
        configured: true,
        connected: false,
        message: connectionError.message || "Failed to connect to Notion",
      })
    }
  } catch (error) {
    console.error("Failed to check Notion status:", error)
    return NextResponse.json(
      { error: "Failed to check Notion status" },
      { status: 500 }
    )
  }
}
