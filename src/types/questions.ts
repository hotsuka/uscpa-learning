export interface FARQuestion {
  id: string;
  topic: string;
  subtopic: string;
  stem: string;
  choices: { label: string; text: string }[];
  correctAnswer: string;
  explanation: string;
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
  isCorrect: boolean;
  attemptedAt: string;
}
