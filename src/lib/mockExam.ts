/**
 * 模試モードの問題抽出ロジック
 *
 * FAR本番のMCQセクション相当（50問）を、現行ブループリントの出題範囲内
 * （farScope が in / partial のテーマ）から Area 配分で層化抽出する。
 * Area配分はブループリットの比重 I:30-40% / II:30-40% / III:25-35% に対応。
 */

import { farQuestionSets } from "@/data/questions/far";
import { getFarScopeForSet, type FarArea } from "@/data/questions/far/farScope";
import type { FARQuestion } from "@/types/questions";

export const MOCK_EXAM_QUESTION_COUNT = 50;
export const MOCK_EXAM_MINUTES = 90;
// 本番のMCQスコアで合格圏とされる目安
export const MOCK_EXAM_TARGET_RATE = 75;

// Area別の出題数（合計50問）
const AREA_QUOTA: Record<FarArea, number> = { I: 18, II: 17, III: 15 };
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
): MockExamQuestionEntry[] {
  const weightOf = (question: FARQuestion): number =>
    Math.pow(SEEN_WEIGHT_DECAY, seenCounts[question.id] ?? 0);

  const setsByArea: Record<FarArea, (typeof farQuestionSets)[number][]> = {
    I: [],
    II: [],
    III: [],
  };
  for (const set of farQuestionSets) {
    const info = getFarScopeForSet(set.id);
    if (info.scope === "out" || !info.area) continue;
    setsByArea[info.area].push(set);
  }

  const result: MockExamQuestionEntry[] = [];
  for (const area of ["I", "II", "III"] as FarArea[]) {
    const pool: FARQuestion[] = [];
    for (const set of setsByArea[area]) {
      pool.push(...weightedSample(set.questions, weightOf, MAX_PER_TOPIC));
    }
    // プール段階で未出題が枯渇したテーマがあるため、抽出側でも重みを効かせる
    const picked = weightedSample(pool, weightOf, AREA_QUOTA[area]);
    for (const question of picked) {
      result.push({ question, area, ...shuffleChoices(question) });
    }
  }
  return shuffleArray(result);
}
