import { describe, it, expect } from "vitest"
import { planPracticeLogPush, verifyPracticeLog, type LocalPracticeLog } from "./practiceLogPush"
import { buildChunks, serializeChunk } from "./practiceLog"
import type { PracticeLogRemoteChunk } from "@/lib/notion/practiceLog"
import type { QuestionAttempt } from "@/types/questions"

const mcq = (questionId: string, attemptedAt: string): QuestionAttempt => ({
  questionId,
  topic: "Economic Theory",
  selectedAnswer: "A",
  isCorrect: true,
  attemptedAt,
})

const local = (attempts: QuestionAttempt[]): LocalPracticeLog => ({ mcq: attempts, tbs: [], mock: [] })

// ローカルの回答を、ある端末がNotionへ送った状態のチャンクにする
const remoteOf = (attempts: QuestionAttempt[], deviceId: string): PracticeLogRemoteChunk[] =>
  buildChunks("mcq", attempts, deviceId).map((c, i) => ({
    pageId: `page-${deviceId}-${i}`,
    key: c.key,
    deviceId,
    kind: "mcq",
    date: c.date,
    seq: c.seq,
    count: c.items.length,
    hash: serializeChunk(c).hash,
    schemaVersion: 1,
    segments: serializeChunk(c).segments,
    lastEditedTime: "2026-10-28T10:00:00.000Z",
  }))

describe("planPracticeLogPush", () => {
  const attempts = [mcq("q1", "2026-10-27T01:00:00.000Z"), mcq("q2", "2026-10-28T01:00:00.000Z")]

  it("未送信ならすべてのチャンクを送る", () => {
    const plan = planPracticeLogPush({ local: local(attempts), deviceId: "dev-a", pushedHashes: {} })

    expect(plan.totalChunks).toBe(2)
    expect(plan.toSend.map((c) => [c.key, c.count])).toEqual([
      ["dev-a:mcq:2026-10-27:0", 1],
      ["dev-a:mcq:2026-10-28:0", 1],
    ])
  })

  it("送信済みで内容が同じチャンクは送らず、回答が増えた日だけ送る", () => {
    const first = planPracticeLogPush({ local: local(attempts), deviceId: "dev-a", pushedHashes: {} })
    const pushedHashes = Object.fromEntries(first.toSend.map((c) => [c.key, c.hash]))

    const next = planPracticeLogPush({
      local: local([...attempts, mcq("q3", "2026-10-28T02:00:00.000Z")]),
      deviceId: "dev-a",
      pushedHashes,
    })
    expect(next.toSend.map((c) => [c.key, c.count])).toEqual([["dev-a:mcq:2026-10-28:0", 2]])
  })

  it("force なら送信済みでもすべて送る", () => {
    const first = planPracticeLogPush({ local: local(attempts), deviceId: "dev-a", pushedHashes: {} })
    const pushedHashes = Object.fromEntries(first.toSend.map((c) => [c.key, c.hash]))

    expect(planPracticeLogPush({ local: local(attempts), deviceId: "dev-a", pushedHashes, force: true }).toSend).toHaveLength(2)
  })

  it("他の端末から取り込んだ回答は、この端末の分として送らない", () => {
    const imported: QuestionAttempt = { ...mcq("q9", "2026-10-26T01:00:00.000Z"), imported: true }
    const plan = planPracticeLogPush({ local: local([...attempts, imported]), deviceId: "dev-a", pushedHashes: {} })

    expect(plan.toSend.map((c) => c.key)).toEqual(["dev-a:mcq:2026-10-27:0", "dev-a:mcq:2026-10-28:0"])
  })

  it("ローカルの回答を書き換えない", () => {
    const data = local(attempts)
    const snapshot = JSON.stringify(data)
    planPracticeLogPush({ local: data, deviceId: "dev-a", pushedHashes: {} })

    expect(JSON.stringify(data)).toBe(snapshot)
  })
})

describe("verifyPracticeLog", () => {
  const mine = [mcq("q1", "2026-10-27T01:00:00.000Z"), mcq("q2", "2026-10-28T01:00:00.000Z")]

  it("この端末の回答がすべてNotionにあれば未送信は0", () => {
    const result = verifyPracticeLog({ local: local(mine), deviceId: "dev-a", remote: remoteOf(mine, "dev-a") })

    expect(result.kinds[0]).toEqual({ kind: "mcq", local: 2, ownOnNotion: 2, missingOnNotion: 0, onlyOnOtherDevices: 0 })
    expect(result.unreadableChunks).toEqual([])
  })

  it("未送信の件数と、他の端末だけにある件数を数える", () => {
    const other = [mcq("q9", "2026-10-26T01:00:00.000Z"), mine[0]]
    const result = verifyPracticeLog({
      local: local(mine),
      deviceId: "dev-a",
      remote: [...remoteOf([mine[0]], "dev-a"), ...remoteOf(other, "dev-b")],
    })

    expect(result.kinds[0]).toMatchObject({ ownOnNotion: 1, missingOnNotion: 1, onlyOnOtherDevices: 1 })
  })

  it("取り込んだ回答は未送信に数えない", () => {
    const imported: QuestionAttempt = { ...mcq("q9", "2026-10-26T01:00:00.000Z"), imported: true }
    const result = verifyPracticeLog({
      local: local([...mine, imported]),
      deviceId: "dev-a",
      remote: [...remoteOf(mine, "dev-a"), ...remoteOf([imported], "dev-b")],
    })

    expect(result.kinds[0]).toEqual({ kind: "mcq", local: 3, ownOnNotion: 2, missingOnNotion: 0, onlyOnOtherDevices: 0 })
  })

  it("読めないページを数え、他の件数の集計は続ける", () => {
    const broken: PracticeLogRemoteChunk = { ...remoteOf(mine, "dev-a")[0], key: "dev-a:mcq:broken:0", segments: ["{"] }
    const result = verifyPracticeLog({
      local: local(mine),
      deviceId: "dev-a",
      remote: [...remoteOf(mine, "dev-a"), broken],
    })

    expect(result.unreadableChunks).toEqual(["dev-a:mcq:broken:0"])
    expect(result.kinds[0].missingOnNotion).toBe(0)
  })
})
