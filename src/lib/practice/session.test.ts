import { describe, it, expect } from "vitest"
import {
  applyAttempt,
  sessionAccuracy,
  sessionDominantTopic,
  sessionStudyMinutes,
  DEFAULT_ANSWER_SECONDS,
  type PracticeSession,
} from "./session"
import type { QuestionAttempt } from "@/types/questions"

const attempt = (
  overrides: Partial<QuestionAttempt> & { attemptedAt: string },
): QuestionAttempt => ({
  questionId: "far-cce-001",
  topic: "Cash and Cash Equivalents",
  selectedAnswer: "B",
  isCorrect: true,
  ...overrides,
})

describe("applyAttempt", () => {
  it("最初の解答では想定解答時間を積む", () => {
    const s = applyAttempt(undefined, attempt({ attemptedAt: "2026-09-12T01:00:00.000Z" }))

    expect(s.answeredCount).toBe(1)
    expect(s.correctCount).toBe(1)
    expect(s.activeSeconds).toBe(DEFAULT_ANSWER_SECONDS)
    expect(s.startedAt).toBe("2026-09-12T01:00:00.000Z")
  })

  it("続けて解いた場合は実際の解答間隔を積む", () => {
    let s = applyAttempt(undefined, attempt({ attemptedAt: "2026-09-12T01:00:00.000Z" }))
    // 2分後に不正解
    s = applyAttempt(
      s,
      attempt({ attemptedAt: "2026-09-12T01:02:00.000Z", isCorrect: false }),
    )

    expect(s.answeredCount).toBe(2)
    expect(s.correctCount).toBe(1)
    expect(s.activeSeconds).toBe(DEFAULT_ANSWER_SECONDS + 120)
  })

  it("5分以上空いた解答は実経過時間を積まない（席を外していた分を除外する）", () => {
    let s = applyAttempt(undefined, attempt({ attemptedAt: "2026-09-12T01:00:00.000Z" }))
    // 3時間後に再開
    s = applyAttempt(s, attempt({ attemptedAt: "2026-09-12T04:00:00.000Z" }))

    expect(s.activeSeconds).toBe(DEFAULT_ANSWER_SECONDS * 2)
    // セッション開始時刻は最初の解答のまま
    expect(s.startedAt).toBe("2026-09-12T01:00:00.000Z")
  })

  it("正誤不明(null)の解答は正解に数えない", () => {
    const s = applyAttempt(
      undefined,
      attempt({ attemptedAt: "2026-09-12T01:00:00.000Z", isCorrect: null }),
    )

    expect(s.answeredCount).toBe(1)
    expect(s.correctCount).toBe(0)
  })

  it("トピックごとの解答数を数える", () => {
    let s = applyAttempt(undefined, attempt({ attemptedAt: "2026-09-12T01:00:00.000Z" }))
    s = applyAttempt(
      s,
      attempt({ attemptedAt: "2026-09-12T01:01:00.000Z", topic: "Leases" }),
    )
    s = applyAttempt(
      s,
      attempt({ attemptedAt: "2026-09-12T01:02:00.000Z", topic: "Leases" }),
    )

    expect(s.topicCounts).toEqual({ "Cash and Cash Equivalents": 1, Leases: 2 })
    expect(sessionDominantTopic(s)).toBe("Leases")
  })
})

describe("集計", () => {
  const base: PracticeSession = {
    startedAt: "2026-09-12T01:00:00.000Z",
    lastAnsweredAt: "2026-09-12T01:30:00.000Z",
    answeredCount: 3,
    correctCount: 2,
    activeSeconds: 1830,
    topicCounts: { Leases: 3 },
  }

  it("学習時間は分に丸める", () => {
    expect(sessionStudyMinutes(base)).toBe(31)
  })

  it("1分未満でも0分の記録は作らない", () => {
    expect(sessionStudyMinutes({ ...base, activeSeconds: 20 })).toBe(1)
  })

  it("正答率を百分率で返す", () => {
    expect(sessionAccuracy(base)).toBe(67)
  })

  it("解答数0なら正答率はnull", () => {
    expect(sessionAccuracy({ ...base, answeredCount: 0, correctCount: 0 })).toBeNull()
  })
})
