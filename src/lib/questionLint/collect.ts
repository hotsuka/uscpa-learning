/**
 * 実データ（アプリが読み込む全問題）に対して問題データ lint を走らせ、不備を集める。
 * 対象はアプリの index から読み込まれる問題だけ（index に登録されていないJSONは画面に出ないため）。
 */

import { existsSync } from "fs";
import { join } from "path";
import { farQuestionSets } from "@/data/questions/far";
import {
  barFreshMockQuestionSets,
  barOwnAreaIIIIIQuestionSets,
  barQuestionSets,
} from "@/data/questions/bar";
import { allTBSQuestions, getTBSMockSetsBySubject } from "@/data/tbs";
import { MOCK_EXAM_AREA_QUOTA, MOCK_EXAM_MINUTES } from "@/lib/mockExam";
import type { FARQuestion } from "@/types/questions";
import {
  BAR_EXAM_TOTAL_MINUTES,
  expectedMcqMockMinutes,
  lintMcq,
  lintMcqMockTime,
  lintTbs,
  lintTbsMockTime,
  type LintIssue,
  type McqMockPool,
} from "./rules";

const publicFileExists = (publicPath: string): boolean =>
  existsSync(join(process.cwd(), "public", publicPath.replace(/^\//, "")));

/** 全MCQ（FAR・BAR・初見模試用）。FARセットはBAR画面でも借りているが、1問1回だけ検査する */
export function allMcqQuestions(): FARQuestion[] {
  const sets = [
    ...farQuestionSets,
    ...barQuestionSets,
    ...barOwnAreaIIIIIQuestionSets,
    ...barFreshMockQuestionSets.map(({ set }) => set),
  ];
  const seen = new Set<string>();
  return sets
    .flatMap((set) => set.questions)
    .filter((q) => (seen.has(q.id) ? false : (seen.add(q.id), true)));
}

/** BAR初見模試（4択）の出題元。Area ごとに初見模試用セットの全問を集める */
export function barFreshMockPool(): McqMockPool {
  const pools: Record<string, FARQuestion[]> = {};
  for (const { set, area } of barFreshMockQuestionSets) {
    pools[area] = [...(pools[area] ?? []), ...set.questions];
  }
  return {
    id: "bar-fresh-mock",
    quota: MOCK_EXAM_AREA_QUOTA.BAR,
    pools,
    limitMinutes: MOCK_EXAM_MINUTES,
  };
}

export function collectIssues(): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const q of allMcqQuestions())
    issues.push(...lintMcq(q, publicFileExists));
  for (const q of allTBSQuestions) issues.push(...lintTbs(q));

  // ④ 模試の時間。4択（初見模試）は MOCK_EXAM_MINUTES、通し模試のTBSは試験時間の残り
  const freshPool = barFreshMockPool();
  issues.push(...lintMcqMockTime(freshPool));
  const tbsLimit = BAR_EXAM_TOTAL_MINUTES - MOCK_EXAM_MINUTES;
  for (const set of getTBSMockSetsBySubject("BAR")) {
    issues.push(...lintTbsMockTime(set.id, set.questions, tbsLimit));
  }
  return issues;
}

/** 通し模試（4択の初見模試＋TBS 1セット）の想定時間の内訳。報告用 */
export function mockTimeSummary(): string[] {
  const mcq = expectedMcqMockMinutes(barFreshMockPool());
  const tbsLimit = BAR_EXAM_TOTAL_MINUTES - MOCK_EXAM_MINUTES;
  return getTBSMockSetsBySubject("BAR").map((set) => {
    const tbs = set.questions.reduce((sum, q) => sum + q.estimatedMinutes, 0);
    return (
      `${set.name}: 4択 ${mcq.toFixed(0)}分/${MOCK_EXAM_MINUTES}分 + TBS ${tbs}分/${tbsLimit}分` +
      ` = ${(mcq + tbs).toFixed(0)}分/${BAR_EXAM_TOTAL_MINUTES}分`
    );
  });
}
