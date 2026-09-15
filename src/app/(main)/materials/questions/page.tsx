"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { QuestionCard, type QuestionCardRef } from "@/components/materials/QuestionCard"
import { MiniTimer, type MiniTimerRef } from "@/components/materials/MiniTimer"
import { PracticeSessionBar } from "@/components/materials/PracticeSessionBar"
import { useTimer } from "@/hooks/useTimer"
import { useTimerStore } from "@/stores/timerStore"
import { farQuestionSets } from "@/data/questions/far"
import { barPracticeQuestionSets, getBarAreaForSet } from "@/data/questions/bar"
import { getFarScopeForSet, FAR_SCOPE_LABELS } from "@/data/questions/far/farScope"
import {
  getBarScopeForSet,
  getBarScopeForQuestion,
  BAR_SCOPE_LABELS,
} from "@/data/questions/bar/barScope"
import { useQuestionBankStore } from "@/stores/questionBankStore"
import { useRecordStore } from "@/stores/recordStore"
import { usePracticeSession } from "@/hooks/usePracticeSession"
import type { FARQuestion } from "@/types/questions"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Brain,
  Target,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  XCircle,
  Gauge,
  ClipboardCheck,
} from "lucide-react"

type DifficultyFilter = "all" | "basic" | "intermediate" | "advanced"

// 出題範囲フィルター: in = 現在の科目の出題範囲内、out = 範囲外のみ
// FARはテーマ（QuestionSet）単位、BARは問題ID単位で判定する（合本教材由来のセットは
// 1セット内に範囲内と範囲外が混在するため）
type ScopeFilter = "all" | "in" | "out"

type Subject = "FAR" | "BAR"

// 出題範囲フィルターは科目ごとに保存する。共通の1キーだと、BAR画面で選んだ「範囲のみ」が
// FAR画面では「FAR範囲のみ」として効き、BAR論点のFARセット（デリバティブ等）が0問になるため
const scopeStorageKey = (subject: Subject) => `uscpa-scope-filter-${subject}`

// 出題範囲フィルターをlocalStorageから読み込み
const loadScopeFilter = (subject: Subject): ScopeFilter => {
  if (typeof window === "undefined") return "all"
  const stored = localStorage.getItem(scopeStorageKey(subject))
  return stored === "in" || stored === "out" ? stored : "all"
}

// 出題範囲フィルターをlocalStorageに保存
const saveScopeFilter = (subject: Subject, value: ScopeFilter) => {
  if (typeof window === "undefined") return
  localStorage.setItem(scopeStorageKey(subject), value)
}

// テーマ一覧に出す区分ラベル。範囲内のみのセットは null（FARの in / BARの未登録セット）。
// BAR画面でFARから借りたセットは、範囲区分ではなくBAR上のAreaを示す
const getSetLabel = (subject: Subject, setId: string): string | null => {
  if (subject === "FAR") {
    const { scope } = getFarScopeForSet(setId)
    return scope === "in" ? null : FAR_SCOPE_LABELS[scope]
  }
  const area = getBarAreaForSet(setId)
  if (area !== "I") return `Area ${area}`
  const { scope } = getBarScopeForSet(setId)
  return scope === "unverified" ? null : BAR_SCOPE_LABELS[scope]
}

export default function QuestionsPage() {
  // 科目切替。出題範囲フィルターは科目ごとのブループリント判定を使う
  const [subject, setSubject] = useState<Subject>("FAR")
  // BARは Area I（BAR問題バンク）に Area II/III（FARセットを参照）を加えた全体
  const questionSets = subject === "BAR" ? barPracticeQuestionSets : farQuestionSets

  const [selectedTopic, setSelectedTopic] = useState<string>("all")
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all")
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>(() => loadScopeFilter("FAR"))
  const [weaknessMode, setWeaknessMode] = useState(false)
  const [neverCorrectOnly, setNeverCorrectOnly] = useState(false)
  const [unattemptedOnly, setUnattemptedOnly] = useState(false)
  // フィルターをオンにした時点でのスナップショット（回答後に問題が消えないようにするため）
  const [frozenAttemptedIds, setFrozenAttemptedIds] = useState<Set<string> | null>(null)
  const [frozenEverCorrectIds, setFrozenEverCorrectIds] = useState<Set<string> | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  const miniTimerRef = useRef<MiniTimerRef>(null)
  const questionCardRef = useRef<QuestionCardRef>(null)
  const { isRunning, start, pause } = useTimer()

  const attempts = useQuestionBankStore((s) => s.attempts)
  const records = useRecordStore((s) => s.records)

  // 問題IDからQuestionSetのtopicへのマップ（個別問題のtopicではなくセット単位で集約）
  // 現在の科目の問題だけを持つので、科目スコープの判定にも使う
  const questionSetTopicMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const set of questionSets) {
      for (const q of set.questions) {
        map.set(q.id, set.topic)
      }
    }
    return map
  }, [questionSets])

  // 出題範囲フィルター適用後の問題IDの集合。統計カードもこの母集団に連動させる。
  // FARはテーマ単位（getFarScopeForSet）、BARは問題単位（getBarScopeForQuestion）で判定。
  // 判定が out のものだけを範囲外とし、gray / unverified は安全側に倒して範囲内に含める。
  // BAR画面の Area II/III（FARセット）は barScope に登録がなく unverified なので「BAR範囲のみ」に残る
  const scopedQuestionIds = useMemo(() => {
    const ids = new Set<string>()
    for (const set of questionSets) {
      for (const q of set.questions) {
        if (scopeFilter === "all") {
          ids.add(q.id)
          continue
        }
        const scope =
          subject === "BAR"
            ? getBarScopeForQuestion(set.id, q.id)
            : getFarScopeForSet(set.id).scope
        const isOut = scope === "out"
        if (scopeFilter === "in" ? !isOut : isOut) ids.add(q.id)
      }
    }
    return ids
  }, [questionSets, scopeFilter, subject])

  // 演習セッション計測用の科目判定。出題範囲フィルターとは独立に、
  // 現在の科目の問題であれば範囲外でも学習時間として数える
  const isOwnQuestion = useCallback(
    (questionId: string) => questionSetTopicMap.has(questionId),
    [questionSetTopicMap]
  )

  const {
    session: practiceSession,
    studyMinutes: practiceMinutes,
    accuracy: practiceAccuracy,
    dominantTopic: practiceTopic,
    isIdle: practiceIdle,
    saveSession: savePracticeSession,
    discardSession: discardPracticeSession,
  } = usePracticeSession({ subject, attempts, isOwnQuestion })

  // 現在の科目かつ出題範囲内の解答履歴のみ。統計カード・フィルターはこれを基準に算出する
  // （FARとBARのattemptsは同じstoreに入るため、絞らないと合算値になる）
  const subjectAttempts = useMemo(
    () => attempts.filter((a) => scopedQuestionIds.has(a.questionId)),
    [attempts, scopedQuestionIds]
  )

  // 初見正答率（各問題の最初の解答のみ）。トピックは現在の科目のQuestionSet基準
  const firstAttemptStats = useMemo(() => {
    const firstByQuestion = new Map<string, (typeof attempts)[0]>()
    for (const a of subjectAttempts) {
      // 正誤不明(null)は初見判定・分母の両方から除外
      if (a.isCorrect === null) continue
      const existing = firstByQuestion.get(a.questionId)
      if (!existing || new Date(a.attemptedAt) < new Date(existing.attemptedAt)) {
        firstByQuestion.set(a.questionId, a)
      }
    }
    const stats: Record<string, { correct: number; total: number; rate: number }> = {}
    for (const attempt of firstByQuestion.values()) {
      const setTopic = questionSetTopicMap.get(attempt.questionId) ?? attempt.topic
      if (!stats[setTopic]) stats[setTopic] = { correct: 0, total: 0, rate: 0 }
      stats[setTopic].total++
      if (attempt.isCorrect === true) stats[setTopic].correct++
    }
    for (const topic of Object.keys(stats)) {
      stats[topic].rate =
        stats[topic].total > 0 ? Math.round((stats[topic].correct / stats[topic].total) * 100) : 0
    }
    return stats
  }, [subjectAttempts, questionSetTopicMap])

  // 初見正答率の全体値（統計カード用）
  const overallFirstRate = useMemo(() => {
    let correct = 0
    let total = 0
    for (const stat of Object.values(firstAttemptStats)) {
      correct += stat.correct
      total += stat.total
    }
    return total > 0 ? Math.round((correct / total) * 100) : null
  }, [firstAttemptStats])

  // attemptsからトピック別統計を算出（QuestionSetのtopic基準、同一問題は最新回答のみ）
  const topicStats = useMemo(() => {
    const latestAttempts = new Map<string, (typeof attempts)[0]>()
    for (const attempt of subjectAttempts) {
      const existing = latestAttempts.get(attempt.questionId)
      if (!existing || new Date(attempt.attemptedAt) > new Date(existing.attemptedAt)) {
        latestAttempts.set(attempt.questionId, attempt)
      }
    }

    const stats: Record<string, { correct: number; total: number; rate: number }> = {}
    for (const attempt of latestAttempts.values()) {
      // 正誤不明(null)は分母から除外
      if (attempt.isCorrect === null) continue
      const setTopic = questionSetTopicMap.get(attempt.questionId) ?? attempt.topic
      if (!stats[setTopic]) stats[setTopic] = { correct: 0, total: 0, rate: 0 }
      stats[setTopic].total++
      if (attempt.isCorrect === true) stats[setTopic].correct++
    }
    for (const topic of Object.keys(stats)) {
      stats[topic].rate = stats[topic].total > 0 ? Math.round((stats[topic].correct / stats[topic].total) * 100) : 0
    }
    return stats
  }, [subjectAttempts, questionSetTopicMap])

  const attemptedIds = useMemo(
    () => new Set(subjectAttempts.map((a) => a.questionId)),
    [subjectAttempts]
  )
  const attemptedCount = attemptedIds.size

  // recordStoreから弱点トピック（正答率60%未満）を抽出
  const weakTopics = useMemo(() => {
    const stats: Record<string, { correct: number; total: number }> = {}
    for (const record of records) {
      if (record.subject !== subject) continue
      if (!record.subtopic || !record.totalQuestions || !record.correctAnswers) continue
      if (!stats[record.subtopic]) stats[record.subtopic] = { correct: 0, total: 0 }
      stats[record.subtopic].total += record.totalQuestions
      stats[record.subtopic].correct += record.correctAnswers
    }
    return Object.entries(stats)
      .filter(([, s]) => s.total >= 5 && Math.round((s.correct / s.total) * 100) < 60)
      .map(([topic]) => topic)
  }, [records, subject])

  // 1回でも正解したことがある問題IDのセット (isCorrect===true のみ。null は正解判定不可)
  const everCorrectIds = useMemo(() => {
    const ids = new Set<string>()
    for (const a of subjectAttempts) {
      if (a.isCorrect === true) ids.add(a.questionId)
    }
    return ids
  }, [subjectAttempts])

  // 問題をフィルタリング
  const filteredQuestions = useMemo(() => {
    let questions: FARQuestion[] = []

    if (selectedTopic === "all") {
      questions = questionSets.flatMap((set) => set.questions)
    } else {
      const set = questionSets.find((s) => s.topic === selectedTopic)
      questions = set ? set.questions : []
    }

    // 出題範囲フィルター（scopedQuestionIds は科目・スコープ判定済み）
    questions = questions.filter((q) => scopedQuestionIds.has(q.id))

    if (difficulty !== "all") {
      questions = questions.filter((q) => q.difficulty === difficulty)
    }

    // 未解答のみフィルター（フィルター適用時点のスナップショットを使い、回答後も問題が消えないようにする）
    if (unattemptedOnly) {
      const idsForFilter = frozenAttemptedIds ?? attemptedIds
      questions = questions.filter((q) => !idsForFilter.has(q.id))
    }

    // 未正解のみフィルター（同様にスナップショットを使う）
    if (neverCorrectOnly) {
      const idsForFilter = frozenEverCorrectIds ?? everCorrectIds
      questions = questions.filter((q) => !idsForFilter.has(q.id))
    }

    if (weaknessMode && weakTopics.length > 0) {
      // 弱点トピックに関連する問題を優先
      const weakQuestions = questions.filter((q) =>
        weakTopics.some(
          (wt) =>
            q.topic.toLowerCase().includes(wt.toLowerCase()) ||
            wt.toLowerCase().includes(q.subtopic.toLowerCase())
        )
      )
      const otherQuestions = questions.filter(
        (q) =>
          !weakTopics.some(
            (wt) =>
              q.topic.toLowerCase().includes(wt.toLowerCase()) ||
              wt.toLowerCase().includes(q.subtopic.toLowerCase())
          )
      )
      questions = [...weakQuestions, ...otherQuestions]
    }

    return questions
  }, [questionSets, selectedTopic, difficulty, scopedQuestionIds, weaknessMode, weakTopics, neverCorrectOnly, everCorrectIds, frozenEverCorrectIds, unattemptedOnly, attemptedIds, frozenAttemptedIds])

  // 表示中の科目とトピックをタイマーに反映する
  // 全トピック表示のときは、前に選んだ別科目のトピック名が残らないよう null にする
  useEffect(() => {
    const set =
      selectedTopic !== "all" ? questionSets.find((s) => s.topic === selectedTopic) : undefined
    useTimerStore.getState().setQuestionBankContext(subject, set ? set.name : null)
  }, [subject, selectedTopic, questionSets])

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isInputFocused =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute("contenteditable") === "true"

      if (isInputFocused) return

      // 1-4: 選択肢 A-D を選択
      if (e.key >= "1" && e.key <= "4") {
        e.preventDefault()
        const labels = ["A", "B", "C", "D"]
        questionCardRef.current?.selectChoice(labels[parseInt(e.key) - 1])
        return
      }

      // Enter: 回答を確定
      if (e.key === "Enter") {
        e.preventDefault()
        questionCardRef.current?.submitAnswer()
        return
      }

      // Space: タイマー開始/停止
      if (e.key === " " && e.code === "Space") {
        e.preventDefault()
        if (isRunning) {
          pause()
        } else {
          start()
        }
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
        setCurrentIndex((i) => Math.min(i + 1, filteredQuestions.length - 1))
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
  }, [isRunning, start, pause, filteredQuestions.length])

  // ページ操作
  const currentQuestion = filteredQuestions[currentIndex]
  const goNext = () => setCurrentIndex((i) => Math.min(i + 1, filteredQuestions.length - 1))
  const goPrev = () => setCurrentIndex((i) => Math.max(i - 1, 0))

  // トピック変更時にインデックスリセット（タイマーへの反映は上のuseEffectで行う）
  const handleTopicChange = (value: string) => {
    setSelectedTopic(value)
    setCurrentIndex(0)
  }

  const handleDifficultyChange = (value: string) => {
    setDifficulty(value as DifficultyFilter)
    setCurrentIndex(0)
  }

  const handleScopeChange = (value: string) => {
    const scope = value as ScopeFilter
    setScopeFilter(scope)
    saveScopeFilter(subject, scope)
    setCurrentIndex(0)
  }

  // 問題ごとの解答状態マップ（未解答/最終正解/最終不正解/解答済み・正誤不明）
  // 各 questionId の最新 attempt で判定する
  const questionStatusMap = useMemo(() => {
    const latestByQuestion = new Map<string, (typeof attempts)[0]>()
    for (const a of subjectAttempts) {
      const existing = latestByQuestion.get(a.questionId)
      if (!existing || new Date(a.attemptedAt) > new Date(existing.attemptedAt)) {
        latestByQuestion.set(a.questionId, a)
      }
    }
    const map = new Map<string, "correct" | "incorrect" | "unknown">()
    for (const [qid, a] of latestByQuestion) {
      if (a.isCorrect === true) map.set(qid, "correct")
      else if (a.isCorrect === false) map.set(qid, "incorrect")
      else map.set(qid, "unknown")
    }
    return map
  }, [subjectAttempts])

  const [showGrid, setShowGrid] = useState(false)

  // 統計計算。出題範囲フィルターを適用した母集団で数える
  const totalQuestions = scopedQuestionIds.size

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="sm:hidden border-b bg-muted/30 p-2 flex justify-center">
        <MiniTimer />
      </div>
      <main className="container max-w-3xl mx-auto p-4 pb-24">
        {/* 戻るリンク */}
        <Link
          href="/materials"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          教材一覧に戻る
        </Link>

        {/* デスクトップ用ミニタイマー */}
        <div className="hidden sm:flex justify-end mb-2">
          <MiniTimer ref={miniTimerRef} />
        </div>

        {/* ページヘッダー */}
        <div className="mb-6 flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold mb-2">{subject} 問題バンク</h1>
            <p className="text-sm text-muted-foreground">
              {subject === "BAR"
                ? "Proactive過去問ベースの演習"
                : "AICPA公開問題ベースの追加演習"}
              （全{totalQuestions}問）
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/materials/questions/mock">
              <ClipboardCheck className="w-4 h-4 mr-1.5" />
              模試モード
            </Link>
          </Button>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="p-3 text-center">
              <BookOpen className="w-5 h-5 mx-auto mb-1 text-blue-500" />
              <div className="text-lg font-bold">{totalQuestions}</div>
              <div className="text-xs text-muted-foreground">全問題数</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Target className="w-5 h-5 mx-auto mb-1 text-green-500" />
              <div className="text-lg font-bold">{attemptedCount}</div>
              <div className="text-xs text-muted-foreground">回答済み</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Gauge className="w-5 h-5 mx-auto mb-1 text-indigo-500" />
              <div className="text-lg font-bold">
                {overallFirstRate !== null ? `${overallFirstRate}%` : "-"}
              </div>
              <div className="text-xs text-muted-foreground">初見正答率</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-orange-500" />
              <div className="text-lg font-bold">{weakTopics.length}</div>
              <div className="text-xs text-muted-foreground">弱点トピック</div>
            </CardContent>
          </Card>
        </div>

        {/* 演習セッション（学習記録への保存） */}
        <PracticeSessionBar
          session={practiceSession}
          studyMinutes={practiceMinutes}
          accuracy={practiceAccuracy}
          dominantTopic={practiceTopic}
          isIdle={practiceIdle}
          onSave={savePracticeSession}
          onDiscard={discardPracticeSession}
        />

        {/* フィルター */}
        <Card className="mb-6">
          <CardContent className="p-4 space-y-3">
            {/* 科目切替 */}
            <div className="flex gap-2">
              {(["FAR", "BAR"] as const).map((s) => (
                <Button
                  key={s}
                  variant={subject === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSubject(s)
                    setSelectedTopic("all")
                    setScopeFilter(loadScopeFilter(s))
                  }}
                >
                  {s}
                  <span className="ml-1 text-xs opacity-70">
                    {(s === "BAR" ? barPracticeQuestionSets : farQuestionSets).reduce(
                      (sum, set) => sum + set.questions.length,
                      0,
                    )}
                    問
                  </span>
                </Button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Select value={selectedTopic} onValueChange={handleTopicChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="トピック選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全トピック</SelectItem>
                    {questionSets.map((set) => {
                      const label = getSetLabel(subject, set.id)
                      return (
                        <SelectItem key={set.id} value={set.topic}>
                          {set.name}
                          {label && (
                            <span className="ml-2 text-xs text-muted-foreground">[{label}]</span>
                          )}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-40">
                <Select value={difficulty} onValueChange={handleDifficultyChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="難易度" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全難易度</SelectItem>
                    <SelectItem value="basic">基礎</SelectItem>
                    <SelectItem value="intermediate">標準</SelectItem>
                    <SelectItem value="advanced">応用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-44">
                <Select value={scopeFilter} onValueChange={handleScopeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="出題範囲" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全範囲</SelectItem>
                    <SelectItem value="in">{subject}範囲のみ</SelectItem>
                    <SelectItem value="out">{subject}範囲外のみ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant={weaknessMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setWeaknessMode(!weaknessMode)
                  setCurrentIndex(0)
                }}
                className="w-full sm:w-auto"
                disabled={weakTopics.length === 0}
              >
                <Brain className="w-4 h-4 mr-2" />
                弱点優先モード
                {weakTopics.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {weakTopics.length}
                  </Badge>
                )}
              </Button>
              <Button
                variant={unattemptedOnly ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (!unattemptedOnly) {
                    setFrozenAttemptedIds(new Set(attemptedIds))
                    setUnattemptedOnly(true)
                  } else {
                    setFrozenAttemptedIds(null)
                    setUnattemptedOnly(false)
                  }
                  setCurrentIndex(0)
                }}
                className="w-full sm:w-auto"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                未解答のみ
                <Badge variant="secondary" className="ml-2">
                  {totalQuestions - attemptedCount}
                </Badge>
              </Button>
              <Button
                variant={neverCorrectOnly ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (!neverCorrectOnly) {
                    setFrozenEverCorrectIds(new Set(everCorrectIds))
                    setNeverCorrectOnly(true)
                  } else {
                    setFrozenEverCorrectIds(null)
                    setNeverCorrectOnly(false)
                  }
                  setCurrentIndex(0)
                }}
                className="w-full sm:w-auto"
              >
                <XCircle className="w-4 h-4 mr-2" />
                未正解のみ
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 問題表示 */}
        {filteredQuestions.length > 0 && currentQuestion ? (
          <>
            <QuestionCard
              ref={questionCardRef}
              key={currentQuestion.id}
              question={currentQuestion}
              questionNumber={currentIndex + 1}
              totalQuestions={filteredQuestions.length}
            />

            {/* ナビゲーション */}
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={goPrev}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                前の問題
              </Button>
              <button
                onClick={() => setShowGrid(!showGrid)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {currentIndex + 1} / {filteredQuestions.length}
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={goNext}
                disabled={currentIndex === filteredQuestions.length - 1}
              >
                次の問題
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {/* 問題番号グリッド */}
            {showGrid && (
              <Card className="mt-3">
                <CardContent className="p-3">
                  <div className="flex flex-wrap items-center gap-3 mb-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> 正解</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> 不正解</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" /> 解答済み・正誤不明</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 inline-block" /> 未解答</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {filteredQuestions.map((q, i) => {
                      const status = questionStatusMap.get(q.id)
                      const isCurrent = i === currentIndex
                      return (
                        <button
                          key={q.id}
                          onClick={() => { setCurrentIndex(i); setShowGrid(false) }}
                          className={cn(
                            "w-8 h-8 rounded text-xs font-medium transition-all flex items-center justify-center",
                            isCurrent && "ring-2 ring-primary ring-offset-1",
                            status === "correct" && "bg-green-100 text-green-800 hover:bg-green-200",
                            status === "incorrect" && "bg-red-100 text-red-800 hover:bg-red-200",
                            status === "unknown" && "bg-slate-200 text-slate-700 hover:bg-slate-300",
                            !status && "bg-muted text-muted-foreground hover:bg-muted/80",
                          )}
                        >
                          {i + 1}
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                該当する問題がありません。フィルターを変更してください。
              </p>
            </CardContent>
          </Card>
        )}

        {/* トピック別正答率 */}
        {Object.keys(topicStats).length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">トピック別正答率</CardTitle>
              <p className="text-xs text-muted-foreground">
                初見＝各問題の最初の解答のみ（実力の目安）／ 復習後＝各問題の最新解答
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {questionSets.map((set) => {
                  const stat = topicStats[set.topic]
                  const first = firstAttemptStats[set.topic]
                  if (!stat && !first) return null
                  const scopeBadge = getSetLabel(subject, set.id)
                  const firstRate = first?.rate ?? 0
                  return (
                    <div key={set.id} className="flex items-center justify-between text-sm">
                      <span className="truncate flex-1">
                        {set.name}
                        {scopeBadge && (
                          <Badge
                            variant="outline"
                            className="ml-2 px-1 py-0 text-[10px] font-normal text-muted-foreground"
                          >
                            {scopeBadge}
                          </Badge>
                        )}
                      </span>
                      <div className="flex items-center gap-2 ml-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              firstRate >= 80
                                ? "bg-green-500"
                                : firstRate >= 60
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                            }`}
                            style={{ width: `${firstRate}%` }}
                          />
                        </div>
                        <span className="w-14 text-right font-medium">
                          {first ? `${first.rate}%` : "-"}
                        </span>
                        <span className="w-16 text-right text-xs text-muted-foreground">
                          復習後 {stat ? `${stat.rate}%` : "-"}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
