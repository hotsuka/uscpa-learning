import type { StudyRecord, Subject } from "@/types";
import type {
  FARQuestion,
  QuestionAttempt,
  QuestionSet,
} from "@/types/questions";
import type { MockExamResult } from "@/stores/mockExamStore";
import { isWeekdayWithHoliday } from "@/lib/holidays";

/**
 * 学習補助ボット（Grok Bot）に読ませる進捗サマリーを組み立てる純粋関数群
 *
 * /bot ページから使う。入力はNotionから読んだ記録・回答履歴・模試結果と問題データで、
 * 何も書き換えない。日付はすべてJSTの "YYYY-MM-DD" で扱う。
 */

export type QuestionSubject = Extract<Subject, "FAR" | "BAR" | "REG">;

export interface IndexedQuestion {
  subject: QuestionSubject;
  /** 問題セットのテーマ（個別問題の topic ではなくセット側に揃える） */
  topic: string;
  question: FARQuestion;
}

export interface QuestionIndex {
  byId: Map<string, IndexedQuestion>;
  /** 科目 → テーマ → 収録問題数 */
  topicTotals: Map<QuestionSubject, Map<string, number>>;
}

/**
 * 問題IDから科目・テーマ・問題本体を引けるようにする。
 * 同じIDが複数の科目に出てくる場合は先に渡した科目を採る
 * （BARはFARのセットを一部借りているため、呼び出し側で REG → BAR → FAR の順に渡す）
 */
export function buildQuestionIndex(
  setsBySubject: [QuestionSubject, QuestionSet[]][],
): QuestionIndex {
  const byId = new Map<string, IndexedQuestion>();
  const topicTotals = new Map<QuestionSubject, Map<string, number>>();
  for (const [subject, sets] of setsBySubject) {
    for (const set of sets) {
      for (const question of set.questions) {
        if (byId.has(question.id)) continue;
        byId.set(question.id, { subject, topic: set.topic, question });
        const totals = topicTotals.get(subject) ?? new Map<string, number>();
        totals.set(set.topic, (totals.get(set.topic) ?? 0) + 1);
        topicTotals.set(subject, totals);
      }
    }
  }
  return { byId, topicTotals };
}

// "YYYY-MM-DD" に日数を足す（時差の影響を受けないようUTCで計算する）
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 2つの "YYYY-MM-DD" の差（to - from）を日数で返す
export function diffDays(from: string, to: string): number {
  const ms =
    new Date(`${to}T00:00:00Z`).getTime() -
    new Date(`${from}T00:00:00Z`).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

// ISO日時をJSTの日付にする
const toJSTDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

// ---- 学習時間 ----

export interface DailyTargetHours {
  weekday: number;
  weekend: number;
}

export interface StudyTimeSummary {
  today: string;
  /** 今日が平日扱いか（土日・祝日は休日扱い） */
  isWeekday: boolean;
  todayTargetMinutes: number;
  todayMinutes: number;
  todayRemainingMinutes: number;
  todayBySubject: Partial<Record<Subject, number>>;
  /** 直近7日（古い順、今日を含む） */
  last7Days: { date: string; minutes: number }[];
  /** 今日または昨日から遡って、学習記録が続いている日数 */
  streakDays: number;
  lastStudiedDate: string | null;
  daysSinceLastStudy: number | null;
  totalHoursBySubject: Partial<Record<Subject, number>>;
}

export function summarizeStudyTime(
  records: StudyRecord[],
  today: string,
  targets: DailyTargetHours,
): StudyTimeSummary {
  const minutesByDate = new Map<string, number>();
  const todayBySubject: Partial<Record<Subject, number>> = {};
  const totalMinutesBySubject: Partial<Record<Subject, number>> = {};
  for (const r of records) {
    const minutes = r.studyMinutes || 0;
    if (minutes <= 0) continue;
    minutesByDate.set(
      r.studiedAt,
      (minutesByDate.get(r.studiedAt) ?? 0) + minutes,
    );
    totalMinutesBySubject[r.subject] =
      (totalMinutesBySubject[r.subject] ?? 0) + minutes;
    if (r.studiedAt === today) {
      todayBySubject[r.subject] = (todayBySubject[r.subject] ?? 0) + minutes;
    }
  }

  const [y, m, d] = today.split("-").map(Number);
  const isWeekday = isWeekdayWithHoliday(new Date(y, m - 1, d));
  const todayTargetMinutes = Math.round(
    (isWeekday ? targets.weekday : targets.weekend) * 60,
  );
  const todayMinutes = minutesByDate.get(today) ?? 0;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    return { date, minutes: minutesByDate.get(date) ?? 0 };
  });

  // 今日まだ記録が無くても、昨日まで続いていれば途切れていない扱いにする
  let streakDays = 0;
  let cursor = minutesByDate.has(today) ? today : addDays(today, -1);
  while (minutesByDate.has(cursor)) {
    streakDays++;
    cursor = addDays(cursor, -1);
  }

  const studiedDates = [...minutesByDate.keys()].filter(
    (date) => date <= today,
  );
  const lastStudiedDate =
    studiedDates.length > 0 ? studiedDates.sort().at(-1)! : null;

  const totalHoursBySubject: Partial<Record<Subject, number>> = {};
  for (const [subject, minutes] of Object.entries(totalMinutesBySubject)) {
    totalHoursBySubject[subject as Subject] =
      Math.round((minutes / 60) * 10) / 10;
  }

  return {
    today,
    isWeekday,
    todayTargetMinutes,
    todayMinutes,
    todayRemainingMinutes: Math.max(0, todayTargetMinutes - todayMinutes),
    todayBySubject,
    last7Days,
    streakDays,
    lastStudiedDate,
    daysSinceLastStudy: lastStudiedDate
      ? diffDays(lastStudiedDate, today)
      : null,
    totalHoursBySubject,
  };
}

// ---- 試験日 ----

export interface ExamCountdown {
  subject: Subject;
  examDate: string;
  daysLeft: number;
}

/** これから受ける試験だけを近い順に返す（今日が試験日なら残り0日） */
export function summarizeExams(
  examDates: Partial<Record<Subject, string>>,
  today: string,
): ExamCountdown[] {
  return Object.entries(examDates)
    .filter((entry): entry is [Subject, string] =>
      /^\d{4}-\d{2}-\d{2}$/.test(entry[1] ?? ""),
    )
    .map(([subject, examDate]) => ({
      subject,
      examDate,
      daysLeft: diffDays(today, examDate),
    }))
    .filter((e) => e.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

const QUESTION_SUBJECTS: QuestionSubject[] = ["FAR", "BAR", "REG"];

/**
 * 再出題・弱点を絞る科目を決める。
 * クエリで科目が指定されていればそれ（"all" なら絞らない）、無ければ問題バンクがある科目のうち次に受ける試験の科目。
 * どれも無ければ絞らない（null）。
 */
export function pickFocusSubject(
  param: string | undefined,
  exams: ExamCountdown[],
): QuestionSubject | null {
  const requested = param?.toUpperCase();
  if (requested === "ALL") return null;
  if (QUESTION_SUBJECTS.includes(requested as QuestionSubject)) {
    return requested as QuestionSubject;
  }
  const next = exams.find((e) =>
    QUESTION_SUBJECTS.includes(e.subject as QuestionSubject),
  );
  return next ? (next.subject as QuestionSubject) : null;
}

// ---- テーマ別の正答率 ----

export interface TopicStat {
  subject: QuestionSubject;
  topic: string;
  totalQuestions: number;
  attemptedQuestions: number;
  unseenQuestions: number;
  /** 各問題の最初の解答での正答率（解き直しで上書きされない実力の目安） */
  firstAttemptRate: number | null;
  /** 各問題の最新の解答での正答率 */
  latestRate: number | null;
}

const rate = (correct: number, total: number): number | null =>
  total > 0 ? Math.round((correct / total) * 100) : null;

// 問題ごとの回答を古い順に並べる。正誤不明(null)と問題データに無い回答は除く
function groupAttempts(
  attempts: QuestionAttempt[],
  index: QuestionIndex,
): Map<string, QuestionAttempt[]> {
  const grouped = new Map<string, QuestionAttempt[]>();
  for (const a of attempts) {
    if (a.isCorrect === null || !index.byId.has(a.questionId)) continue;
    const list = grouped.get(a.questionId) ?? [];
    list.push(a);
    grouped.set(a.questionId, list);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.attemptedAt.localeCompare(b.attemptedAt));
  }
  return grouped;
}

export function summarizeTopics(
  attempts: QuestionAttempt[],
  index: QuestionIndex,
): TopicStat[] {
  const grouped = groupAttempts(attempts, index);
  const acc = new Map<
    string,
    {
      subject: QuestionSubject;
      topic: string;
      attempted: number;
      firstCorrect: number;
      latestCorrect: number;
    }
  >();
  for (const [questionId, list] of grouped) {
    const { subject, topic } = index.byId.get(questionId)!;
    const key = `${subject}\u0000${topic}`;
    const entry = acc.get(key) ?? {
      subject,
      topic,
      attempted: 0,
      firstCorrect: 0,
      latestCorrect: 0,
    };
    entry.attempted++;
    if (list[0].isCorrect) entry.firstCorrect++;
    if (list.at(-1)!.isCorrect) entry.latestCorrect++;
    acc.set(key, entry);
  }

  const stats: TopicStat[] = [];
  for (const [subject, totals] of index.topicTotals) {
    for (const [topic, totalQuestions] of totals) {
      const entry = acc.get(`${subject}\u0000${topic}`);
      const attempted = entry?.attempted ?? 0;
      stats.push({
        subject,
        topic,
        totalQuestions,
        attemptedQuestions: attempted,
        unseenQuestions: totalQuestions - attempted,
        firstAttemptRate: rate(entry?.firstCorrect ?? 0, attempted),
        latestRate: rate(entry?.latestCorrect ?? 0, attempted),
      });
    }
  }
  return stats;
}

// ---- 間違えた問題の再出題（間隔反復） ----

/** 最後に間違えてから連続で正解した回数ごとの、次の出題までの日数。この回数を超えたら卒業 */
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14];

export interface ReviewItem {
  questionId: string;
  subject: QuestionSubject;
  topic: string;
  /** 出題予定日（これ以前なら出題対象） */
  dueDate: string;
  overdueDays: number;
  /** 最後に間違えてから連続で正解した回数 */
  correctStreak: number;
  wrongCount: number;
  lastAttemptDate: string;
  stem: string;
  choices: { label: string; text: string }[];
  correctAnswer: string;
  explanation: string;
}

/**
 * 一度でも間違えた問題のうち、今日までに出題予定日が来たものを、遅れの大きい順に返す。
 * 予定日は最後の解答日 + REVIEW_INTERVAL_DAYS[最後に間違えてからの連続正解数]。
 */
export function buildReviewQueue(
  attempts: QuestionAttempt[],
  index: QuestionIndex,
  today: string,
  limit: number,
): { due: ReviewItem[]; dueCount: number } {
  const due: ReviewItem[] = [];
  for (const [questionId, list] of groupAttempts(attempts, index)) {
    const lastWrong = list.findLastIndex((a) => a.isCorrect === false);
    if (lastWrong === -1) continue;
    const correctStreak = list.length - 1 - lastWrong;
    if (correctStreak >= REVIEW_INTERVAL_DAYS.length) continue;

    const lastAttemptDate = toJSTDate(list.at(-1)!.attemptedAt);
    const dueDate = addDays(
      lastAttemptDate,
      REVIEW_INTERVAL_DAYS[correctStreak],
    );
    if (dueDate > today) continue;

    const { subject, topic, question } = index.byId.get(questionId)!;
    due.push({
      questionId,
      subject,
      topic,
      dueDate,
      overdueDays: diffDays(dueDate, today),
      correctStreak,
      wrongCount: list.filter((a) => a.isCorrect === false).length,
      lastAttemptDate,
      stem: question.stem,
      choices: question.choices,
      correctAnswer: question.correctAnswer,
      explanation: question.explanationJa || question.explanation,
    });
  }
  due.sort(
    (a, b) =>
      b.overdueDays - a.overdueDays || a.questionId.localeCompare(b.questionId),
  );
  return { due: due.slice(0, limit), dueCount: due.length };
}

// ---- 模試 ----

export interface MockSummary {
  subject: string;
  fresh: boolean;
  finishedDate: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
}

/** 新しい順に返す。科目の無い古い結果はFAR扱い（mockExamStore の定義に合わせる） */
export function summarizeMocks(
  results: MockExamResult[],
  limit: number,
): MockSummary[] {
  return [...results]
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
    .slice(0, limit)
    .map((r) => ({
      subject: r.subject ?? "FAR",
      fresh: r.mode === "fresh",
      finishedDate: toJSTDate(r.finishedAt),
      score: r.score,
      correctCount: r.correctCount,
      totalQuestions: r.totalQuestions,
    }));
}
