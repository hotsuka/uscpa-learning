import { NextRequest, NextResponse } from "next/server"
import {
  getNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  getAllTags,
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
    const id = searchParams.get("id")
    const tagsOnly = searchParams.get("tagsOnly") === "true"

    // タグ一覧のみ取得
    if (tagsOnly) {
      const tags = await getAllTags()
      return NextResponse.json({ tags })
    }

    // 単一ノートの取得（コンテンツ含む）
    if (id) {
      const note = await getNoteById(id)
      if (!note) {
        return NextResponse.json(
          { error: "Note not found" },
          { status: 404 }
        )
      }
      return NextResponse.json(note)
    }

    // 一覧の取得
    const subject = searchParams.get("subject") as Subject | undefined
    const tagsParam = searchParams.get("tags")
    const tags = tagsParam ? tagsParam.split(",") : undefined
    const searchQuery = searchParams.get("q") || undefined
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : undefined

    const notes = await getNotes({
      subject,
      tags,
      searchQuery,
      limit,
    })

    return NextResponse.json(notes)
  } catch (error: any) {
    console.error("Failed to get notes:", error)
    return NextResponse.json(
      { error: "Failed to get notes", details: error?.message || String(error) },
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

    // v1.11: 新フィールド対応のバリデーション
    const noteData = {
      noteId: body.noteId,
      noteType: body.noteType || "note",
      title: body.title || "無題",
      content: body.content || null,
      subject: body.subject || null,
      tags: body.tags || [],
      materialId: body.materialId || null,
      pageNumber: body.pageNumber ?? null,
      deviceId: body.deviceId || "",
      createdAt: body.createdAt,
      updatedAt: body.updatedAt || new Date().toISOString(),
    }

    const note = await createNote(noteData)

    return NextResponse.json(note, { status: 201 })
  } catch (error: any) {
    console.error("Failed to create note:", error)
    return NextResponse.json(
      { error: "Failed to create note", details: error?.message || String(error) },
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
        { error: "Note ID is required" },
        { status: 400 }
      )
    }

    await updateNote(id, updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update note:", error)
    return NextResponse.json(
      { error: "Failed to update note" },
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
        { error: "Note ID is required" },
        { status: 400 }
      )
    }

    await deleteNote(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete note:", error)
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    )
  }
}
