import { describe, expect, it } from "vitest";
import type { Flashcard, FlashcardReview } from "@/types/flashcards";
import { buildTodayQueue, scheduleCard } from "./schedule";

const review = (
  cardId: string,
  result: FlashcardReview["result"],
  reviewedAt: string,
): FlashcardReview => ({ cardId, deckId: "deck", result, reviewedAt });

const card = (id: string): Flashcard => ({
  id,
  category: "c",
  front: "f",
  back: "b",
  sources: [],
});

describe("scheduleCard", () => {
  it("未学習は new", () => {
    expect(scheduleCard("c1", [], "2026-10-31").status).toBe("new");
  });

  it("忘れていたら翌日、続けて覚えていたら3日後・7日後と延ばす", () => {
    const forgot = [review("c1", "forgot", "2026-10-30T01:00:00Z")];
    expect(scheduleCard("c1", forgot, "2026-10-31")).toMatchObject({
      status: "due",
      dueDate: "2026-10-31",
      rememberedStreak: 0,
      forgotCount: 1,
    });

    const thenRemembered = [
      ...forgot,
      review("c1", "remembered", "2026-10-31T01:00:00Z"),
      review("c1", "remembered", "2026-11-03T01:00:00Z"),
    ];
    expect(scheduleCard("c1", thenRemembered, "2026-11-05")).toMatchObject({
      status: "scheduled",
      dueDate: "2026-11-10",
      rememberedStreak: 2,
      reviewCount: 3,
      lastResult: "remembered",
    });
  });

  it("間隔は30日で頭打ちにする", () => {
    const many = [1, 2, 3, 4, 5, 6].map((d) =>
      review("c1", "remembered", `2026-01-0${d}T01:00:00Z`),
    );
    expect(scheduleCard("c1", many, "2026-01-06").dueDate).toBe("2026-02-05");
  });

  it("日付はJSTで数える（UTC 10/30 16:00 は JST 10/31）", () => {
    const r = [review("c1", "forgot", "2026-10-30T16:00:00Z")];
    expect(scheduleCard("c1", r, "2026-10-31").dueDate).toBe("2026-11-01");
  });
});

describe("buildTodayQueue", () => {
  it("予定日を過ぎたカードを古い順に先に出し、次に未学習、先の予定のカードは出さない", () => {
    const cards = ["c1", "c2", "c3", "c4"].map(card);
    const reviews = [
      review("c2", "forgot", "2026-10-29T01:00:00Z"), // 予定 10/30
      review("c3", "forgot", "2026-10-25T01:00:00Z"), // 予定 10/26
      review("c4", "remembered", "2026-10-30T01:00:00Z"), // 予定 11/02
    ];
    expect(buildTodayQueue(cards, reviews, "2026-10-31").map((i) => i.card.id)).toEqual([
      "c3",
      "c2",
      "c1",
    ]);
  });
});
