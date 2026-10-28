import { describe, it, expect } from "vitest"
import { planPracticeLogPull } from "./practiceLogPull"
import type { LocalPracticeLog } from "./practiceLogPush"
import { buildChunks, mergePracticeLog, serializeChunk, type PracticeLogItemMap, type PracticeLogKind } from "./practiceLog"
import type { PracticeLogRemoteChunk } from "@/lib/notion/practiceLog"
import type { QuestionAttempt } from "@/types/questions"
import type { TBSAttempt } from "@/types/tbs"

const mcq = (questionId: string, attemptedAt: string, selectedAnswer = "A", isCorrect: boolean | null = true): QuestionAttempt => ({
  questionId,
  topic: "Economic Theory",
  selectedAnswer,
  isCorrect,
  attemptedAt,
})

const tbs = (tbsId: string, completedAt: string): TBSAttempt => ({ tbsId, taskAttempts: [], completedAt, totalScore: 80 })

const empty = (): LocalPracticeLog => ({ mcq: [], tbs: [], mock: [] })

// ある端末がNotionへ送った状態のチャンクにする
const remoteOf = <K extends PracticeLogKind>(kind: K, items: PracticeLogItemMap[K][], deviceId: string): PracticeLogRemoteChunk[] =>
  buildChunks(kind, items, deviceId).map((c, i) => ({
    pageId: `page-${deviceId}-${kind}-${i}`,
    key: c.key,
    deviceId,
    kind,
    date: c.date,
    seq: c.seq,
    count: c.items.length,
    hash: serializeChunk(c).hash,
    schemaVersion: 1,
    segments: serializeChunk(c).segments,
    lastEditedTime: "2026-10-28T10:00:00.000Z",
  }))

describe("planPracticeLogPull", () => {
  const mine = [mcq("q1", "2026-10-27T01:00:00.000Z"), mcq("q2", "2026-10-28T01:00:00.000Z")]

  it("ローカルに無い他の端末の回答だけを、取り込み印を付けて選ぶ", () => {
    const other = [mine[0], mcq("q9", "2026-10-26T01:00:00.000Z")]
    const plan = planPracticeLogPull({
      local: { ...empty(), mcq: mine },
      deviceId: "dev-a",
      remote: remoteOf("mcq", other, "dev-b"),
    })

    expect(plan.added).toEqual({ mcq: 1, tbs: 0, mock: 0 })
    expect(plan.additions.mcq).toEqual([{ ...other[1], imported: true }])
  })

  it("この端末のチャンクは読まない", () => {
    const plan = planPracticeLogPull({
      local: empty(),
      deviceId: "dev-a",
      remote: remoteOf("mcq", mine, "dev-a"),
    })

    expect(plan.added.mcq).toBe(0)
  })

  it("複数の端末に同じ回答があっても1件だけ足す", () => {
    const shared = [mcq("q9", "2026-10-26T01:00:00.000Z")]
    const plan = planPracticeLogPull({
      local: empty(),
      deviceId: "dev-a",
      remote: [...remoteOf("mcq", shared, "dev-b"), ...remoteOf("mcq", shared, "dev-c")],
    })

    expect(plan.additions.mcq).toHaveLength(1)
  })

  it("TBSも種類ごとに分けて選ぶ", () => {
    const plan = planPracticeLogPull({
      local: empty(),
      deviceId: "dev-a",
      remote: remoteOf("tbs", [tbs("tbs-1", "2026-10-27T01:00:00.000Z")], "dev-b"),
    })

    expect(plan.added).toEqual({ mcq: 0, tbs: 1, mock: 0 })
    expect(plan.additions.tbs[0].imported).toBe(true)
  })

  it("読めないページは飛ばし、他のページは取り込む", () => {
    const good = remoteOf("mcq", [mcq("q9", "2026-10-26T01:00:00.000Z")], "dev-b")
    const broken: PracticeLogRemoteChunk = { ...good[0], key: "dev-b:mcq:broken:0", segments: ["{"] }
    const plan = planPracticeLogPull({ local: empty(), deviceId: "dev-a", remote: [...good, broken] })

    expect(plan.unreadableChunks).toEqual(["dev-b:mcq:broken:0"])
    expect(plan.added.mcq).toBe(1)
  })

  it("ローカルの回答を書き換えない", () => {
    const data: LocalPracticeLog = { ...empty(), mcq: mine }
    const snapshot = JSON.stringify(data)
    planPracticeLogPull({ local: data, deviceId: "dev-a", remote: remoteOf("mcq", [mcq("q9", "2026-10-26T01:00:00.000Z")], "dev-b") })

    expect(JSON.stringify(data)).toBe(snapshot)
  })

  it("足し合わせるとローカルの回答はそのまま残り、補正前の回答は補正されて取り込み印も残る", () => {
    // cce-131 は 2026-06-29 の修正より前の回答を補正する対象
    const old = mcq("cce-131", "2026-06-01T01:00:00.000Z", "B", false)
    const plan = planPracticeLogPull({ local: { ...empty(), mcq: mine }, deviceId: "dev-a", remote: remoteOf("mcq", [old], "dev-b") })
    const merged = mergePracticeLog("mcq", mine, plan.additions.mcq).items

    expect(merged).toHaveLength(3)
    expect(merged.filter((a) => !a.imported)).toEqual(mine)
    const imported = merged.find((a) => a.questionId === "cce-131")
    expect(imported?.imported).toBe(true)
  })
})
