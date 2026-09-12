"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Check, Clock, PauseCircle, Save, X } from "lucide-react"
import type { PracticeSession } from "@/hooks/usePracticeSession"

interface PracticeSessionBarProps {
  session: PracticeSession | undefined
  studyMinutes: number
  accuracy: number | null
  dominantTopic: string | null
  /** 最後の解答から時間が空いている状態（保存忘れの可能性がある） */
  isIdle: boolean
  onSave: () => boolean
  onDiscard: () => void
}

/** 分を「1時間5分」形式で表示する */
const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes}分`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}時間` : `${h}時間${m}分`
}

/** 開始日時を「9/12 10:30」形式で表示する */
const formatStartedAt = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * 問題バンクの演習セッションを表示し、学習記録として保存するバー。
 * 解答を始めるまでは何も表示しない。
 */
export function PracticeSessionBar({
  session,
  studyMinutes,
  accuracy,
  dominantTopic,
  isIdle,
  onSave,
  onDiscard,
}: PracticeSessionBarProps) {
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  // 保存メッセージは数秒で消す
  useEffect(() => {
    if (!savedMessage) return
    const id = setTimeout(() => setSavedMessage(null), 4000)
    return () => clearTimeout(id)
  }, [savedMessage])

  // セッションが切り替わったら破棄確認を閉じる
  useEffect(() => {
    setConfirmDiscard(false)
  }, [session?.startedAt])

  if (!session || session.answeredCount === 0) {
    return savedMessage ? (
      <div className="mb-4 flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
        <Check className="h-4 w-4 shrink-0" />
        {savedMessage}
      </div>
    ) : null
  }

  const handleSave = () => {
    const minutes = studyMinutes
    const questions = session.answeredCount
    if (onSave()) {
      setSavedMessage(`学習記録に保存しました（${formatMinutes(minutes)} / ${questions}問）`)
    }
  }

  return (
    <Card className={cn("mb-4", isIdle && "border-orange-500/50 bg-orange-500/5")}>
      <CardContent className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              {isIdle ? (
                <PauseCircle className="h-4 w-4 shrink-0 text-orange-500" />
              ) : (
                <Clock className="h-4 w-4 shrink-0 text-blue-500" />
              )}
              <span>
                {formatMinutes(studyMinutes)} · {session.answeredCount}問
                {accuracy !== null && ` · 正答率${accuracy}%`}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground truncate">
              {formatStartedAt(session.startedAt)}開始
              {dominantTopic && ` · ${dominantTopic}`}
              {isIdle && " · 中断中（未保存）"}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {confirmDiscard ? (
              <>
                <span className="text-xs text-muted-foreground">破棄しますか？</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    onDiscard()
                    setConfirmDiscard(false)
                  }}
                >
                  破棄
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDiscard(false)}>
                  やめる
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" onClick={handleSave}>
                  <Save className="mr-1.5 h-4 w-4" />
                  学習記録に保存
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="セッションを破棄"
                  onClick={() => setConfirmDiscard(true)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {savedMessage && (
          <div className="mt-2 flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
            <Check className="h-3.5 w-3.5 shrink-0" />
            {savedMessage}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
