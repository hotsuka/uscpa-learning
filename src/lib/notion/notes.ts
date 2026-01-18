import { getNotionClient, getDbIds } from "./client"
import type { Subject, StudyNote } from "@/types"

// 学習ノートを取得
export async function getNotes(options?: {
  subject?: Subject
  tags?: string[]
  searchQuery?: string
  limit?: number
}): Promise<StudyNote[]> {
  const notion = getNotionClient()
  const dbIds = getDbIds()

  if (!dbIds.notes) {
    throw new Error("NOTION_NOTES_DB_ID is not set")
  }

  const filter: any[] = []

  if (options?.subject) {
    filter.push({
      property: "科目",
      select: { equals: options.subject },
    })
  }
  if (options?.tags && options.tags.length > 0) {
    for (const tag of options.tags) {
      filter.push({
        property: "タグ",
        multi_select: { contains: tag },
      })
    }
  }
  if (options?.searchQuery) {
    filter.push({
      property: "名前",
      title: { contains: options.searchQuery },
    })
  }

  const response = await notion.databases.query({
    database_id: dbIds.notes,
    filter: filter.length > 0 ? { and: filter } : undefined,
    sorts: [{ property: "更新日", direction: "descending" }],
    page_size: options?.limit || 100,
  })

  return response.results.map((page: any) => {
    const props = page.properties
    return {
      id: page.id,
      title: props["名前"]?.title?.[0]?.text?.content || "無題",
      content: null, // ページコンテンツは別途取得が必要
      subject: (props["科目"]?.select?.name || null) as Subject | null,
      tags: props["タグ"]?.multi_select?.map((s: any) => s.name) || [],
      createdAt: page.created_time,
      updatedAt: page.last_edited_time,
    }
  })
}

// 学習ノートを1件取得（コンテンツ含む）
export async function getNoteById(pageId: string): Promise<StudyNote | null> {
  const notion = getNotionClient()

  try {
    const page = await notion.pages.retrieve({ page_id: pageId }) as any
    const props = page.properties

    // ページコンテンツを取得
    const blocks = await notion.blocks.children.list({ block_id: pageId })
    const content = blocksToMarkdown(blocks.results)

    return {
      id: page.id,
      title: props["名前"]?.title?.[0]?.text?.content || "無題",
      content,
      subject: (props["科目"]?.select?.name || null) as Subject | null,
      tags: props["タグ"]?.multi_select?.map((s: any) => s.name) || [],
      createdAt: page.created_time,
      updatedAt: page.last_edited_time,
    }
  } catch {
    return null
  }
}

// ブロックをMarkdownに変換
function blocksToMarkdown(blocks: any[]): string {
  return blocks
    .map((block) => {
      const type = block.type

      switch (type) {
        case "paragraph":
          return richTextToPlain(block.paragraph?.rich_text)
        case "heading_1":
          return `# ${richTextToPlain(block.heading_1?.rich_text)}`
        case "heading_2":
          return `## ${richTextToPlain(block.heading_2?.rich_text)}`
        case "heading_3":
          return `### ${richTextToPlain(block.heading_3?.rich_text)}`
        case "bulleted_list_item":
          return `- ${richTextToPlain(block.bulleted_list_item?.rich_text)}`
        case "numbered_list_item":
          return `1. ${richTextToPlain(block.numbered_list_item?.rich_text)}`
        case "code":
          const lang = block.code?.language || ""
          const code = richTextToPlain(block.code?.rich_text)
          return `\`\`\`${lang}\n${code}\n\`\`\``
        case "quote":
          return `> ${richTextToPlain(block.quote?.rich_text)}`
        case "divider":
          return "---"
        case "toggle":
          return `<details>\n<summary>${richTextToPlain(block.toggle?.rich_text)}</summary>\n</details>`
        default:
          return ""
      }
    })
    .filter((line) => line !== "")
    .join("\n\n")
}

function richTextToPlain(richText: any[]): string {
  if (!richText) return ""
  return richText.map((t) => t.plain_text || t.text?.content || "").join("")
}

// Markdownをブロックに変換
function markdownToBlocks(markdown: string): any[] {
  const lines = markdown.split("\n")
  const blocks: any[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // コードブロック
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim() || "plain text"
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push({
        type: "code",
        code: {
          rich_text: [{ type: "text", text: { content: codeLines.join("\n") } }],
          language: lang,
        },
      })
      i++
      continue
    }

    // 見出し
    if (line.startsWith("### ")) {
      blocks.push({
        type: "heading_3",
        heading_3: {
          rich_text: [{ type: "text", text: { content: line.slice(4) } }],
        },
      })
    } else if (line.startsWith("## ")) {
      blocks.push({
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: line.slice(3) } }],
        },
      })
    } else if (line.startsWith("# ")) {
      blocks.push({
        type: "heading_1",
        heading_1: {
          rich_text: [{ type: "text", text: { content: line.slice(2) } }],
        },
      })
    }
    // 箇条書き
    else if (line.startsWith("- ")) {
      blocks.push({
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content: line.slice(2) } }],
        },
      })
    }
    // 番号付きリスト
    else if (/^\d+\.\s/.test(line)) {
      blocks.push({
        type: "numbered_list_item",
        numbered_list_item: {
          rich_text: [{ type: "text", text: { content: line.replace(/^\d+\.\s/, "") } }],
        },
      })
    }
    // 引用
    else if (line.startsWith("> ")) {
      blocks.push({
        type: "quote",
        quote: {
          rich_text: [{ type: "text", text: { content: line.slice(2) } }],
        },
      })
    }
    // 区切り線
    else if (line === "---") {
      blocks.push({ type: "divider", divider: {} })
    }
    // 通常の段落
    else if (line.trim()) {
      blocks.push({
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: line } }],
        },
      })
    }

    i++
  }

  return blocks
}

// 学習ノートを作成
export async function createNote(
  note: Omit<StudyNote, "id" | "createdAt" | "updatedAt">
): Promise<StudyNote> {
  const notion = getNotionClient()
  const dbIds = getDbIds()

  if (!dbIds.notes) {
    throw new Error("NOTION_NOTES_DB_ID is not set")
  }

  const properties: Record<string, any> = {
    名前: {
      title: [{ text: { content: note.title } }],
    },
  }

  if (note.subject) {
    properties["科目"] = { select: { name: note.subject } }
  }
  if (note.tags && note.tags.length > 0) {
    properties["タグ"] = {
      multi_select: note.tags.map((tag) => ({ name: tag })),
    }
  }

  // ページコンテンツをブロックとして追加
  const children = note.content ? markdownToBlocks(note.content) : []

  const response = await notion.pages.create({
    parent: { database_id: dbIds.notes },
    properties,
    children: children.length > 0 ? children : undefined,
  })

  return {
    id: response.id,
    title: note.title,
    content: note.content,
    subject: note.subject,
    tags: note.tags,
    createdAt: (response as any).created_time,
    updatedAt: (response as any).last_edited_time,
  }
}

// 学習ノートを更新
export async function updateNote(
  pageId: string,
  updates: Partial<Omit<StudyNote, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  const notion = getNotionClient()

  const properties: Record<string, any> = {}

  if (updates.title !== undefined) {
    properties["名前"] = { title: [{ text: { content: updates.title } }] }
  }
  if (updates.subject !== undefined) {
    properties["科目"] = updates.subject
      ? { select: { name: updates.subject } }
      : { select: null }
  }
  if (updates.tags !== undefined) {
    properties["タグ"] = {
      multi_select: updates.tags.map((tag) => ({ name: tag })),
    }
  }

  // プロパティを更新
  if (Object.keys(properties).length > 0) {
    await notion.pages.update({
      page_id: pageId,
      properties,
    })
  }

  // コンテンツを更新する場合は、既存ブロックを削除して新規作成
  if (updates.content !== undefined) {
    // 既存ブロックを取得して削除
    const existingBlocks = await notion.blocks.children.list({ block_id: pageId })
    for (const block of existingBlocks.results) {
      await notion.blocks.delete({ block_id: block.id })
    }

    // 新しいブロックを追加
    const newBlocks = markdownToBlocks(updates.content || "")
    if (newBlocks.length > 0) {
      await notion.blocks.children.append({
        block_id: pageId,
        children: newBlocks,
      })
    }
  }
}

// 学習ノートを削除（アーカイブ）
export async function deleteNote(pageId: string): Promise<void> {
  const notion = getNotionClient()

  await notion.pages.update({
    page_id: pageId,
    archived: true,
  })
}

// タグ一覧を取得
export async function getAllTags(): Promise<string[]> {
  const notion = getNotionClient()
  const dbIds = getDbIds()

  if (!dbIds.notes) {
    throw new Error("NOTION_NOTES_DB_ID is not set")
  }

  const database = await notion.databases.retrieve({
    database_id: dbIds.notes,
  }) as any

  const tagProperty = database.properties["タグ"]
  if (tagProperty?.type === "multi_select") {
    return tagProperty.multi_select.options.map((opt: any) => opt.name)
  }

  return []
}
