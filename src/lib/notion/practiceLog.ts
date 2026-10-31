import { isFullPage } from "@notionhq/client"
import type {
  CreatePageParameters,
  PageObjectResponse,
  QueryDatabaseParameters,
} from "@notionhq/client/build/src/api-endpoints"
import { getNotionClient } from "./client"
import type { PracticeLogKind } from "@/lib/sync/practiceLog"

/**
 * 問題演習ログDB（回答・TBS・模試の結果を端末別・日別のチャンクで保存する）の読み書き
 *
 * チャンクの中身の組み立て・分割・足し合わせは src/lib/sync/practiceLog.ts が担い、
 * ここはNotionのプロパティとの変換と、APIの呼び出しだけを行う。
 * ページは消さない（同期の取り込みは和集合なので削除を伝える必要がない）。
 */

// Notion側のプロパティ名（DBの列名と一致させる）
const PROP = {
  key: "チャンクキー",
  deviceId: "端末ID",
  kind: "種類",
  date: "日付",
  seq: "連番",
  count: "件数",
  hash: "ハッシュ",
  schemaVersion: "形式バージョン",
  data: "データ",
} as const

/** Notionへ書き込むチャンク（中身はテキストの区切りにしたもの） */
export interface PracticeLogChunkInput {
  key: string
  deviceId: string
  kind: PracticeLogKind
  date: string
  seq: number
  count: number
  hash: string
  schemaVersion: number
  segments: string[]
}

/** Notionから読んだチャンク */
export interface PracticeLogRemoteChunk {
  pageId: string
  key: string
  deviceId: string
  kind: PracticeLogKind | null
  date: string | null
  seq: number | null
  count: number | null
  hash: string
  schemaVersion: number | null
  segments: string[]
  lastEditedTime: string
}

export interface UpsertResult {
  key: string
  pageId: string
  status: "created" | "updated"
}

export function getPracticeLogDbId(): string | undefined {
  return process.env.NOTION_PRACTICE_LOG_DB_ID?.trim() || undefined
}

export function isPracticeLogConfigured(): boolean {
  return !!(process.env.NOTION_API_KEY?.trim() && getPracticeLogDbId())
}

const requireDbId = (): string => {
  const dbId = getPracticeLogDbId()
  if (!dbId) throw new Error("NOTION_PRACTICE_LOG_DB_ID is not set")
  return dbId
}

const plainText = (items: { plain_text: string }[]): string =>
  items.map((t) => t.plain_text).join("")

/** チャンクをNotionページのプロパティにする */
export function chunkToProperties(chunk: PracticeLogChunkInput): CreatePageParameters["properties"] {
  return {
    [PROP.key]: { title: [{ text: { content: chunk.key } }] },
    [PROP.deviceId]: { rich_text: [{ text: { content: chunk.deviceId } }] },
    [PROP.kind]: { select: { name: chunk.kind } },
    [PROP.date]: { date: { start: chunk.date } },
    [PROP.seq]: { number: chunk.seq },
    [PROP.count]: { number: chunk.count },
    [PROP.hash]: { rich_text: [{ text: { content: chunk.hash } }] },
    [PROP.schemaVersion]: { number: chunk.schemaVersion },
    [PROP.data]: { rich_text: chunk.segments.map((s) => ({ text: { content: s } })) },
  }
}

const KINDS: readonly PracticeLogKind[] = ["mcq", "tbs", "mock", "flash"]

/** Notionページをチャンクとして読む。列が欠けていても落とさず、読めた範囲で返す */
export function pageToRemoteChunk(page: PageObjectResponse): PracticeLogRemoteChunk {
  const props = page.properties
  const title = props[PROP.key]
  const text = (name: string): string => {
    const p = props[name]
    return p?.type === "rich_text" ? plainText(p.rich_text) : ""
  }
  const num = (name: string): number | null => {
    const p = props[name]
    return p?.type === "number" ? p.number : null
  }
  const kindProp = props[PROP.kind]
  const kindName = kindProp?.type === "select" ? kindProp.select?.name : undefined
  const dateProp = props[PROP.date]
  const data = props[PROP.data]

  return {
    pageId: page.id,
    key: title?.type === "title" ? plainText(title.title) : "",
    deviceId: text(PROP.deviceId),
    kind: KINDS.find((k) => k === kindName) ?? null,
    date: dateProp?.type === "date" ? (dateProp.date?.start ?? null) : null,
    seq: num(PROP.seq),
    count: num(PROP.count),
    hash: text(PROP.hash),
    schemaVersion: num(PROP.schemaVersion),
    // 区切りは保存時の2000字単位とは限らない（Notionが隣り合う区切りをまとめることがある）。
    // 呼び出し側は join して使うので、要素ごとの plain_text をそのまま返す
    segments: data?.type === "rich_text" ? data.rich_text.map((t) => t.plain_text) : [],
    lastEditedTime: page.last_edited_time,
  }
}

/**
 * チャンクを取得する。
 * - since: この時刻以降に更新されたページだけ（Notionの更新時刻は分単位に丸められるため、呼び出し側で余裕を取る）
 * - excludeDeviceId: この端末が書いたページを除く（自分の回答はローカルにあるので取り込む必要がない）
 */
export async function getPracticeLogChunks(options?: {
  since?: string
  excludeDeviceId?: string
}): Promise<PracticeLogRemoteChunk[]> {
  const notion = getNotionClient()
  const databaseId = requireDbId()

  const filters: Extract<QueryDatabaseParameters["filter"], { and: unknown }>["and"] = []
  if (options?.since) {
    filters.push({ timestamp: "last_edited_time", last_edited_time: { on_or_after: options.since } })
  }
  if (options?.excludeDeviceId) {
    filters.push({ property: PROP.deviceId, rich_text: { does_not_equal: options.excludeDeviceId } })
  }

  const chunks: PracticeLogRemoteChunk[] = []
  let cursor: string | undefined
  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: filters.length > 0 ? { and: filters } : undefined,
      sorts: [{ timestamp: "last_edited_time", direction: "ascending" }],
      page_size: 100,
      start_cursor: cursor,
    })
    for (const page of response.results) {
      if (isFullPage(page)) chunks.push(pageToRemoteChunk(page))
    }
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined
  } while (cursor)

  return chunks
}

/** チャンクキーでページを探す。同じキーのページが複数あれば最初のものを使う */
async function findPageIdByKey(key: string): Promise<string | null> {
  const notion = getNotionClient()
  const response = await notion.databases.query({
    database_id: requireDbId(),
    filter: { property: PROP.key, title: { equals: key } },
    page_size: 1,
  })
  return response.results[0]?.id ?? null
}

/**
 * チャンクを1件書き込む。同じキーのページがあれば更新し、無ければ作る。
 * ページIDを呼び出し側から受け取らず毎回キーで探すのは、古いIDで別のチャンクを上書きしないため。
 */
export async function upsertPracticeLogChunk(chunk: PracticeLogChunkInput): Promise<UpsertResult> {
  const notion = getNotionClient()
  const properties = chunkToProperties(chunk)

  const existingId = await findPageIdByKey(chunk.key)
  if (existingId) {
    await notion.pages.update({ page_id: existingId, properties })
    return { key: chunk.key, pageId: existingId, status: "updated" }
  }

  const created = await notion.pages.create({
    parent: { database_id: requireDbId() },
    properties,
  })
  return { key: chunk.key, pageId: created.id, status: "created" }
}
