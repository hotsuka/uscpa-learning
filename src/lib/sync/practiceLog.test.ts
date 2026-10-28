import { describe, it, expect } from "vitest"
import {
  buildChunks,
  hashString,
  itemKey,
  mergePracticeLog,
  parseChunkPayload,
  selectOwnItems,
  serializeChunk,
  splitSegments,
  MAX_CHUNK_CHARS,
  MAX_SEGMENT_CHARS,
  MAX_SEGMENTS,
} from "./practiceLog"
import type { QuestionAttempt } from "@/types/questions"
import type { TBSAttempt } from "@/types/tbs"
import type { MockExamResult } from "@/stores/mockExamStore"

const mcq = (overrides: Partial<QuestionAttempt> & { attemptedAt: string }): QuestionAttempt => ({
  questionId: "bar-001",
  topic: "Economic Theory",
  selectedAnswer: "A",
  isCorrect: true,
  ...overrides,
})

const tbs = (overrides: Partial<TBSAttempt> & { completedAt: string }): TBSAttempt => ({
  tbsId: "bar-tbs-001",
  taskAttempts: [],
  totalScore: 80,
  ...overrides,
})

const mock = (overrides: Partial<MockExamResult> & { id: string; finishedAt: string }): MockExamResult => ({
  subject: "BAR",
  startedAt: overrides.finishedAt,
  totalQuestions: 1,
  correctCount: 1,
  score: 100,
  areaBreakdown: {},
  difficultyBreakdown: {},
  topicBreakdown: {},
  answers: [],
  ...overrides,
})

describe("buildChunks", () => {
  it("JSTの日付ごとに分ける（UTCでは前日でもJSTで翌日なら翌日のチャンク）", () => {
    const chunks = buildChunks(
      "mcq",
      [
        mcq({ questionId: "q1", attemptedAt: "2026-10-27T14:59:00.000Z" }), // JST 10/27 23:59
        mcq({ questionId: "q2", attemptedAt: "2026-10-27T15:00:00.000Z" }), // JST 10/28 00:00
      ],
      "dev-a",
    )

    expect(chunks.map((c) => [c.key, c.items.map((i) => i.questionId)])).toEqual([
      ["dev-a:mcq:2026-10-27:0", ["q1"]],
      ["dev-a:mcq:2026-10-28:0", ["q2"]],
    ])
  })

  it("1日分が上限を超えるときは連番を振って分け、どのチャンクも上限に収まる", () => {
    const items = Array.from({ length: 800 }, (_, i) =>
      mcq({
        questionId: `q-${String(i).padStart(4, "0")}`,
        topic: "Governmental Accounting and Reporting",
        attemptedAt: `2026-10-28T0${Math.floor(i / 100)}:00:${String(i % 60).padStart(2, "0")}.000Z`,
      }),
    )
    const chunks = buildChunks("mcq", items, "dev-a")

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.map((c) => c.seq)).toEqual(chunks.map((_, i) => i))
    for (const chunk of chunks) {
      expect(JSON.stringify(chunk.items).length).toBeLessThanOrEqual(MAX_CHUNK_CHARS)
      expect(serializeChunk(chunk).segments.length).toBeLessThanOrEqual(MAX_SEGMENTS)
    }
    expect(chunks.flatMap((c) => c.items)).toHaveLength(800)
  })

  it("入力の並びが違っても同じチャンクになる（変更が無ければハッシュも変わらない）", () => {
    const items = [
      mcq({ questionId: "q2", attemptedAt: "2026-10-28T01:00:00.000Z" }),
      mcq({ questionId: "q1", attemptedAt: "2026-10-28T01:00:00.000Z" }),
      mcq({ questionId: "q3", attemptedAt: "2026-10-28T00:00:00.000Z" }),
    ]
    const a = buildChunks("mcq", items, "dev-a")
    const b = buildChunks("mcq", [...items].reverse(), "dev-a")

    expect(a.map((c) => serializeChunk(c).hash)).toEqual(b.map((c) => serializeChunk(c).hash))
    expect(a[0].items.map((i) => i.questionId)).toEqual(["q3", "q1", "q2"])
  })

  it("1件で1ページに収まらない回答はエラーにする（黙って切り捨てない）", () => {
    const huge = mock({
      id: "m1",
      finishedAt: "2026-10-28T00:00:00.000Z",
      topicBreakdown: { x: { correct: 0, total: "y".repeat(MAX_CHUNK_CHARS) as unknown as number } },
    })
    expect(() => buildChunks("mock", [huge], "dev-a")).toThrow("収まりません")
  })
})

describe("serializeChunk / parseChunkPayload", () => {
  it("区切って保存したものを元に戻せる", () => {
    const items = Array.from({ length: 50 }, (_, i) =>
      tbs({ tbsId: `t${i}`, completedAt: `2026-10-28T00:00:${String(i).padStart(2, "0")}.000Z` }),
    )
    const [chunk] = buildChunks("tbs", items, "dev-a")
    const { segments } = serializeChunk(chunk)

    expect(segments.every((s) => s.length <= MAX_SEGMENT_CHARS)).toBe(true)
    expect(parseChunkPayload("tbs", segments)).toEqual({ items: chunk.items, skipped: 0 })
  })

  it("読めないJSON・未知の形式は null、形の合わない回答は1件ずつ読み飛ばす", () => {
    expect(parseChunkPayload("mcq", ['{"v":1,"items":['])).toBeNull()
    expect(parseChunkPayload("mcq", [JSON.stringify({ v: 999, items: [] })])).toBeNull()

    const ok = mcq({ attemptedAt: "2026-10-28T00:00:00.000Z" })
    const parsed = parseChunkPayload("mcq", [
      JSON.stringify({ v: 1, items: [ok, { questionId: "x" }, null, { ...ok, isCorrect: null }] }),
    ])
    expect(parsed).toEqual({ items: [ok, { ...ok, isCorrect: null }], skipped: 2 })
  })
})

describe("splitSegments", () => {
  it("サロゲートペアの途中では区切らない", () => {
    const text = "a".repeat(MAX_SEGMENT_CHARS - 1) + "𠮷" + "b"
    const segments = splitSegments(text)

    expect(segments.join("")).toBe(text)
    expect(segments[0]).toBe("a".repeat(MAX_SEGMENT_CHARS - 1))
    expect(segments[1]).toBe("𠮷b")
  })
})

describe("mergePracticeLog", () => {
  it("ローカルに無い回答だけを追加し、同じキーならローカルを残す", () => {
    const local = [mcq({ questionId: "q1", attemptedAt: "2026-10-28T01:00:00.000Z", isCorrect: false })]
    const remote = [
      mcq({ questionId: "q1", attemptedAt: "2026-10-28T01:00:00.000Z", isCorrect: true }),
      mcq({ questionId: "q2", attemptedAt: "2026-10-28T00:00:00.000Z" }),
      mcq({ questionId: "q2", attemptedAt: "2026-10-28T00:00:00.000Z" }),
    ]
    const result = mergePracticeLog("mcq", local, remote)

    expect(result.added).toBe(1)
    // 古い順に並ぶ
    expect(result.items.map((a) => [a.questionId, a.isCorrect])).toEqual([
      ["q2", true],
      ["q1", false],
    ])
  })

  it("リモートが空・既に全部あるならローカルの配列をそのまま返す", () => {
    const local = [mcq({ attemptedAt: "2026-10-28T01:00:00.000Z" })]

    expect(mergePracticeLog("mcq", local, []).items).toBe(local)
    expect(mergePracticeLog("mcq", local, [...local]).items).toBe(local)
  })

  it("ローカルにだけある回答は消さない", () => {
    const local = [
      mcq({ questionId: "q1", attemptedAt: "2026-10-28T01:00:00.000Z" }),
      mcq({ questionId: "q2", attemptedAt: "2026-10-28T02:00:00.000Z" }),
    ]
    const result = mergePracticeLog("mcq", local, [mcq({ questionId: "q3", attemptedAt: "2026-10-28T03:00:00.000Z" })])

    expect(result.items.map((a) => a.questionId)).toEqual(["q1", "q2", "q3"])
  })

  it("取り込むMCの回答には正誤補正をかける", () => {
    const remote = [mcq({ questionId: "eq-048", selectedAnswer: "C", isCorrect: false, attemptedAt: "2026-05-22T00:00:00.000Z" })]

    expect(mergePracticeLog("mcq", [], remote).items[0].isCorrect).toBe(true)
  })

  it("TBSは古い順に並べ、最新の回答が末尾に来る", () => {
    const local = [tbs({ completedAt: "2026-10-20T00:00:00.000Z", totalScore: 60 })]
    const remote = [tbs({ completedAt: "2026-10-10T00:00:00.000Z", totalScore: 40 })]
    const { items } = mergePracticeLog("tbs", local, remote)

    expect(items.at(-1)?.totalScore).toBe(60)
  })

  it("模試は新しい順に並べる（mockExamStore と同じ）", () => {
    const local = [mock({ id: "m1", finishedAt: "2026-10-10T00:00:00.000Z" })]
    const remote = [mock({ id: "m2", finishedAt: "2026-10-20T00:00:00.000Z" })]

    expect(mergePracticeLog("mock", local, remote).items.map((r) => r.id)).toEqual(["m2", "m1"])
  })
})

describe("selectOwnItems", () => {
  it("他の端末のチャンクにある回答は自分のチャンクに入れない", () => {
    const own = mcq({ questionId: "q1", attemptedAt: "2026-10-28T01:00:00.000Z" })
    const fromOther = mcq({ questionId: "q2", attemptedAt: "2026-10-28T02:00:00.000Z" })

    expect(selectOwnItems("mcq", [own, fromOther], new Set([itemKey("mcq", fromOther)]))).toEqual([own])
  })
})

describe("hashString", () => {
  it("同じ文字列は同じ値、違えば違う値", () => {
    expect(hashString("abc")).toBe(hashString("abc"))
    expect(hashString("abc")).not.toBe(hashString("abd"))
    expect(hashString("")).toMatch(/^[0-9a-f]{8}$/)
  })
})
