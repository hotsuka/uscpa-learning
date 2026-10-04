import type { TBSQuestion } from "@/types/tbs";
import { farTBSQuestions } from "./far";
import { barMockTBSSets, barTBSQuestions, type TBSMockSet } from "./bar";

/** TBSを持つ科目。問題が用意できた科目だけを並べる */
export const TBS_SUBJECTS = ["FAR", "BAR"] as const;
export type TBSSubject = (typeof TBS_SUBJECTS)[number];

const questionsBySubject: Record<TBSSubject, TBSQuestion[]> = {
  FAR: farTBSQuestions,
  BAR: barTBSQuestions,
};

export const getTBSQuestionsBySubject = (subject: TBSSubject): TBSQuestion[] =>
  questionsBySubject[subject];

/** 通し模試用のTBS（演習一覧には出さない）。模試を用意した科目だけ */
const mockSetsBySubject: Record<TBSSubject, TBSMockSet[]> = {
  FAR: [],
  BAR: barMockTBSSets,
};

export const getTBSMockSetsBySubject = (subject: TBSSubject): TBSMockSet[] =>
  mockSetsBySubject[subject];

/** 全科目のTBS（通し模試用を含む）。詳細ページの静的生成やID検索に使う */
export const allTBSQuestions: TBSQuestion[] = [
  ...farTBSQuestions,
  ...barTBSQuestions,
  ...barMockTBSSets.flatMap((set) => set.questions),
];

export const findTBSQuestionById = (id: string): TBSQuestion | undefined =>
  allTBSQuestions.find((q) => q.id === id);

/** 科目内のトピック一覧（重複を除く。出現順を保つ） */
export const getTBSTopicsBySubject = (subject: TBSSubject): string[] => [
  ...new Set(questionsBySubject[subject].map((q) => q.topic)),
];
