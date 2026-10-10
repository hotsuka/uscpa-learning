/**
 * 自作問題データの全問検査（問題データ lint）の判定ロジック
 *
 * 2026-09〜10 に、作成時点で機械的に見つけられた不備（表崩れ・列見出しの割れ・参照資料の欠落・
 * 模試の時間超過）を1件ずつ画面で見つけて報告→修正する流れが続いたため、全問をまとめて検査する。
 * 実データに対する実行は questionLint.test.ts（`npm run lint:questions`）が行う。
 *
 * 検出する不備:
 *   ① missing-reference   本文・設問が参照資料（Exhibit・図・表）に言及しているのに、その資料がデータに無い
 *   ② table-format        表の列数不整合・空見出し・描画で崩れる記法
 *   ③ missing-explanation 解説の欠落 / missing-heading 見出しの欠落
 *   ④ mock-time-over      模試セットの想定解答時間の合計が制限時間を超える
 */

import { isTableRow } from "@/components/materials/QuestionStem";
import type { FARQuestion } from "@/types/questions";
import type { TBSQuestion } from "@/types/tbs";

export type LintRule =
  | "missing-reference"
  | "table-format"
  | "missing-explanation"
  | "missing-heading"
  | "mock-time-over";

export interface LintIssue {
  rule: LintRule;
  /** 問題ID（模試セットの時間超過はセットID） */
  id: string;
  /** 不備のある箇所（stem / choices / exhibit ex-1 / task t1 など） */
  where: string;
  detail: string;
}

/**
 * 既知不備の照合キー。同じ問題・同じ規則・同じ箇所・同じ種類（detail の「:」「（」より前。数値は無視）なら
 * 同じ不備とみなす。例示している行・分数・内訳は直している途中で変わるので、キーには含めない
 */
export const issueKey = (issue: LintIssue): string =>
  [
    issue.rule,
    issue.id,
    issue.where,
    issue.detail.split(/[:：（]/)[0].replace(/[0-9]+/g, "N"),
  ].join("|");

// ---------------------------------------------------------------------------
// ① 参照資料の欠落（MCQ）
// ---------------------------------------------------------------------------

// 図そのものを指す語。figure（SVG）が無ければ解けない（表では代わりにならない）
const VISUAL_REFERENCE =
  /\b(?:(?:following|accompanying|below|above)\s+(?:chart|graph|diagram|figure|illustration)|(?:chart|graph|diagram|figure|illustration)\s+(?:below|above|shown|presented)|refer(?:ring)?\s+to\s+(?:the\s+)?(?:chart|graph|diagram|figure))\b/i;

// Exhibit を指す語。figure か本文中の表が要る
const EXHIBIT_REFERENCE =
  /\b(?:(?:following|accompanying|below|above)\s+exhibit|exhibit\s+(?:below|above|shown|presented)|refer(?:ring)?\s+to\s+(?:the\s+)?exhibit)\b/i;

// 表・データを指す語。「which of the following information」のように選択肢を指すものは除く
const DATA_REFERENCE =
  /(?<!(?:which|each|all|any|none|both|one|either|neither)\s+of\s+)\b(?:(?:the\s+following|accompanying)\s+(?:data|information|facts|amounts|balances|schedule|table|budget|costs|results|transactions|account\s+balances|figures)|(?:shown|presented|given|provided|listed|summarized)\s+below|(?:table|schedule)\s+(?:below|above))\b/i;

/**
 * 本文に表（「 | 」区切りの行）があるか。組合せ問題の最終行は選択肢の列見出しで、資料ではないので除く
 */
const hasStemTable = (stem: string, q?: FARQuestion): boolean => {
  const lines = stem.split("\n");
  const isMatrix =
    q !== undefined &&
    q.choices.length > 0 &&
    q.choices.every((c) => c.text.includes(" | "));
  const body = isMatrix ? lines.slice(0, -2) : lines;
  return body.some((line) => line.includes(" | "));
};

/**
 * MCQの本文が参照する資料（図・表・データ）がデータ上に存在するか。
 * figure の画像ファイルの実在確認は呼び出し側（fileExists）に任せる。
 */
export function lintMcqReferences(
  q: FARQuestion,
  fileExists: (publicPath: string) => boolean,
): LintIssue[] {
  const issues: LintIssue[] = [];
  const stem = q.stem ?? "";

  if (q.figure && !fileExists(q.figure.src)) {
    issues.push({
      rule: "missing-reference",
      id: q.id,
      where: "figure",
      detail: `図ファイルが public/ に無い: ${q.figure.src}`,
    });
  }

  const visual = stem.match(VISUAL_REFERENCE);
  if (visual && !q.figure) {
    issues.push({
      rule: "missing-reference",
      id: q.id,
      where: "stem",
      detail: `本文が「${visual[0]}」を参照しているが、figure（図）が無い`,
    });
    return issues;
  }
  const exhibit = stem.match(EXHIBIT_REFERENCE);
  if (exhibit && !q.figure && !hasStemTable(stem, q)) {
    issues.push({
      rule: "missing-reference",
      id: q.id,
      where: "stem",
      detail: `本文が「${exhibit[0]}」を参照しているが、figure も表も無い`,
    });
    return issues;
  }

  const data = DATA_REFERENCE.exec(stem);
  if (data && !q.figure) {
    // 参照語より後ろに数値も表も無ければ、資料本体が欠けている
    const after = stem.slice(data.index + data[0].length);
    // 「the following costs. Which should be ...?」のように選択肢を指しているものは除く
    if (
      !/\d/.test(after) &&
      !hasStemTable(after, q) &&
      !/\bwhich\b/i.test(after)
    ) {
      issues.push({
        rule: "missing-reference",
        id: q.id,
        where: "stem",
        detail: `本文が「${data[0]}」を参照しているが、その後ろに数値も表も無い`,
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// ② 表の崩れ（MCQ。QuestionStem の「 | 」区切り形式）
// ---------------------------------------------------------------------------

const cellsOf = (line: string): string[] =>
  line.split(" | ").map((c) => c.trim());

/**
 * MCQ問題文の表を、画面（QuestionStem）と同じ判定で読んで崩れの原因を探す。
 * QuestionStem は「 | 」区切りの行だけを表として描画し、Markdown表は扱わない。
 */
export function lintMcqStemTable(q: FARQuestion): LintIssue[] {
  const lines = (q.stem ?? "").split("\n");
  // 同じ種類の崩れは1問につき1件にまとめ、最初の該当行と行数を添える
  const found = new Map<string, string[]>();
  const note = (kind: string, line: string) =>
    found.set(kind, [...(found.get(kind) ?? []), line.trim().slice(0, 60)]);

  // Markdown表は「 | 」区切りとして読まれ、行頭・行末の | が残り、区切り行が罫線や見出しに化ける。
  // 表全体が崩れるので、この場合は他の行単位の検査はしない
  const markdownRows = lines.filter(
    (l) => /^\s*\|/.test(l) || /^\s*:?-{3,}:?(\s*\|\s*:?-{3,}:?)+\s*$/.test(l),
  );
  if (markdownRows.length > 0) {
    markdownRows.forEach((l) =>
      note(
        "Markdown表の記法（QuestionStem は「 | 」区切りのみ対応。| が残り表が崩れる）",
        l,
      ),
    );
  } else {
    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (!line) return;
      // 空白なしの | は区切りとして扱われず、空白に置き換えられて列が消える
      if (line.includes("|") && !line.includes(" | ")) {
        note("前後に空白の無い |（列区切りとして読まれない）", line);
        return;
      }
      if (!line.includes(" | ")) return;
      // 「a | | b」は「 | 」で割ると | がセルに残り、列が1つずれる（空セルは「a |  | b」と書く）
      if (cellsOf(line).some((c) => c.startsWith("|") || c.endsWith("|"))) {
        note("| が連続して列がずれる", line);
      }
      // 表の行のはずが、長いセルなどで本文扱いになり表が途中で割れる
      const neighborIsRow =
        (i > 0 && isTableRow(lines[i - 1])) ||
        (i < lines.length - 1 && isTableRow(lines[i + 1]));
      // 「▪ | 本文」のような箇条書きは表ではないので除く
      const isBullet = /^[▪•●■◦·*-]$/.test(cellsOf(line)[0] ?? "");
      if (!isTableRow(raw) && neighborIsRow && !isBullet) {
        note("表の行が本文扱いになり表が割れる（セルが45字超など）", line);
      }
    });

    // 表の行の間に断片行が挟まる（PDF抽出でセルが前後の行へ割れた形。bar-pc-003 など）。
    // 文章（ピリオド・コロンで終わる、または長い行）は表の外の説明文なので対象外
    for (let i = 1; i < lines.length - 1; i++) {
      const l = lines[i].trim();
      if (
        !lines[i].includes(" | ") &&
        l !== "" &&
        l.length <= 30 &&
        !/[.:。：]$/.test(l) &&
        isTableRow(lines[i - 1]) &&
        isTableRow(lines[i + 1])
      ) {
        note("表の行の間に断片行", l);
      }
    }
  }

  return [...found.entries()].map(([kind, examples]) => ({
    rule: "table-format" as const,
    id: q.id,
    where: "stem",
    detail:
      `${kind}: "${examples[0]}"` +
      (examples.length > 1 ? ` ほか${examples.length - 1}行` : ""),
  }));
}

/**
 * 組合せで答える設問（全選択肢が「 | 」区切り）の列数と列見出しを検査する。
 * 画面（QuestionCard）は問題文の最終行を選択肢の列見出しとして切り出すため、
 * 見出しが無い・2行に割れている・列数が合わないと、Yes/No が何を指すか読めなくなる。
 */
export function lintMcqMatrixChoices(q: FARQuestion): LintIssue[] {
  const issues: LintIssue[] = [];
  const pipeChoices = q.choices.filter((c) => c.text.includes(" | "));
  if (pipeChoices.length === 0) return issues;

  if (pipeChoices.length !== q.choices.length) {
    issues.push({
      rule: "table-format",
      id: q.id,
      where: "choices",
      detail: `一部の選択肢だけが「 | 」区切り（${pipeChoices.map((c) => c.label).join("/")}）`,
    });
    return issues;
  }

  const counts = q.choices.map((c) => cellsOf(c.text).length);
  const columns = Math.max(...counts);
  if (counts.some((n) => n !== columns)) {
    issues.push({
      rule: "table-format",
      id: q.id,
      where: "choices",
      detail: `選択肢の列数が不揃い（${q.choices.map((c, i) => `${c.label}=${counts[i]}`).join(", ")}）`,
    });
  }

  const stemLines = (q.stem ?? "").split("\n").map((l) => l.trim());
  const last = stemLines[stemLines.length - 1] ?? "";
  const prev = stemLines[stemLines.length - 2] ?? "";
  // QuestionCard の matrixHeader と同じ条件。満たさなければ見出しは表示されない
  const isHeaderLine = last !== "" && last.length < 90 && !/[?.]$/.test(last);

  if (!isHeaderLine) {
    issues.push({
      rule: "missing-heading",
      id: q.id,
      where: "choices",
      detail: `組合せ選択肢（${columns}列）の列見出しが問題文の最終行に無い`,
    });
    return issues;
  }

  const headerCells = last.includes(" | ") ? cellsOf(last) : [last];
  // 「Product with excess | OE/OF」「sales」のように、見出しの続きだけが最終行に落ちている
  if (
    !last.includes(" | ") &&
    prev.includes(" | ") &&
    cellsOf(prev).length === columns &&
    !/[?.:]$/.test(prev)
  ) {
    issues.push({
      rule: "missing-heading",
      id: q.id,
      where: "choices",
      detail: `列見出しが2行に割れ、最終行（見出しとして使われる行）が続きの断片になっている: "${prev.slice(0, 40)}" / "${last.slice(0, 40)}"`,
    });
    return issues;
  }
  if (headerCells.length !== columns) {
    issues.push({
      rule: "table-format",
      id: q.id,
      where: "choices",
      detail: `列見出し ${headerCells.length}列 と選択肢 ${columns}列 が合わない: "${last.slice(0, 60)}"`,
    });
  }

  // 見出しが2行に割れている（a4d4382 / 11a9eb3 で直した型）。画面は最終行しか見出しに使わない
  const prevIsSplitHeader =
    prev.includes(" | ") &&
    cellsOf(prev).length === headerCells.length &&
    !/\d/.test(prev) &&
    !/[?.:]$/.test(prev);
  const prevIsFragment =
    prev !== "" &&
    !prev.includes(" | ") &&
    prev.length <= 25 &&
    !/[?.:;,]$/.test(prev) &&
    stemLines.length >= 3;
  if (prevIsSplitHeader || prevIsFragment) {
    issues.push({
      rule: "missing-heading",
      id: q.id,
      where: "choices",
      detail: `列見出しが2行に割れている疑い: "${prev.slice(0, 40)}" / "${last.slice(0, 40)}"`,
    });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// ③ 解説の欠落（MCQ）
// ---------------------------------------------------------------------------

// 解説を書かずに出典の動画解説を指しているだけのもの（check-questions.mjs と同じ判定）
const PLACEHOLDER_EXPLANATION = /Refer to the video explanation/i;

export function lintMcqExplanation(q: FARQuestion): LintIssue[] {
  const issues: LintIssue[] = [];
  const en = (q.explanation ?? "").trim();
  const ja = (q.explanationJa ?? "").trim();
  if (!en && !ja) {
    issues.push({
      rule: "missing-explanation",
      id: q.id,
      where: "explanation",
      detail: "解説（英・日）が空",
    });
    return issues;
  }
  if (PLACEHOLDER_EXPLANATION.test(en) || PLACEHOLDER_EXPLANATION.test(ja)) {
    issues.push({
      rule: "missing-explanation",
      id: q.id,
      where: "explanation",
      detail: "解説が未記入（動画解説への参照だけ）",
    });
    return issues;
  }
  if (!ja) {
    issues.push({
      rule: "missing-explanation",
      id: q.id,
      where: "explanationJa",
      detail: "日本語解説が空",
    });
  }
  if (!en) {
    issues.push({
      rule: "missing-explanation",
      id: q.id,
      where: "explanation",
      detail: "英語解説が空",
    });
  }
  return issues;
}

export function lintMcq(
  q: FARQuestion,
  fileExists: (publicPath: string) => boolean,
): LintIssue[] {
  return [
    ...lintMcqReferences(q, fileExists),
    ...lintMcqStemTable(q),
    ...lintMcqMatrixChoices(q),
    ...lintMcqExplanation(q),
  ];
}

// ---------------------------------------------------------------------------
// TBS（Exhibit・タスク・Markdown表）
// ---------------------------------------------------------------------------

/** 「Exhibit 2」「Exhibits 1 and 3」「Exhibits 1–3」から参照されている番号を取り出す */
export function referencedExhibitNumbers(text: string): string[] {
  const found = new Set<string>();
  const re =
    /\bExhibits?\s+((?:[0-9]+|[A-Z])\b(?:\s*(?:,|and|&|through|to|-|–|—)\s*(?:[0-9]+|[A-Z])\b)*)/g;
  for (const m of text.matchAll(re)) {
    const list = m[1];
    const range = list.match(/^([0-9]+)\s*(?:through|to|-|–|—)\s*([0-9]+)$/);
    if (range) {
      for (let n = Number(range[1]); n <= Number(range[2]); n++)
        found.add(String(n));
      continue;
    }
    for (const token of list.split(/\s*(?:,|and|&)\s*/)) {
      const t = token.trim();
      if (/^(?:[0-9]+|[A-Z])$/.test(t)) found.add(t);
    }
  }
  return [...found];
}

/** Exhibit の番号（タイトル「Exhibit 2: ...」または id「ex-2」）の一覧 */
const exhibitNumbers = (q: TBSQuestion): Set<string> => {
  const nums = new Set<string>();
  for (const ex of q.exhibits) {
    const t = ex.title.match(/\bExhibit\s+([0-9]+|[A-Z])\b/i);
    if (t) nums.add(t[1].toUpperCase());
    const i = ex.id.match(/^ex-?([0-9]+|[a-z])$/i);
    if (i) nums.add(i[1].toUpperCase());
  }
  return nums;
};

interface MarkdownTable {
  /** 表の先頭行の行番号（0始まり） */
  startLine: number;
  rows: string[][];
  hasDelimiter: boolean;
}

/** GFMの表の1行をセルに分ける（\| はセル内の文字として扱う） */
export function splitMarkdownRow(line: string): string[] {
  let body = line.trim();
  if (body.startsWith("|")) body = body.slice(1);
  if (body.endsWith("|") && !body.endsWith("\\|")) body = body.slice(0, -1);
  return body.split(/(?<!\\)\|/).map((c) => c.trim());
}

const DELIMITER_ROW = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/;

/** Markdown中の「| で始まる行」の塊を表の候補として取り出す */
export function findMarkdownTables(text: string): MarkdownTable[] {
  const lines = text.split("\n");
  const tables: MarkdownTable[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].trim().startsWith("|")) {
      i++;
      continue;
    }
    const start = i;
    const block: string[] = [];
    while (i < lines.length && lines[i].trim().startsWith("|"))
      block.push(lines[i++]);
    const hasDelimiter =
      block.length >= 2 && DELIMITER_ROW.test(block[1].trim());
    tables.push({
      startLine: start,
      rows: block
        .filter((_, k) => !(hasDelimiter && k === 1))
        .map(splitMarkdownRow),
      hasDelimiter,
    });
  }
  return tables;
}

/**
 * Markdown（TBSのシナリオ・Exhibit・タスク・解説。react-markdown + remark-gfm で描画）の表を検査する。
 * GFMは見出し行と区切り行の列数が違うと表として描画せず、本体行の余分なセルは黙って捨てる。
 */
export function lintMarkdownTables(
  id: string,
  where: string,
  text: string,
): LintIssue[] {
  const issues: LintIssue[] = [];
  const push = (detail: string) =>
    issues.push({ rule: "table-format", id, where, detail });

  for (const table of findMarkdownTables(text)) {
    const at = `${table.startLine + 1}行目の表`;
    if (table.rows.length < 2 && !table.hasDelimiter) {
      // 1行だけ | で始まる行は表ではなく本文に | が残る
      push(`${at}: 区切り行（|---|）が無く表として描画されない`);
      continue;
    }
    if (!table.hasDelimiter) {
      push(`${at}: 2行目が区切り行（|---|）でなく表として描画されない`);
      continue;
    }
    const lines = text.split("\n");
    const delimiterCells = splitMarkdownRow(lines[table.startLine + 1]).length;
    const [header, ...body] = table.rows;
    if (header.length !== delimiterCells) {
      push(
        `${at}: 見出し ${header.length}列 と区切り行 ${delimiterCells}列 が合わず表として描画されない`,
      );
      continue;
    }
    // 先頭列（行ラベル列）の見出しが空なのは財務表の慣例なので許す
    const emptyHeaders = header
      .map((c, k) => (c === "" && k > 0 ? k + 1 : 0))
      .filter((k) => k > 0);
    if (emptyHeaders.length > 0) {
      push(`${at}: 見出しが空の列（${emptyHeaders.join(", ")}列目）`);
    }
    body.forEach((row, r) => {
      if (row.length !== header.length) {
        push(
          `${at}: ${r + 1}行目の列数 ${row.length} が見出し ${header.length}列 と合わない` +
            (row.length > header.length ? "（余分なセルは表示されない）" : ""),
        );
      }
    });
  }
  return issues;
}

const TABLE_REFERENCE_IN_TASK =
  /\b(?:(?:following|accompanying|below)\s+(?:table|schedule|template|worksheet)|(?:table|schedule|template|worksheet)\s+below)\b/i;

export function lintTbs(q: TBSQuestion): LintIssue[] {
  const issues: LintIssue[] = [];
  const add = (rule: LintRule, where: string, detail: string) =>
    issues.push({ rule, id: q.id, where, detail });

  if (!q.title?.trim()) add("missing-heading", "title", "問題タイトルが空");
  if (!q.scenario?.trim()) add("missing-reference", "scenario", "シナリオが空");

  // ① Exhibit の欠落
  const available = exhibitNumbers(q);
  const texts: [string, string][] = [
    ["scenario", q.scenario ?? ""],
    ...q.tasks.map((t): [string, string] => [
      `task ${t.id}`,
      t.instruction ?? "",
    ]),
  ];
  for (const [where, text] of texts) {
    const missing = referencedExhibitNumbers(text).filter(
      (n) => !available.has(n.toUpperCase()),
    );
    if (missing.length > 0) {
      add(
        "missing-reference",
        where,
        `Exhibit ${missing.join(", ")} を参照しているがデータに無い（あるのは ${[...available].join(", ") || "なし"}）`,
      );
    }
  }
  if (
    q.exhibits.length === 0 &&
    /\bexhibit/i.test(texts.map(([, t]) => t).join("\n"))
  ) {
    add(
      "missing-reference",
      "exhibits",
      "本文が Exhibit に言及しているが exhibits が空",
    );
  }

  for (const ex of q.exhibits) {
    const where = `exhibit ${ex.id}`;
    if (!ex.title?.trim())
      add("missing-heading", where, "Exhibit のタイトルが空");
    if ((ex.content ?? "").trim().length < 20) {
      add("missing-reference", where, "Exhibit の本文が空（または20字未満）");
    }
    issues.push(...lintMarkdownTables(q.id, where, ex.content ?? ""));
  }
  issues.push(...lintMarkdownTables(q.id, "scenario", q.scenario ?? ""));

  for (const task of q.tasks) {
    const where = `task ${task.id}`;
    if (!task.title?.trim())
      add("missing-heading", where, "タスクのタイトルが空");
    if (!task.workTab?.trim())
      add("missing-heading", where, "タスクのタブ名（workTab）が空");
    // 画面に出るのは explanationJa だけ
    if (!task.explanationJa?.trim())
      add("missing-explanation", where, "日本語解説（explanationJa）が空");
    if (!task.explanation?.trim())
      add("missing-explanation", where, "英語解説（explanation）が空");

    if (
      TABLE_REFERENCE_IN_TASK.test(task.instruction ?? "") &&
      !task.tableConfig &&
      findMarkdownTables(task.instruction ?? "").length === 0
    ) {
      add(
        "missing-reference",
        where,
        "設問が表を参照しているが、tableConfig も設問内の表も無い",
      );
    }
    if (task.answerType === "table" && task.tableConfig) {
      const { columns, rows } = task.tableConfig;
      if (columns.some((c) => !c.trim()))
        add("missing-heading", where, "解答表の列見出しに空がある");
      if (rows.some((r) => !r.trim()))
        add("missing-heading", where, "解答表の行見出しに空がある");
    }
    issues.push(...lintMarkdownTables(q.id, where, task.instruction ?? ""));
    issues.push(
      ...lintMarkdownTables(
        q.id,
        `${where} explanationJa`,
        task.explanationJa ?? "",
      ),
    );
  }
  return issues;
}

// ---------------------------------------------------------------------------
// ④ 模試セットの想定解答時間
// ---------------------------------------------------------------------------

/**
 * 想定解答時間の基準（分）。
 *
 * - 本番のBAR試験は4時間（240分）。アプリの4択模試は MOCK_EXAM_MINUTES（90分）で50問を解くので、
 *   通し模試のTBS 7問に残る時間は 240 − 90 = 150分。
 * - TBSはデータの estimatedMinutes をそのまま使う。
 * - 4択は1問ごとの設定値がデータに無いため、問題文と選択肢の語数・計算問題かどうかから見積もる
 *   （読む時間 + 判断の固定時間 + 計算の上乗せ）。係数は、10/10 の初見模試①（旧初見問題 v1）が
 *   90分で13問時間切れになったことと、過去問ベースのセット（Proactive）がおおむね90分に収まることに
 *   合わせた暫定値。
 *
 * TODO: 難易度・時間の基準は過去問統計で後日差し替え。
 *   10/10 の出題傾向分析（commit 6577ed4 の時点で、過去問621問の語数中央値55〜62語・計算問題3割弱）は
 *   数値がコミットメッセージにしか残っておらず、リポジトリ上に参照できるデータが無い。
 *   統計をデータとして置いたら、MCQ_* の係数と difficulty の判定をそこから引くように変える。
 */
export const BAR_EXAM_TOTAL_MINUTES = 240;
const MCQ_BASE_MINUTES = 0.6;
const MCQ_WORDS_PER_MINUTE = 100;
const MCQ_CALCULATION_EXTRA_MINUTES = 0.8;

const countWords = (text: string): number =>
  (text.match(/[A-Za-z0-9$%][^\s|]*/g) ?? []).length;

/** 選択肢が金額・数値の問題（計算問題）か。数値の選択肢が3つ以上あれば計算問題とみなす */
export const isCalculationQuestion = (q: FARQuestion): boolean =>
  q.choices.filter(
    (c) =>
      (c.text.match(/\d/g) ?? []).length >= 2 &&
      !/[a-z]{4,}.*[a-z]{4,}/i.test(c.text),
  ).length >= 3;

/** 4択1問の想定解答時間（分） */
export function estimateMcqMinutes(q: FARQuestion): number {
  const words =
    countWords(q.stem ?? "") +
    q.choices.reduce((sum, c) => sum + countWords(c.text), 0);
  return (
    MCQ_BASE_MINUTES +
    words / MCQ_WORDS_PER_MINUTE +
    (isCalculationQuestion(q) ? MCQ_CALCULATION_EXTRA_MINUTES : 0)
  );
}

export interface McqMockPool {
  /** 模試セットのID（報告用） */
  id: string;
  /** Area ごとの出題数 */
  quota: Record<string, number>;
  /** Area ごとの出題元の問題 */
  pools: Record<string, FARQuestion[]>;
  limitMinutes: number;
}

/**
 * 4択模試の想定解答時間（分）。模試は Area ごとに出題数ぶんを抽出するので、
 * 「Area の出題数 × その Area の問題の平均想定時間」の合計を期待値とする。
 */
export function expectedMcqMockMinutes(pool: McqMockPool): number {
  return Object.entries(pool.quota).reduce((sum, [area, count]) => {
    const qs = pool.pools[area] ?? [];
    if (qs.length === 0) return sum;
    const mean = qs.reduce((s, q) => s + estimateMcqMinutes(q), 0) / qs.length;
    return sum + mean * count;
  }, 0);
}

export function lintMcqMockTime(pool: McqMockPool): LintIssue[] {
  const minutes = expectedMcqMockMinutes(pool);
  if (minutes <= pool.limitMinutes) return [];
  return [
    {
      rule: "mock-time-over",
      id: pool.id,
      where: "mcq",
      detail: `4択の想定解答時間 ${minutes.toFixed(0)}分 が制限 ${pool.limitMinutes}分 を超える`,
    },
  ];
}

export function lintTbsMockTime(
  setId: string,
  questions: TBSQuestion[],
  limitMinutes: number,
): LintIssue[] {
  const minutes = questions.reduce((sum, q) => sum + q.estimatedMinutes, 0);
  if (minutes <= limitMinutes) return [];
  return [
    {
      rule: "mock-time-over",
      id: setId,
      where: "tbs",
      detail:
        `TBS ${questions.length}問の estimatedMinutes 合計 ${minutes}分 が持ち時間 ${limitMinutes}分 を超える` +
        `（${questions.map((q) => `${q.id}=${q.estimatedMinutes}`).join(", ")}）`,
    },
  ];
}
