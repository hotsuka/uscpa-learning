import type { TBSQuestion } from "@/types/tbs";
import { farTBSQuestions } from "./far";
import { barTBSQuestions } from "./bar";

/** TBSを持つ科目。問題が用意できた科目だけを並べる */
export const TBS_SUBJECTS = ["FAR", "BAR"] as const;
export type TBSSubject = (typeof TBS_SUBJECTS)[number];

const questionsBySubject: Record<TBSSubject, TBSQuestion[]> = {
  FAR: farTBSQuestions,
  BAR: barTBSQuestions,
};

export const getTBSQuestionsBySubject = (subject: TBSSubject): TBSQuestion[] =>
  questionsBySubject[subject];

/** 全科目のTBS。詳細ページの静的生成やID検索に使う */
export const allTBSQuestions: TBSQuestion[] = [
  ...farTBSQuestions,
  ...barTBSQuestions,
];

export const findTBSQuestionById = (id: string): TBSQuestion | undefined =>
  allTBSQuestions.find((q) => q.id === id);

/** 科目内のトピック一覧（重複を除く。出現順を保つ） */
export const getTBSTopicsBySubject = (subject: TBSSubject): string[] => [
  ...new Set(questionsBySubject[subject].map((q) => q.topic)),
];
