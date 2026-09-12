"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { QuestionAttempt } from "@/types/questions"
import { useRecordStore } from "@/stores/recordStore"
import { getJSTDateString } from "@/lib/utils"
import {
  applyAttempt,
  sessionAccuracy,
  sessionDominantTopic,
  sessionStudyMinutes,
  IDLE_GAP_MS,
  type PracticeSession,
  type PracticeSubject,
} from "@/lib/practice/session"

export type { PracticeSession, PracticeSubject }

const STORAGE_KEY = "uscpa-practice-session"
const STORAGE_VERSION = 1

interface StoredState {
  version: number
  /** 取り込み済みのattempts件数。再マウント時の二重取り込みを防ぐ */
  consumedAttempts: number
  sessions: Partial<Record<PracticeSubject, PracticeSession>>
}

const emptyState = (consumedAttempts: number): StoredState => ({
  version: STORAGE_VERSION,
  consumedAttempts,
  sessions: {},
})

const loadState = (fallbackConsumed: number): StoredState => {
  if (typeof window === "undefined") return emptyState(fallbackConsumed)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState(fallbackConsumed)
    const parsed = JSON.parse(raw) as StoredState
    if (parsed.version !== STORAGE_VERSION || typeof parsed.consumedAttempts !== "number") {
      return emptyState(fallbackConsumed)
    }
    return { ...parsed, sessions: parsed.sessions ?? {} }
  } catch {
    return emptyState(fallbackConsumed)
  }
}

const saveState = (state: StoredState) => {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorageが使えない環境では計測を諦める（演習自体は続行させる）
  }
}

interface UsePracticeSessionArgs {
  subject: PracticeSubject
  attempts: QuestionAttempt[]
  /** 表示中の科目の問題かどうか（他科目の解答を取り込まないための判定） */
  isOwnQuestion: (questionId: string) => boolean
}

/**
 * 問題バンクの演習を「学習記録」に残すためのセッション計測フック。
 *
 * questionBankStoreのattemptsが増えたぶんだけ取り込み、解答間隔から実解答時間を積算する。
 * 保存はユーザーの明示操作（saveSession）のみで行い、自動では記録を作らない。
 */
export function usePracticeSession({ subject, attempts, isOwnQuestion }: UsePracticeSessionArgs) {
  const addRecord = useRecordStore((s) => s.addRecord)
  const [state, setState] = useState<StoredState | null>(null)
  // 中断表示を更新するための現在時刻（30秒ごとに進める）
  const [now, setNow] = useState(() => Date.now())

  // 初回マウント時に復元。セッションが無ければ既存のattemptsは取り込み済み扱いにする
  useEffect(() => {
    setState(loadState(attempts.length))
    // 復元は初回のみ。attemptsの変化は下のuseEffectで取り込む
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 新しい解答をセッションへ取り込む
  useEffect(() => {
    if (!state) return
    const from = Math.min(state.consumedAttempts, attempts.length)
    if (from >= attempts.length) return

    let session = state.sessions[subject]
    for (const attempt of attempts.slice(from)) {
      // 表示中の科目以外の解答は取り込まない
      if (!isOwnQuestion(attempt.questionId)) continue
      session = applyAttempt(session, attempt)
    }

    const next: StoredState = {
      ...state,
      consumedAttempts: attempts.length,
      sessions: { ...state.sessions, [subject]: session },
    }
    saveState(next)
    setState(next)
  }, [attempts, state, subject, isOwnQuestion])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30 * 1000)
    return () => clearInterval(id)
  }, [])

  const session = state?.sessions[subject]

  const studyMinutes = useMemo(() => (session ? sessionStudyMinutes(session) : 0), [session])
  const accuracy = useMemo(() => (session ? sessionAccuracy(session) : null), [session])
  const dominantTopic = useMemo(() => (session ? sessionDominantTopic(session) : null), [session])

  // 最後の解答から一定時間空いていれば「中断中」。保存忘れを気づかせるために使う
  const isIdle = session ? now - new Date(session.lastAnsweredAt).getTime() > IDLE_GAP_MS : false

  const clearSession = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev
      const sessions = { ...prev.sessions }
      delete sessions[subject]
      const next = { ...prev, sessions }
      saveState(next)
      return next
    })
  }, [subject])

  /** セッションを学習記録として保存する。保存できた場合のみtrueを返す */
  const saveSession = useCallback((): boolean => {
    if (!session || session.answeredCount === 0) return false

    addRecord({
      recordType: "practice",
      subject,
      subtopic: dominantTopic,
      studyMinutes: sessionStudyMinutes(session),
      totalQuestions: session.answeredCount,
      correctAnswers: session.correctCount,
      roundNumber: null,
      chapter: null,
      pageRange: null,
      // 日を跨いだ場合も演習を始めた日の記録として扱う
      studiedAt: getJSTDateString(new Date(session.startedAt)),
      memo: "問題バンク演習（自動計測）",
      fromQuestionBank: true,
      source: "manual",
    })

    clearSession()
    return true
  }, [session, subject, dominantTopic, addRecord, clearSession])

  return {
    session,
    studyMinutes,
    accuracy,
    dominantTopic,
    isIdle,
    saveSession,
    discardSession: clearSession,
  }
}
