#!/usr/bin/env node
// ステージング(_staging/<section>.json)で承認された新規問題を本ファイルへ安全にマージする。
//   - マージ前に本ファイルを .bak-far-bulk-<timestamp> でバックアップ（既存データ保護）
//   - 各問を厳格検証（必須フィールド/ラベル整合/選択肢相異/ID衝突/疑念語句）してから append
//   - 1問でも不正なら そのセクションはマージせずスキップしてエラー報告（部分マージしない）
//   - 既存問題のテキストは一切再整形しない（テキスト保持追記）。新規問題のみを
//     questions 配列の末尾に挿入し、version を minor 更新。整形は後段の prettier に委ねる。
//
// 使い方:
//   node scripts/merge-staged-questions.mjs                 # _staging 配下の全 json をマージ
//   node scripts/merge-staged-questions.mjs leases inventory # 指定セクションのみ
//
// 非破壊・追記のみ。既存問題は一切変更しない。マージ後は対象ファイルに prettier をかけること。

import { readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync } from "fs";
import { join } from "path";

const FAR_DIR = "src/data/questions/far";
const STAGING_DIR = join(FAR_DIR, "_staging");

const PREFIX = {
  "accounting-changes": "chg", "cash-equivalents": "cce", "cash-flows": "cf",
  "consolidations": "con", "credit-loss-cecl": "cecl", "derivatives-hedging": "deriv",
  "equity": "eq", "foreign-currency-eps": "fx", "government-accounting": "gov",
  "income-taxes": "tax", "inventory": "inv", "investments": "inv-i", "leases": "lease",
  "liabilities": "liab", "nonprofit-accounting": "nfp", "partnerships": "part",
  "pensions": "pen", "ppe-intangibles": "ppe", "receivables": "rec",
  "revenue-recognition": "rev", "stock-compensation": "sc",
};

const VALID_DIFF = new Set(["basic", "intermediate", "advanced"]);
const SUSPICIOUS = [
  /wait[,\s—]+let me/i, /hmm[,.]?\s/i, /not among the choices/i,
  /let me re.?calculat/i, /let me reconsider/i, /let me re.?read/i,
  /let me recheck/i, /but i wrote/i, /closest answer is/i, /doesn.t match|do not match/i,
];

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function bumpMinor(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version || "1.4.0");
  return m ? `${m[1]}.${Number(m[2]) + 1}.0` : "1.5.0";
}

function validateQuestion(q, prefix, seenIds, existingIds) {
  const errs = [];
  const id = q.id;
  if (typeof id !== "string" || !id) errs.push("id 欠落");
  else {
    if (!new RegExp(`^${prefix}-\\d{3}$`).test(id)) errs.push(`id 形式不正(${id}) 期待:${prefix}-NNN`);
    if (existingIds.has(id)) errs.push(`id 既存と衝突(${id})`);
    if (seenIds.has(id)) errs.push(`id ステージング内重複(${id})`);
  }
  for (const f of ["topic", "subtopic", "stem", "explanation", "explanationJa", "source"])
    if (typeof q[f] !== "string" || !q[f].trim()) errs.push(`${f} 欠落/空`);
  if (!Array.isArray(q.references) || q.references.length === 0) errs.push("references が空/非配列");
  if (!VALID_DIFF.has(q.difficulty)) errs.push(`difficulty 不正(${q.difficulty})`);
  if (!Array.isArray(q.choices) || q.choices.length !== 4) {
    errs.push(`choices は4件必要(${q.choices?.length})`);
  } else {
    const labels = q.choices.map((c) => c.label);
    if (JSON.stringify(labels) !== JSON.stringify(["A", "B", "C", "D"]))
      errs.push(`choices ラベルは A/B/C/D 順(${labels.join("")})`);
    const texts = q.choices.map((c) => (c.text ?? "").trim());
    if (texts.some((t) => !t)) errs.push("choices に空テキスト");
    if (new Set(texts).size !== texts.length) errs.push("choices テキスト重複");
  }
  if (!["A", "B", "C", "D"].includes(q.correctAnswer)) errs.push(`correctAnswer 不正(${q.correctAnswer})`);
  const exp = (q.explanation ?? "") + " " + (q.explanationJa ?? "");
  if (SUSPICIOUS.some((re) => re.test(exp))) errs.push("解説に疑念語句");
  return errs;
}

// 新規問題1件をプロジェクト標準（選択肢/参照は inline、後段 prettier が行幅で自動展開）に
// 合わせて 4スペース基準でシリアライズする。
const I4 = "    ", I6 = "      ", I8 = "        ";
const esc = (s) => JSON.stringify(s ?? "");
function serializeQuestion(q) {
  const choices = q.choices
    .map((c) => `${I8}{ "label": ${esc(c.label)}, "text": ${esc(c.text)} }`)
    .join(",\n");
  const refs = "[" + q.references.map(esc).join(", ") + "]";
  return [
    `${I4}{`,
    `${I6}"id": ${esc(q.id)},`,
    `${I6}"topic": ${esc(q.topic)},`,
    `${I6}"subtopic": ${esc(q.subtopic)},`,
    `${I6}"stem": ${esc(q.stem)},`,
    `${I6}"choices": [`,
    choices,
    `${I6}],`,
    `${I6}"correctAnswer": ${esc(q.correctAnswer)},`,
    `${I6}"explanation": ${esc(q.explanation)},`,
    `${I6}"explanationJa": ${esc(q.explanationJa)},`,
    `${I6}"references": ${refs},`,
    `${I6}"difficulty": ${esc(q.difficulty)},`,
    `${I6}"source": ${esc(q.source)}`,
    `${I4}}`,
  ].join("\n");
}

function loadStaged(path) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(raw) ? raw : raw.questions ?? [];
}

const argSections = process.argv.slice(2);
const stagingFiles = argSections.length
  ? argSections.map((s) => `${s}.json`)
  : existsSync(STAGING_DIR) ? readdirSync(STAGING_DIR).filter((f) => f.endsWith(".json")) : [];

if (!stagingFiles.length) { console.log("ステージングファイルがありません。"); process.exit(0); }

const ts = timestamp();
let totalAdded = 0, hadError = false;
const summary = [];

for (const file of stagingFiles) {
  const section = file.replace(/\.json$/, "");
  const prefix = PREFIX[section];
  const stagePath = join(STAGING_DIR, file);
  const realPath = join(FAR_DIR, file);

  if (!prefix) { console.error(`✗ ${section}: 未知のセクション`); hadError = true; continue; }
  if (!existsSync(stagePath)) { console.error(`✗ ${section}: ステージング無し`); hadError = true; continue; }
  if (!existsSync(realPath)) { console.error(`✗ ${section}: 本ファイル無し`); hadError = true; continue; }

  const staged = loadStaged(stagePath);
  const realText = readFileSync(realPath, "utf8");
  const real = JSON.parse(realText);
  const existingIds = new Set(real.questions.map((q) => q.id));
  const seenIds = new Set();

  const allErrs = [];
  for (const q of staged) {
    const errs = validateQuestion(q, prefix, seenIds, existingIds);
    if (q.id) seenIds.add(q.id);
    if (errs.length) allErrs.push(`  [${q.id ?? "?"}] ${errs.join(" / ")}`);
  }
  if (allErrs.length) {
    console.error(`✗ ${section}: ${allErrs.length} 件の不正 — マージ中止`);
    console.error(allErrs.join("\n"));
    hadError = true; continue;
  }

  // version をテキスト置換（既存整形を保持）
  const oldVer = real.version;
  const verFind = `"version": ${JSON.stringify(oldVer)}`;
  if (realText.split(verFind).length - 1 !== 1) {
    console.error(`✗ ${section}: version 行を一意特定できず`); hadError = true; continue;
  }
  let out = realText.replace(verFind, `"version": ${JSON.stringify(bumpMinor(oldVer))}`);

  // questions 配列の閉じ括弧（2スペース "  ]"）の直前へ新規問題を挿入
  const closeIdx = out.lastIndexOf("\n  ]");
  if (closeIdx < 0) { console.error(`✗ ${section}: questions 配列終端を特定できず`); hadError = true; continue; }
  const head = out.slice(0, closeIdx);     // ... 最後の既存問題 "    }" で終わる
  const tail = out.slice(closeIdx);        // "\n  ]\n}\n"
  const block = staged.map(serializeQuestion).join(",\n");
  out = head + ",\n" + block + tail;

  copyFileSync(realPath, `${realPath}.bak-far-bulk-${ts}`);
  writeFileSync(realPath, out, "utf8");

  totalAdded += staged.length;
  summary.push(`✓ ${section}: +${staged.length}問 (${real.questions.length}→${real.questions.length + staged.length}) v${oldVer}→v${bumpMinor(oldVer)}`);
}

console.log("\n=== マージ結果 ===");
summary.forEach((s) => console.log(s));
console.log(`合計 +${totalAdded}問`);
console.log("※ マージ後は対象ファイルに `npx prettier --write` をかけて整形を統一してください。");
if (hadError) { console.error("\n一部セクションでエラー。修正して再実行してください。"); process.exit(1); }
