export interface FARQuestion {
  id: string;
  topic: string;
  subtopic: string;
  stem: string;
  choices: { label: string; text: string }[];
  correctAnswer: string;
  explanation: string;
  explanationJa: string;
  references: string[];
  difficulty: "basic" | "intermediate" | "advanced";
  source: string;
}

export interface QuestionSet {
  id: string;
  name: string;
  topic: string;
  questions: FARQuestion[];
  version: string;
}

export interface QuestionAttempt {
  questionId: string;
  topic: string;
  selectedAnswer: string;
  // null は「正誤不明」を示す（v2 migrate の recalculate バグでデータが壊れた回答に対するリカバリ用）
  isCorrect: boolean | null;
  attemptedAt: string;
}
