// ステージング中のTBS問題を、独立に書かれた検算スクリプトと突き合わせる。
//
// 目的: 数値の誤りをLLMのレビューではなく機械的に落とす。作問エージェントには
//   ①scenario/exhibits → ②検算スクリプト → ③問題JSON の順で書かせること。
//   ②を①だけを見て書かせることで、③のcorrectAnswerとは独立した2回目の計算になる。
//
// 配置:
//   src/data/tbs/far/_staging/<topic>.json           作問した問題（TBSQuestionの配列）
//   src/data/tbs/far/_staging/calc/<問題id>.calc.mjs  対応する検算スクリプト
//
// 検算スクリプトの形式:
//   export const tbsId = "far-tbs-lease-003";
//   export const expected = {
//     "task-1": 48000,                                    // number
//     "task-2": "Operating lease",                        // select
//     "task-3": ["Right-of-use asset", "Lease liability"], // multiselect
//     "task-4": { "Cash|Debit": 5000, "Cash|Credit": 0 },  // table（"行ラベル|列ラベル"）
//     "task-5": "842-20-30-1",                            // research
//   };
//   （expected は定数直書きでなく、Exhibitの数値からの計算式で書くこと）
//
// 使い方: node scripts/verify-tbs-calc.mjs [ステージングディレクトリ]
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { pathToFileURL } from "url";
import { normalizeCitation } from "./lib/tbs-validate.mjs";

const stagingDir = process.argv[2] ?? "src/data/tbs/far/_staging";
const calcDir = join(stagingDir, "calc");

if (!existsSync(stagingDir)) {
  console.log(`ステージングディレクトリがありません: ${stagingDir}`);
  process.exit(0);
}

const questionFiles = readdirSync(stagingDir).filter((f) =>
  f.endsWith(".json"),
);
if (questionFiles.length === 0) {
  console.log("ステージング中の問題がありません。");
  process.exit(0);
}

const problems = [];
const usedCalcFiles = new Set();
let checkedTasks = 0;
let checkedQuestions = 0;

function fail(id, message) {
  problems.push(`${id} ${message}`);
}

// 数値比較（許容誤差つき）
function numberMatches(actual, expectedValue, tolerance) {
  if (typeof actual !== "number" || typeof expectedValue !== "number")
    return false;
  return Math.abs(actual - expectedValue) <= (tolerance ?? 0);
}

for (const file of questionFiles) {
  let questions;
  try {
    questions = JSON.parse(readFileSync(join(stagingDir, file), "utf8"));
  } catch (e) {
    fail(`[${file}]`, `JSONパースエラー: ${e.message}`);
    continue;
  }
  if (!Array.isArray(questions)) {
    fail(`[${file}]`, "トップレベルが配列ではない");
    continue;
  }

  for (const q of questions) {
    checkedQuestions++;
    const calcPath = join(calcDir, `${q.id}.calc.mjs`);
    if (!existsSync(calcPath)) {
      fail(`[${q.id}]`, `検算スクリプトが無い: ${calcPath}`);
      continue;
    }
    usedCalcFiles.add(`${q.id}.calc.mjs`);

    let mod;
    try {
      mod = await import(pathToFileURL(resolve(calcPath)).href);
    } catch (e) {
      fail(`[${q.id}]`, `検算スクリプトの読み込み失敗: ${e.message}`);
      continue;
    }
    if (mod.tbsId !== q.id) {
      fail(`[${q.id}]`, `検算スクリプトのtbsIdが一致しない: ${mod.tbsId}`);
      continue;
    }
    const expected = mod.expected;
    if (!expected || typeof expected !== "object") {
      fail(`[${q.id}]`, "検算スクリプトが expected をexportしていない");
      continue;
    }

    const taskIds = new Set(q.tasks.map((t) => t.id));
    for (const key of Object.keys(expected)) {
      if (!taskIds.has(key))
        fail(`[${q.id}]`, `expectedに存在しないtask idがある: ${key}`);
    }

    for (const t of q.tasks) {
      const tid = `[${q.id}/${t.id}]`;
      if (!(t.id in expected)) {
        fail(
          tid,
          "検算スクリプトに該当タスクのexpectedが無い（全タスク検算すること）",
        );
        continue;
      }
      checkedTasks++;
      const exp = expected[t.id];

      if (t.answerType === "number") {
        if (!numberMatches(t.correctAnswer, exp, t.tolerance)) {
          fail(
            tid,
            `数値不一致: JSON=${t.correctAnswer} / 検算=${exp}（tolerance=${t.tolerance ?? 0}）`,
          );
        }
      } else if (t.answerType === "select") {
        if (t.correctAnswer !== exp)
          fail(tid, `select不一致: JSON="${t.correctAnswer}" / 検算="${exp}"`);
      } else if (t.answerType === "multiselect") {
        const a = new Set(
          Array.isArray(t.correctAnswer) ? t.correctAnswer : [],
        );
        const b = new Set(Array.isArray(exp) ? exp : []);
        const same = a.size === b.size && [...a].every((v) => b.has(v));
        if (!same)
          fail(
            tid,
            `multiselect不一致: JSON=${JSON.stringify([...a])} / 検算=${JSON.stringify([...b])}`,
          );
      } else if (t.answerType === "research") {
        if (normalizeCitation(t.correctAnswer) !== normalizeCitation(exp))
          fail(
            tid,
            `research不一致: JSON="${t.correctAnswer}" / 検算="${exp}"`,
          );
      } else if (t.answerType === "table") {
        if (!exp || typeof exp !== "object" || Array.isArray(exp)) {
          fail(
            tid,
            'table型のexpectedは {"行ラベル|列ラベル": 値} 形式にすること',
          );
          continue;
        }
        const cells = t.tableConfig?.cells ?? [];
        const seen = new Set();
        for (const c of cells) {
          const key = `${c.rowLabel}|${c.colLabel}`;
          seen.add(key);
          if (!(key in exp)) {
            fail(tid, `検算にセルが無い: ${key}`);
            continue;
          }
          const e = exp[key];
          const ok =
            typeof c.correctValue === "number"
              ? numberMatches(c.correctValue, e, c.tolerance ?? t.tolerance)
              : String(c.correctValue) === String(e);
          if (!ok)
            fail(tid, `セル不一致 ${key}: JSON=${c.correctValue} / 検算=${e}`);
        }
        for (const key of Object.keys(exp)) {
          if (!seen.has(key)) fail(tid, `検算にJSONに無いセルがある: ${key}`);
        }
      }
    }
  }
}

// 対応する問題が無い検算スクリプト（消し忘れ・id typo の検出）
if (existsSync(calcDir)) {
  for (const f of readdirSync(calcDir).filter((f) => f.endsWith(".calc.mjs"))) {
    if (!usedCalcFiles.has(f)) fail(`[${f}]`, "対応するステージング問題が無い");
  }
}

console.log(
  `TBS検算: ${stagingDir} — ${checkedQuestions}問 / ${checkedTasks}タスクを突き合わせ`,
);
if (problems.length > 0) {
  console.error(`\n❌ ${problems.length}件の不一致:\n`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    "\n※ JSONと検算のどちらが正しいかを手計算で確定してから直すこと。",
  );
  process.exit(1);
}
console.log("✓ 全タスクが検算と一致");
