export type TBSAnswerType = "number" | "select" | "multiselect" | "table";

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

export interface TBSTaskAttempt {
  tbsId: string;
  taskId: string;
  userAnswer: string | number | string[];
  isCorrect: boolean;
  attemptedAt: string;
}

export interface TBSAttempt {
  tbsId: string;
  taskAttempts: TBSTaskAttempt[];
  completedAt: string;
  totalScore: number;
}
