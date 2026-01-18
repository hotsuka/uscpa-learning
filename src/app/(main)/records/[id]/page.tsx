"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubjectSelector } from "@/components/timer/SubjectSelector"
import { SubtopicSelector } from "@/components/timer/SubtopicSelector"
import { type Subject, type RecordType } from "@/types"
import { BookOpen, FileQuestion, Clock, Pencil, Save, X, Trash2, FileText } from "lucide-react"
import { useRecordStore } from "@/stores/recordStore"
import { formatMinutes } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export default function RecordDetailPage() {
  const router = useRouter()
  const params = useParams()
  const recordId = params.id as string
  const { getRecordById, updateRecord, deleteRecord } = useRecordStore()

  const record = getRecordById(recordId)
  const [isEditing, setIsEditing] = useState(false)

  // 編集用state
  const [recordType, setRecordType] = useState<RecordType>("practice")
  const [subject, setSubject] = useState<Subject>("FAR")
  const [subtopic, setSubtopic] = useState<string>("")
  const [studiedAt, setStudiedAt] = useState("")
  const [memo, setMemo] = useState("")
  const [studyHours, setStudyHours] = useState("")
  const [studyMinutesInput, setStudyMinutesInput] = useState("")
  const [totalQuestions, setTotalQuestions] = useState("")
  const [correctAnswers, setCorrectAnswers] = useState("")
  const [roundNumber, setRoundNumber] = useState("1")
  const [chapter, setChapter] = useState("")
  const [pageRange, setPageRange] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // レコードデータを編集用ステートに設定
  useEffect(() => {
    if (record) {
      setRecordType(record.recordType)
      setSubject(record.subject)
      setSubtopic(record.subtopic || "")
      setStudiedAt(record.studiedAt)
      setMemo(record.memo || "")

      const hours = Math.floor((record.studyMinutes || 0) / 60)
      const mins = (record.studyMinutes || 0) % 60
      setStudyHours(hours > 0 ? String(hours) : "")
      setStudyMinutesInput(mins > 0 ? String(mins) : "")

      setTotalQuestions(record.totalQuestions ? String(record.totalQuestions) : "")
      setCorrectAnswers(record.correctAnswers ? String(record.correctAnswers) : "")
      setRoundNumber(record.roundNumber ? String(record.roundNumber) : "1")
      setChapter(record.chapter || "")
      setPageRange(record.pageRange || "")
    }
  }, [record])

  // 記録が見つからない場合
  if (!record) {
    return (
      <>
        <Header title="記録詳細" />
        <div className="p-4 md:p-8">
          <div className="max-w-xl mx-auto">
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">記録が見つかりません</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => router.push("/records")}
                >
                  記録一覧に戻る
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    )
  }

  // 学習時間を分に変換
  const totalStudyMinutes = (parseInt(studyHours) || 0) * 60 + (parseInt(studyMinutesInput) || 0)

  const accuracy =
    totalQuestions && correctAnswers
      ? Math.round((parseInt(correctAnswers) / parseInt(totalQuestions)) * 100)
      : 0

  const handleSave = async () => {
    setIsSaving(true)

    updateRecord(recordId, {
      recordType,
      subject,
      subtopic: subtopic || null,
      studyMinutes: totalStudyMinutes,
      studiedAt,
      memo: memo || null,
      totalQuestions: recordType === "practice" ? (parseInt(totalQuestions) || null) : null,
      correctAnswers: recordType === "practice" ? (parseInt(correctAnswers) || null) : null,
      roundNumber: recordType === "practice" ? (parseInt(roundNumber) || null) : null,
      chapter: recordType === "textbook" ? (chapter || null) : null,
      pageRange: recordType === "textbook" ? (pageRange || null) : null,
    })

    setIsEditing(false)
    setIsSaving(false)
  }

  const handleDelete = () => {
    if (confirm("この記録を削除しますか？")) {
      deleteRecord(recordId)
      router.push("/records")
    }
  }

  const handleCancel = () => {
    // 元の値に戻す
    if (record) {
      setRecordType(record.recordType)
      setSubject(record.subject)
      setSubtopic(record.subtopic || "")
      setStudiedAt(record.studiedAt)
      setMemo(record.memo || "")

      const hours = Math.floor((record.studyMinutes || 0) / 60)
      const mins = (record.studyMinutes || 0) % 60
      setStudyHours(hours > 0 ? String(hours) : "")
      setStudyMinutesInput(mins > 0 ? String(mins) : "")

      setTotalQuestions(record.totalQuestions ? String(record.totalQuestions) : "")
      setCorrectAnswers(record.correctAnswers ? String(record.correctAnswers) : "")
      setRoundNumber(record.roundNumber ? String(record.roundNumber) : "1")
      setChapter(record.chapter || "")
      setPageRange(record.pageRange || "")
    }
    setIsEditing(false)
  }

  // バリデーション
  const hasStudyTime = totalStudyMinutes > 0
  const isPracticeValid = recordType === "practice" && totalQuestions && correctAnswers && hasStudyTime
  const isTextbookValid = recordType === "textbook" && hasStudyTime
  const isFormValid = isPracticeValid || isTextbookValid

  // 表示用の正答率計算
  const displayAccuracy = record.totalQuestions && record.correctAnswers
    ? Math.round((record.correctAnswers / record.totalQuestions) * 100)
    : null

  return (
    <>
      <Header title={isEditing ? "記録を編集" : "記録詳細"} />
      <div className="p-4 md:p-8">
        <div className="max-w-xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{isEditing ? "記録を編集" : "学習記録"}</CardTitle>
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button variant="outline" size="sm" onClick={handleCancel}>
                        <X className="h-4 w-4 mr-1" />
                        キャンセル
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={!isFormValid || isSaving}>
                        <Save className="h-4 w-4 mr-1" />
                        {isSaving ? "保存中..." : "保存"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                        <Pencil className="h-4 w-4 mr-1" />
                        編集
                      </Button>
                      <Button variant="destructive" size="sm" onClick={handleDelete}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        削除
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                // 編集モード
                <div className="space-y-6">
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
                        setSubtopic("")
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
                    />
                  </div>

                  {/* メモ */}
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
                </div>
              ) : (
                // 表示モード
                <div className="space-y-6">
                  {/* 基本情報 */}
                  <div className="flex items-center gap-3">
                    <Badge variant={record.subject.toLowerCase() as "far" | "aud" | "reg" | "bar"}>
                      {record.subject}
                    </Badge>
                    {record.recordType === "practice" && (
                      <Badge variant="outline">
                        <FileQuestion className="h-3 w-3 mr-1" />
                        過去問演習
                      </Badge>
                    )}
                    {record.recordType === "textbook" && (
                      <Badge variant="outline">
                        <BookOpen className="h-3 w-3 mr-1" />
                        テキスト復習
                      </Badge>
                    )}
                    {record.recordType === "practice" && record.roundNumber && (
                      <span className="text-sm text-muted-foreground">{record.roundNumber}周目</span>
                    )}
                  </div>

                  {/* テーマ */}
                  <div>
                    <Label className="text-muted-foreground text-xs">テーマ</Label>
                    <p className="font-medium">{record.subtopic || record.chapter || "未設定"}</p>
                  </div>

                  {/* 学習日 */}
                  <div>
                    <Label className="text-muted-foreground text-xs">学習日</Label>
                    <p className="font-medium">{record.studiedAt}</p>
                  </div>

                  {/* 学習時間 */}
                  <div>
                    <Label className="text-muted-foreground text-xs">学習時間</Label>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{formatMinutes(record.studyMinutes)}</p>
                    </div>
                  </div>

                  {/* 過去問演習の場合: 問題数・正答率 */}
                  {record.recordType === "practice" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground text-xs">問題数</Label>
                        <p className="font-medium">
                          {record.correctAnswers}/{record.totalQuestions}問
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">正答率</Label>
                        <p className="text-3xl font-bold">
                          {displayAccuracy !== null ? `${displayAccuracy}%` : "-"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* テキスト復習の場合: ページ範囲 */}
                  {record.recordType === "textbook" && record.pageRange && (
                    <div>
                      <Label className="text-muted-foreground text-xs">ページ範囲</Label>
                      <p className="font-medium">{record.pageRange}</p>
                    </div>
                  )}

                  {/* メモ */}
                  {record.memo && (
                    <div>
                      <Label className="text-muted-foreground text-xs">メモ / 振り返り</Label>
                      <p className="whitespace-pre-wrap text-sm mt-1 p-3 bg-muted rounded-lg">
                        {record.memo}
                      </p>
                    </div>
                  )}

                  {/* 作成日時 */}
                  <div className="text-xs text-muted-foreground pt-4 border-t">
                    作成: {new Date(record.createdAt).toLocaleString("ja-JP")}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 戻るボタン */}
          <div className="mt-6">
            <Button variant="outline" onClick={() => router.push("/records")}>
              記録一覧に戻る
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
