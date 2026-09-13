import { describe, it, expect } from "vitest"
import { mergeNotionRecords } from "./mergeRecords"
import type { StudyRecord } from "@/types"

const record = (overrides: Partial<StudyRecord> & { id: string }): StudyRecord => ({
  recordType: "practice",
  subject: "BAR",
  subtopic: "Economic Theory",
  studyMinutes: 30,
  totalQuestions: 10,
  correctAnswers: 7,
  roundNumber: 1,
  chapter: null,
  pageRange: null,
  studiedAt: "2026-09-01",
  memo: null,
  fromQuestionBank: true,
  source: "timer",
  sessionId: null,
  deviceId: "device-1",
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-01T10:00:00.000Z",
  ...overrides,
})

describe("mergeNotionRecords", () => {
  it("対応付けが無くても同じIDの記録は重複させない（一括送信した記録を取り込む場合）", () => {
    const local = [record({ id: "a" })]
    const notion = [
      record({ id: "a", createdAt: "2026-09-01T10:00:00.000+00:00", updatedAt: "2026-09-01T10:00:00.000+00:00" }),
    ]

    const { records, notionIdMap } = mergeNotionRecords(local, notion, {})

    expect(records).toHaveLength(1)
    expect(notionIdMap).toEqual({ a: "a" })
  })

  it("2回続けて取り込んでも件数が増えない", () => {
    const local = [record({ id: "a" }), record({ id: "b", createdAt: "2026-09-02T10:00:00.000Z" })]
    const notion = [record({ id: "a" }), record({ id: "c", createdAt: "2026-09-03T10:00:00.000Z" })]

    const first = mergeNotionRecords(local, notion, {})
    const second = mergeNotionRecords(first.records, notion, first.notionIdMap)

    expect(first.records.map((r) => r.id).sort()).toEqual(["a", "b", "c"])
    expect(second.records.map((r) => r.id).sort()).toEqual(["a", "b", "c"])
  })

  it("ローカルの方が新しければローカルを残す", () => {
    const local = [record({ id: "a", studyMinutes: 70, updatedAt: "2026-09-02T00:00:00.000Z" })]
    const notion = [record({ id: "a", studyMinutes: 751, updatedAt: "2026-09-01T00:00:00.000Z" })]

    const { records } = mergeNotionRecords(local, notion, { a: "a" })

    expect(records).toHaveLength(1)
    expect(records[0].studyMinutes).toBe(70)
  })

  it("Notionの方が新しければNotionを採用する", () => {
    const local = [record({ id: "a", subject: "FAR", updatedAt: "2026-09-01T00:00:00.000Z" })]
    const notion = [record({ id: "a", subject: "BAR", updatedAt: "2026-09-13T00:00:00.000Z" })]

    const { records } = mergeNotionRecords(local, notion, {})

    expect(records[0].subject).toBe("BAR")
  })

  it("Notionに無いローカル記録は残す", () => {
    const local = [record({ id: "local-only" })]

    const { records } = mergeNotionRecords(local, [], {})

    expect(records.map((r) => r.id)).toEqual(["local-only"])
  })

  it("NotionのページIDで対応付けられた古い記録も同一とみなす", () => {
    const local = [record({ id: "record-1768725894721-dw8zy0cwk", updatedAt: "2026-01-20T00:00:00.000Z" })]
    const notion = [record({ id: "2ec1ca24-27d3-814e-b094-d5fe0faade68", updatedAt: "2026-01-18T00:00:00.000Z" })]

    const { records } = mergeNotionRecords(local, notion, {
      "record-1768725894721-dw8zy0cwk": "2ec1ca24-27d3-814e-b094-d5fe0faade68",
    })

    expect(records).toHaveLength(1)
    expect(records[0].id).toBe("record-1768725894721-dw8zy0cwk")
  })

  it("Notionにしか無い記録は追加し、作成日時の新しい順に並べる", () => {
    const local = [record({ id: "old", createdAt: "2026-08-01T00:00:00.000Z" })]
    const notion = [record({ id: "new", createdAt: "2026-09-01T00:00:00.000Z" })]

    const { records } = mergeNotionRecords(local, notion, {})

    expect(records.map((r) => r.id)).toEqual(["new", "old"])
  })
})
