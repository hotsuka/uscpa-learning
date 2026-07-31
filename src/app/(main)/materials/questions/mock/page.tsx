"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/common/ConfirmDialog"
import { MarkdownPreview } from "@/components/notes/MarkdownPreview"
import { MiniTimer, type MiniTimerRef } from "@/components/materials/MiniTimer"
import { MockExamResultDetail } from "@/components/questions/MockExamResultDetail"
import { useTimer } from "@/hooks/useTimer"
import {
  buildMockExam,
  MOCK_EXAM_QUESTION_COUNT,
  MOCK_EXAM_MINUTES,
  MOCK_EXAM_TARGET_RATE,
  type MockExamQuestionEntry,
} from "@/lib/mockExam"
import { useQuestionBankStore } from "@/stores/questionBankStore"
import {
  useMockExamStore,
  type MockExamAnswer,
  type MockExamResult,
} from "@/stores/mockExamStore"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Timer,
  Flag,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Keyboard,
} from "lucide-react"

// review: 過去の模試結果を履歴から見直すフェーズ
type Phase = "intro" | "running" | "result" | "review"

const formatRemaining = (sec: number): string => {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

export default function MockExamPage() {
  const [phase, setPhase] = useState<Phase>("intro")
  const [entries, setEntries] = useState<MockExamQuestionEntry[]>([])
  // index -> シャッフル後ラベル
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [flagged, setFlagged] = useState<Set<number>>(new Set())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [remainingSec, setRemainingSec] = useState(MOCK_EXAM_MINUTES * 60)
  const [result, setResult] = useState<MockExamResult | null>(null)
  // 履歴から見直し中の過去結果
  const [reviewingResult, setReviewingResult] = useState<MockExamResult | null>(null)
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false)

  const startedAtRef = useRef<string>("")
  const deadlineRef = useRef<number>(0)
  const finishedRef = useRef(false)
  const miniTimerRef = useRef<MiniTimerRef>(null)

  const { isRunning, start, pause } = useTimer()

  const addAttempt = useQuestionBankStore((s) => s.addAttempt)
  const addResult = useMockExamStore((s) => s.addResult)
  const pastResults = useMockExamStore((s) => s.results)

  const handleStart = (): void => {
    setEntries(buildMockExam())
    setAnswers({})
    setFlagged(new Set())
    setCurrentIndex(0)
    setRemainingSec(MOCK_EXAM_MINUTES * 60)
    setResult(null)
    setReviewingResult(null)
    startedAtRef.current = new Date().toISOString()
    deadlineRef.current = Date.now() + MOCK_EXAM_MINUTES * 60 * 1000
    finishedRef.current = false
    setPhase("running")
  }

  const finishExam = useCallback((): void => {
    if (finishedRef.current) return
    finishedRef.current = true
    const finishedAt = new Date().toISOString()

    const answerRecords: MockExamAnswer[] = entries.map((entry, i) => {
      const selectedShuffled = answers[i] ?? null
      const selectedOriginal = selectedShuffled
        ? (entry.shuffledToOriginalLabel[selectedShuffled] ?? selectedShuffled)
        : null
      // 未回答は不正解として集計する
      const isCorrect = selectedShuffled !== null && selectedShuffled === entry.correctAnswer
      return {
        questionId: entry.question.id,
        topic: entry.question.topic,
        area: entry.area,
        difficulty: entry.question.difficulty,
        selectedAnswer: selectedOriginal,
        correctAnswer: entry.question.correctAnswer,
        isCorrect,
      }
    })

    // 回答した問題は通常の解答履歴（初見統計等）にも記録する
    for (const record of answerRecords) {
      if (record.selectedAnswer !== null) {
        addAttempt({
          questionId: record.questionId,
          topic: record.topic,
          selectedAnswer: record.selectedAnswer,
          isCorrect: record.isCorrect,
          attemptedAt: finishedAt,
        })
      }
    }

    const breakdown = (keyOf: (a: MockExamAnswer) => string) => {
      const acc: Record<string, { correct: number; total: number }> = {}
      for (const a of answerRecords) {
        const key = keyOf(a)
        if (!acc[key]) acc[key] = { correct: 0, total: 0 }
        acc[key].total++
        if (a.isCorrect) acc[key].correct++
      }
      return acc
    }

    const correctCount = answerRecords.filter((a) => a.isCorrect).length
    const mockResult: MockExamResult = {
      id: crypto.randomUUID(),
      startedAt: startedAtRef.current,
      finishedAt,
      totalQuestions: answerRecords.length,
      correctCount,
      score:
        answerRecords.length > 0
          ? Math.round((correctCount / answerRecords.length) * 100)
          : 0,
      areaBreakdown: breakdown((a) => a.area),
      difficultyBreakdown: breakdown((a) => a.difficulty),
      topicBreakdown: breakdown((a) => a.topic),
      answers: answerRecords,
    }
    addResult(mockResult)
    setResult(mockResult)
    setPhase("result")
  }, [entries, answers, addAttempt, addResult])

  // タイマー（0で自動提出）
  useEffect(() => {
    if (phase !== "running") return
    const timer = setInterval(() => {
      const rest = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000))
      setRemainingSec(rest)
      if (rest <= 0) {
        finishExam()
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [phase, finishExam])

  // 実施中のページ離脱警告
  useEffect(() => {
    if (phase !== "running") return
    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [phase])

  const answeredCount = Object.keys(answers).length
  const currentEntry = entries[currentIndex]

  // キーボードショートカット（通常モードと同じく 1-4 で選択、←→ で問題移動）
  useEffect(() => {
    if (phase !== "running") return
    const handleKeyDown = (e: KeyboardEvent): void => {
      // 提出確認ダイアログ表示中は無効化
      if (confirmSubmitOpen) return

      const activeElement = document.activeElement
      const isInputFocused =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute("contenteditable") === "true"

      if (isInputFocused) return

      // 1-4: 表示順の選択肢を選択（シャッフル後ラベルで保持する）
      if (e.key >= "1" && e.key <= "4") {
        const choice = currentEntry?.choices[Number(e.key) - 1]
        if (!choice) return
        e.preventDefault()
        setAnswers((prev) => ({ ...prev, [currentIndex]: choice.label }))
        return
      }

      // ←: 前の問題
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        setCurrentIndex((i) => Math.max(i - 1, 0))
        return
      }

      // →: 次の問題
      if (e.key === "ArrowRight") {
        e.preventDefault()
        setCurrentIndex((i) => Math.min(i + 1, entries.length - 1))
        return
      }

      // Space: 学習タイマー開始/停止
      if (e.key === " " && e.code === "Space") {
        e.preventDefault()
        if (isRunning) {
          pause()
        } else {
          start()
        }
        return
      }

      // Q: 問題数を増減
      if (e.key === "q" || e.key === "Q") {
        e.preventDefault()
        if (e.shiftKey) {
          miniTimerRef.current?.decrementQuestions()
        } else {
          miniTimerRef.current?.incrementQuestions()
        }
        return
      }

      // A: 正解数を増減
      if (e.key === "a" || e.key === "A") {
        e.preventDefault()
        if (e.shiftKey) {
          miniTimerRef.current?.decrementCorrect()
        } else {
          miniTimerRef.current?.incrementCorrect()
        }
        return
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    phase,
    confirmSubmitOpen,
    currentEntry,
    currentIndex,
    entries.length,
    isRunning,
    start,
    pause,
  ])

  const handleSubmitClick = (): void => {
    setConfirmSubmitOpen(true)
  }

  const toggleFlag = (index: number): void => {
    setFlagged((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {/* モバイル用ミニタイマー（学習時間・問題数・正解数） */}
      <div className="sm:hidden border-b bg-muted/30 p-2 flex justify-center">
        <MiniTimer />
      </div>
      <main className="container max-w-3xl mx-auto p-4 pb-24">
        {/* デスクトップ用ミニタイマー */}
        <div className="hidden sm:flex justify-end mb-2">
          <MiniTimer ref={miniTimerRef} />
        </div>

        {(phase === "intro" || phase === "result") && (
          <Link
            href="/materials/questions"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            問題バンクに戻る
          </Link>
        )}

        {phase === "review" && (
          <button
            onClick={() => {
              setReviewingResult(null)
              setPhase("intro")
            }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            模試トップに戻る
          </button>
        )}

        {/* ===== 開始画面 ===== */}
        {phase === "intro" && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-2">FAR 模試モード</h1>
              <p className="text-sm text-muted-foreground">
                本番のMCQセクション相当の演習（解答中は正誤・解説が表示されません）
              </p>
            </div>
            <Card className="mb-6">
              <CardContent className="p-6 space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
                  <span>
                    全{MOCK_EXAM_QUESTION_COUNT}問 — FAR出題範囲からArea配分
                    （I:18問 / II:17問 / III:15問）で自動抽出
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-muted-foreground" />
                  <span>
                    制限時間{MOCK_EXAM_MINUTES}分 — 時間切れで自動提出、目標は正答率
                    {MOCK_EXAM_TARGET_RATE}%以上
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-muted-foreground" />
                  <span>見直しフラグと問題番号グリッドで自由に行き来できます</span>
                </div>
                <div className="flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-muted-foreground" />
                  <span>
                    ショートカット: 1〜4 で選択肢を選択、← → で前後の問題へ移動、
                    Space で学習タイマー開始/停止、Q / A で問題数・正解数を増減
                    （Shift併用で減算）
                  </span>
                </div>
                <Button onClick={handleStart} className="w-full mt-2">
                  模試を開始する
                </Button>
              </CardContent>
            </Card>

            {pastResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">過去の模試結果</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    タップすると誤答した問題の選択結果と解説を確認できます
                  </p>
                  {pastResults.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setReviewingResult(r)
                        setPhase("review")
                      }}
                      className="w-full flex items-center justify-between text-sm px-3 py-2 rounded-md border bg-muted/30 hover:bg-muted transition-colors text-left"
                    >
                      <span className="text-muted-foreground">
                        {formatDateTime(r.finishedAt)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "font-bold",
                            r.score >= MOCK_EXAM_TARGET_RATE
                              ? "text-green-600"
                              : "text-red-500"
                          )}
                        >
                          {r.score}%
                          <span className="font-normal text-muted-foreground text-xs ml-1">
                            ({r.correctCount}/{r.totalQuestions})
                          </span>
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ===== 演習画面 ===== */}
        {phase === "running" && currentEntry && (
          <>
            {/* タイマーバー */}
            <div className="flex items-center justify-between mb-4 sticky top-0 z-10 bg-background py-2 border-b">
              <div
                className={cn(
                  "flex items-center gap-1.5 font-mono text-lg font-bold",
                  remainingSec <= 300 && "text-red-500"
                )}
              >
                <Timer className="w-5 h-5" />
                {formatRemaining(remainingSec)}
              </div>
              <div className="text-sm text-muted-foreground">
                回答 {answeredCount} / {entries.length}
              </div>
              <Button size="sm" onClick={handleSubmitClick}>
                提出する
              </Button>
            </div>

            {/* 問題 */}
            <Card className="mb-4">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">
                    {currentIndex + 1} / {entries.length}
                  </span>
                  <Button
                    variant={flagged.has(currentIndex) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleFlag(currentIndex)}
                  >
                    <Flag className="w-4 h-4 mr-1" />
                    {flagged.has(currentIndex) ? "フラグ解除" : "見直しフラグ"}
                  </Button>
                </div>
                <div className="text-base font-medium mb-6 leading-relaxed">
                  <MarkdownPreview content={currentEntry.question.stem} />
                </div>
                <div className="space-y-3">
                  {currentEntry.choices.map((choice) => {
                    const isSelected = answers[currentIndex] === choice.label
                    return (
                      <button
                        key={choice.label}
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, [currentIndex]: choice.label }))
                        }
                        className={cn(
                          "w-full text-left p-4 rounded-lg border-2 transition-all",
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-primary hover:bg-accent cursor-pointer"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span className="font-bold text-sm shrink-0 mt-0.5 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                            {choice.label}
                          </span>
                          <span className="text-sm leading-relaxed">{choice.text}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* ナビゲーション */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                前の問題
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentIndex((i) => Math.min(i + 1, entries.length - 1))}
                disabled={currentIndex === entries.length - 1}
              >
                次の問題
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {/* 問題番号グリッド */}
            <Card>
              <CardContent className="p-3">
                <div className="flex flex-wrap items-center gap-3 mb-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" /> 回答済み
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" /> フラグ
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 inline-block" /> 未回答
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {entries.map((entry, i) => {
                    const isAnswered = answers[i] !== undefined
                    const isFlagged = flagged.has(i)
                    const isCurrent = i === currentIndex
                    return (
                      <button
                        key={entry.question.id}
                        onClick={() => setCurrentIndex(i)}
                        className={cn(
                          "w-8 h-8 rounded text-xs font-medium transition-all flex items-center justify-center",
                          isCurrent && "ring-2 ring-primary ring-offset-1",
                          isFlagged
                            ? "bg-orange-100 text-orange-800 hover:bg-orange-200"
                            : isAnswered
                              ? "bg-primary/15 text-primary hover:bg-primary/25"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                      >
                        {i + 1}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ===== 結果画面 ===== */}
        {phase === "result" && result && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-2">模試結果</h1>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(result.startedAt)} 〜 {formatDateTime(result.finishedAt)}
              </p>
            </div>

            <MockExamResultDetail result={result} />

            <div className="flex gap-2">
              <Button onClick={handleStart} className="flex-1">
                もう一度受ける
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link href="/materials/questions">問題バンクに戻る</Link>
              </Button>
            </div>
          </>
        )}

        {/* ===== 過去結果の見直し画面 ===== */}
        {phase === "review" && reviewingResult && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-2">過去の模試結果</h1>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(reviewingResult.startedAt)} 〜{" "}
                {formatDateTime(reviewingResult.finishedAt)}
              </p>
            </div>

            <MockExamResultDetail result={reviewingResult} />

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setReviewingResult(null)
                  setPhase("intro")
                }}
                className="flex-1"
              >
                模試トップに戻る
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link href="/materials/questions">問題バンクに戻る</Link>
              </Button>
            </div>
          </>
        )}
      </main>

      <ConfirmDialog
        open={confirmSubmitOpen}
        onOpenChange={setConfirmSubmitOpen}
        title="模試を提出しますか？"
        description={
          answeredCount < entries.length
            ? `未回答が${entries.length - answeredCount}問あります。未回答は不正解として採点されます。`
            : "全問回答済みです。採点結果を表示します。"
        }
        confirmLabel="提出する"
        onConfirm={() => {
          setConfirmSubmitOpen(false)
          finishExam()
        }}
      />
    </div>
  )
}
