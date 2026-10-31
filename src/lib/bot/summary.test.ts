import { describe, expect, it } from "vitest";
import type { StudyRecord } from "@/types";
import type { FARQuestion, QuestionAttempt, QuestionSet } from "@/types/questions";
import {
  addDays,
  buildQuestionIndex,
  buildReviewQueue,
  diffDays,
  summarizeExams,
  summarizeStudyTime,
  summarizeTopics,
} from "./summary";

const question = (id: string): FARQuestion => ({
  id,
  topic: "個別問題側のテーマ",
  subtopic: "",
  stem: `stem ${id}`,
  choices: [
    { label: "A", text: "a" },
    { label: "B", text: "b" },
  ],
  correctAnswer: "A",
  explanation: "en",
  explanationJa: "ja",
  references: [],
  difficulty: "basic",
  source: "test",
});

const set = (topic: string, ids: string[]): QuestionSet => ({
  id: topic,
  name: topic,
  topic,
  questions: ids.map(question),
  version: "1",
});

const attempt = (
  questionId: string,
  isCorrect: boolean | null,
  attemptedAt: string,
): QuestionAttempt => ({
  questionId,
  topic: "x",
  selectedAnswer: isCorrect ? "A" : "B",
  isCorrect,
  attemptedAt,
});

const record = (studiedAt: string, studyMinutes: number, subject: StudyRecord["subject"] = "REG") =>
  ({ studiedAt, studyMinutes, subject }) as StudyRecord;

describe("日付計算", () => {
  it("月をまたいで日数を足し引きできる", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
    expect(diffDays("2026-10-31", "2026-12-15")).toBe(45);
  });
});

describe("buildQuestionIndex", () => {
  it("同じIDは先に渡した科目に割り当て、テーマは問題セット側を使う", () => {
    const index = buildQuestionIndex([
      ["BAR", [set("BAR theme", ["q1"])]],
      ["FAR", [set("FAR theme", ["q1", "q2"])]],
    ]);
    expect(index.byId.get("q1")).toMatchObject({ subject: "BAR", topic: "BAR theme" });
    expect(index.byId.get("q2")).toMatchObject({ subject: "FAR", topic: "FAR theme" });
    expect(index.topicTotals.get("FAR")?.get("FAR theme")).toBe(1);
  });
});

describe("summarizeStudyTime", () => {
  const targets = { weekday: 4, weekend: 6 };

  it("今日の合計・残り・連続日数を出す（2026-10-31は土曜で休日の目標）", () => {
    const s = summarizeStudyTime(
      [
        record("2026-10-31", 90),
        record("2026-10-31", 30, "FAR"),
        record("2026-10-30", 60),
        record("2026-10-29", 60),
        record("2026-10-27", 60),
      ],
      "2026-10-31",
      targets,
    );
    expect(s.isWeekday).toBe(false);
    expect(s.todayTargetMinutes).toBe(360);
    expect(s.todayMinutes).toBe(120);
    expect(s.todayRemainingMinutes).toBe(240);
    expect(s.todayBySubject).toEqual({ REG: 90, FAR: 30 });
    expect(s.streakDays).toBe(3);
    expect(s.last7Days).toHaveLength(7);
    expect(s.last7Days.at(-1)).toEqual({ date: "2026-10-31", minutes: 120 });
  });

  it("今日まだ記録が無くても昨日まで続いていれば連続日数を数え、最終学習日を返す", () => {
    const s = summarizeStudyTime(
      [record("2026-11-01", 30), record("2026-10-31", 30)],
      "2026-11-02",
      targets,
    );
    expect(s.isWeekday).toBe(true);
    expect(s.streakDays).toBe(2);
    expect(s.lastStudiedDate).toBe("2026-11-01");
    expect(s.daysSinceLastStudy).toBe(1);
  });

  it("祝日は休日の目標を使う（2026-11-03 文化の日）", () => {
    expect(summarizeStudyTime([], "2026-11-03", targets).todayTargetMinutes).toBe(360);
  });
});

describe("summarizeExams", () => {
  it("過ぎた試験と未設定を除き、近い順に並べる", () => {
    expect(
      summarizeExams(
        { BAR: "2026-10-28", REG: "2026-12-18", FAR: "2026-11-30", AUD: "" },
        "2026-10-31",
      ),
    ).toEqual([
      { subject: "FAR", examDate: "2026-11-30", daysLeft: 30 },
      { subject: "REG", examDate: "2026-12-18", daysLeft: 48 },
    ]);
  });
});

describe("summarizeTopics", () => {
  it("初見と最新の正答率・未着手数を出し、正誤不明の回答は数えない", () => {
    const index = buildQuestionIndex([["REG", [set("Tax", ["q1", "q2", "q3"])]]]);
    const [stat] = summarizeTopics(
      [
        attempt("q1", false, "2026-10-01T00:00:00Z"),
        attempt("q1", true, "2026-10-02T00:00:00Z"),
        attempt("q2", true, "2026-10-01T00:00:00Z"),
        attempt("q3", null, "2026-10-01T00:00:00Z"),
      ],
      index,
    );
    expect(stat).toMatchObject({
      subject: "REG",
      topic: "Tax",
      totalQuestions: 3,
      attemptedQuestions: 2,
      unseenQuestions: 1,
      firstAttemptRate: 50,
      latestRate: 100,
    });
  });
});

describe("buildReviewQueue", () => {
  const index = buildQuestionIndex([["REG", [set("Tax", ["q1", "q2", "q3", "q4"])]]]);

  it("間違えた翌日・正解1回後は3日後に出し、間違えたことの無い問題は出さない", () => {
    const { due, dueCount } = buildReviewQueue(
      [
        // 10/30(JST)に間違い → 10/31が予定日
        attempt("q1", false, "2026-10-30T01:00:00Z"),
        // 10/27に間違い → 10/28に正解 → 予定日は10/31
        attempt("q2", false, "2026-10-27T01:00:00Z"),
        attempt("q2", true, "2026-10-28T01:00:00Z"),
        // 10/29に間違い → 10/30に正解 → 予定日は11/02（まだ）
        attempt("q3", false, "2026-10-29T01:00:00Z"),
        attempt("q3", true, "2026-10-30T01:00:00Z"),
        attempt("q4", true, "2026-10-01T01:00:00Z"),
      ],
      index,
      "2026-10-31",
      10,
    );
    expect(dueCount).toBe(2);
    expect(due.map((d) => [d.questionId, d.dueDate, d.correctStreak])).toEqual([
      ["q1", "2026-10-31", 0],
      ["q2", "2026-10-31", 1],
    ]);
    expect(due[0]).toMatchObject({ correctAnswer: "A", explanation: "ja", wrongCount: 1 });
  });

  it("最後に間違えてから4回続けて正解したら卒業し、件数の上限で切る", () => {
    const graduated = [
      attempt("q1", false, "2026-01-01T00:00:00Z"),
      ...[2, 3, 4, 5].map((d) => attempt("q1", true, `2026-01-0${d}T00:00:00Z`)),
    ];
    const wrong = ["q2", "q3", "q4"].map((id) => attempt(id, false, "2026-01-01T00:00:00Z"));
    const { due, dueCount } = buildReviewQueue([...graduated, ...wrong], index, "2026-10-31", 2);
    expect(dueCount).toBe(3);
    expect(due.map((d) => d.questionId)).toEqual(["q2", "q3"]);
  });

  it("日付はJSTで判定する（UTCでは前日でもJSTで当日なら当日扱い）", () => {
    // 2026-10-30T16:00Z = JST 10/31 01:00 → 予定日は11/01
    const { dueCount } = buildReviewQueue(
      [attempt("q1", false, "2026-10-30T16:00:00Z")],
      index,
      "2026-10-31",
      10,
    );
    expect(dueCount).toBe(0);
  });
});
