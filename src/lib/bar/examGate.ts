import type { QuestionAttempt } from "@/types/questions";
import { barQuestionSets } from "@/data/questions/bar";
import { daysUntil } from "@/lib/utils";

/**
 * BAR受験日。Discipline科目は四半期の初月しか実施されないため、
 * 2026年10月window（10/1〜10/31）の実予約日。大阪 OSAKA,JAPAN #1 で09:00開始。
 */
export const BAR_EXAM_DATE = "2026-10-28";

/** Area I（配点40-50%）の残り問題を解き切る期限。ここを起点に1日あたりの必要問題数を出す。 */
export const BAR_AREA1_DEADLINE = "2026-09-27";

/** 第2ゲート（未見問題での総合判定）の実施日。 */
export const BAR_GATE2_DATE = "2026-10-18";

/**
 * FAR受験実績からの較正値。
 * 範囲内・初見正答率76.9%＋TBSタスク正答率74.1%で本番81点（合格ライン75）だったため、
 * 75相当を初見73%、安全圏を76%と置く。n=1の粗い外挿であり、
 * スケールドスコアは正答率そのものではない点に注意。
 */
export const BAR_PASS_LINE_RATE = 73;
export const BAR_SAFE_RATE = 76;

/** 第1ゲート（Area I完走時点）の基準。総合の合格ライン目安より1ポイント低く置く。 */
export const BAR_GATE1_RATE = 72;

export interface BarSetStat {
  id: string;
  name: string;
  topic: string;
  /** セットの総問題数 */
  total: number;
  /** 一度でも解答した問題数 */
  attempted: number;
  /** 初見正答率の分母（正誤不明を除く） */
  firstSeenTotal: number;
  firstSeenCorrect: number;
  /** 初見正答率（%）。母数0のときはnull */
  rate: number | null;
}

export interface BarGateStatus {
  sets: BarSetStat[];
  total: number;
  attempted: number;
  remaining: number;
  firstSeenTotal: number;
  firstSeenCorrect: number;
  rate: number | null;
  daysUntilExam: number;
  daysUntilArea1Deadline: number;
  /** Area I完走に必要な1日あたり問題数。期限を過ぎている場合はnull */
  requiredPerDay: number | null;
  gate1Cleared: boolean;
  gate2Cleared: boolean;
  safeCleared: boolean;
}

/**
 * BAR問題バンクの初見正答率と消化ペースを集計する。
 *
 * 初見正答率は「各問題の最初の解答」だけで集計する。解き直しで上書きされないため、
 * FARでは本番スコアの予測子として機能した（76.9% → 81点）。
 * 正誤不明(isCorrect === null)の回答は初見判定・分母の両方から除外する。
 */
export function computeBarGateStatus(
  attempts: QuestionAttempt[],
): BarGateStatus {
  // BAR問題のみを対象にするため questionId → セットid の対応を作る
  const setIdByQuestionId = new Map<string, string>();
  for (const set of barQuestionSets) {
    for (const q of set.questions) {
      setIdByQuestionId.set(q.id, set.id);
    }
  }

  const attemptedIds = new Set<string>();
  const firstByQuestion = new Map<string, QuestionAttempt>();
  for (const a of attempts) {
    if (!setIdByQuestionId.has(a.questionId)) continue;
    attemptedIds.add(a.questionId);
    if (a.isCorrect === null) continue;
    const existing = firstByQuestion.get(a.questionId);
    if (
      !existing ||
      new Date(a.attemptedAt) < new Date(existing.attemptedAt)
    ) {
      firstByQuestion.set(a.questionId, a);
    }
  }

  const sets: BarSetStat[] = barQuestionSets.map((set) => {
    let attempted = 0;
    let firstSeenTotal = 0;
    let firstSeenCorrect = 0;
    for (const q of set.questions) {
      if (!attemptedIds.has(q.id)) continue;
      attempted++;
      const first = firstByQuestion.get(q.id);
      if (!first) continue;
      firstSeenTotal++;
      if (first.isCorrect === true) firstSeenCorrect++;
    }
    return {
      id: set.id,
      name: set.name,
      topic: set.topic,
      total: set.questions.length,
      attempted,
      firstSeenTotal,
      firstSeenCorrect,
      rate:
        firstSeenTotal > 0
          ? Math.round((firstSeenCorrect / firstSeenTotal) * 100)
          : null,
    };
  });

  const total = sets.reduce((sum, s) => sum + s.total, 0);
  const attempted = sets.reduce((sum, s) => sum + s.attempted, 0);
  const firstSeenTotal = sets.reduce((sum, s) => sum + s.firstSeenTotal, 0);
  const firstSeenCorrect = sets.reduce((sum, s) => sum + s.firstSeenCorrect, 0);
  const rate =
    firstSeenTotal > 0
      ? Math.round((firstSeenCorrect / firstSeenTotal) * 100)
      : null;

  const remaining = total - attempted;
  const daysUntilArea1Deadline = daysUntil(BAR_AREA1_DEADLINE);
  const requiredPerDay =
    daysUntilArea1Deadline > 0
      ? Math.ceil(remaining / daysUntilArea1Deadline)
      : null;

  return {
    sets,
    total,
    attempted,
    remaining,
    firstSeenTotal,
    firstSeenCorrect,
    rate,
    daysUntilExam: daysUntil(BAR_EXAM_DATE),
    daysUntilArea1Deadline,
    requiredPerDay,
    gate1Cleared: rate !== null && rate >= BAR_GATE1_RATE,
    gate2Cleared: rate !== null && rate >= BAR_PASS_LINE_RATE,
    safeCleared: rate !== null && rate >= BAR_SAFE_RATE,
  };
}
