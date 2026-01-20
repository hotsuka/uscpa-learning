"use client"

import { useEffect, useState, useMemo } from "react"
import { useTimer } from "@/hooks/useTimer"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  TimerDisplay,
  TimerControls,
  SubjectSelector,
  SubtopicSelector,
  ModeToggle,
  RecordDialog,
  type RecordData,
} from "@/components/timer"
import { formatMinutes, generateUUID } from "@/lib/utils"
import { SUBJECTS, type Subject } from "@/types"
import { useRecordStore } from "@/stores/recordStore"
import { FileQuestion, MessageSquare } from "lucide-react"

interface PendingSession {
  sessionId: string  // セッション識別子（v1.11追加）
  subject: Subject
  subtopic: string | null
  durationSeconds: number
  startTime: number
  endTime: number
  totalQuestions: string
  correctAnswers: string
  memo: string
}

export default function TimerPage() {
  const {
    subject,
    subtopic,
    mode,
    displayTime,
    isBreak,
    isRunning,
    isPaused,
    isIdle,
    elapsedSeconds,
    totalQuestions,
    correctAnswers,
    memo,
    setSubject,
    setSubtopic,
    setMode,
    setTotalQuestions,
    setCorrectAnswers,
    setMemo,
    resetRecordFields,
    start,
    pause,
    stop,
    reset,
  } = useTimer()

  const { addRecord, records } = useRecordStore()

  // 記録ダイアログの状態
  const [showRecordDialog, setShowRecordDialog] = useState(false)
  const [pendingSession, setPendingSession] = useState<PendingSession | null>(null)

  // 今日の記録から学習時間を計算
  const todayTotalMinutes = useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    const todayRecords = records.filter((r) => r.studiedAt === today)
    return todayRecords.reduce((sum, r) => sum + (r.studyMinutes || 0), 0)
  }, [records])

  // 正答率の計算
  const accuracy = totalQuestions && correctAnswers
    ? Math.round((parseInt(correctAnswers) / parseInt(totalQuestions)) * 100)
    : null

  const handleStop = () => {
    const session = stop()
    if (session) {
      // セッション情報を保持してダイアログを表示
      setPendingSession({
        sessionId: generateUUID(),  // セッション識別子を生成（v1.11追加）
        subject: session.subject,
        subtopic: session.subtopic,
        durationSeconds: session.durationSeconds,
        startTime: session.startTime,
        endTime: session.endTime,
        totalQuestions: session.totalQuestions,
        correctAnswers: session.correctAnswers,
        memo: session.memo,
      })
      setShowRecordDialog(true)
    }
  }

  const handleSaveRecord = async (data: RecordData) => {
    if (!pendingSession) return

    const minutes = Math.floor(pendingSession.durationSeconds / 60)

    // 学習記録をストアに追加（Notion同期も含む）
    addRecord({
      recordType: data.recordType,
      subject: data.subject,
      subtopic: data.subtopic,
      studyMinutes: data.studyMinutes,
      totalQuestions: data.totalQuestions,
      correctAnswers: data.correctAnswers,
      roundNumber: data.roundNumber,
      chapter: data.chapter,
      pageRange: data.pageRange,
      memo: data.memo,
      studiedAt: data.studiedAt,
      source: "timer",  // タイマー経由の記録（v1.11追加）
      sessionId: pendingSession.sessionId,  // 紐づくセッションID（v1.11追加）
    })

    // Notionにセッションも保存（バックグラウンド）
    fetch("/api/notion/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: pendingSession.sessionId,  // セッション識別子（v1.11追加）
        subject: pendingSession.subject,
        subtopic: pendingSession.subtopic,
        studyMinutes: minutes,
        startedAt: new Date(pendingSession.startTime).toISOString(),
        endedAt: new Date(pendingSession.endTime).toISOString(),
      }),
    }).catch((error) => {
      console.error("Failed to save session to Notion:", error)
    })

    // ダイアログを閉じてリセット
    setShowRecordDialog(false)
    setPendingSession(null)
    resetRecordFields()
  }

  const handleCancelRecord = () => {
    // キャンセル時はセッションを破棄（記録なし）
    setShowRecordDialog(false)
    setPendingSession(null)
    resetRecordFields()
  }

  return (
    <>
      <Header title="タイマー" />
      <div className="p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* モード切替 */}
          <div className="flex justify-center">
            <ModeToggle
              mode={mode}
              onChange={setMode}
              disabled={!isIdle}
            />
          </div>

          {/* 科目・サブテーマ選択 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <SubjectSelector
              value={subject}
              onChange={setSubject}
              disabled={!isIdle}
            />
            <SubtopicSelector
              subject={subject}
              value={subtopic ?? ""}
              onChange={(value) => setSubtopic(value || null)}
              disabled={!isIdle}
              className="w-full sm:w-[200px]"
            />
          </div>

          {/* 現在の選択表示 */}
          <div className="text-center">
            <span className="text-sm text-muted-foreground">
              {SUBJECTS[subject].name}
              {subtopic && <span className="ml-2">/ {subtopic}</span>}
            </span>
          </div>

          {/* タイマー表示 */}
          <Card className="border-2">
            <CardContent className="py-12">
              <TimerDisplay
                time={displayTime}
                isBreak={isBreak}
              />
            </CardContent>
          </Card>

          {/* コントロール */}
          <TimerControls
            isRunning={isRunning}
            isPaused={isPaused}
            onStart={start}
            onPause={pause}
            onStop={handleStop}
            onReset={reset}
          />

          {/* 演習記録入力欄 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileQuestion className="h-4 w-4" />
                演習記録（任意）
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 問題数・正答数 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="totalQuestions">問題数</Label>
                  <Input
                    id="totalQuestions"
                    type="number"
                    min="1"
                    placeholder="例: 30"
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="correctAnswers">正解数</Label>
                  <Input
                    id="correctAnswers"
                    type="number"
                    min="0"
                    max={totalQuestions || undefined}
                    placeholder="例: 24"
                    value={correctAnswers}
                    onChange={(e) => setCorrectAnswers(e.target.value)}
                  />
                </div>
              </div>

              {/* 正答率表示 */}
              {accuracy !== null && (
                <div className="text-center p-2 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">正答率: </span>
                  <span className={`text-lg font-bold ${
                    accuracy >= 80 ? "text-green-600" :
                    accuracy >= 60 ? "text-yellow-600" : "text-red-600"
                  }`}>
                    {accuracy}%
                  </span>
                </div>
              )}

              {/* メモ */}
              <div className="space-y-2">
                <Label htmlFor="memo" className="flex items-center gap-2">
                  <MessageSquare className="h-3 w-3" />
                  メモ
                </Label>
                <Textarea
                  id="memo"
                  placeholder="学習の感想や気づきなど..."
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* 今日の累計 */}
          <Card>
            <CardContent className="py-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">今日の学習時間</p>
                <p className="text-2xl font-bold mt-1">
                  {formatMinutes(todayTotalMinutes + Math.floor(elapsedSeconds / 60))}
                </p>
                {elapsedSeconds >= 60 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    (現在のセッション: +{formatMinutes(Math.floor(elapsedSeconds / 60))})
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 使い方ヒント */}
          {isIdle && (
            <div className="text-center text-sm text-muted-foreground">
              <p>科目とサブテーマを選択して、スタートボタンを押してください</p>
              <p className="mt-1">
                ポモドーロモード: 25分作業 → 5分休憩
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 記録ダイアログ */}
      {pendingSession && (
        <RecordDialog
          open={showRecordDialog}
          onOpenChange={setShowRecordDialog}
          subject={pendingSession.subject}
          subtopic={pendingSession.subtopic}
          studyMinutes={Math.floor(pendingSession.durationSeconds / 60)}
          initialTotalQuestions={pendingSession.totalQuestions}
          initialCorrectAnswers={pendingSession.correctAnswers}
          initialMemo={pendingSession.memo}
          onSave={handleSaveRecord}
          onCancel={handleCancelRecord}
        />
      )}
    </>
  )
}
