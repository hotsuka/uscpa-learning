import { describe, expect, it } from "vitest";
import { regQuestionSets } from "@/data/questions/reg";
import { flashcardDecks } from "./index";

// 解説で誤魔化した跡（問題データで過去に起きた不備）をカードにも入れない
const DOUBT_PHRASES = [/\bwait\b/i, /\bhmm\b/i, /let me recalculate/i, /closest answer/i];

const regQuestionIds = new Set(regQuestionSets.flatMap((s) => s.questions.map((q) => q.id)));

describe("フラッシュカードのデータ", () => {
  it("デッキIDとカードIDが重複しない", () => {
    const deckIds = flashcardDecks.map((d) => d.id);
    expect(new Set(deckIds).size).toBe(deckIds.length);
    const cardIds = flashcardDecks.flatMap((d) => d.cards.map((c) => c.id));
    expect(new Set(cardIds).size).toBe(cardIds.length);
  });

  for (const deck of flashcardDecks) {
    describe(deck.id, () => {
      it("どのカードも問い・答え・論点・出典がそろっている", () => {
        for (const card of deck.cards) {
          expect(card.front.trim(), card.id).not.toBe("");
          expect(card.back.trim(), card.id).not.toBe("");
          expect(card.category.trim(), card.id).not.toBe("");
          expect(card.sources.length, card.id).toBeGreaterThan(0);
        }
      });

      // 計算例（過去問の数字）は年度に依らないので除き、限度額などの金額を書いた行だけを見る
      it("計算例以外で金額（$）を書いたカードには課税年度がある", () => {
        for (const card of deck.cards) {
          const lines = `${card.front}\n${card.back}\n${card.note ?? ""}`.split("\n");
          const amountLine = lines.find((l) => /\$\s?\d/.test(l) && !/例|it-\d|=|→/.test(l));
          if (amountLine) expect(card.taxYear, `${card.id}: ${amountLine}`).toBeTruthy();
        }
      });

      it("関連問題のIDは問題バンクに実在する", () => {
        for (const card of deck.cards) {
          for (const id of card.relatedQuestionIds ?? []) {
            expect(regQuestionIds.has(id), `${card.id} → ${id}`).toBe(true);
          }
        }
      });

      it("疑念語句を含まない", () => {
        for (const card of deck.cards) {
          const text = `${card.front}\n${card.back}\n${card.note ?? ""}`;
          for (const phrase of DOUBT_PHRASES) {
            expect(phrase.test(text), `${card.id}: ${phrase}`).toBe(false);
          }
        }
      });
    });
  }
});
