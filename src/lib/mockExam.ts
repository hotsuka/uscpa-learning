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
 * Areaごとに各テーマから最大 MAX_PER_TOPIC 問をランダムに取り、
 * プールから所定数を無作為抽出したうえで全体をシャッフルする。
 */
export function buildMockExam(): MockExamQuestionEntry[] {
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
      pool.push(...shuffleArray(set.questions).slice(0, MAX_PER_TOPIC));
    }
    const picked = shuffleArray(pool).slice(0, AREA_QUOTA[area]);
    for (const question of picked) {
      result.push({ question, area, ...shuffleChoices(question) });
    }
  }
  return shuffleArray(result);
}
