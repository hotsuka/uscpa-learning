import { describe, it, expect } from "vitest"
import {
  buildFreshMockExam,
  buildMockExam,
  countFreshMockRuns,
  countSeenQuestions,
  MOCK_EXAM_QUESTION_COUNT,
} from "@/lib/mockExam"
import { getBarScopeForQuestion } from "@/data/questions/bar/barScope"
import { barFreshMockQuestionSets, barQuestionSets } from "@/data/questions/bar"

describe("countSeenQuestions", () => {
  it("questionIdごとの出題回数を集計する", () => {
    const counts = countSeenQuestions([
      { answers: [{ questionId: "a" }, { questionId: "b" }] },
      { answers: [{ questionId: "a" }] },
      {},
    ])
    expect(counts).toEqual({ a: 2, b: 1 })
  })
})

describe("buildMockExam", () => {
  it("50問をArea配分18/17/15で抽出する", () => {
    const entries = buildMockExam()
    expect(entries).toHaveLength(MOCK_EXAM_QUESTION_COUNT)
    const byArea = entries.reduce<Record<string, number>>((acc, e) => {
      acc[e.area] = (acc[e.area] ?? 0) + 1
      return acc
    }, {})
    expect(byArea).toEqual({ I: 18, II: 17, III: 15 })
  })

  it("同一模試内で問題が重複しない", () => {
    const ids = buildMockExam().map((e) => e.question.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("正解ラベルがシャッフル後の選択肢と整合する", () => {
    for (const entry of buildMockExam()) {
      const shuffled = entry.choices.find((c) => c.label === entry.correctAnswer)
      const original = entry.question.choices.find(
        (c) => c.label === entry.question.correctAnswer,
      )
      expect(shuffled?.text).toBe(original?.text)
      expect(entry.shuffledToOriginalLabel[entry.correctAnswer]).toBe(
        entry.question.correctAnswer,
      )
    }
  })

  it("出題履歴を渡すと未出題を優先して重複を抑える", () => {
    const seenCounts: Record<string, number> = {}
    let duplicates = 0
    // 20回分（延べ1000問）を連続で生成し、既出が再出題される回数を数える
    for (let i = 0; i < 20; i++) {
      for (const entry of buildMockExam(seenCounts)) {
        const id = entry.question.id
        if (seenCounts[id]) duplicates++
        seenCounts[id] = (seenCounts[id] ?? 0) + 1
      }
    }
    // 履歴を渡さない従来ロジックでは同条件で約144回の重複が発生する
    expect(duplicates).toBeLessThan(10)
  })

  it("全問が出題済みでも50問を返す", () => {
    const seenCounts: Record<string, number> = {}
    for (const entry of buildMockExam()) seenCounts[entry.question.id] = 1
    // 重みが同値に潰れても抽出が成立すること
    expect(buildMockExam(seenCounts)).toHaveLength(MOCK_EXAM_QUESTION_COUNT)
  })
})

describe("buildMockExam（BAR）", () => {
  it("50問をArea配分22/20/8で抽出する", () => {
    const entries = buildMockExam({}, "BAR")
    expect(entries).toHaveLength(MOCK_EXAM_QUESTION_COUNT)
    const byArea = entries.reduce<Record<string, number>>((acc, e) => {
      acc[e.area] = (acc[e.area] ?? 0) + 1
      return acc
    }, {})
    expect(byArea).toEqual({ I: 22, II: 20, III: 8 })
  })

  it("同一模試内で問題が重複しない", () => {
    const ids = buildMockExam({}, "BAR").map((e) => e.question.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("Area I に範囲外と判定済みの問題を出さない", () => {
    const setIdByQuestionId = new Map<string, string>()
    for (const set of barQuestionSets)
      for (const q of set.questions) setIdByQuestionId.set(q.id, set.id)
    // 抽出は乱数なので複数回回して取りこぼしを減らす
    for (let i = 0; i < 20; i++) {
      for (const entry of buildMockExam({}, "BAR").filter((e) => e.area === "I")) {
        const setId = setIdByQuestionId.get(entry.question.id)
        expect(setId).toBeDefined()
        expect(getBarScopeForQuestion(setId!, entry.question.id)).not.toBe("out")
      }
    }
  })

  it("企業側の年金会計（出題範囲外）を出さない", () => {
    for (let i = 0; i < 20; i++) {
      const ids = buildMockExam({}, "BAR").map((e) => e.question.id)
      expect(ids.filter((id) => id.startsWith("pen-"))).toEqual([])
    }
  })
})

describe("buildFreshMockExam（BAR初見模試）", () => {
  const freshIds = barFreshMockQuestionSets.flatMap(({ set }) => set.questions.map((q) => q.id))

  it("初見模試用の問題をすべて解いていれば組めない", () => {
    const attempted = new Set(freshIds)
    expect(countFreshMockRuns(attempted)).toBe(0)
    expect(buildFreshMockExam(attempted)).toBeNull()
  })

  it("未解答の初見模試用の問題だけで Area 配分どおりに組む", () => {
    const runs = countFreshMockRuns(new Set())
    if (runs < 1) return // 問題を投入する前は組めない
    // 1回分を解いた扱いにすると残り回数が1減り、その問題は二度と出ない
    const first = buildFreshMockExam(new Set())!
    const firstIds = new Set(first.map((e) => e.question.id))
    expect(first).toHaveLength(MOCK_EXAM_QUESTION_COUNT)
    expect(first.every((e) => freshIds.includes(e.question.id))).toBe(true)
    const byArea = first.reduce<Record<string, number>>((acc, e) => {
      acc[e.area] = (acc[e.area] ?? 0) + 1
      return acc
    }, {})
    expect(byArea).toEqual({ I: 22, II: 20, III: 8 })
    expect(countFreshMockRuns(firstIds)).toBe(runs - 1)
    const second = buildFreshMockExam(firstIds)
    if (second) expect(second.some((e) => firstIds.has(e.question.id))).toBe(false)
  })

  it("Area 内のテーマ別出題数は未解答数に比例する（過去問の論点比率を保つ）", () => {
    if (countFreshMockRuns(new Set()) < 1) return
    const exam = buildFreshMockExam(new Set())!
    const quota: Record<string, number> = { I: 22, II: 20, III: 8 }
    for (const { set, area } of barFreshMockQuestionSets) {
      const total = barFreshMockQuestionSets
        .filter((f) => f.area === area)
        .reduce((sum, f) => sum + f.set.questions.length, 0)
      const topics = new Set(set.questions.map((q) => q.topic))
      for (const topic of topics) {
        const expected = (quota[area] * set.questions.filter((q) => q.topic === topic).length) / total
        const actual = exam.filter((e) => e.area === area && e.question.topic === topic).length
        expect(actual).toBeGreaterThanOrEqual(Math.floor(expected))
        expect(actual).toBeLessThanOrEqual(Math.ceil(expected))
      }
    }
  })
})
