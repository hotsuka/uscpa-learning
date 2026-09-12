import type { QuestionAttempt } from "@/types/questions";

// 解答間隔がこれを超えた場合は「席を外していた」とみなし、
// 実経過時間ではなく想定解答時間だけを加算する
export const IDLE_GAP_MS = 5 * 60 * 1000;

// 1問目・中断明けの1問に加算する想定解答時間（MCQの標準ペース）
export const DEFAULT_ANSWER_SECONDS = 90;

export type PracticeSubject = "FAR" | "BAR";

export interface PracticeSession {
  /** セッション開始時刻（ISO文字列）。学習記録の日付にはこの日付を使う */
  startedAt: string;
  /** 最後に解答した時刻（ISO文字列）。中断判定に使う */
  lastAnsweredAt: string;
  answeredCount: number;
  correctCount: number;
  /** アイドル時間を除いた実解答時間（秒） */
  activeSeconds: number;
  /** トピックごとの解答数。学習記録のsubtopicに最頻トピックを入れるために保持 */
  topicCounts: Record<string, number>;
}

/**
 * 解答1件をセッションへ取り込む。
 * 解答間隔が短い間は実経過時間を積み、中断を挟んだ場合は想定解答時間だけを加算する。
 */
export function applyAttempt(
  session: PracticeSession | undefined,
  attempt: QuestionAttempt,
): PracticeSession {
  const isCorrect = attempt.isCorrect === true;

  if (!session) {
    return {
      startedAt: attempt.attemptedAt,
      lastAnsweredAt: attempt.attemptedAt,
      answeredCount: 1,
      correctCount: isCorrect ? 1 : 0,
      activeSeconds: DEFAULT_ANSWER_SECONDS,
      topicCounts: { [attempt.topic]: 1 },
    };
  }

  const gapMs =
    new Date(attempt.attemptedAt).getTime() -
    new Date(session.lastAnsweredAt).getTime();
  const addSeconds =
    gapMs > 0 && gapMs < IDLE_GAP_MS
      ? Math.round(gapMs / 1000)
      : DEFAULT_ANSWER_SECONDS;

  return {
    ...session,
    lastAnsweredAt: attempt.attemptedAt,
    answeredCount: session.answeredCount + 1,
    correctCount: session.correctCount + (isCorrect ? 1 : 0),
    activeSeconds: session.activeSeconds + addSeconds,
    topicCounts: {
      ...session.topicCounts,
      [attempt.topic]: (session.topicCounts[attempt.topic] ?? 0) + 1,
    },
  };
}

/** 学習記録に保存する学習時間（分）。0分の記録を作らないよう最低1分にする */
export function sessionStudyMinutes(session: PracticeSession): number {
  return Math.max(1, Math.round(session.activeSeconds / 60));
}

/** 正答率（%）。1問も解いていなければnull */
export function sessionAccuracy(session: PracticeSession): number | null {
  if (session.answeredCount === 0) return null;
  return Math.round((session.correctCount / session.answeredCount) * 100);
}

/** 最も多く解いたトピック。学習記録のsubtopicに入れて分析ページで拾えるようにする */
export function sessionDominantTopic(session: PracticeSession): string | null {
  const entries = Object.entries(session.topicCounts);
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}
