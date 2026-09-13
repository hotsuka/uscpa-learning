import { describe, it, expect } from "vitest"
import { planNotionPush } from "./pushPlan"
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
  deviceId: "this-device",
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-01T10:00:00.000Z",
  ...overrides,
})

describe("planNotionPush", () => {
  it("この端末で作ったのにNotionに無い記録を作成対象にする", () => {
    const plan = planNotionPush({
      localRecords: [record({ id: "a" })],
      notionRecords: [],
      notionIdMap: {},
      deviceId: "this-device",
    })

    expect(plan.toCreate.map((r) => r.id)).toEqual(["a"])
    expect(plan.toUpdate).toEqual([])
  })

  it("他の端末で作られた記録はNotionに無くても作成しない（他端末で削除された記録を復活させない）", () => {
    const plan = planNotionPush({
      localRecords: [record({ id: "a", deviceId: "other-device" })],
      notionRecords: [],
      notionIdMap: { a: "a" },
      deviceId: "this-device",
    })

    expect(plan.toCreate).toEqual([])
  })

  it("ローカルの方が1分以上新しい記録を更新対象にする", () => {
    const plan = planNotionPush({
      localRecords: [record({ id: "a", studyMinutes: 70, updatedAt: "2026-09-02T00:00:00.000Z" })],
      notionRecords: [record({ id: "a", studyMinutes: 751, updatedAt: "2026-09-01T00:00:00.000Z" })],
      notionIdMap: { a: "a" },
      deviceId: "this-device",
    })

    expect(plan.toUpdate.map((r) => r.id)).toEqual(["a"])
    expect(plan.toCreate).toEqual([])
  })

  it("Notionの日付が分単位に丸められた差（1分未満）は更新しない", () => {
    const plan = planNotionPush({
      localRecords: [record({ id: "a", updatedAt: "2026-09-13T01:47:42.123Z" })],
      notionRecords: [record({ id: "a", updatedAt: "2026-09-13T01:47:00.000+00:00" })],
      notionIdMap: { a: "a" },
      deviceId: "this-device",
    })

    expect(plan.toUpdate).toEqual([])
  })

  it("Notionの方が新しい記録は更新しない", () => {
    const plan = planNotionPush({
      localRecords: [record({ id: "a", updatedAt: "2026-09-01T00:00:00.000Z" })],
      notionRecords: [record({ id: "a", updatedAt: "2026-09-13T00:00:00.000Z" })],
      notionIdMap: {},
      deviceId: "this-device",
    })

    expect(plan).toEqual({ toCreate: [], toUpdate: [] })
  })

  it("NotionのページIDで対応付けられた古い記録も同じ記録として扱う", () => {
    const plan = planNotionPush({
      localRecords: [record({ id: "record-1768725894721-dw8zy0cwk" })],
      notionRecords: [record({ id: "2ec1ca24-27d3-814e-b094-d5fe0faade68" })],
      notionIdMap: { "record-1768725894721-dw8zy0cwk": "2ec1ca24-27d3-814e-b094-d5fe0faade68" },
      deviceId: "this-device",
    })

    expect(plan).toEqual({ toCreate: [], toUpdate: [] })
  })

  it("同じIDが重複していても1回だけ送る", () => {
    const plan = planNotionPush({
      localRecords: [record({ id: "a" }), record({ id: "a" })],
      notionRecords: [],
      notionIdMap: {},
      deviceId: "this-device",
    })

    expect(plan.toCreate).toHaveLength(1)
  })

  it("上限を超える分は次回に回し、作成を優先して古い順に送る", () => {
    const localRecords = [
      record({ id: "u1", updatedAt: "2026-09-05T00:00:00.000Z" }),
      record({ id: "c2", updatedAt: "2026-09-03T00:00:00.000Z" }),
      record({ id: "c1", updatedAt: "2026-09-02T00:00:00.000Z" }),
    ]
    const plan = planNotionPush({
      localRecords,
      notionRecords: [record({ id: "u1", updatedAt: "2026-09-01T00:00:00.000Z" })],
      notionIdMap: {},
      deviceId: "this-device",
      limit: 2,
    })

    expect(plan.toCreate.map((r) => r.id)).toEqual(["c1", "c2"])
    expect(plan.toUpdate).toEqual([])
  })
})
