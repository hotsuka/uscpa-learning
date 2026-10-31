import type { Flashcard, FlashcardReview } from "@/types/flashcards";

/**
 * フラッシュカードの出題予定（間隔反復）を決める純粋関数群
 *
 * 画面（/materials/flashcards）とボット用ページ（/bot）で同じ予定を使う。日付はJSTの "YYYY-MM-DD"。
 */

/** 続けて「覚えていた」回数ごとの、次に出すまでの日数。「忘れていた」の直後は0回目として翌日に出す */
export const FLASHCARD_INTERVAL_DAYS = [1, 3, 7, 14, 30];

export type CardStatus = "new" | "due" | "scheduled";

export interface CardSchedule {
  cardId: string;
  status: CardStatus;
  /** 次に出す日。未学習なら null */
  dueDate: string | null;
  /** 最後に「忘れていた」としてから続けて「覚えていた」回数 */
  rememberedStreak: number;
  reviewCount: number;
  forgotCount: number;
  lastResult: FlashcardReview["result"] | null;
}

const toJSTDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

const addDays = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function scheduleCard(
  cardId: string,
  reviews: FlashcardReview[],
  today: string,
): CardSchedule {
  const own = reviews
    .filter((r) => r.cardId === cardId)
    .sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt));
  if (own.length === 0) {
    return {
      cardId,
      status: "new",
      dueDate: null,
      rememberedStreak: 0,
      reviewCount: 0,
      forgotCount: 0,
      lastResult: null,
    };
  }

  let rememberedStreak = 0;
  for (let i = own.length - 1; i >= 0 && own[i].result === "remembered"; i--) {
    rememberedStreak++;
  }
  // 「忘れていた」の直後は0回目（翌日）、覚えていた回数が増えるほど間隔を空ける
  const interval =
    FLASHCARD_INTERVAL_DAYS[
      Math.min(rememberedStreak, FLASHCARD_INTERVAL_DAYS.length - 1)
    ];
  const last = own[own.length - 1];
  const dueDate = addDays(toJSTDate(last.reviewedAt), interval);
  return {
    cardId,
    status: dueDate <= today ? "due" : "scheduled",
    dueDate,
    rememberedStreak,
    reviewCount: own.length,
    forgotCount: own.filter((r) => r.result === "forgot").length,
    lastResult: last.result,
  };
}

/**
 * 今日出すカードの並び。予定日を過ぎたもの（古い順）→ 未学習（デッキの順）。
 * 予定日がまだ先のカードは含めない。
 */
export function buildTodayQueue(
  cards: Flashcard[],
  reviews: FlashcardReview[],
  today: string,
): { card: Flashcard; schedule: CardSchedule }[] {
  const items = cards.map((card) => ({
    card,
    schedule: scheduleCard(card.id, reviews, today),
  }));
  const due = items
    .filter((i) => i.schedule.status === "due")
    .sort((a, b) => a.schedule.dueDate!.localeCompare(b.schedule.dueDate!));
  const fresh = items.filter((i) => i.schedule.status === "new");
  return [...due, ...fresh];
}
