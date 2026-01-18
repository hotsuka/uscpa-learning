"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { BookOpen, FileText, Loader2 } from "lucide-react"
import { SUBJECTS, type Subject, type RecordType } from "@/types"
import { formatMinutes } from "@/lib/utils"

interface RecordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subject: Subject
  subtopic: string | null
  studyMinutes: number
  onSave: (data: RecordData) => Promise<void>
  onCancel: () => void
}

export interface RecordData {
  recordType: RecordType
  subject: Subject
  subtopic: string | null
  studyMinutes: number
  // 過去問演習用
  totalQuestions: number | null
  correctAnswers: number | null
  roundNumber: number | null
  // テキスト復習用
  chapter: string | null
  pageRange: string | null
  // 共通
  memo: string | null
  studiedAt: string
}

export function RecordDialog({
  open,
  onOpenChange,
  subject,
  subtopic,
  studyMinutes,
  onSave,
  onCancel,
}: RecordDialogProps) {
  const [recordType, setRecordType] = useState<RecordType>("practice")
  const [totalQuestions, setTotalQuestions] = useState<string>("")
  const [correctAnswers, setCorrectAnswers] = useState<string>("")
  const [roundNumber, setRoundNumber] = useState<string>("1")
  const [chapter, setChapter] = useState<string>("")
  const [pageRange, setPageRange] = useState<string>("")
  const [memo, setMemo] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)

  const accuracy = totalQuestions && correctAnswers
    ? Math.round((parseInt(correctAnswers) / parseInt(totalQuestions)) * 100)
    : null

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const data: RecordData = {
        recordType,
        subject,
        subtopic,
        studyMinutes,
        totalQuestions: recordType === "practice" && totalQuestions ? parseInt(totalQuestions) : null,
        correctAnswers: recordType === "practice" && correctAnswers ? parseInt(correctAnswers) : null,
        roundNumber: recordType === "practice" && roundNumber ? parseInt(roundNumber) : null,
        chapter: recordType === "textbook" && chapter ? chapter : null,
        pageRange: recordType === "textbook" && pageRange ? pageRange : null,
        memo: memo || null,
        studiedAt: new Date().toISOString().split("T")[0],
      }
      await onSave(data)
      // フォームをリセット
      resetForm()
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    resetForm()
    onCancel()
  }

  const resetForm = () => {
    setRecordType("practice")
    setTotalQuestions("")
    setCorrectAnswers("")
    setRoundNumber("1")
    setChapter("")
    setPageRange("")
    setMemo("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>学習記録を保存</DialogTitle>
          <DialogDescription>
            {SUBJECTS[subject].name}
            {subtopic && ` / ${subtopic}`}
            の学習記録を保存します
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 学習時間表示 */}
          <div className="text-center p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">学習時間</p>
            <p className="text-3xl font-bold">{formatMinutes(studyMinutes)}</p>
          </div>

          {/* 記録タイプ選択 */}
          <div className="space-y-3">
            <Label>記録タイプ</Label>
            <RadioGroup
              value={recordType}
              onValueChange={(value) => setRecordType(value as RecordType)}
              className="grid grid-cols-2 gap-4"
            >
              <Label
                htmlFor="practice"
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  recordType === "practice"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                }`}
              >
                <RadioGroupItem value="practice" id="practice" className="sr-only" />
                <BookOpen className="h-6 w-6" />
                <span className="font-medium">過去問演習</span>
                <span className="text-xs text-muted-foreground">問題数・正答率を記録</span>
              </Label>
              <Label
                htmlFor="textbook"
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  recordType === "textbook"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                }`}
              >
                <RadioGroupItem value="textbook" id="textbook" className="sr-only" />
                <FileText className="h-6 w-6" />
                <span className="font-medium">テキスト学習</span>
                <span className="text-xs text-muted-foreground">章・ページを記録</span>
              </Label>
            </RadioGroup>
          </div>

          {/* 過去問演習の入力フィールド */}
          {recordType === "practice" && (
            <div className="space-y-4">
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
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">正答率: </span>
                  <span className={`text-lg font-bold ${
                    accuracy >= 80 ? "text-green-600" :
                    accuracy >= 60 ? "text-yellow-600" : "text-red-600"
                  }`}>
                    {accuracy}%
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="roundNumber">周回数</Label>
                <Input
                  id="roundNumber"
                  type="number"
                  min="1"
                  placeholder="例: 1"
                  value={roundNumber}
                  onChange={(e) => setRoundNumber(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* テキスト学習の入力フィールド */}
          {recordType === "textbook" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="chapter">章・セクション</Label>
                <Input
                  id="chapter"
                  placeholder="例: Chapter 5 - Revenue Recognition"
                  value={chapter}
                  onChange={(e) => setChapter(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pageRange">ページ範囲</Label>
                <Input
                  id="pageRange"
                  placeholder="例: 100-150"
                  value={pageRange}
                  onChange={(e) => setPageRange(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* メモ */}
          <div className="space-y-2">
            <Label htmlFor="memo">メモ（任意）</Label>
            <Textarea
              id="memo"
              placeholder="学習の感想や気づきなど..."
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              "記録を保存"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
