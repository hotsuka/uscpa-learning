// TBS問題データの整合性チェック
// 使い方:
//   node scripts/check-tbs.mjs [対象ディレクトリ]   （省略時 src/data/tbs/far）
//   node scripts/check-tbs.mjs --strict             警告もエラー扱い（新規作問の検証用）
//   node scripts/check-tbs.mjs --list-ids           既存ID・topic一覧を出力（作問時の衝突回避用）
//
// 検証ロジックは scripts/lib/tbs-validate.mjs に集約されている。
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { validateQuestion } from "./lib/tbs-validate.mjs";

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const listIds = args.includes("--list-ids");
const targetDir = args.find((a) => !a.startsWith("--")) ?? "src/data/tbs/far";

const files = readdirSync(targetDir).filter(
  (f) => f.endsWith(".json") && !f.includes(".bak"),
);

// --list-ids: 作問エージェントに渡すための既存ID一覧（本文は読ませずに衝突だけ避ける）
if (listIds) {
  const rows = [];
  for (const file of files) {
    const questions = JSON.parse(readFileSync(join(targetDir, file), "utf8"));
    for (const q of questions) {
      rows.push({ file, id: q.id, topic: q.topic });
    }
  }
  rows.sort((a, b) => a.id.localeCompare(b.id));
  console.log(
    `# 既存TBS問題 ${rows.length}件（${targetDir}）— 新規IDはこれらと衝突させないこと`,
  );
  for (const r of rows) console.log(`${r.id}\t${r.topic}\t${r.file}`);
  process.exit(0);
}

const errors = [];
const warnings = [];
const seenIds = new Set();
let totalQuestions = 0;
let totalTasks = 0;

for (const file of files) {
  let questions;
  try {
    questions = JSON.parse(readFileSync(join(targetDir, file), "utf8"));
  } catch (e) {
    errors.push(`${file} [-] JSONパースエラー: ${e.message}`);
    continue;
  }
  if (!Array.isArray(questions)) {
    errors.push(`${file} [-] トップレベルが配列ではない`);
    continue;
  }

  for (const q of questions) {
    totalQuestions++;
    totalTasks += Array.isArray(q.tasks) ? q.tasks.length : 0;
    const res = validateQuestion(q, { seenIds });
    for (const e of res.errors) errors.push(`${file} [${e.id}] ${e.message}`);
    for (const w of res.warnings)
      warnings.push({
        advisory: w.advisory,
        text: `${file} [${w.id}] ${w.message}`,
      });
  }
}

console.log(
  `TBSチェック: ${targetDir} — ${files.length}ファイル / ${totalQuestions}問 / ${totalTasks}タスク${strict ? " (strict)" : ""}`,
);

const guideline = warnings.filter((w) => !w.advisory);
const advisories = warnings.filter((w) => w.advisory);

if (guideline.length > 0) {
  const head = strict ? "❌" : "⚠";
  console.error(`\n${head} ${guideline.length}件の警告（構成ガイドライン）:\n`);
  for (const w of guideline) console.error(`  - ${w.text}`);
}

// 機械では正否を判定できない指摘。--strict でも失敗させず、人間/QCの確認に回す
if (advisories.length > 0) {
  console.error(`\nℹ ${advisories.length}件の要確認（自動判定不可）:\n`);
  for (const w of advisories) console.error(`  - ${w.text}`);
}

if (errors.length > 0) {
  console.error(`\n❌ ${errors.length}件のエラー:\n`);
  for (const e of errors) console.error(`  - ${e}`);
}

if (errors.length > 0 || (strict && guideline.length > 0)) process.exit(1);
console.log(
  warnings.length > 0
    ? "\n✓ エラーなし（上記の警告・要確認は目視すること）"
    : "✓ 全チェック通過",
);
