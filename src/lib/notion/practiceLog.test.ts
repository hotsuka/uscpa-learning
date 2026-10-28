import { describe, it, expect } from "vitest"
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints"
import { chunkToProperties, pageToRemoteChunk, type PracticeLogChunkInput } from "./practiceLog"
import { practiceLogPushSchema, MAX_CHUNKS_PER_REQUEST } from "@/lib/validations/practiceLog"
import { MAX_SEGMENT_CHARS, MAX_SEGMENTS } from "@/lib/sync/practiceLog"

const chunk = (overrides: Partial<PracticeLogChunkInput> = {}): PracticeLogChunkInput => ({
  key: "dev-a:mcq:2026-10-28:0",
  deviceId: "dev-a",
  kind: "mcq",
  date: "2026-10-28",
  seq: 0,
  count: 2,
  hash: "0123abcd",
  schemaVersion: 1,
  segments: ['{"v":1,"items":[', "]}"],
  ...overrides,
})

// 書き込み用のプロパティを、Notionが返す形（plain_text 付き）に変換する
const toResponseProperties = (properties: ReturnType<typeof chunkToProperties>): PageObjectResponse["properties"] => {
  const richText = (items: { text: { content: string } }[]) =>
    items.map((t) => ({ type: "text", text: { content: t.text.content, link: null }, plain_text: t.text.content }))
  const result: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(properties as Record<string, Record<string, unknown>>)) {
    if ("title" in value) result[name] = { type: "title", title: richText(value.title as { text: { content: string } }[]) }
    else if ("rich_text" in value)
      result[name] = { type: "rich_text", rich_text: richText(value.rich_text as { text: { content: string } }[]) }
    else if ("select" in value) result[name] = { type: "select", select: value.select }
    else if ("date" in value) result[name] = { type: "date", date: value.date }
    else if ("number" in value) result[name] = { type: "number", number: value.number }
  }
  return result as PageObjectResponse["properties"]
}

const page = (properties: PageObjectResponse["properties"]): PageObjectResponse =>
  ({
    object: "page",
    id: "page-1",
    last_edited_time: "2026-10-28T10:00:00.000Z",
    properties,
  }) as PageObjectResponse

describe("chunkToProperties / pageToRemoteChunk", () => {
  it("書き込んだプロパティをそのまま読み戻せる", () => {
    const input = chunk()
    const remote = pageToRemoteChunk(page(toResponseProperties(chunkToProperties(input))))

    expect(remote).toEqual({
      pageId: "page-1",
      key: input.key,
      deviceId: input.deviceId,
      kind: "mcq",
      date: "2026-10-28",
      seq: 0,
      count: 2,
      hash: input.hash,
      schemaVersion: 1,
      segments: input.segments,
      lastEditedTime: "2026-10-28T10:00:00.000Z",
    })
  })

  it("列が欠けている・未知の種類のページでも落ちずに空の値で返す", () => {
    const remote = pageToRemoteChunk(page({ 種類: { type: "select", select: { name: "unknown" } } } as never))

    expect(remote).toMatchObject({ key: "", deviceId: "", kind: null, seq: null, segments: [] })
  })
})

describe("practiceLogPushSchema", () => {
  it("正しいチャンクを通す", () => {
    expect(practiceLogPushSchema.safeParse({ chunks: [chunk()] }).success).toBe(true)
  })

  it("キーが中身と食い違うチャンクを弾く（別の端末・日のページを上書きしないため）", () => {
    const result = practiceLogPushSchema.safeParse({ chunks: [chunk({ key: "dev-b:mcq:2026-10-28:0" })] })
    expect(result.success).toBe(false)
  })

  it("Notionの字数・区切り数の上限を超えるチャンクを弾く", () => {
    const tooLong = chunk({ segments: ["x".repeat(MAX_SEGMENT_CHARS + 1)] })
    const tooMany = chunk({ segments: Array.from({ length: MAX_SEGMENTS + 1 }, () => "x") })

    expect(practiceLogPushSchema.safeParse({ chunks: [tooLong] }).success).toBe(false)
    expect(practiceLogPushSchema.safeParse({ chunks: [tooMany] }).success).toBe(false)
  })

  it("1回の送信のチャンク数に上限がある", () => {
    const chunks = Array.from({ length: MAX_CHUNKS_PER_REQUEST + 1 }, (_, seq) =>
      chunk({ seq, key: `dev-a:mcq:2026-10-28:${seq}` }),
    )
    expect(practiceLogPushSchema.safeParse({ chunks }).success).toBe(false)
    expect(practiceLogPushSchema.safeParse({ chunks: chunks.slice(0, MAX_CHUNKS_PER_REQUEST) }).success).toBe(true)
  })
})
