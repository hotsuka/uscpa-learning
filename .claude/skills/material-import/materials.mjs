#!/usr/bin/env node
// 教材PDFの棚卸しと取り込み。
//
//   node materials.mjs scan  --subject BAR [--src ~/Downloads]
//   node materials.mjs apply --subject BAR --plan scripts/_work/import-plan.json [--apply]
//
// 設計: 単元の読み取り(判断)はClaudeがやる。ここでやるのは
// 命名規則の検査・重複判定・件数の突合だけ。手で数えないための道具。

import { readdirSync, existsSync, copyFileSync, readFileSync, statSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";

const REF_DIR = "reference";
// コア3科目 + Discipline3科目。BEC は旧制度で、履歴として残っているだけ
const SUBJECTS = ["FAR", "AUD", "REG", "BAR", "ISC", "TCP"];
const LEGACY_SUBJECTS = ["BEC"];
const KINDS = ["テキスト", "演習問題"];
// 演習問題の番号。M=モジュール別編成 / CH=チャプター別編成 で別体系（統合しない）
const NUM_RE = /^(M|CH)\d+$/;

function expand(p) {
  return p.startsWith("~") ? join(homedir(), p.slice(1)) : p;
}

function argOf(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : fallback;
}

/** reference/ の命名規則に従っているかを解析する。従っていなければ null。 */
function parseName(fn) {
  if (!fn.toLowerCase().endsWith(".pdf")) return null;
  let stem = fn.slice(0, -4);
  let withAnswers = false;
  if (stem.endsWith("_回答あり")) {
    withAnswers = true;
    stem = stem.slice(0, -"_回答あり".length);
  }
  const parts = stem.split("_");
  if (parts.length < 3) return null;
  const subject = parts[0];
  if (![...SUBJECTS, ...LEGACY_SUBJECTS].includes(subject)) return null;

  let num = null;
  let rest = parts.slice(1);
  if (rest.length >= 3 && NUM_RE.test(rest[rest.length - 1])) {
    num = rest.pop();
  }
  const kind = rest.pop();
  if (!KINDS.includes(kind)) return null;
  const topic = rest.join("_");
  if (!topic) return null;
  // 単元名にアンダースコアは使わない規約（区切りと区別がつかなくなるため）
  if (rest.length !== 1) return null;
  if (num && kind !== "演習問題") return null;
  return { subject, topic, kind, num, withAnswers };
}

/** ソース側の雑多なファイル名から、科目コードだけを拾う。単元は判定しない。 */
function guessSubject(fn) {
  for (const s of [...SUBJECTS, ...LEGACY_SUBJECTS]) {
    if (new RegExp(`(^|[^A-Z])${s}([^A-Z]|$)`).test(fn)) return s;
  }
  return null;
}

function listPdfs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .filter((f) => statSync(join(dir, f)).isFile())
    .sort();
}

function tally(rows, key) {
  const m = new Map();
  for (const r of rows) m.set(r[key], (m.get(r[key]) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// ---------------------------------------------------------------- scan

function scan() {
  const subject = argOf("--subject");
  const src = expand(argOf("--src", "~/Downloads"));
  if (!subject) die("--subject が必要です（例: --subject BAR）");
  if (!SUBJECTS.includes(subject)) die(`--subject は ${SUBJECTS.join(" / ")} のいずれか`);

  const ref = listPdfs(REF_DIR).map((f) => ({ file: f, ...(parseName(f) || {}) }));
  const bad = ref.filter((r) => !r.subject);
  console.log(`== 取り込み先 ${REF_DIR}/ : ${ref.length}本 ==`);
  for (const [s, n] of tally(ref.filter((r) => r.subject), "subject")) {
    const legacy = LEGACY_SUBJECTS.includes(s) ? "  ← 旧制度（新規追加しない）" : "";
    console.log(`  ${s.padEnd(5)} ${String(n).padStart(3)}本${legacy}`);
  }
  for (const [k, n] of tally(ref.filter((r) => r.kind), "kind")) {
    console.log(`  ${k.padEnd(6)} ${String(n).padStart(3)}本`);
  }
  console.log(`  うち回答あり ${ref.filter((r) => r.withAnswers).length}本（無印版とは別ファイル）`);
  if (bad.length) {
    console.log(`\n  [要確認] 命名規則に合わない ${bad.length}本:`);
    bad.forEach((r) => console.log(`    ${r.file}`));
  }

  const already = new Set(ref.map((r) => r.file));
  const srcFiles = listPdfs(src);
  const rows = srcFiles.map((f) => {
    const parsed = parseName(f);
    return {
      file: f,
      subject: parsed ? parsed.subject : guessSubject(f),
      normalized: !!parsed,
      exists: already.has(f),
    };
  });

  const target = rows.filter((r) => r.subject === subject);
  const fresh = target.filter((r) => !r.exists);
  const dup = target.filter((r) => r.exists);
  const other = rows.filter((r) => r.subject && r.subject !== subject);
  const unknown = rows.filter((r) => !r.subject);

  console.log(`\n== ソース ${src} : ${rows.length}本 ==`);
  console.log(`渡されたPDF: ${rows.length}本`);
  console.log(`  ├ 対象（${subject}）        : ${target.length}本`);
  console.log(`  │   ├ 新規                 : ${fresh.length}本  ← 実際に増えるのはこれ`);
  console.log(`  │   └ 既に ${REF_DIR}/ にある : ${dup.length}本`);
  console.log(`  └ 対象外                   : ${other.length + unknown.length}本`);
  for (const [s, n] of tally(other, "subject")) {
    console.log(`      ├ ${s}（今回対象外）           : ${String(n).padStart(2)}本`);
  }
  console.log(`      └ 科目コードが読めない        : ${String(unknown.length).padStart(2)}本`);

  // 件数だけだと取りこぼしと区別がつかないので、対象外は必ず名前を出す
  if (other.length) {
    console.log(`\n[対象外: 別科目]`);
    other.forEach((r) => console.log(`  ${r.subject}  ${r.file}`));
  }
  if (unknown.length) {
    console.log(`\n[対象外: 科目コードが読めない] ここはClaudeが中身から判断する`);
    unknown.forEach((r) => console.log(`  ${r.file}`));
  }
  if (dup.length) {
    console.log(`\n[既に取り込み済み]`);
    dup.forEach((r) => console.log(`  ${r.file}`));
  }
  console.log(`\n次: 計画JSONを書いて apply --plan で検証する（この時点では何もコピーしていない）`);
}

// ---------------------------------------------------------------- apply

function apply() {
  const subject = argOf("--subject");
  const planPath = argOf("--plan");
  const src = expand(argOf("--src", "~/Downloads"));
  const doApply = process.argv.includes("--apply");
  if (!subject || !planPath) die("--subject と --plan が必要です");

  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  if (plan.subject && plan.subject !== subject) {
    die(`計画の subject(${plan.subject}) と --subject(${subject}) が食い違っています`);
  }
  const items = plan.items || [];
  const srcFiles = new Set(listPdfs(src));
  const already = new Set(listPdfs(REF_DIR));
  const errors = [];
  const seen = new Map();
  const todo = [];
  const skipped = [];

  for (const it of items) {
    if (!it.src) {
      errors.push(`src の無い項目があります: ${JSON.stringify(it)}`);
      continue;
    }
    if (!srcFiles.has(it.src)) {
      errors.push(`ソースに存在しません: ${it.src}`);
      continue;
    }
    if (it.skip) {
      skipped.push(it);
      continue;
    }
    if (!it.dest) {
      errors.push(`dest も skip もありません: ${it.src}`);
      continue;
    }
    const parsed = parseName(it.dest);
    if (!parsed) {
      errors.push(`命名規則に合いません: ${it.dest}`);
      continue;
    }
    if (parsed.subject !== subject) {
      errors.push(`科目が違います（${parsed.subject}）: ${it.dest}`);
      continue;
    }
    if (already.has(it.dest)) {
      errors.push(`${REF_DIR}/ に既にあります（上書きしません）: ${it.dest}`);
      continue;
    }
    if (seen.has(it.dest)) {
      errors.push(`計画内で dest が重複: ${it.dest}（${seen.get(it.dest)} と ${it.src}）`);
      continue;
    }
    seen.set(it.dest, it.src);
    todo.push(it);
  }

  // 計画に載っていないソースは「書き忘れ」と「意図的な除外」を区別できないので落とす
  const planned = new Set(items.map((i) => i.src));
  const missing = [...srcFiles].filter((f) => !planned.has(f));
  if (missing.length) {
    errors.push(`計画に載っていないソースが ${missing.length}本あります（skip を明記してください）:`);
    missing.forEach((f) => errors.push(`    ${f}`));
  }

  if (errors.length) {
    console.log(`[NG] ${errors.length}件の問題があります。何もコピーしていません。\n`);
    errors.forEach((e) => console.log(`  ${e}`));
    process.exit(1);
  }

  console.log(`== 検証OK ==`);
  console.log(`  計画  : ${items.length}本`);
  console.log(`  コピー: ${todo.length}本`);
  console.log(`  除外  : ${skipped.length}本`);
  for (const [reason, n] of tally(skipped.map((s) => ({ r: s.skip })), "r")) {
    console.log(`      ${reason}: ${n}本`);
  }

  if (!doApply) {
    console.log(`\n--dry-run（既定）のため書き込んでいません。実行するには --apply を付けてください。`);
    return;
  }

  let n = 0;
  for (const it of todo) {
    copyFileSync(join(src, it.src), join(REF_DIR, it.dest));
    n++;
  }
  const after = listPdfs(REF_DIR).length;
  console.log(`\n== 突合 ==`);
  console.log(`  コピー予定 ${todo.length}本 / 実際にコピー ${n}本 ${n === todo.length ? "✓ 一致" : "✗ 不一致"}`);
  console.log(`  ${REF_DIR}/ : ${already.size}本 → ${after}本（+${after - already.size}）`);
  if (n !== todo.length || after - already.size !== todo.length) {
    console.log(`  [要確認] 予定と実績が合いません。原因を確認してください。`);
    process.exit(1);
  }
  console.log(`  ソースは残しています（移動ではなくコピー）`);
}

function die(msg) {
  console.error(`エラー: ${msg}`);
  process.exit(1);
}

const cmd = process.argv[2];
if (cmd === "scan") scan();
else if (cmd === "apply") apply();
else {
  console.log("使い方:");
  console.log("  node materials.mjs scan  --subject BAR [--src ~/Downloads]");
  console.log("  node materials.mjs apply --subject BAR --plan <plan.json> [--apply]");
  process.exit(1);
}
