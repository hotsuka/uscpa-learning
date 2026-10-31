"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Layers, RotateCcw } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MiniTimer } from "@/components/materials/MiniTimer";
import { flashcardDecks } from "@/data/flashcards";
import { buildTodayQueue, scheduleCard } from "@/lib/flashcards/schedule";
import { getJSTDateString } from "@/lib/utils";
import { useFlashcardStore } from "@/stores/flashcardStore";
import { useTimerStore } from "@/stores/timerStore";
import type { FlashcardResult } from "@/types/flashcards";

type Mode = "today" | "all";

export default function FlashcardsPage() {
  const [deckId, setDeckId] = useState(flashcardDecks[0].id);
  const deck = flashcardDecks.find((d) => d.id === deckId) ?? flashcardDecks[0];
  const reviews = useFlashcardStore((s) => s.reviews);
  const addReview = useFlashcardStore((s) => s.addReview);

  const [mode, setMode] = useState<Mode>("today");
  const [category, setCategory] = useState<string>("all");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  // 出題中に並びが変わらないよう、今日の分はセッション開始時の並びで固定する
  // （自己採点するたびに並びを組み直すと、採点したカードが抜けて次のカードを飛ばしてしまう）
  const [sessionIds, setSessionIds] = useState<string[]>(() =>
    buildTodayQueue(
      flashcardDecks[0].cards,
      useFlashcardStore.getState().reviews,
      getJSTDateString(),
    ).map((i) => i.card.id),
  );

  // ミニタイマーの記録を科目・テーマに紐づける（問題バンクと同じ仕組み）
  useEffect(() => {
    useTimerStore.getState().setQuestionBankContext(deck.subject, deck.topic);
  }, [deck.subject, deck.topic]);

  const today = getJSTDateString();
  const categories = useMemo(
    () => Array.from(new Set(deck.cards.map((c) => c.category))),
    [deck],
  );
  const filtered = useMemo(
    () =>
      deck.cards.filter((c) => category === "all" || c.category === category),
    [deck, category],
  );

  const schedules = useMemo(
    () =>
      new Map(
        deck.cards.map((c) => [c.id, scheduleCard(c.id, reviews, today)]),
      ),
    [deck, reviews, today],
  );
  const counts = useMemo(() => {
    let due = 0;
    let fresh = 0;
    for (const s of schedules.values()) {
      if (s.status === "due") due++;
      else if (s.status === "new") fresh++;
    }
    return { due, fresh, learned: deck.cards.length - fresh };
  }, [schedules, deck]);

  const queueIds = useMemo(() => {
    if (mode === "all") return filtered.map((c) => c.id);
    return sessionIds;
  }, [mode, filtered, sessionIds]);

  const startSession = (
    nextMode: Mode,
    nextCategory = category,
    nextDeck = deck,
  ) => {
    setDeckId(nextDeck.id);
    setMode(nextMode);
    setCategory(nextCategory);
    setIndex(0);
    setFlipped(false);
    const cards = nextDeck.cards.filter(
      (c) => nextCategory === "all" || c.category === nextCategory,
    );
    setSessionIds(
      nextMode === "today"
        ? buildTodayQueue(cards, reviews, today).map((i) => i.card.id)
        : [],
    );
  };

  const current = deck.cards.find((c) => c.id === queueIds[index]);
  const finished = index >= queueIds.length;

  const grade = (result: FlashcardResult) => {
    if (!current) return;
    addReview({
      cardId: current.id,
      deckId: deck.id,
      result,
      reviewedAt: new Date().toISOString(),
    });
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  // Space/Enter: 答えを見る、1: 忘れていた、2: 覚えていた
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
        return;
      if (!current) return;
      if (!flipped && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setFlipped(true);
      } else if (flipped && e.key === "1") {
        grade("forgot");
      } else if (flipped && e.key === "2") {
        grade("remembered");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const schedule = current ? schedules.get(current.id) : undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="sm:hidden border-b bg-muted/30 p-2 flex justify-center">
        <MiniTimer />
      </div>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="hidden sm:flex justify-end">
          <MiniTimer />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/materials"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Layers className="h-5 w-5 text-amber-500" />
              フラッシュカード
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              頻出論点を1問1答で確認。自己採点に応じて翌日・3日後・7日後…と出し直します
            </p>
          </div>
        </div>

        {flashcardDecks.length > 1 && (
          <select
            className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            value={deckId}
            onChange={(e) => {
              const next = flashcardDecks.find((d) => d.id === e.target.value);
              if (next) startSession(mode, "all", next);
            }}
          >
            {flashcardDecks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.subject} — {d.name}
              </option>
            ))}
          </select>
        )}

        <div className="bg-white rounded-lg border p-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-medium">
            {deck.subject} {deck.name}
          </span>
          <span className="text-gray-600">全 {deck.cards.length} 枚</span>
          <span className="text-red-600">復習 {counts.due} 枚</span>
          <span className="text-blue-600">未学習 {counts.fresh} 枚</span>
          <span className="text-green-600">学習済み {counts.learned} 枚</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={mode === "today" ? "default" : "outline"}
            onClick={() => startSession("today")}
          >
            今日の分
          </Button>
          <Button
            size="sm"
            variant={mode === "all" ? "default" : "outline"}
            onClick={() => startSession("all")}
          >
            すべて順番に
          </Button>
          <select
            className="rounded-md border bg-white px-2 py-1 text-sm"
            value={category}
            onChange={(e) => startSession(mode, e.target.value)}
          >
            <option value="all">すべての論点</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {finished || !current ? (
          <div className="bg-white rounded-lg border p-6 text-center space-y-3">
            <p className="font-medium">
              {queueIds.length === 0
                ? "今日出すカードはありません。"
                : `${queueIds.length} 枚すべて終わりました。`}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => startSession(mode)}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              もう一度
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span>
                {index + 1} / {queueIds.length}
              </span>
              <Badge variant="secondary">{current.category}</Badge>
              {schedule?.status === "new" && (
                <Badge className="bg-blue-100 text-blue-700">未学習</Badge>
              )}
              {schedule?.status === "due" && (
                <Badge className="bg-red-100 text-red-700">復習</Badge>
              )}
              {current.taxYear && <span>{current.taxYear}年分の金額</span>}
            </div>

            <p className="whitespace-pre-wrap text-base font-medium leading-relaxed">
              {current.front}
            </p>

            {flipped ? (
              <>
                <div className="border-t pt-4 space-y-3">
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {current.back}
                  </p>
                  {current.note && (
                    <p className="whitespace-pre-wrap text-sm text-amber-800 bg-amber-50 rounded p-2">
                      {current.note}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 break-all">
                    出典: {current.sources.join(" / ")}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="border-red-300 text-red-700"
                    onClick={() => grade("forgot")}
                  >
                    忘れていた（1）
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => grade("remembered")}
                  >
                    覚えていた（2）
                  </Button>
                </div>
              </>
            ) : (
              <Button className="w-full" onClick={() => setFlipped(true)}>
                答えを見る（Space）
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
