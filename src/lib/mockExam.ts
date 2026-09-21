/**
 * 模試モードの問題抽出ロジック
 *
 * 本番のMCQセクション相当（50問）を、ブループリントの出題範囲内から Area 配分で層化抽出する。
 * - FAR: farScope が in / partial のテーマ。I:30-40% / II:30-40% / III:25-35%
 * - BAR: Area I は BAR問題バンク（範囲外判定の問題を除く）、Area II/III は BAR画面と同じセット
 *        （BAR専用セット＋借りているFARセット）。I:40-50% / II:35-45% / III:10-20%
 */

import { farQuestionSets } from "@/data/questions/far";
import { getFarScopeForSet, type FarArea } from "@/data/questions/far/farScope";
import {
  barAreaIIIIIQuestionSets,
  barOwnAreaIIIIIQuestionSets,
  barQuestionSets,
  getBarAreaForSet,
} from "@/data/questions/bar";
import { getBarScopeForQuestion } from "@/data/questions/bar/barScope";
import type { FARQuestion, QuestionSet } from "@/types/questions";

export type MockExamSubject = "FAR" | "BAR";

export const MOCK_EXAM_QUESTION_COUNT = 50;
export const MOCK_EXAM_MINUTES = 90;
// 本番のMCQスコアで合格圏とされる目安
export const MOCK_EXAM_TARGET_RATE = 75;

// Area別の出題数（合計50問）。ブループリントの配点の中央値に比例させる
export const MOCK_EXAM_AREA_QUOTA: Record<MockExamSubject, Record<FarArea, number>> = {
  FAR: { I: 18, II: 17, III: 15 },
  BAR: { I: 22, II: 20, III: 8 },
};
// 同一テーマからの偏り防止
const MAX_PER_TOPIC = 5;
// 過去の模試で出題済みの問題に掛ける重み（1回出題されるごとに乗算）。
// 完全に除外はせず「未出題を強く優先する」挙動にして、
// 未出題が枯渇したテーマでは出題回数の少ない問題から回るようにする。
const SEEN_WEIGHT_DECAY = 0.12;

export interface MockExamQuestionEntry {
  question: FARQuestion;
  area: FarArea;
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
): Record<FarArea, { set: QuestionSet; questions: FARQuestion[] }[]> {
  const pools: Record<FarArea, { set: QuestionSet; questions: FARQuestion[] }[]> = {
    I: [],
    II: [],
    III: [],
  };

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
  for (const set of [...barOwnAreaIIIIIQuestionSets, ...barAreaIIIIIQuestionSets]) {
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
  const quota = MOCK_EXAM_AREA_QUOTA[subject];

  const result: MockExamQuestionEntry[] = [];
  for (const area of ["I", "II", "III"] as FarArea[]) {
    const pool: FARQuestion[] = [];
    for (const { questions } of pools[area]) {
      pool.push(...weightedSample(questions, weightOf, MAX_PER_TOPIC));
    }
    // プール段階で未出題が枯渇したテーマがあるため、抽出側でも重みを効かせる
    const picked = weightedSample(pool, weightOf, quota[area]);
    for (const question of picked) {
      result.push({ question, area, ...shuffleChoices(question) });
    }
  }
  return shuffleArray(result);
}
