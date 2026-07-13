// TBS問題データの整合性チェック
// 使い方: node scripts/check-tbs.mjs [対象ディレクトリ]（省略時 src/data/tbs/far）
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const targetDir = process.argv[2] ?? "src/data/tbs/far";

const ANSWER_TYPES = ["number", "select", "multiselect", "table", "research"];
const DIFFICULTIES = ["basic", "intermediate", "advanced"];
const SUBJECTS = ["FAR", "AUD", "REG", "BAR"];

// 解説内に「自信がない・計算が合わない」ことを示す疑念パターン（check-questions.mjsと同基準）
const SUSPICIOUS = [
  { re: /wait[,\s—]+let me/i, label: "wait-let-me" },
  { re: /hmm[,.]?\s/i, label: "hmm" },
  { re: /not among the choices/i, label: "not-among-choices" },
  { re: /let me re.?calculat/i, label: "recalculate" },
  { re: /let me reconsider/i, label: "reconsider" },
  { re: /let me re.?read/i, label: "re-read" },
  { re: /let me recheck/i, label: "recheck" },
  { re: /closest answer is/i, label: "closest-answer" },
  { re: /doesn.t match|do not match/i, label: "doesnt-match" },
];

// TBSは選択肢をA-Dラベルで参照しない（内容で参照する）
const LABEL_REF = [
  { re: /\bchoice\s+[A-D]\b/i, label: "choice-letter" },
  { re: /\boption\s+[A-D]\b/i, label: "option-letter" },
  { re: /選択肢[A-DＡ-Ｄ]/, label: "sentakushi-letter" },
];

// ASC引用の正規化（TBSAnswerForm.tsxのnormalizeCitationと同一ロジック）
function normalizeCitation(value) {
  return String(value)
    .replace(/[^0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const files = readdirSync(targetDir).filter(
  (f) => f.endsWith(".json") && !f.includes(".bak"),
);

const errors = [];
const seenIds = new Set();
let totalQuestions = 0;
let totalTasks = 0;

function err(file, id, message) {
  errors.push(`${file} [${id}] ${message}`);
}

for (const file of files) {
  let questions;
  try {
    questions = JSON.parse(readFileSync(join(targetDir, file), "utf8"));
  } catch (e) {
    err(file, "-", `JSONパースエラー: ${e.message}`);
    continue;
  }
  if (!Array.isArray(questions)) {
    err(file, "-", "トップレベルが配列ではない");
    continue;
  }

  for (const q of questions) {
    totalQuestions++;
    const qid = q.id ?? "(idなし)";

    // 基本フィールド
    if (!/^far-tbs-[a-z0-9-]+-\d{3}$/.test(q.id ?? "")) {
      err(file, qid, `id形式が不正: ${q.id}`);
    }
    if (seenIds.has(q.id)) {
      err(file, qid, "id重複");
    }
    seenIds.add(q.id);

    if (!SUBJECTS.includes(q.subject)) err(file, qid, `subject不正: ${q.subject}`);
    if (!DIFFICULTIES.includes(q.difficulty))
      err(file, qid, `difficulty不正: ${q.difficulty}`);
    if (typeof q.estimatedMinutes !== "number" || q.estimatedMinutes < 5 || q.estimatedMinutes > 40)
      err(file, qid, `estimatedMinutes不正: ${q.estimatedMinutes}`);
    if (!q.topic) err(file, qid, "topicが空");
    if (!q.title) err(file, qid, "titleが空");
    if (!q.scenario) err(file, qid, "scenarioが空");

    // Exhibits
    if (!Array.isArray(q.exhibits) || q.exhibits.length === 0) {
      err(file, qid, "exhibitsが空");
    } else {
      for (const ex of q.exhibits) {
        if (!ex.id || !ex.title || !ex.content)
          err(file, qid, `exhibit不完全: ${ex.id ?? "(idなし)"}`);
      }
    }

    // Tasks
    if (!Array.isArray(q.tasks) || q.tasks.length === 0) {
      err(file, qid, "tasksが空");
      continue;
    }
    const taskIds = new Set();
    for (const t of q.tasks) {
      totalTasks++;
      const tid = `${qid}/${t.id ?? "(idなし)"}`;

      if (taskIds.has(t.id)) err(file, tid, "task id重複");
      taskIds.add(t.id);

      if (!t.workTab) err(file, tid, "workTabが空");
      if (!t.title) err(file, tid, "titleが空");
      if (!t.instruction) err(file, tid, "instructionが空");
      if (!t.explanation) err(file, tid, "explanationが空");
      if (!t.explanationJa) err(file, tid, "explanationJaが空");
      if (!ANSWER_TYPES.includes(t.answerType)) {
        err(file, tid, `answerType不正: ${t.answerType}`);
        continue;
      }

      // answerType別チェック
      if (t.answerType === "number") {
        if (typeof t.correctAnswer !== "number")
          err(file, tid, `number型なのにcorrectAnswerが数値でない: ${JSON.stringify(t.correctAnswer)}`);
      }
      if (t.answerType === "select") {
        if (!Array.isArray(t.options) || t.options.length < 2) {
          err(file, tid, "select型なのにoptionsが2未満");
        } else {
          if (new Set(t.options).size !== t.options.length)
            err(file, tid, "options重複");
          if (!t.options.includes(t.correctAnswer))
            err(file, tid, `correctAnswerがoptionsに存在しない: ${t.correctAnswer}`);
        }
      }
      if (t.answerType === "multiselect") {
        if (!Array.isArray(t.options) || t.options.length < 2) {
          err(file, tid, "multiselect型なのにoptionsが2未満");
        } else if (!Array.isArray(t.correctAnswer) || t.correctAnswer.length === 0) {
          err(file, tid, "multiselect型なのにcorrectAnswerが空配列/非配列");
        } else {
          for (const a of t.correctAnswer) {
            if (!t.options.includes(a))
              err(file, tid, `correctAnswerの要素がoptionsに存在しない: ${a}`);
          }
        }
      }
      if (t.answerType === "table") {
        const tc = t.tableConfig;
        if (!tc || !Array.isArray(tc.columns) || !Array.isArray(tc.rows) || !Array.isArray(tc.cells)) {
          err(file, tid, "table型なのにtableConfigが不完全");
        } else if (tc.cells.length === 0) {
          err(file, tid, "tableConfig.cellsが空");
        } else {
          const seenCells = new Set();
          for (const c of tc.cells) {
            if (!tc.rows.includes(c.rowLabel))
              err(file, tid, `cellのrowLabelがrowsに存在しない: ${c.rowLabel}`);
            if (!tc.columns.includes(c.colLabel))
              err(file, tid, `cellのcolLabelがcolumnsに存在しない: ${c.colLabel}`);
            if (c.correctValue === undefined || c.correctValue === null || c.correctValue === "")
              err(file, tid, `cellのcorrectValueが空: ${c.rowLabel}/${c.colLabel}`);
            const cellKey = `${c.rowLabel}__${c.colLabel}`;
            if (seenCells.has(cellKey)) err(file, tid, `cell座標重複: ${cellKey}`);
            seenCells.add(cellKey);
          }
        }
      }
      if (t.answerType === "research") {
        const normalized = normalizeCitation(t.correctAnswer ?? "");
        if (!/^\d+(-\d+)+$/.test(normalized))
          err(file, tid, `research型のcorrectAnswerがASC引用形式でない: ${t.correctAnswer}`);
      }

      // 疑念語句・ラベル参照
      const texts = [t.explanation ?? "", t.explanationJa ?? ""];
      for (const text of texts) {
        for (const { re, label } of SUSPICIOUS) {
          if (re.test(text)) err(file, tid, `疑念語句(${label}): ${text.slice(0, 60)}...`);
        }
        for (const { re, label } of LABEL_REF) {
          if (re.test(text)) err(file, tid, `ラベル参照(${label}): ${text.slice(0, 60)}...`);
        }
      }
    }
  }
}

console.log(`TBSチェック: ${targetDir} — ${files.length}ファイル / ${totalQuestions}問 / ${totalTasks}タスク`);
if (errors.length > 0) {
  console.error(`\n❌ ${errors.length}件のエラー:\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("✓ 全チェック通過");
