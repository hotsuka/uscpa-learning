import { NextRequest, NextResponse } from "next/server"
import {
  getSessions,
  createSession,
  deleteSession,
  isNotionConfigured,
} from "@/lib/notion"
import type { Subject } from "@/types"

export async function GET(request: NextRequest) {
  try {
    if (!isNotionConfigured()) {
      return NextResponse.json(
        { error: "Notion is not configured" },
        { status: 503 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined
    const subject = searchParams.get("subject") as Subject | undefined
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : undefined

    const sessions = await getSessions({
      startDate,
      endDate,
      subject,
      limit,
    })

    return NextResponse.json(sessions)
  } catch (error) {
    console.error("Failed to get sessions:", error)
    return NextResponse.json(
      { error: "Failed to get sessions" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isNotionConfigured()) {
      return NextResponse.json(
        { error: "Notion is not configured" },
        { status: 503 }
      )
    }

    const body = await request.json()

    // タイマーページからのリクエスト形式を変換（v1.11: sessionId, deviceId追加）
    const sessionData = {
      sessionId: body.sessionId || body.id || "",
      subject: body.subject as Subject,
      subtopic: body.subtopic || null,
      durationMinutes: body.studyMinutes || body.durationMinutes || 0,
      startedAt: body.startedAt,
      endedAt: body.endedAt,
      deviceId: body.deviceId || "",
    }

    const session = await createSession(sessionData)

    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    console.error("Failed to create session:", error)
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isNotionConfigured()) {
      return NextResponse.json(
        { error: "Notion is not configured" },
        { status: 503 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      )
    }

    await deleteSession(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete session:", error)
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    )
  }
}
