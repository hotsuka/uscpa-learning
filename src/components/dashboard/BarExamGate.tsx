"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Target,
  CalendarCheck,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQuestionBankStore } from "@/stores/questionBankStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { daysUntil } from "@/lib/utils";
import {
  computeBarGateStatus,
  BAR_EXAM_DATE,
  BAR_AREA1_DEADLINE,
  BAR_GATE2_DATE,
  BAR_GATE1_RATE,
  BAR_PASS_LINE_RATE,
  BAR_SAFE_RATE,
} from "@/lib/bar/examGate";

const formatDate = (iso: string): string => {
  const [, month, day] = iso.split("-");
  return Number(month) + "/" + Number(day);
};

/**
 * BAR受験（2026年10月window）の可否を初見正答率で判定するカード。
 * 模試スコアは既出問題バイアスで過大に出るため、判定には初見正答率を使う。
 */
export function BarExamGate() {
  const attempts = useQuestionBankStore((s) => s.attempts);
  const examDates = useSettingsStore((s) => s.examDates);
  const setExamDate = useSettingsStore((s) => s.setExamDate);

  const status = useMemo(() => computeBarGateStatus(attempts), [attempts]);

  // 到達度は安全圏(76%)を100%として表示する
  const gaugeValue =
    status.rate === null
      ? 0
      : Math.min(100, Math.round((status.rate / BAR_SAFE_RATE) * 100));

  const judgement = status.safeCleared
    ? { label: "安全圏", variant: "default" as const }
    : status.gate2Cleared
      ? { label: "射程内", variant: "secondary" as const }
      : { label: "不足", variant: "destructive" as const };

  // 弱い順。母数が10問未満のセットは判断材料にならないので後ろへ回す
  const weakSets = useMemo(
    () =>
      [...status.sets].sort((a, b) => {
        const aReady = a.firstSeenTotal >= 10;
        const bReady = b.firstSeenTotal >= 10;
        if (aReady !== bReady) return aReady ? -1 : 1;
        if (a.rate === null) return 1;
        if (b.rate === null) return -1;
        return a.rate - b.rate;
      }),
    [status.sets],
  );

  const gates = [
    {
      name: "第1ゲート",
      date: BAR_AREA1_DEADLINE,
      threshold: BAR_GATE1_RATE,
      cleared: status.gate1Cleared,
      note: "Area I完走時点。未達ならArea IIIの枠を削って誤答潰しへ再配分",
    },
    {
      name: "第2ゲート",
      date: BAR_GATE2_DATE,
      threshold: BAR_PASS_LINE_RATE,
      cleared: status.gate2Cleared,
      note: "未見問題で総合判定。未達なら最終10日をMCQ弱点に全振り",
    },
  ];

  const examDateMismatch = examDates.BAR !== BAR_EXAM_DATE;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5" />
          BAR受験ゲート
          <Badge variant="bar">{formatDate(BAR_EXAM_DATE)}</Badge>
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            あと{status.daysUntilExam}日
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 初見正答率 */}
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">
              {status.rate === null ? "—" : status.rate + "%"}
            </span>
            <span className="text-sm text-muted-foreground">
              初見正答率（{status.firstSeenCorrect}/{status.firstSeenTotal}問）
            </span>
            <Badge variant={judgement.variant} className="ml-auto">
              {judgement.label}
            </Badge>
          </div>
          <Progress
            value={gaugeValue}
            className="mt-2"
            aria-label="BAR初見正答率の安全圏到達度"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            合格ライン目安 {BAR_PASS_LINE_RATE}% ／ 安全圏 {BAR_SAFE_RATE}%
            （FARの実績76.9%→81点から外挿）
          </p>
        </div>

        {/* 消化ペース */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border p-2">
            <div className="text-xs text-muted-foreground">消化</div>
            <div className="text-lg font-semibold">
              {status.attempted}
              <span className="text-xs text-muted-foreground">
                /{status.total}
              </span>
            </div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-xs text-muted-foreground">残り</div>
            <div className="text-lg font-semibold">{status.remaining}問</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-xs text-muted-foreground">
              {formatDate(BAR_AREA1_DEADLINE)}完走に必要
            </div>
            <div className="text-lg font-semibold">
              {status.requiredPerDay === null
                ? "—"
                : status.requiredPerDay + "問/日"}
            </div>
          </div>
        </div>

        {/* ゲート判定 */}
        <div className="space-y-2">
          {gates.map((gate) => (
            <div
              key={gate.name}
              className="flex items-start gap-2 rounded-lg border p-2"
            >
              {gate.cleared ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {gate.name}（{formatDate(gate.date)}・{gate.threshold}%）
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    あと{daysUntil(gate.date)}日
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{gate.note}</p>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            ゲートは残り時間の配分を決めるためのもので、受験自体は取り消さない。
            受験料は埋没しており、受けた方が弱点データが残る。
          </p>
        </div>

        {/* セット別の初見正答率（弱い順） */}
        <div>
          <div className="mb-1 text-sm font-medium">テーマ別（弱い順）</div>
          <div className="space-y-1">
            {weakSets.map((set) => (
              <div key={set.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{set.topic}</span>
                <span className="text-xs text-muted-foreground">
                  {set.attempted}/{set.total}
                </span>
                <span
                  className={
                    "w-14 text-right font-medium " +
                    (set.rate === null
                      ? "text-muted-foreground"
                      : set.rate >= BAR_SAFE_RATE
                        ? "text-green-600"
                        : set.rate >= BAR_PASS_LINE_RATE
                          ? "text-foreground"
                          : "text-red-600")
                  }
                >
                  {set.rate === null ? "未着手" : set.rate + "%"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {examDateMismatch && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-50 p-2 dark:bg-amber-950/30">
            <CalendarCheck className="h-4 w-4 shrink-0 text-amber-600" />
            <span className="flex-1 text-xs">
              設定のBAR試験日が{examDates.BAR}のままです
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setExamDate("BAR", BAR_EXAM_DATE)}
            >
              {BAR_EXAM_DATE}に設定
            </Button>
          </div>
        )}

        <Button asChild variant="outline" className="w-full">
          <Link href="/materials/questions">BARの問題を解く</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
