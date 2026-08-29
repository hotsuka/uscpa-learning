import { describe, it, expect } from "vitest";
import type { QuestionAttempt } from "@/types/questions";
import { barQuestionSets } from "@/data/questions/bar";
import {
  computeBarGateStatus,
  BAR_GATE1_RATE,
  BAR_PASS_LINE_RATE,
  BAR_SAFE_RATE,
} from "./examGate";

// 実データの問題IDを使う（モックのIDだとBAR判定のフィルタを通らないため）
const m44 = barQuestionSets.find((s) => s.id.includes("m44"))!;
const ch51 = barQuestionSets.find((s) => s.id.includes("ch51"))!;

const attempt = (
  questionId: string,
  isCorrect: boolean | null,
  attemptedAt: string,
): QuestionAttempt => ({
  questionId,
  topic: "dummy",
  selectedAnswer: "A",
  isCorrect,
  attemptedAt,
});

describe("computeBarGateStatus", () => {
  it("BARバンクの総問題数を集計する", () => {
    const status = computeBarGateStatus([]);
    const expected = barQuestionSets.reduce(
      (sum, s) => sum + s.questions.length,
      0,
    );
    expect(status.total).toBe(expected);
    expect(status.attempted).toBe(0);
    expect(status.remaining).toBe(expected);
    expect(status.rate).toBeNull();
  });

  it("FAR問題のattemptは集計対象に含めない", () => {
    const status = computeBarGateStatus([
      attempt("cf-001", true, "2026-08-01T00:00:00.000Z"),
    ]);
    expect(status.attempted).toBe(0);
    expect(status.firstSeenTotal).toBe(0);
  });

  it("初見（最初の解答）のみで正答率を出し、解き直しでは上書きされない", () => {
    const id = m44.questions[0].id;
    const status = computeBarGateStatus([
      attempt(id, false, "2026-08-10T00:00:00.000Z"),
      attempt(id, true, "2026-08-20T00:00:00.000Z"),
    ]);
    expect(status.firstSeenTotal).toBe(1);
    expect(status.firstSeenCorrect).toBe(0);
    expect(status.rate).toBe(0);
    // 解答済みの数は1問（重複カウントしない）
    expect(status.attempted).toBe(1);
  });

  it("正誤不明(null)は初見の分母から除くが、解答済みには数える", () => {
    const id = m44.questions[1].id;
    const status = computeBarGateStatus([
      attempt(id, null, "2026-08-10T00:00:00.000Z"),
      attempt(id, true, "2026-08-20T00:00:00.000Z"),
    ]);
    expect(status.attempted).toBe(1);
    expect(status.firstSeenTotal).toBe(1);
    expect(status.firstSeenCorrect).toBe(1);
  });

  it("セット別に集計する", () => {
    const status = computeBarGateStatus([
      attempt(m44.questions[0].id, true, "2026-08-10T00:00:00.000Z"),
      attempt(ch51.questions[0].id, false, "2026-08-11T00:00:00.000Z"),
    ]);
    const m44Stat = status.sets.find((s) => s.id === m44.id)!;
    const ch51Stat = status.sets.find((s) => s.id === ch51.id)!;
    expect(m44Stat.rate).toBe(100);
    expect(ch51Stat.rate).toBe(0);
    expect(status.rate).toBe(50);
  });

  it("較正値のしきい値でゲート判定が切り替わる", () => {
    // 100問中78問正解 → 78%（安全圏76%超え）
    const ids = m44.questions.slice(0, 100).map((q) => q.id);
    const attempts = ids.map((id, i) =>
      attempt(id, i < 78, "2026-08-10T00:00:00.000Z"),
    );
    const status = computeBarGateStatus(attempts);
    expect(status.rate).toBe(78);
    expect(status.gate1Cleared).toBe(true);
    expect(status.gate2Cleared).toBe(true);
    expect(status.safeCleared).toBe(true);

    // 68%（現状値相当）はいずれのゲートも未達
    const low = ids.map((id, i) => attempt(id, i < 68, "2026-08-10T00:00:00.000Z"));
    const lowStatus = computeBarGateStatus(low);
    expect(lowStatus.rate).toBe(68);
    expect(lowStatus.gate1Cleared).toBe(false);
    expect(lowStatus.gate2Cleared).toBe(false);
    expect(lowStatus.safeCleared).toBe(false);
  });

  it("しきい値の大小関係が崩れていない", () => {
    expect(BAR_GATE1_RATE).toBeLessThan(BAR_PASS_LINE_RATE);
    expect(BAR_PASS_LINE_RATE).toBeLessThan(BAR_SAFE_RATE);
  });
});
