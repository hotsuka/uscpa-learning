export type TBSAnswerType =
  "number" | "select" | "multiselect" | "table" | "research";

export interface TBSExhibit {
  id: string;
  title: string;
  content: string;
}

export interface TBSTableCell {
  rowLabel: string;
  colLabel: string;
  correctValue: number | string;
  tolerance?: number;
}

export interface TBSTableConfig {
  columns: string[];
  rows: string[];
  cells: TBSTableCell[];
}

export interface TBSTask {
  id: string;
  workTab: string;
  title: string;
  instruction: string;
  answerType: TBSAnswerType;
  options?: string[];
  tableConfig?: TBSTableConfig;
  correctAnswer?: string | number | string[];
  tolerance?: number;
  explanation: string;
  explanationJa: string;
  references?: string[];
}

export interface TBSQuestion {
  id: string;
  subject: "FAR" | "AUD" | "REG" | "BAR";
  topic: string;
  title: string;
  scenario: string;
  exhibits: TBSExhibit[];
  tasks: TBSTask[];
  difficulty: "basic" | "intermediate" | "advanced";
  estimatedMinutes: number;
  source: string;
}

// 回答値: number=数値, select/research=文字列, multiselect=文字列配列, table=セルキー→入力値
export type TBSAnswerValue =
  string | number | string[] | Record<string, string>;

export interface TBSTaskAttempt {
  tbsId: string;
  taskId: string;
  userAnswer: TBSAnswerValue;
  isCorrect: boolean;
  attemptedAt: string;
}

export interface TBSAttempt {
  tbsId: string;
  taskAttempts: TBSTaskAttempt[];
  completedAt: string;
  totalScore: number;
}
