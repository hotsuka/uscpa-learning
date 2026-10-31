import type { FlashcardDeck } from "@/types/flashcards";
import regIndividualTaxation from "./reg/individual-taxation.json";

// 頻出論点のフラッシュカード。規則は教材テキストか問題バンクの解説で、金額はIRSの一次情報で裏を取ったものだけを載せる
export const flashcardDecks: FlashcardDeck[] = [
  regIndividualTaxation as FlashcardDeck,
];

export const getFlashcardDeck = (id: string): FlashcardDeck | undefined =>
  flashcardDecks.find((d) => d.id === id);
