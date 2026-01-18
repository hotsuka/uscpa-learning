"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubjectSelector } from "@/components/timer/SubjectSelector"
import { SubtopicSelector } from "@/components/timer/SubtopicSelector"
import { type Subject, type RecordType } from "@/types"
import { BookOpen, FileQuestion, Clock, Timer } from "lucide-react"
import { useRecordStore, checkAndResetDailyMinutes } from "@/stores/recordStore"
import { formatMinutes } from "@/lib/utils"

export default function NewRecordPage() {
  const router = useRouter()
  const { addRecord, getSubjectTodayMinutes, getTodayTotalMinutes } = useRecordStore()

  // 日付チェック
  useEffect(() => {
    checkAndResetDailyMinutes()
  }, [])

  // 共通フィールド
  const [recordType, setRecordType] = useState<RecordType>("practice")
  const [subject, setSubject] = useState<Subject>("FAR")
  const [subtopic, setSubtopic] = useState<string>("")
  const [studiedAt, setStudiedAt] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [memo, setMemo] = useState("")

  // 学習時間（分単位）- タイマーからデフォルト値を取得
  const [studyHours, setStudyHours] = useState("")
  const [studyMinutesInput, setStudyMinutesInput] = useState("")

  // 科目変更時にタイマーの時間をデフォルト値として設定
  useEffect(() => {
    const todayMinutes = getSubjectTodayMinutes(subject)
    if (todayMinutes > 0) {
      const hours = Math.floor(todayMinutes / 60)
      const mins = todayMinutes % 60
      setStudyHours(hours > 0 ? String(hours) : "")
      setStudyMinutesInput(String(mins))
    }
  }, [subject, getSubjectTodayMinutes])

  // 過去問演習用
  const [totalQuestions, setTotalQuestions] = useState("")
  const [correctAnswers, setCorrectAnswers] = useState("")
  const [roundNumber, setRoundNumber] = useState("1")

  // テキスト復習用
  const [chapter, setChapter] = useState("")
  const [pageRange, setPageRange] = useState("")

  const [isSubmitting, setIsSubmitting] = useState(false)

  // 今日の全科目の学習時間
  const todayTotalMinutes = getTodayTotalMinutes()

  // 学習時間を分に変換
  const totalStudyMinutes = (parseInt(studyHours) || 0) * 60 + (parseInt(studyMinutesInput) || 0)

  const accuracy =
    totalQuestions && correctAnswers
      ? Math.round((parseInt(correctAnswers) / parseInt(totalQuestions)) * 100)
      : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // 記録をストアに保存
    addRecord({
      recordType,
      subject,
      subtopic: subtopic || null,
      studyMinutes: totalStudyMinutes,
      studiedAt,
      memo: memo || null,
      // 過去問演習用
      totalQuestions: recordType === "practice" ? parseInt(totalQuestions) : null,
      correctAnswers: recordType === "practice" ? parseInt(correctAnswers) : null,
      roundNumber: recordType === "practice" ? parseInt(roundNumber) : null,
      // テキスト復習用
      chapter: recordType === "textbook" ? (chapter || null) : null,
      pageRange: recordType === "textbook" ? (pageRange || null) : null,
    })

    console.log("Record saved to store")
    router.push("/records")
  }

  // バリデーション: 学習時間は必須
  const hasStudyTime = totalStudyMinutes > 0
  const isPracticeValid = recordType === "practice" && totalQuestions && correctAnswers && hasStudyTime
  const isTextbookValid = recordType === "textbook" && hasStudyTime
  const isFormValid = isPracticeValid || isTextbookValid

  return (
    <>
      <Header title="記録を追加" />
      <div className="p-4 md:p-8">
        <div className="max-w-xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>学習記録</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 記録タイプ選択 */}
                <div className="space-y-2">
                  <Label>記録タイプ</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setRecordType("practice")}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                        recordType === "practice"
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-muted-foreground/50"
                      }`}
                    >
                      <FileQuestion className={`h-6 w-6 ${recordType === "practice" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-sm font-medium ${recordType === "practice" ? "text-primary" : ""}`}>
                        過去問演習
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecordType("textbook")}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                        recordType === "textbook"
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-muted-foreground/50"
                      }`}
                    >
                      <BookOpen className={`h-6 w-6 ${recordType === "textbook" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-sm font-medium ${recordType === "textbook" ? "text-primary" : ""}`}>
                        テキスト復習
                      </span>
                    </button>
                  </div>
                </div>

                {/* 科目選択 */}
                <div className="space-y-2">
                  <Label>科目</Label>
                  <SubjectSelector
                    value={subject}
                    onChange={(s) => {
                      setSubject(s)
                      setSubtopic("") // 科目変更時にサブテーマをリセット
                    }}
                    className="w-full"
                  />
                </div>

                {/* サブテーマ選択 */}
                <div className="space-y-2">
                  <Label>サブテーマ（任意）</Label>
                  <SubtopicSelector
                    subject={subject}
                    value={subtopic}
                    onChange={setSubtopic}
                    className="w-full"
                  />
                </div>

                {/* 学習時間 */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    学習時間
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="24"
                      value={studyHours}
                      onChange={(e) => setStudyHours(e.target.value)}
                      placeholder="0"
                      className="w-20"
                    />
                    <span className="text-muted-foreground">時間</span>
                    <Input
                      type="number"
                      min="0"
                      max="59"
                      value={studyMinutesInput}
                      onChange={(e) => setStudyMinutesInput(e.target.value)}
                      placeholder="0"
                      className="w-20"
                    />
                    <span className="text-muted-foreground">分</span>
                  </div>
                  {todayTotalMinutes > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                      <Timer className="h-3 w-3" />
                      <span>今日のタイマー記録: {formatMinutes(todayTotalMinutes)}</span>
                    </div>
                  )}
                  {totalStudyMinutes > 0 && (
                    <p className="text-sm text-primary font-medium">
                      = {formatMinutes(totalStudyMinutes)}
                    </p>
                  )}
                </div>

                {/* 過去問演習用フィールド */}
                {recordType === "practice" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="totalQuestions">問題数</Label>
                        <Input
                          id="totalQuestions"
                          type="number"
                          min="1"
                          value={totalQuestions}
                          onChange={(e) => setTotalQuestions(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="correctAnswers">正解数</Label>
                        <Input
                          id="correctAnswers"
                          type="number"
                          min="0"
                          max={totalQuestions || undefined}
                          value={correctAnswers}
                          onChange={(e) => setCorrectAnswers(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    {totalQuestions && correctAnswers && (
                      <div className="text-center py-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">正答率</p>
                        <p className="text-4xl font-bold">{accuracy}%</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="roundNumber">周回数</Label>
                      <Input
                        id="roundNumber"
                        type="number"
                        min="1"
                        value={roundNumber}
                        onChange={(e) => setRoundNumber(e.target.value)}
                        required
                      />
                    </div>
                  </>
                )}

                {/* テキスト復習用フィールド */}
                {recordType === "textbook" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="chapter">チャプター / セクション（任意）</Label>
                      <Input
                        id="chapter"
                        value={chapter}
                        onChange={(e) => setChapter(e.target.value)}
                        placeholder="例: Chapter 5 - Revenue Recognition"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pageRange">ページ範囲（任意）</Label>
                      <Input
                        id="pageRange"
                        value={pageRange}
                        onChange={(e) => setPageRange(e.target.value)}
                        placeholder="例: 100-150"
                      />
                    </div>
                  </>
                )}

                {/* 学習日 */}
                <div className="space-y-2">
                  <Label htmlFor="studiedAt">学習日</Label>
                  <Input
                    id="studiedAt"
                    type="date"
                    value={studiedAt}
                    onChange={(e) => setStudiedAt(e.target.value)}
                    required
                  />
                </div>

                {/* メモ・振り返り */}
                <div className="space-y-2">
                  <Label htmlFor="memo">メモ / 振り返り（任意）</Label>
                  <textarea
                    id="memo"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="今日の学びや気づき、補足情報などを自由に記入..."
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.back()}
                  >
                    キャンセル
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={!isFormValid || isSubmitting}
                  >
                    {isSubmitting ? "保存中..." : "保存"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
