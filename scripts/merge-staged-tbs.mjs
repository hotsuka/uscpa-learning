#!/usr/bin/env node
// ステージング(_staging/<topic>.json)で検証を通ったTBS問題を本ファイルへ安全に追記する。
//   - マージ前に本ファイルを .bak-tbs-<timestamp> でバックアップ（既存データ保護）
//   - 各問を厳格検証（scripts/lib/tbs-validate.mjs のerrors + warnings両方）してから append
//   - 検算スクリプト(_staging/calc/<id>.calc.mjs)の存在も必須にして検算工程の飛ばしを防ぐ
//   - 1問でも不正ならそのトピックはマージせずスキップ（部分マージしない）
//   - 既存問題のテキストは一切再整形しない（配列末尾へのテキスト挿入のみ）
//
// 使い方:
//   node scripts/merge-staged-tbs.mjs                # _staging 配下の全 json をマージ
//   node scripts/merge-staged-tbs.mjs leases equity  # 指定トピックのみ
//
// 非破壊・追記のみ。マージ後は対象ファイルに prettier をかけること。
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  copyFileSync,
} from "fs";
import { join } from "path";
import { validateQuestion } from "./lib/tbs-validate.mjs";

const TBS_DIR = "src/data/tbs/far";
const STAGING_DIR = join(TBS_DIR, "_staging");
const CALC_DIR = join(STAGING_DIR, "calc");

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// 既存ファイル全体のID（トピックをまたいだ衝突も防ぐ）
function collectExistingIds() {
  const ids = new Set();
  if (!existsSync(TBS_DIR)) return ids;
  for (const f of readdirSync(TBS_DIR).filter(
    (f) => f.endsWith(".json") && !f.includes(".bak"),
  )) {
    try {
      for (const q of JSON.parse(readFileSync(join(TBS_DIR, f), "utf8")))
        ids.add(q.id);
    } catch {
      // パースできないファイルはcheck-tbs.mjs側で報告される
    }
  }
  return ids;
}

// 既存ファイルの整形（prettier 2スペース）に合わせて1問をシリアライズする
function serializeQuestion(q) {
  return JSON.stringify(q, null, 2)
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

const argTopics = process.argv.slice(2);
const stagingFiles = argTopics.length
  ? argTopics.map((t) => `${t}.json`)
  : existsSync(STAGING_DIR)
    ? readdirSync(STAGING_DIR).filter((f) => f.endsWith(".json"))
    : [];

if (!stagingFiles.length) {
  console.log("ステージングファイルがありません。");
  process.exit(0);
}

const existingIds = collectExistingIds();
const seenIds = new Set();
const ts = timestamp();
const summary = [];
const createdFiles = [];
let totalAdded = 0;
let hadError = false;

for (const file of stagingFiles) {
  const topic = file.replace(/\.json$/, "");
  const stagePath = join(STAGING_DIR, file);
  const realPath = join(TBS_DIR, file);

  if (!existsSync(stagePath)) {
    console.error(`✗ ${topic}: ステージング無し (${stagePath})`);
    hadError = true;
    continue;
  }

  let staged;
  try {
    staged = JSON.parse(readFileSync(stagePath, "utf8"));
  } catch (e) {
    console.error(`✗ ${topic}: ステージングJSONパースエラー: ${e.message}`);
    hadError = true;
    continue;
  }
  if (!Array.isArray(staged) || staged.length === 0) {
    console.error(`✗ ${topic}: ステージングが空配列/非配列`);
    hadError = true;
    continue;
  }

  // 検証（警告もエラー扱い＝新規作問はガイドライン準拠を必須にする）
  const issues = [];
  for (const q of staged) {
    const { errors, warnings } = validateQuestion(q, { seenIds, existingIds });
    for (const e of errors) issues.push(`  [${e.id}] ${e.message}`);
    for (const w of warnings) issues.push(`  [${w.id}] (警告) ${w.message}`);
    if (!existsSync(join(CALC_DIR, `${q.id}.calc.mjs`)))
      issues.push(
        `  [${q.id}] 検算スクリプトが無い — node scripts/verify-tbs-calc.mjs を先に通すこと`,
      );
  }
  if (issues.length) {
    console.error(`✗ ${topic}: ${issues.length}件の不正 — マージ中止`);
    console.error(issues.join("\n"));
    hadError = true;
    continue;
  }

  const block = staged.map(serializeQuestion).join(",\n");

  if (!existsSync(realPath)) {
    // 新規トピック: ファイルごと作成する（index.tsへの登録は手動）
    writeFileSync(realPath, `[\n${block}\n]\n`, "utf8");
    createdFiles.push(file);
    summary.push(`✓ ${topic}: 新規ファイル作成 +${staged.length}問`);
    totalAdded += staged.length;
    continue;
  }

  const realText = readFileSync(realPath, "utf8");
  const closeIdx = realText.lastIndexOf("\n]");
  if (closeIdx < 0) {
    console.error(
      `✗ ${topic}: 配列終端("\\n]")を特定できず — 手動で確認すること`,
    );
    hadError = true;
    continue;
  }
  const before = realText.slice(0, closeIdx);
  const after = realText.slice(closeIdx);
  const existingCount = JSON.parse(realText).length;

  copyFileSync(realPath, `${realPath}.bak-tbs-${ts}`);
  writeFileSync(realPath, `${before},\n${block}${after}`, "utf8");

  totalAdded += staged.length;
  summary.push(
    `✓ ${topic}: +${staged.length}問 (${existingCount}→${existingCount + staged.length})`,
  );
}

console.log("\n=== TBSマージ結果 ===");
summary.forEach((s) => console.log(s));
console.log(`合計 +${totalAdded}問`);
if (createdFiles.length) {
  console.log(
    "\n※ 新規ファイルは src/data/tbs/far/index.ts への import 追加が必要:",
  );
  createdFiles.forEach((f) => console.log(`   - ${f}`));
}
console.log(
  "※ マージ後は `npx prettier --write src/data/tbs/far/*.json` で整形を統一し、",
);
console.log(
  "   `node scripts/check-tbs.mjs` を再実行してから _staging を削除すること。",
);
if (hadError) {
  console.error("\n一部トピックでエラー。修正して再実行してください。");
  process.exit(1);
}
