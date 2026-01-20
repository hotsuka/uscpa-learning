import { NextRequest, NextResponse } from "next/server"
import {
  getRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
  isNotionConfigured,
} from "@/lib/notion"
import type { Subject, RecordType } from "@/types"

export async function GET(request: NextRequest) {
  try {
    if (!isNotionConfigured()) {
      return NextResponse.json(
        { error: "Notion is not configured" },
        { status: 503 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get("id")

    // 単一レコードの取得
    if (id) {
      const record = await getRecordById(id)
      if (!record) {
        return NextResponse.json(
          { error: "Record not found" },
          { status: 404 }
        )
      }
      return NextResponse.json(record)
    }

    // 一覧の取得
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined
    const subject = searchParams.get("subject") as Subject | undefined
    const recordType = searchParams.get("recordType") as RecordType | undefined
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : undefined

    const records = await getRecords({
      startDate,
      endDate,
      subject,
      recordType,
      limit,
    })

    return NextResponse.json(records)
  } catch (error) {
    console.error("Failed to get records:", error)
    return NextResponse.json(
      { error: "Failed to get records" },
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
    const record = await createRecord(body)

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error("Failed to create record:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to create record", details: errorMessage },
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
        { error: "Record ID is required" },
        { status: 400 }
      )
    }

    await updateRecord(id, updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update record:", error)
    return NextResponse.json(
      { error: "Failed to update record" },
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
        { error: "Record ID is required" },
        { status: 400 }
      )
    }

    await deleteRecord(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete record:", error)
    return NextResponse.json(
      { error: "Failed to delete record" },
      { status: 500 }
    )
  }
}
