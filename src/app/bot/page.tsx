import type { Metadata } from "next";
import type { StudyRecord, Subject } from "@/types";
import type { QuestionAttempt } from "@/types/questions";
import type { MockExamResult } from "@/stores/mockExamStore";
import { getRecords, getSettings, isNotionConfigured } from "@/lib/notion";
import { getPracticeLogChunks, isPracticeLogConfigured } from "@/lib/notion/practiceLog";
import { mergePracticeLog, parseChunkPayload } from "@/lib/sync/practiceLog";
import { getJSTDateString } from "@/lib/utils";
import { farQuestionSets } from "@/data/questions/far";
import { regQuestionSets } from "@/data/questions/reg";
import {
  barFreshMockQuestionSets,
  barOwnAreaIIIIIQuestionSets,
  barQuestionSets,
} from "@/data/questions/bar";
import {
  buildQuestionIndex,
  buildReviewQueue,
  pickFocusSubject,
  summarizeExams,
  summarizeMocks,
  summarizeStudyTime,
  summarizeTopics,
} from "@/lib/bot/summary";

/**
 * 学習補助ボット（Grok Bot）向けの読み取り専用ページ
 *
 * サーバー側でNotionを読んで集計し、HTMLとして返すだけ。メイン画面のレイアウト（同期・バックアップ）を通らず、
 * ストアにも localStorage にも触れないので、ボットがこのページで何を押してもデータは変わらない。
 *
 * クエリ（任意）:
 *   weekday / weekend … 平日・休日の目標時間（h）。目標時間はNotionに同期していないため既定は設定画面の初期値
 *   review … 再出題リストの件数（既定20、最大50）
 *   subject … 正答率・再出題・模試を絞る科目（FAR / BAR / REG / all）。既定は次に受ける試験の科目
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "学習サマリー（ボット用）",
  robots: { index: false, follow: false },
};

const DEFAULT_TARGETS = { weekday: 4, weekend: 6 };
const DEFAULT_REVIEW_LIMIT = 20;
const MAX_REVIEW_LIMIT = 50;

const questionIndex = buildQuestionIndex([
  ["REG", regQuestionSets],
  ["BAR", [...barQuestionSets, ...barOwnAreaIIIIIQuestionSets, ...barFreshMockQuestionSets.map((m) => m.set)]],
  ["FAR", farQuestionSets],
]);

// 数値のクエリを読む。読めない・範囲外なら既定値
const numberParam = (value: string | string[] | undefined, fallback: number, max: number): number => {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : fallback;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

interface LoadedData {
  records: StudyRecord[];
  examDates: Partial<Record<Subject, string>>;
  attempts: QuestionAttempt[];
  mocks: MockExamResult[];
  warnings: string[];
}

async function loadData(): Promise<LoadedData> {
  const data: LoadedData = { records: [], examDates: {}, attempts: [], mocks: [], warnings: [] };
  if (!isNotionConfigured()) {
    data.warnings.push("Notionが設定されていないため、データを読めませんでした");
    return data;
  }

  const [records, settings, chunks] = await Promise.allSettled([
    getRecords(),
    getSettings(),
    isPracticeLogConfigured() ? getPracticeLogChunks() : Promise.resolve(null),
  ]);

  if (records.status === "fulfilled") data.records = records.value;
  else data.warnings.push(`学習記録を読めませんでした: ${errorMessage(records.reason)}`);

  if (settings.status === "fulfilled" && settings.value) {
    for (const [subject, date] of Object.entries(settings.value.examDates)) {
      if (date) data.examDates[subject as Subject] = date;
    }
  } else if (settings.status === "rejected") {
    data.warnings.push(`試験日を読めませんでした: ${errorMessage(settings.reason)}`);
  }

  if (chunks.status === "rejected") {
    data.warnings.push(`問題演習ログを読めませんでした: ${errorMessage(chunks.reason)}`);
  } else if (chunks.value === null) {
    data.warnings.push("問題演習ログのDBが設定されていないため、正答率と再出題は空です");
  } else {
    // 全端末のチャンクをキーで1件にまとめる（アプリが取り込むときと同じ和集合・正誤補正）
    const mcq: QuestionAttempt[] = [];
    const mock: MockExamResult[] = [];
    let unreadable = 0;
    for (const chunk of chunks.value) {
      if (chunk.kind !== "mcq" && chunk.kind !== "mock") continue;
      const parsed = parseChunkPayload(chunk.kind, chunk.segments);
      if (!parsed) {
        unreadable++;
        continue;
      }
      if (chunk.kind === "mcq") mcq.push(...(parsed.items as QuestionAttempt[]));
      else mock.push(...(parsed.items as MockExamResult[]));
    }
    data.attempts = mergePracticeLog("mcq", [], mcq).items;
    data.mocks = mergePracticeLog("mock", [], mock).items;
    if (unreadable > 0) data.warnings.push(`読めなかった演習ログのチャンクが${unreadable}件あります`);
  }
  return data;
}

const formatMinutes = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}時間${m}分` : `${m}分`;
};

const formatRate = (rate: number | null): string => (rate === null ? "—" : `${rate}%`);

export default async function BotSummaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const targets = {
    weekday: numberParam(params.weekday, DEFAULT_TARGETS.weekday, 24),
    weekend: numberParam(params.weekend, DEFAULT_TARGETS.weekend, 24),
  };
  const reviewLimit = Math.floor(numberParam(params.review, DEFAULT_REVIEW_LIMIT, MAX_REVIEW_LIMIT));

  const generatedAt = new Date();
  const today = getJSTDateString(generatedAt);
  const data = await loadData();

  const studyTime = summarizeStudyTime(data.records, today, targets);
  const exams = summarizeExams(data.examDates, today);

  // 受験済みの科目の問題で埋まらないよう、正答率・再出題・模試は対象の科目だけにする
  const subjectParam = Array.isArray(params.subject) ? params.subject[0] : params.subject;
  const focusSubject = pickFocusSubject(subjectParam, exams);
  const inFocus = (subject: string) => focusSubject === null || subject === focusSubject;
  const focusAttempts = data.attempts.filter((a) => {
    const indexed = questionIndex.byId.get(a.questionId);
    return indexed !== undefined && inFocus(indexed.subject);
  });
  const topics = summarizeTopics(focusAttempts, questionIndex).filter((t) => inFocus(t.subject));
  const review = buildReviewQueue(focusAttempts, questionIndex, today, reviewLimit);
  const mocks = summarizeMocks(data.mocks.filter((m) => inFocus(m.subject ?? "FAR")), 5);
  const focusLabel = focusSubject ?? "全科目";

  // 弱点: 5問以上解いたテーマを初見正答率の低い順に
  const weakTopics = topics
    .filter((t) => t.attemptedQuestions >= 5)
    .sort((a, b) => (a.firstAttemptRate ?? 0) - (b.firstAttemptRate ?? 0))
    .slice(0, 10);

  const summary = {
    generatedAt: generatedAt.toISOString(),
    today,
    readOnly: true,
    focusSubject,
    targets,
    studyTime,
    exams,
    weakTopics,
    topics,
    review,
    mocks,
    warnings: data.warnings,
  };

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-4 text-sm leading-relaxed">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">学習サマリー（ボット用・読み取り専用）</h1>
        <p>
          作成日時: {generatedAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}（JST）／今日: {today}
        </p>
        <p>
          このページは表示専用です。記録の追加・編集はできません。機械で読む場合は末尾の
          <code>#bot-data</code>（JSON）を使ってください。
        </p>
        <p>
          対象科目: {focusLabel}（弱点・再出題・模試・テーマ別の表はこの科目だけ。学習時間と試験日は全科目）
        </p>
        {data.warnings.map((w) => (
          <p key={w} className="text-red-600">
            注意: {w}
          </p>
        ))}
      </header>

      <section>
        <h2 className="mb-2 text-lg font-semibold">今日の学習</h2>
        <ul className="list-disc pl-5">
          <li>
            目標: {formatMinutes(studyTime.todayTargetMinutes)}（{studyTime.isWeekday ? "平日" : "休日"}・平日
            {targets.weekday}h／休日{targets.weekend}h）
          </li>
          <li>実績: {formatMinutes(studyTime.todayMinutes)}</li>
          <li>残り: {formatMinutes(studyTime.todayRemainingMinutes)}</li>
          <li>
            科目別:{" "}
            {Object.entries(studyTime.todayBySubject)
              .map(([s, m]) => `${s} ${formatMinutes(m)}`)
              .join("、") || "なし"}
          </li>
          <li>
            連続学習: {studyTime.streakDays}日／最終学習日: {studyTime.lastStudiedDate ?? "記録なし"}
            {studyTime.daysSinceLastStudy !== null && `（${studyTime.daysSinceLastStudy}日前）`}
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">直近7日</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border px-2 py-1 text-left">日付</th>
              <th className="border px-2 py-1 text-right">学習時間</th>
            </tr>
          </thead>
          <tbody>
            {studyTime.last7Days.map((d) => (
              <tr key={d.date}>
                <td className="border px-2 py-1">{d.date}</td>
                <td className="border px-2 py-1 text-right">{formatMinutes(d.minutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">試験日</h2>
        {exams.length === 0 ? (
          <p>これからの試験日は設定されていません。</p>
        ) : (
          <ul className="list-disc pl-5">
            {exams.map((e) => (
              <li key={e.subject}>
                {e.subject}: {e.examDate}（残り{e.daysLeft}日・累計学習
                {studyTime.totalHoursBySubject[e.subject] ?? 0}時間）
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">弱点テーマ（5問以上解いたテーマ・初見正答率の低い順）</h2>
        <TopicTable topics={weakTopics} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">
          今日の再出題（{review.dueCount}問が対象・遅れの大きい順に{review.due.length}問を表示）
        </h2>
        <p className="mb-3">
          一度間違えた問題を、最後に間違えた翌日・その後の正解ごとに3日後・7日後・14日後に出します。4回続けて正解したら外れます。
        </p>
        <ol className="list-decimal space-y-4 pl-5">
          {review.due.map((item) => (
            <li key={item.questionId}>
              <p className="font-medium">
                [{item.subject} / {item.topic} / {item.questionId}] 予定日 {item.dueDate}・誤答
                {item.wrongCount}回・その後の連続正解{item.correctStreak}回
              </p>
              <p className="whitespace-pre-wrap">{item.stem}</p>
              <ul className="pl-4">
                {item.choices.map((c) => (
                  <li key={c.label}>
                    {c.label}. {c.text}
                  </li>
                ))}
              </ul>
              <details>
                <summary>正解と解説</summary>
                <p>正解: {item.correctAnswer}</p>
                <p className="whitespace-pre-wrap">{item.explanation}</p>
              </details>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">直近の模試</h2>
        {mocks.length === 0 ? (
          <p>模試の結果はありません。</p>
        ) : (
          <ul className="list-disc pl-5">
            {mocks.map((m) => (
              <li key={`${m.finishedDate}-${m.subject}-${m.score}-${m.totalQuestions}`}>
                {m.finishedDate} {m.subject}
                {m.fresh ? "（初見）" : ""}: {m.score}%（{m.correctCount}/{m.totalQuestions}）
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">全テーマの正答率と未着手数</h2>
        <TopicTable topics={topics} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">機械読み取り用データ（JSON）</h2>
        <pre id="bot-data" className="overflow-x-auto whitespace-pre-wrap break-all rounded border p-2 text-xs">
          {JSON.stringify(summary, null, 2)}
        </pre>
      </section>
    </main>
  );
}

function TopicTable({ topics }: { topics: ReturnType<typeof summarizeTopics> }) {
  if (topics.length === 0) return <p>該当するテーマはありません。</p>;
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="border px-2 py-1 text-left">科目</th>
          <th className="border px-2 py-1 text-left">テーマ</th>
          <th className="border px-2 py-1 text-right">初見正答率</th>
          <th className="border px-2 py-1 text-right">最新正答率</th>
          <th className="border px-2 py-1 text-right">解いた／収録</th>
          <th className="border px-2 py-1 text-right">未着手</th>
        </tr>
      </thead>
      <tbody>
        {topics.map((t) => (
          <tr key={`${t.subject}-${t.topic}`}>
            <td className="border px-2 py-1">{t.subject}</td>
            <td className="border px-2 py-1">{t.topic}</td>
            <td className="border px-2 py-1 text-right">{formatRate(t.firstAttemptRate)}</td>
            <td className="border px-2 py-1 text-right">{formatRate(t.latestRate)}</td>
            <td className="border px-2 py-1 text-right">
              {t.attemptedQuestions}／{t.totalQuestions}
            </td>
            <td className="border px-2 py-1 text-right">{t.unseenQuestions}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
