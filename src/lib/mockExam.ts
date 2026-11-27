/**
 * 模試モードの問題抽出ロジック
 *
 * 本番のMCQセクション相当（50問）を、ブループリントの出題範囲内から Area 配分で層化抽出する。
 * - FAR: farScope が in / partial のテーマ。I:30-40% / II:30-40% / III:25-35%
 * - BAR: Area I は BAR問題バンク（範囲外判定の問題を除く）、Area II/III は BAR画面と同じセット
 *        （BAR専用セット＋借りているFARセット）。I:40-50% / II:35-45% / III:10-20%
 * - REG: regScope が範囲内とする問題。本番どおり72問で、
 *        I:10-20% / II:15-25% / III:5-15% / IV:22-32% / V:23-33%
 */

import { farQuestionSets } from "@/data/questions/far";
import { getFarScopeForSet, type FarArea } from "@/data/questions/far/farScope";
import {
  barAreaIIIIIQuestionSets,
  barFreshMockQuestionSets,
  barOwnAreaIIIIIQuestionSets,
  barQuestionSets,
  getBarAreaForSet,
} from "@/data/questions/bar";
import { getBarScopeForQuestion } from "@/data/questions/bar/barScope";
import { regQuestionSets } from "@/data/questions/reg";
import {
  getRegAreaForQuestion,
  getRegScopeForQuestion,
  type RegArea,
} from "@/data/questions/reg/regScope";
import type { FARQuestion, QuestionSet } from "@/types/questions";

export type MockExamSubject = "FAR" | "BAR" | "REG";
// FAR/BAR は I〜III、REG は I〜V
export type MockExamArea = FarArea | RegArea;

// FAR/BAR の出題数と制限時間（BAR初見模試・問題lintもこの値を使う）
export const MOCK_EXAM_QUESTION_COUNT = 50;
export const MOCK_EXAM_MINUTES = 90;
// 本番のMCQスコアで合格圏とされる目安
export const MOCK_EXAM_TARGET_RATE = 75;

// 科目ごとの出題数と制限時間。REGは本番のMCQ（72問）に合わせる。
// 制限時間は本番4時間を4択とTBS 8問（1問15分）で半分ずつに分けた120分。
// 問題lintの想定解答時間（範囲内の全問の平均から 72問で約118分）が収まる値でもある
const MOCK_EXAM_FORMAT: Record<
  MockExamSubject,
  { questionCount: number; minutes: number }
> = {
  FAR: { questionCount: MOCK_EXAM_QUESTION_COUNT, minutes: MOCK_EXAM_MINUTES },
  BAR: { questionCount: MOCK_EXAM_QUESTION_COUNT, minutes: MOCK_EXAM_MINUTES },
  REG: { questionCount: 72, minutes: 120 },
};

export const getMockExamQuestionCount = (subject: MockExamSubject): number =>
  MOCK_EXAM_FORMAT[subject].questionCount;

export const getMockExamMinutes = (subject: MockExamSubject): number =>
  MOCK_EXAM_FORMAT[subject].minutes;

// Area別の出題数。ブループリントの配点の中央値に比例させる（キーの並びが表示・抽出の順）
export const MOCK_EXAM_AREA_QUOTA = {
  FAR: { I: 18, II: 17, III: 15 },
  BAR: { I: 22, II: 20, III: 8 },
  // 中央値 15/20/10/27/28% × 72問 を最大剰余法で丸めたもの
  REG: { I: 11, II: 14, III: 7, IV: 19, V: 21 },
} satisfies Record<MockExamSubject, Partial<Record<MockExamArea, number>>>;

const areaQuotaOf = (subject: MockExamSubject): [MockExamArea, number][] =>
  Object.entries(MOCK_EXAM_AREA_QUOTA[subject]) as [MockExamArea, number][];

// 同一テーマからの偏り防止。REGは1セット=1単元で、Area I/III/IV は1セットしか無いため上限を掛けない
// （掛けると Area の出題数に届かない）。Area 内の単元比率は問題数に比例させる
const MAX_PER_TOPIC: Record<MockExamSubject, number> = {
  FAR: 5,
  BAR: 5,
  REG: Number.POSITIVE_INFINITY,
};
// 過去の模試で出題済みの問題に掛ける重み（1回出題されるごとに乗算）。
// 完全に除外はせず「未出題を強く優先する」挙動にして、
// 未出題が枯渇したテーマでは出題回数の少ない問題から回るようにする。
const SEEN_WEIGHT_DECAY = 0.12;

export interface MockExamQuestionEntry {
  question: FARQuestion;
  area: MockExamArea;
  /** シャッフル済み選択肢（ラベルA〜Dは固定、テキストのみ入れ替え） */
  choices: { label: string; text: string }[];
  /** シャッフル後ラベルでの正解 */
  correctAnswer: string;
  /** シャッフル後ラベル → 元ラベル（保存時は必ず元ラベルに変換すること） */
  shuffledToOriginalLabel: Record<string, string>;
}

function shuffleArray<T>(arr: readonly T[]): T[] {
  const copied = [...arr];
  for (let i = copied.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

/**
 * 重み付き非復元抽出（Efraimidis-Spirakis法）。
 * 各要素に u^(1/w) をキーとして割り当て、上位k件を取ると
 * 重みに比例した確率での非復元抽出になる。
 */
function weightedSample<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  count: number,
): T[] {
  return items
    .map((item) => ({
      item,
      key: Math.pow(Math.random(), 1 / Math.max(weightOf(item), 1e-12)),
    }))
    .sort((a, b) => b.key - a.key)
    .slice(0, count)
    .map((entry) => entry.item);
}

/**
 * 過去の模試結果から questionId ごとの出題回数を集計する。
 * mockExamStore への依存を避けるため必要最小限の形だけを受け取る。
 */
export function countSeenQuestions(
  results: readonly { answers?: readonly { questionId: string }[] }[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const result of results) {
    for (const answer of result.answers ?? []) {
      counts[answer.questionId] = (counts[answer.questionId] ?? 0) + 1;
    }
  }
  return counts;
}

// QuestionCard と同じ方式で選択肢テキストのみシャッフルする
function shuffleChoices(question: FARQuestion): {
  choices: { label: string; text: string }[];
  correctAnswer: string;
  shuffledToOriginalLabel: Record<string, string>;
} {
  const labels = question.choices.map((c) => c.label);
  const correctText = question.choices.find(
    (c) => c.label === question.correctAnswer,
  )!.text;
  const texts = shuffleArray(question.choices.map((c) => c.text));
  const shuffledToOriginalLabel: Record<string, string> = {};
  labels.forEach((label, i) => {
    const originalLabel =
      question.choices.find((c) => c.text === texts[i])?.label ?? label;
    shuffledToOriginalLabel[label] = originalLabel;
  });
  return {
    choices: labels.map((label, i) => ({ label, text: texts[i] })),
    correctAnswer: labels[texts.indexOf(correctText)],
    shuffledToOriginalLabel,
  };
}

/** 抽出元のセットと、そのセットから出題してよい問題を Area ごとに並べる */
function collectPools(
  subject: MockExamSubject,
): Record<MockExamArea, { set: QuestionSet; questions: FARQuestion[] }[]> {
  const pools: Record<
    MockExamArea,
    { set: QuestionSet; questions: FARQuestion[] }[]
  > = {
    I: [],
    II: [],
    III: [],
    IV: [],
    V: [],
  };

  if (subject === "REG") {
    // 範囲外（贈与税・遺産税・信託など）を除き、問題ごとの Area に振り分ける
    for (const set of regQuestionSets) {
      const byArea = new Map<RegArea, FARQuestion[]>();
      for (const q of set.questions) {
        if (getRegScopeForQuestion(set.id, q.id) === "out") continue;
        const area = getRegAreaForQuestion(set.id, q.id);
        if (!area) continue;
        byArea.set(area, [...(byArea.get(area) ?? []), q]);
      }
      for (const [area, questions] of byArea)
        pools[area].push({ set, questions });
    }
    return pools;
  }

  if (subject === "FAR") {
    for (const set of farQuestionSets) {
      const info = getFarScopeForSet(set.id);
      if (info.scope === "out" || !info.area) continue;
      pools[info.area].push({ set, questions: set.questions });
    }
    return pools;
  }

  // BAR Area I: 範囲外と判定済みの問題（ERMの一部など）だけ除く。判断保留・未照合は残す
  for (const set of barQuestionSets) {
    const questions = set.questions.filter(
      (q) => getBarScopeForQuestion(set.id, q.id) !== "out",
    );
    if (questions.length > 0) pools.I.push({ set, questions });
  }
  // BAR Area II/III: BAR画面で演習できるセットと同じもの
  for (const set of [
    ...barOwnAreaIIIIIQuestionSets,
    ...barAreaIIIIIQuestionSets,
  ]) {
    const area = getBarAreaForSet(set.id);
    if (area === "I") continue;
    pools[area].push({ set, questions: set.questions });
  }
  return pools;
}

/**
 * 模試1回分（50問）を層化抽出する。
 * Areaごとに各テーマから最大 MAX_PER_TOPIC 問を取り、
 * プールから所定数を抽出したうえで全体をシャッフルする。
 *
 * seenCounts（過去の出題回数）を渡すと、未出題の問題を強く優先して抽出する。
 * テーマ配分は Area 内で均等（従来どおり）。
 */
export function buildMockExam(
  seenCounts: Record<string, number> = {},
  subject: MockExamSubject = "FAR",
): MockExamQuestionEntry[] {
  const weightOf = (question: FARQuestion): number =>
    Math.pow(SEEN_WEIGHT_DECAY, seenCounts[question.id] ?? 0);

  const pools = collectPools(subject);

  const result: MockExamQuestionEntry[] = [];
  for (const [area, count] of areaQuotaOf(subject)) {
    const pool: FARQuestion[] = [];
    for (const { questions } of pools[area]) {
      pool.push(...weightedSample(questions, weightOf, MAX_PER_TOPIC[subject]));
    }
    // プール段階で未出題が枯渇したテーマがあるため、抽出側でも重みを効かせる
    const picked = weightedSample(pool, weightOf, count);
    for (const question of picked) {
      result.push({ question, area, ...shuffleChoices(question) });
    }
  }
  return shuffleArray(result);
}

/** 初見模試用の問題のうち、まだ一度も解いていないものを Area ごとに集める */
function collectUnseenFreshPools(
  attemptedIds: ReadonlySet<string>,
): Record<FarArea, FARQuestion[]> {
  const pools: Record<FarArea, FARQuestion[]> = { I: [], II: [], III: [] };
  for (const { set, area } of barFreshMockQuestionSets) {
    pools[area].push(...set.questions.filter((q) => !attemptedIds.has(q.id)));
  }
  return pools;
}

/**
 * BARの初見模試を何回分組めるか。Area ごとの「未解答数 ÷ 出題数」の最小値。
 * attemptedIds は演習・模試を問わず一度でも解いた問題ID（問題バンクの解答履歴）。
 */
export function countFreshMockRuns(attemptedIds: ReadonlySet<string>): number {
  const pools = collectUnseenFreshPools(attemptedIds);
  const quota = MOCK_EXAM_AREA_QUOTA.BAR;
  return Math.min(
    ...(["I", "II", "III"] as FarArea[]).map((area) =>
      Math.floor(pools[area].length / quota[area]),
    ),
  );
}

/**
 * BARの初見模試（50問）を組む。一度も解いていない初見模試用の問題だけから出題する。
 * どれかの Area で未解答が出題数に満たなければ null（解いたことのある問題で埋めない）。
 * 初見模試用の問題は過去問の論点比率に合わせて問題数を配分してあるため、
 * Area 内ではテーマごとの未解答数に比例して出題数を割り当てる（最大剰余法）。
 * 一律の上限で均すと、過去問で多い論点（財務管理など）が薄まってしまう。
 */
export function buildFreshMockExam(
  attemptedIds: ReadonlySet<string>,
): MockExamQuestionEntry[] | null {
  if (countFreshMockRuns(attemptedIds) < 1) return null;
  const pools = collectUnseenFreshPools(attemptedIds);
  const quota = MOCK_EXAM_AREA_QUOTA.BAR;

  const result: MockExamQuestionEntry[] = [];
  for (const area of ["I", "II", "III"] as FarArea[]) {
    const byTopic = new Map<string, FARQuestion[]>();
    for (const q of pools[area])
      byTopic.set(q.topic, [...(byTopic.get(q.topic) ?? []), q]);
    const total = pools[area].length;
    const shares = shuffleArray([...byTopic.values()]).map((qs) => {
      const exact = (quota[area] * qs.length) / total;
      return {
        qs,
        count: Math.floor(exact),
        remainder: exact - Math.floor(exact),
      };
    });
    // 切り捨てで足りない分は、端数の大きいテーマから1問ずつ足す
    let shortfall = quota[area] - shares.reduce((sum, s) => sum + s.count, 0);
    for (const share of [...shares].sort((a, b) => b.remainder - a.remainder)) {
      if (shortfall <= 0) break;
      share.count += 1;
      shortfall -= 1;
    }
    const picked = shares.flatMap((s) => shuffleArray(s.qs).slice(0, s.count));
    for (const question of picked) {
      result.push({ question, area, ...shuffleChoices(question) });
    }
  }
  return shuffleArray(result);
}
