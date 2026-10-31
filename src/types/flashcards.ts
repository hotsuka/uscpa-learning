import type { Subject } from "@/types";

export interface Flashcard {
  id: string;
  /** 論点（英語）。例: "Filing Status" */
  category: string;
  /** 問い。英語の用語は括弧で併記 */
  front: string;
  /** 答え。改行で箇条書きを区切る */
  back: string;
  /** ひっかけ・旧ルールとの違いなど */
  note?: string;
  /** 同じ論点を問う問題バンクの問題ID */
  relatedQuestionIds?: string[];
  /** 裏を取った出典（教材のページ・問題バンクの解説・IRSのURL） */
  sources: string[];
  /** 金額を含むカードの課税年度 */
  taxYear?: string;
}

export interface FlashcardDeck {
  id: string;
  subject: Subject;
  topic: string;
  name: string;
  version: string;
  cards: Flashcard[];
}

/** 覚えていたか（自己採点） */
export type FlashcardResult = "remembered" | "forgot";

export interface FlashcardReview {
  cardId: string;
  deckId: string;
  result: FlashcardResult;
  reviewedAt: string;
  /** 他の端末からNotion経由で取り込んだ記録。この端末の分としてNotionへ送り直さないために使う */
  imported?: true;
}
