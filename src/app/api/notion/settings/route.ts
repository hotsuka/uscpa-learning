import { NextRequest, NextResponse } from "next/server"
import {
  getSettings,
  createSettings,
  updateSettings,
  isNotionConfigured,
} from "@/lib/notion"

export async function GET() {
  try {
    if (!isNotionConfigured()) {
      return NextResponse.json(
        { error: "Notion is not configured" },
        { status: 503 }
      )
    }

    const settings = await getSettings()

    if (!settings) {
      return NextResponse.json(
        { error: "Settings not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error("Failed to get settings:", error)
    return NextResponse.json(
      { error: "Failed to get settings" },
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
    const settings = await createSettings(body)

    return NextResponse.json(settings, { status: 201 })
  } catch (error) {
    console.error("Failed to create settings:", error)
    return NextResponse.json(
      { error: "Failed to create settings" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isNotionConfigured()) {
      return NextResponse.json(
        { error: "Notion is not configured" },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: "Settings ID is required" },
        { status: 400 }
      )
    }

    await updateSettings(id, updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update settings:", error)
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    )
  }
}
