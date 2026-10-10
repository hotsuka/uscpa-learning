/**
 * 問題データ lint（全問検査）
 *
 * 実行: npm run lint:questions （= npx vitest run src/lib/questionLint）
 *
 * 前半は判定ロジックの単体テスト、後半は実データ全問への適用。
 * 実データの不備のうち、問題内容の判断が要るもので未対応のものは known-issues.json に載せてある。
 * テストが落ちるのは次の2つ:
 *   - known-issues.json に無い不備が出た（＝新しく作った・直した問題に不備がある）→ 問題データを直す
 *   - known-issues.json の不備が出なくなった（＝直した）→ known-issues.json からその行を消す
 * known-issues.json に新しい不備を足して通すのは、ユーザが「このままでよい」と判断したときだけ。
 */

import { describe, expect, it } from "vitest";
import {
  barOwnAreaIIIIIQuestionSets,
  barQuestionSets,
} from "@/data/questions/bar";
import { MOCK_EXAM_AREA_QUOTA, MOCK_EXAM_MINUTES } from "@/lib/mockExam";
import type { FARQuestion, QuestionSet } from "@/types/questions";
import type { TBSQuestion } from "@/types/tbs";
import { barFreshMockPool, collectIssues, mockTimeSummary } from "./collect";
import knownIssues from "./known-issues.json";
import {
  expectedMcqMockMinutes,
  issueKey,
  lintMarkdownTables,
  lintMcq,
  lintMcqMockTime,
  lintTbs,
  lintTbsMockTime,
  referencedExhibitNumbers,
  type LintIssue,
} from "./rules";

const mcq = (overrides: Partial<FARQuestion>): FARQuestion => ({
  id: "test-001",
  topic: "Test",
  subtopic: "Test",
  stem: "What is the amount?",
  choices: [
    { label: "A", text: "$1,000" },
    { label: "B", text: "$2,000" },
    { label: "C", text: "$3,000" },
    { label: "D", text: "$4,000" },
  ],
  correctAnswer: "A",
  explanation: "Because $1,000.",
  explanationJa: "$1,000 だから。",
  references: [],
  difficulty: "basic",
  source: "test",
  ...overrides,
});

const tbs = (overrides: Partial<TBSQuestion>): TBSQuestion => ({
  id: "tbs-test-001",
  subject: "BAR",
  topic: "Test",
  title: "Test TBS",
  scenario: "See **Exhibit 1**.",
  exhibits: [
    {
      id: "ex-1",
      title: "Exhibit 1: Data",
      content: "| Item | Amount |\n|---|---|\n| Sales | $100 |",
    },
  ],
  tasks: [
    {
      id: "task-1",
      workTab: "Task 1",
      title: "Compute",
      instruction: "Compute sales.",
      answerType: "number",
      correctAnswer: 100,
      explanation: "Sales are $100.",
      explanationJa: "売上は $100。",
    },
  ],
  difficulty: "basic",
  estimatedMinutes: 20,
  source: "test",
  ...overrides,
});

const always = (): boolean => true;
const rulesOf = (issues: LintIssue[]) => issues.map((i) => i.rule);

describe("① 参照資料の欠落", () => {
  it("図を参照しているのに figure が無い問題を拾う（表があっても図の代わりにはならない）", () => {
    const q = mcq({
      stem: "In the profit-volume chart below, what does OE represent?\nA | B",
    });
    expect(rulesOf(lintMcq(q, always))).toContain("missing-reference");
    expect(
      rulesOf(
        lintMcq(
          { ...q, figure: { src: "/questions/x.png", alt: "x" } },
          always,
        ),
      ),
    ).not.toContain("missing-reference");
  });

  it("figure の画像ファイルが無ければ拾う", () => {
    const q = mcq({ figure: { src: "/questions/none.png", alt: "x" } });
    expect(lintMcq(q, () => false).map((i) => i.where)).toContain("figure");
  });

  it("「the following information」の後ろにデータが無ければ拾い、選択肢を指す言い方は拾わない", () => {
    expect(
      rulesOf(
        lintMcq(
          mcq({
            stem: "Based on the following information, what is net income?",
          }),
          always,
        ),
      ),
    ).toContain("missing-reference");
    expect(
      rulesOf(
        lintMcq(
          mcq({
            stem: "Based on the following information:\nSales | $100\nCost | $60\nWhat is gross profit?",
          }),
          always,
        ),
      ),
    ).not.toContain("missing-reference");
    expect(
      rulesOf(
        lintMcq(
          mcq({
            stem: "An NFP incurs the following costs. Which should be classified as management?",
          }),
          always,
        ),
      ),
    ).not.toContain("missing-reference");
  });

  it("TBSで参照している Exhibit がデータに無ければ拾う", () => {
    expect(
      referencedExhibitNumbers("See Exhibits 1 and 3, and Exhibits 4–5."),
    ).toEqual(["1", "3", "4", "5"]);
    const q = tbs({ scenario: "Data are in **Exhibit 1** and **Exhibit 2**." });
    const issues = lintTbs(q).filter((i) => i.rule === "missing-reference");
    expect(issues.map((i) => i.detail).join()).toContain("Exhibit 2");
    expect(lintTbs(tbs({}))).toEqual([]);
  });
});

describe("② 表の崩れ", () => {
  it("MCQ問題文のMarkdown表を拾う（QuestionStem は「 | 」区切りしか描画できない）", () => {
    const q = mcq({
      stem: "Data:\n\n| Item | Amount |\n|---|---|\n| Sales | $100 |\n\nWhat is sales?",
    });
    const issues = lintMcq(q, always).filter((i) => i.rule === "table-format");
    expect(issues).toHaveLength(1);
    expect(issues[0].detail).toContain("Markdown表");
  });

  it("表の行の間に断片行が挟まる崩れ（bar-pc-003 の型）を拾う", () => {
    const q = mcq({
      stem: "Data:\nUnits | 1,000 | 2,000\nNumber of frames\nCost | $5,000 | $6,000\nWhat is cost?",
    });
    expect(rulesOf(lintMcq(q, always))).toContain("table-format");
  });

  it("組合せ選択肢の列見出しが2行に割れている（a4d4382 の型）・無い・列数が合わないものを拾う", () => {
    const yesNo = [
      { label: "A", text: "Yes | Yes" },
      { label: "B", text: "Yes | No" },
      { label: "C", text: "No | Yes" },
      { label: "D", text: "No | No" },
    ];
    const split = mcq({
      stem: "Which is used?\nBudget allowance | Budget allowance\nbased on actual | based on standard",
      choices: yesNo,
    });
    expect(rulesOf(lintMcq(split, always))).toContain("missing-heading");

    const none = mcq({
      stem: "Which of the costs are assigned to inventory?",
      choices: yesNo,
    });
    expect(rulesOf(lintMcq(none, always))).toContain("missing-heading");

    const merged = mcq({
      stem: "Which is used?\nControllable Volume variance (budget) variance",
      choices: yesNo,
    });
    expect(rulesOf(lintMcq(merged, always))).toContain("table-format");

    const ok = mcq({
      stem: "Which is used?\nBudget allowance based on actual hours | Budget allowance based on standard hours",
      choices: yesNo,
    });
    expect(lintMcq(ok, always)).toEqual([]);
  });

  it("Markdown表（TBS）の見出し・区切り行・本体行の列数不整合と空見出しを拾う", () => {
    const details = (md: string) =>
      lintMarkdownTables("t", "exhibit", md)
        .map((i) => i.detail)
        .join("\n");
    expect(details("| A | B |\n|---|\n| 1 | 2 |")).toContain("区切り行");
    expect(details("| A | B |\n|---|---|\n| 1 | 2 | 3 |")).toContain(
      "余分なセル",
    );
    expect(
      details("| | Year 1 | |\n|---|---|---|\n| Cash | 1 | 2 |"),
    ).toContain("見出しが空の列（3列目）");
    expect(details("| A | B |\n| 1 | 2 |")).toContain("区切り行");
    // 先頭列の空見出しは財務表の慣例なので許す
    expect(details("| | Year 1 |\n|---|---|\n| Cash | 1 |")).toBe("");
  });
});

describe("③ 解説・見出しの欠落", () => {
  it("解説が空・動画解説への参照だけの問題を拾う", () => {
    expect(
      rulesOf(lintMcq(mcq({ explanation: "", explanationJa: "" }), always)),
    ).toContain("missing-explanation");
    expect(
      rulesOf(
        lintMcq(
          mcq({
            explanation:
              "Refer to the video explanation in the Proactive question bank.",
            explanationJa: "",
          }),
          always,
        ),
      ),
    ).toContain("missing-explanation");
  });

  it("TBSのタスク解説（画面に出る explanationJa）・タイトルの欠落を拾う", () => {
    const base = tbs({});
    const q = tbs({
      tasks: [{ ...base.tasks[0], explanationJa: "", title: "" }],
    });
    expect(rulesOf(lintTbs(q))).toEqual(
      expect.arrayContaining(["missing-explanation", "missing-heading"]),
    );
  });
});

describe("④ 模試の想定解答時間", () => {
  it("TBS 7問の estimatedMinutes 合計が持ち時間を超えたら拾う", () => {
    const seven = Array.from({ length: 7 }, (_, i) =>
      tbs({ id: `t${i}`, estimatedMinutes: 25 }),
    );
    expect(lintTbsMockTime("set", seven, 150)).toHaveLength(1);
    expect(lintTbsMockTime("set", seven.slice(0, 6), 150)).toEqual([]);
  });

  it("旧初見模試（v1。10/10に90分で13問時間切れ）は超過と判定し、作り直した v2 は収まる", () => {
    const setById = (id: string): QuestionSet => {
      const set = [...barQuestionSets, ...barOwnAreaIIIIIQuestionSets].find(
        (s) => s.id === id,
      );
      if (!set) throw new Error(`${id} が見つからない`);
      return set;
    };
    const v1 = {
      id: "bar-fresh-mock-v1",
      quota: MOCK_EXAM_AREA_QUOTA.BAR,
      pools: {
        I: setById("bar-fresh-mock-area1").questions,
        II: setById("bar-fresh-mock-area2").questions,
        III: setById("bar-fresh-mock-area3").questions,
      },
      limitMinutes: MOCK_EXAM_MINUTES,
    };
    expect(lintMcqMockTime(v1)).toHaveLength(1);
    expect(expectedMcqMockMinutes(barFreshMockPool())).toBeLessThanOrEqual(
      MOCK_EXAM_MINUTES,
    );
  });
});

describe("実データの全問検査", () => {
  const issues = collectIssues();
  const known = new Set((knownIssues as LintIssue[]).map(issueKey));
  const found = new Set(issues.map(issueKey));

  it("検出結果を出力する", () => {
    const byRule = new Map<string, number>();
    for (const i of issues) byRule.set(i.rule, (byRule.get(i.rule) ?? 0) + 1);
    const lines = [
      `問題データ lint: 不備 ${issues.length}件（うち既知 ${issues.filter((i) => known.has(issueKey(i))).length}件）`,
      ...[...byRule].map(([rule, n]) => `  ${rule}: ${n}件`),
      "通し模試の時間:",
      ...mockTimeSummary().map((s) => `  ${s}`),
    ];
    console.log(lines.join("\n"));
    expect(issues.length).toBeGreaterThanOrEqual(0);
  });

  it("既知の一覧（known-issues.json）に無い不備が無い", () => {
    const fresh = issues.filter((i) => !known.has(issueKey(i)));
    // 落ちたら、ここに出た問題IDのデータを直す
    expect(
      fresh.map((i) => `[${i.rule}] ${i.id} (${i.where}) ${i.detail}`),
    ).toEqual([]);
  });

  it("既知の一覧に、もう出なくなった（直った）不備が残っていない", () => {
    const stale = (knownIssues as LintIssue[]).filter(
      (i) => !found.has(issueKey(i)),
    );
    // 落ちたら、ここに出た行を known-issues.json から消す
    expect(stale.map(issueKey)).toEqual([]);
  });
});
