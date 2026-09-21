#!/usr/bin/env node
// 学習記録バックアップ（~/Downloads/uscpa-backup-*.json）の検査・集計・修正。
//
//   node scripts/study-log-audit.mjs audit  [--file <path>] [--prev <path>] [--dir ~/Downloads]
//   node scripts/study-log-audit.mjs report [--file <path>] [--prev <path>] [--weak-min 20]
//   node scripts/study-log-audit.mjs fix    --plan <plan.json> [--apply] [--out <path>]
//
// 設計: 内容の読み取り（この表記ゆれをどれに寄せるか／この重複を消してよいか）はClaudeとユーザがやる。
// ここでやるのは機械的検査だけ — 科目の突合・重複判定・件数の集計・世代間の差分。手で数えない。
//
// 正の語彙は2系統ある。どちらもリポジトリ側が正で、バックアップ側は従う。
//   A. 問題バンクの topic   : src/data/questions/{far,bar}/*.json
//   B. 手入力のサブテーマ   : src/types/index.ts の SUBJECT_SUBTOPICS
// BAR Area II/III は FAR の問題セットを参照しているため（src/data/questions/bar/barScope.ts）、
// 「FARの単元なのに科目がBAR」は正常。ここを潰すと 2026-09-15 の再発になる。

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { join, basename, dirname } from "path";
import { homedir } from "os";

const REPO_FAR_DIR = "src/data/questions/far";
const REPO_BAR_DIR = "src/data/questions/bar";
const BAR_SCOPE_FILE = join(REPO_BAR_DIR, "barScope.ts");
const TYPES_FILE = "src/types/index.ts";

const SUBJECTS = ["FAR", "AUD", "REG", "BAR"];
const BACKUP_RE = /^uscpa-backup-(\d{8})-(\d{4})\.json$/;

// 学習記録の subtopic に入るが問題セットではないラベル。表記ゆれ候補から除外する。
// 模試モード = /materials/questions/mock、TBS = useTBSTimerContext.ts の TBS_TIMER_SUBTOPIC。
const NON_TOPIC_LABELS = [
  "模試モード",
  "Module 9 Task-Based Simulation",
  "Recently Released Question",
];

// 内容一致の重複を「二重登録」とみなす createdAt の近接幅（分）。
// これより離れていれば、同じ日に同じ単元を2回やった正常なケースとして扱う。
const DUP_WINDOW_MINUTES = 10;

// ------------------------------------------------------------------ 共通

function expand(p) {
  return p.startsWith("~") ? join(homedir(), p.slice(1)) : p;
}

function argOf(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : fallback;
}

function die(msg) {
  console.error(`エラー: ${msg}`);
  process.exit(1);
}

/** 表記ゆれ比較用の正規化。大文字小文字・記号・空白の違いを落とす */
function normKey(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9぀-ヿ一-鿿]/g, "");
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 0..1 の類似度。1が完全一致 */
function similarity(a, b) {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

/** 全角を2桁として数えた表示幅。日本語混じりの表がずれないように使う */
function dispWidth(s) {
  let w = 0;
  for (const ch of String(s)) {
    w += /[　-ヿ一-鿿＀-｠—←-⇿]/.test(ch) ? 2 : 1;
  }
  return w;
}

function padEndDisp(s, n) {
  return String(s) + " ".repeat(Math.max(0, n - dispWidth(s)));
}

function padStartDisp(s, n) {
  return " ".repeat(Math.max(0, n - dispWidth(s))) + String(s);
}

function pct(n, d) {
  return d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "—";
}

function hours(min) {
  return (min / 60).toFixed(1);
}

function tally(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// ------------------------------------------------------- リポジトリ側の語彙

/**
 * 問題セット（far/bar の JSON）を読む。
 * 返り値: { setId, subject, topics: string[], questionIds: string[] } の配列
 */
function loadQuestionSets() {
  const sets = [];
  for (const [subject, dir] of [
    ["FAR", REPO_FAR_DIR],
    ["BAR", REPO_BAR_DIR],
  ]) {
    if (!existsSync(dir)) continue;
    // _sets.json のような作問用メタファイルは問題セットではないので除く
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_"))) {
      const raw = JSON.parse(readFileSync(join(dir, f), "utf8"));
      const questions = raw.questions ?? raw;
      const topics = new Set();
      if (raw.topic) topics.add(raw.topic);
      for (const q of questions) if (q.topic) topics.add(q.topic);
      sets.push({
        setId: raw.id ?? f.replace(/\.json$/, ""),
        subject,
        file: join(dir, f),
        topics: [...topics],
        questionIds: questions.map((q) => q.id),
      });
    }
  }
  return sets;
}

/**
 * BAR Area II/III が参照している FAR セットID。
 * barScope.ts の BAR_AREA_II_III_SOURCES から機械抽出する（手で写すと必ずずれる）。
 */
function loadBarAreaFarSetIds() {
  if (!existsSync(BAR_SCOPE_FILE)) return new Set();
  const src = readFileSync(BAR_SCOPE_FILE, "utf8");
  const start = src.indexOf("BAR_AREA_II_III_SOURCES");
  if (start < 0) return new Set();
  const end = src.indexOf("\n];", start);
  const block = src.slice(start, end < 0 ? undefined : end);
  const ids = new Set([...block.matchAll(/"(far-[a-z0-9-]+)"/g)].map((m) => m[1]));
  // 以前BAR画面に載せていて外したセット。当時BAR画面で解いた記録は正しい履歴なので許容する
  const retiredStart = src.indexOf("BAR_RETIRED_FAR_SET_IDS");
  if (retiredStart >= 0) {
    const retiredEnd = src.indexOf("\n];", retiredStart);
    const retiredBlock = src.slice(retiredStart, retiredEnd < 0 ? undefined : retiredEnd);
    for (const m of retiredBlock.matchAll(/setId:\s*"(far-[a-z0-9-]+)"/g)) ids.add(m[1]);
  }
  return ids;
}

/** src/types/index.ts の SUBJECT_SUBTOPICS（手入力ドロップダウンの選択肢）を読む */
function loadManualSubtopics() {
  const result = { FAR: [], AUD: [], REG: [], BAR: [] };
  if (!existsSync(TYPES_FILE)) return result;
  const src = readFileSync(TYPES_FILE, "utf8");
  const start = src.indexOf("SUBJECT_SUBTOPICS");
  if (start < 0) return result;
  const end = src.indexOf("\n};", start);
  const block = src.slice(start, end < 0 ? undefined : end);
  for (const m of block.matchAll(/(FAR|AUD|REG|BAR):\s*\[([\s\S]*?)\]/g)) {
    result[m[1]] = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  }
  return result;
}

/**
 * subtopic → 許される科目の対応表を作る。
 * - 問題セットの topic: そのセットの科目。FAR セットが BAR Area II/III に載っていれば BAR も可
 * - 手入力の選択肢    : その科目
 */
function buildVocabulary() {
  const sets = loadQuestionSets();
  const barAreaFarSetIds = loadBarAreaFarSetIds();
  const manual = loadManualSubtopics();

  /** normKey → { label, allowed:Set<subject>, sources:Set<string>, setIds:Set<string> } */
  const byKey = new Map();
  const put = (label, subject, source, setId) => {
    const k = normKey(label);
    if (!k) return;
    if (!byKey.has(k)) {
      byKey.set(k, {
        label,
        allowed: new Set(),
        sources: new Set(),
        setIds: new Set(),
      });
    }
    const e = byKey.get(k);
    e.allowed.add(subject);
    e.sources.add(source);
    if (setId) e.setIds.add(setId);
  };

  for (const s of sets) {
    for (const t of s.topics) {
      put(t, s.subject, "問題バンク", s.setId);
      // BAR Area II/III は FAR セットをコピーせず参照しているので、科目 BAR も正しい
      if (s.subject === "FAR" && barAreaFarSetIds.has(s.setId)) {
        put(t, "BAR", "BAR Area II/III", s.setId);
      }
    }
  }
  for (const subject of SUBJECTS) {
    for (const t of manual[subject] ?? []) put(t, subject, "手入力の選択肢", null);
  }

  // 問題ID接頭辞 → セット（時間窓突合で使う）
  const setByQuestionId = new Map();
  for (const s of sets) for (const qid of s.questionIds) setByQuestionId.set(qid, s);

  return { byKey, sets, barAreaFarSetIds, manual, setByQuestionId };
}

// --------------------------------------------------------- バックアップ読み込み

function listBackups(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => BACKUP_RE.test(f))
    .filter((f) => statSync(join(dir, f)).isFile())
    .sort()
    .map((f) => join(dir, f));
}

/** バックアップJSONを読み、localStorage文字列をほどいて返す */
function loadBackup(path) {
  const payload = JSON.parse(readFileSync(path, "utf8"));
  if (payload.schema !== "uscpa-backup") {
    die(`schema が uscpa-backup ではありません: ${path}`);
  }
  const data = payload.data ?? {};
  // data の各値はオブジェクトではなく JSON 文字列（localStorage のダンプ）
  const store = (key) => {
    const raw = data[key];
    if (typeof raw !== "string") return null;
    try {
      return JSON.parse(raw);
    } catch {
      die(`${key} の JSON をパースできません: ${path}`);
    }
  };
  const records = store("uscpa-records");
  const qbank = store("uscpa-question-bank");
  const tbs = store("uscpa-tbs-bank");
  const mocks = store("uscpa-mock-exams");
  const notes = store("uscpa-notes");
  return {
    path,
    file: basename(path),
    payload,
    exportedAt: payload.exportedAt ?? null,
    presentKeys: Object.keys(data),
    records: records?.state?.records ?? null,
    attempts: qbank?.state?.attempts ?? null,
    tbsAttempts: tbs?.state?.attempts ?? null,
    mockResults: mocks?.state?.results ?? null,
    notes: notes?.state?.notes ?? null,
  };
}

/**
 * --file / --prev の解決。未指定なら --dir（既定 ~/Downloads）の最新と、
 * その1つ前で「学習記録を含む」世代を選ぶ。
 * 学習記録がバックアップ対象に入ったのは 2026-09 中旬以降なので、
 * それ以前の世代を prev にすると差分が「全件新規」に化ける。
 */
function resolveFiles() {
  const dir = expand(argOf("--dir", "~/Downloads"));
  const all = listBackups(dir);
  const fileArg = argOf("--file");
  const prevArg = argOf("--prev");

  if (!fileArg && all.length === 0) die(`${dir} に uscpa-backup-*.json がありません`);
  const curPath = fileArg ? expand(fileArg) : all[all.length - 1];
  const cur = loadBackup(curPath);

  let prev = null;
  if (prevArg) {
    prev = loadBackup(expand(prevArg));
  } else {
    const idx = all.indexOf(curPath);
    const older = (idx >= 0 ? all.slice(0, idx) : all).reverse();
    for (const p of older) {
      const cand = loadBackup(p);
      if (cand.records) {
        prev = cand;
        break;
      }
    }
    // 学習記録を持つ前世代が無ければ、直前の世代を問題バンク比較用に使う
    if (!prev && older.length) prev = loadBackup(older[0]);
  }
  return { dir, cur, prev, all };
}

// ------------------------------------------------------------ 検査1: 科目

/** 記録が問題バンク由来か。ここが true のものだけ科目を機械判定できる */
function isFromBank(r) {
  return r.fromQuestionBank === true;
}

/**
 * 時間窓の演習履歴から科目の裏を取る。
 * subtopic のラベルに依存しない唯一の証拠なので、誤登録の判定根拠として添える。
 */
function windowEvidence(record, attempts, setByQuestionId) {
  if (!record.createdAt || !attempts) return null;
  const end = new Date(record.createdAt).getTime();
  if (Number.isNaN(end)) return null;
  const start = end - ((record.studyMinutes || 0) + 5) * 60_000;
  const hit = attempts.filter((a) => {
    const t = new Date(a.attemptedAt).getTime();
    return t >= start && t <= end + 60_000;
  });
  if (hit.length === 0) return null;
  const setIds = new Set();
  const subjects = new Set();
  for (const a of hit) {
    const s = setByQuestionId.get(a.questionId);
    if (s) {
      setIds.add(s.setId);
      subjects.add(s.subject);
    }
  }
  return { count: hit.length, setIds: [...setIds], subjects: [...subjects] };
}

function detectSubjectMismatch(cur, vocab) {
  const records = cur.records ?? [];
  const targets = records.filter(isFromBank);
  const findings = [];
  const unknownTopic = [];

  for (const r of targets) {
    const entry = vocab.byKey.get(normKey(r.subtopic));
    if (!entry) {
      unknownTopic.push(r);
      continue;
    }
    if (entry.allowed.has(r.subject)) continue;
    findings.push({
      record: r,
      canonical: entry.label,
      allowed: [...entry.allowed],
      setIds: [...entry.setIds],
      evidence: windowEvidence(r, cur.attempts, vocab.setByQuestionId),
    });
  }
  return { targets, findings, unknownTopic };
}

// ------------------------------------------------------------ 検査2: 重複

function contentKey(r) {
  return [
    r.recordType,
    r.subject,
    r.subtopic,
    r.studiedAt,
    r.studyMinutes,
    r.totalQuestions,
    r.correctAnswers,
    r.roundNumber,
  ].join("|");
}

/**
 * 重複を3段階で出す。段階を分けるのは、2026-09-13 の重複が
 * `id` 一致では1件も引っかからなかったため。
 *   強 id       : 同一レコードが二重に配列へ入っている（マージ事故）
 *   強 sessionId: 1タイマーセッション = 1レコードの前提が破れている（二重保存・二重同期）
 *   中 内容近接 : 内容が同じで createdAt が DUP_WINDOW_MINUTES 以内（二重送信の疑い）
 *   弱 内容遠隔 : 内容が同じだが作成時刻が離れている（同日に同じ単元を2回やった正常ケースが多い）
 */
function detectDuplicates(records) {
  const groupBy = (keyFn) => {
    const m = new Map();
    for (const r of records) {
      const k = keyFn(r);
      if (k === null || k === undefined || k === "") continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return [...m.entries()].filter(([, v]) => v.length > 1);
  };

  const byId = groupBy((r) => r.id);
  const bySession = groupBy((r) => (r.source === "timer" ? r.sessionId : null)).filter(
    ([, v]) => !byId.some(([, w]) => w[0].id === v[0].id),
  );

  const near = [];
  const far = [];
  for (const [key, group] of groupBy(contentKey)) {
    const sorted = [...group].sort((a, b) =>
      String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")),
    );
    // createdAt が DUP_WINDOW_MINUTES 以内のものをひとかたまり（クラスタ）にする
    const clusters = [[sorted[0]]];
    for (let i = 1; i < sorted.length; i++) {
      const gap =
        (new Date(sorted[i].createdAt).getTime() -
          new Date(sorted[i - 1].createdAt).getTime()) /
        60_000;
      if (Number.isFinite(gap) && Math.abs(gap) <= DUP_WINDOW_MINUTES) {
        clusters[clusters.length - 1].push(sorted[i]);
      } else {
        clusters.push([sorted[i]]);
      }
    }
    // 1クラスタ内に複数 = 二重送信の疑い（中）
    for (const c of clusters) if (c.length > 1) near.push([key, c]);
    // クラスタが複数 = 同じ内容を別の時刻に登録している（弱）
    if (clusters.length > 1) far.push([key, sorted]);
  }
  return { byId, bySession, near, far };
}

// -------------------------------------------------------- 検査3: 表記ゆれ

function detectVariants(records, vocab) {
  // normKey ごとに「実際に現れた綴り」を全部持つ。
  // 綴りが違えば集計は別行に割れるので、正規化して同じになるものも表記ゆれとして扱う
  const groups = new Map();
  for (const r of records) {
    const label = r.subtopic;
    if (label === null || label === undefined) continue;
    const k = normKey(label);
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, { key: k, forms: new Map(), n: 0, subjects: new Set() });
    const g = groups.get(k);
    g.n++;
    g.subjects.add(r.subject);
    g.forms.set(label, (g.forms.get(label) || 0) + 1);
  }

  const known = [];
  const unknown = [];
  const spellingSplits = [];

  for (const g of groups.values()) {
    const forms = [...g.forms.entries()].sort((a, b) => b[1] - a[1]);
    const subjects = [...g.subjects];
    // 記号・空白だけが違う綴りが複数 → 検出はできても集計は割れている
    if (forms.length > 1) {
      spellingSplits.push({ key: g.key, forms, n: g.n, subjects });
    }
    if (NON_TOPIC_LABELS.some((l) => normKey(l) === g.key)) continue;
    if (vocab.byKey.has(g.key)) {
      known.push({ label: forms[0][0], n: g.n, subjects });
      continue;
    }
    // 正の語彙の中から近いものを3つ出す。どれに寄せるかは人が決める
    const candidates = [...vocab.byKey.values()]
      .map((v) => ({
        label: v.label,
        allowed: [...v.allowed],
        score: similarity(g.key, normKey(v.label)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    unknown.push({ key: g.key, label: forms[0][0], forms, n: g.n, subjects, candidates });
  }
  unknown.sort((a, b) => b.n - a.n);
  spellingSplits.sort((a, b) => b.n - a.n);
  return { known, unknown, spellingSplits };
}

// ------------------------------------------------------------- 集計・差分

function aggregate(records) {
  const bySubject = new Map();
  const bySubtopic = new Map();
  for (const r of records) {
    const add = (m, key) => {
      if (!m.has(key)) {
        m.set(key, { key, minutes: 0, questions: 0, correct: 0, records: 0 });
      }
      const e = m.get(key);
      e.records++;
      e.minutes += r.studyMinutes || 0;
      e.questions += r.totalQuestions || 0;
      e.correct += r.correctAnswers || 0;
      return e;
    };
    add(bySubject, r.subject ?? "(未設定)");
    add(bySubtopic, `${r.subject ?? "(未設定)"} | ${r.subtopic ?? "(未設定)"}`);
  }
  return { bySubject, bySubtopic };
}

function diffRecords(cur, prev) {
  if (!cur.records) return null;
  if (!prev?.records) {
    return { comparable: false, prevFile: prev?.file ?? null };
  }
  const prevIds = new Set(prev.records.map((r) => r.id));
  const curIds = new Set(cur.records.map((r) => r.id));
  const added = cur.records.filter((r) => !prevIds.has(r.id));
  const removed = prev.records.filter((r) => !curIds.has(r.id));
  // 同じ id で中身が変わったもの（科目の付け替え・時間の修正など）
  const prevById = new Map(prev.records.map((r) => [r.id, r]));
  const changed = cur.records.filter((r) => {
    const p = prevById.get(r.id);
    return p && contentKey(p) !== contentKey(r);
  });
  return { comparable: true, prevFile: prev.file, added, removed, changed };
}

// ---------------------------------------------------------------- audit

function printHeader(cur, prev) {
  console.log(`== 対象ファイル ==`);
  console.log(`  今回: ${cur.file}  (exportedAt ${cur.exportedAt})`);
  console.log(`  前回: ${prev ? `${prev.file}  (exportedAt ${prev.exportedAt})` : "なし"}`);
  console.log(`  含まれるキー: ${cur.presentKeys.join(", ")}`);
  if (!cur.records) {
    console.log(`  [注意] uscpa-records を含みません。学習記録の検査はできません`);
  }
  console.log();
}

function audit() {
  const { cur, prev } = resolveFiles();
  const vocab = buildVocabulary();
  printHeader(cur, prev);

  const records = cur.records ?? [];
  const { targets, findings, unknownTopic } = detectSubjectMismatch(cur, vocab);
  const manualPractice = records.filter((r) => r.recordType === "practice" && !isFromBank(r));
  const textbook = records.filter((r) => r.recordType === "textbook");

  // --- 内訳表。ここを出す前に何も書き換えない
  console.log(`== 内訳 ==`);
  console.log(`学習記録: ${records.length}件`);
  console.log(`  ├ 検査対象（fromQuestionBank: true）: ${targets.length}件  ← 科目を機械判定できるのはこれだけ`);
  console.log(`  │   ├ 科目一致            : ${targets.length - findings.length - unknownTopic.length}件`);
  console.log(`  │   ├ 科目の誤登録疑い    : ${findings.length}件`);
  console.log(`  │   └ 単元名が語彙に無い  : ${unknownTopic.length}件  ← 表記ゆれ側で扱う`);
  console.log(`  └ 検査対象外                       : ${records.length - targets.length}件`);
  console.log(`      ├ 手入力の practice   : ${manualPractice.length}件（科目はユーザが選んだもの。機械判定しない）`);
  console.log(`      └ textbook            : ${textbook.length}件`);
  console.log();

  // --- 検査1: 科目の誤登録
  console.log(`== [1] 科目の誤登録 : ${findings.length}件 ==`);
  if (findings.length === 0) {
    console.log(`  なし`);
  } else {
    for (const f of findings) {
      const r = f.record;
      console.log(`  ${r.id}`);
      console.log(`    記録   : ${r.subject} / ${r.subtopic} / ${r.studiedAt} / ${r.studyMinutes}分 / ${r.totalQuestions ?? "—"}問`);
      console.log(`    正の語彙: "${f.canonical}" は ${f.allowed.join(" または ")} （${f.setIds.join(", ") || "手入力の選択肢"}）`);
      if (f.evidence) {
        console.log(`    時間窓の演習履歴: ${f.evidence.count}問 / セット ${f.evidence.setIds.join(", ") || "不明"} / 科目 ${f.evidence.subjects.join(",") || "不明"}`);
      } else {
        console.log(`    時間窓の演習履歴: なし（問題バンクの attempts と照合できず）`);
      }
    }
  }
  console.log();

  // --- 検査2: 重複
  const dup = detectDuplicates(records);
  const strong = dup.byId.length + dup.bySession.length;
  console.log(`== [2] 重複 : 強 ${strong}組 / 中 ${dup.near.length}組 / 弱 ${dup.far.length}組 ==`);
  const dumpGroups = (title, groups, note) => {
    console.log(`  ${title}: ${groups.length}組${note ? `  ${note}` : ""}`);
    for (const [key, g] of groups) {
      console.log(`    [${g.length}件] ${key}`);
      for (const r of g) {
        console.log(`      ${r.id}  createdAt=${r.createdAt}  source=${r.source}  sessionId=${r.sessionId ?? "—"}`);
      }
    }
  };
  dumpGroups("強: id 一致", dup.byId, "（同一レコードが二重に入っている）");
  dumpGroups("強: sessionId 一致（timer）", dup.bySession, "（1セッション=1レコードの前提が破れている）");
  dumpGroups("中: 内容一致 + createdAt が" + DUP_WINDOW_MINUTES + "分以内", dup.near, "（二重送信の疑い。消す前に必ず確認）");
  dumpGroups("弱: 内容一致だが作成時刻が離れている", dup.far, "（同じ日に同じ単元を2回やった正常ケースが多い。参考表示）");
  console.log();

  // --- 検査3: 表記ゆれ
  const variants = detectVariants(records, vocab);
  console.log(
    `== [3] subtopic の表記ゆれ : 語彙に無い ${variants.unknown.length}種 / 綴り違いで割れている ${variants.spellingSplits.length}種 ==`,
  );
  console.log(`  正の語彙に一致: ${variants.known.length}種`);
  if (variants.unknown.length) {
    console.log(`\n  [3-a] 正の語彙に無い単元名 — どれに寄せるかは人が決める`);
    for (const u of variants.unknown) {
      console.log(`  "${u.label}"  ${u.n}件  科目=${u.subjects.join(",")}`);
      for (const c of u.candidates) {
        console.log(`      候補 ${String((c.score * 100).toFixed(0)).padStart(3)}%  "${c.label}"  (${c.allowed.join("/")})`);
      }
    }
  }
  if (variants.spellingSplits.length) {
    console.log(`\n  [3-b] 記号・空白だけが違う綴り — 集計が別行に割れている`);
    for (const s of variants.spellingSplits) {
      console.log(`  科目=${s.subjects.join(",")}  計${s.n}件`);
      for (const [form, n] of s.forms) console.log(`      ${String(n).padStart(4)}件  "${form}"`);
    }
  }
  console.log();

  // --- 前回との差分
  const d = diffRecords(cur, prev);
  console.log(`== [4] 前回バックアップとの差分 ==`);
  if (!d) {
    console.log(`  学習記録が無いため比較できません`);
  } else if (!d.comparable) {
    console.log(`  前回（${d.prevFile ?? "なし"}）に uscpa-records が含まれないため比較できません`);
    console.log(`  （学習記録がバックアップ対象に入ったのは 2026-09 中旬以降）`);
  } else {
    console.log(`  比較元: ${d.prevFile}`);
    console.log(`  新規  : ${d.added.length}件`);
    console.log(`  変更  : ${d.changed.length}件（同じ id で中身が変わったもの）`);
    console.log(`  消失  : ${d.removed.length}件  ${d.removed.length ? "← 要確認。ローカルデータの消失を疑う" : ""}`);
    if (d.added.length) {
      const range = d.added.map((r) => r.studiedAt).filter(Boolean).sort();
      console.log(`  新規の学習日レンジ: ${range[0] ?? "—"} 〜 ${range[range.length - 1] ?? "—"}`);
      for (const [k, n] of tally(d.added, (r) => `${r.subject} / ${r.subtopic}`)) {
        console.log(`    ${String(n).padStart(3)}件  ${k}`);
      }
    }
    // 変更が大量に出るのは一括書き換えが起きたときなので、先頭だけ出して件数で示す
    const head = (rows, label) => {
      for (const r of rows.slice(0, 20)) console.log(`    [${label}] ${r.id}  ${contentKey(r)}`);
      if (rows.length > 20) console.log(`    ... 他 ${rows.length - 20}件`);
    };
    head(d.changed, "変更");
    head(d.removed, "消失");
  }
  console.log();

  // --- 他データセットの件数
  console.log(`== [5] データセット別の件数 ==`);
  const counts = [
    ["学習記録 uscpa-records", cur.records, prev?.records],
    ["問題バンク uscpa-question-bank", cur.attempts, prev?.attempts],
    ["TBS uscpa-tbs-bank", cur.tbsAttempts, prev?.tbsAttempts],
    ["模試 uscpa-mock-exams", cur.mockResults, prev?.mockResults],
    ["ノート uscpa-notes", cur.notes, prev?.notes],
  ];
  for (const [name, c, p] of counts) {
    const cn = c ? c.length : null;
    const pn = p ? p.length : null;
    const delta = cn !== null && pn !== null ? `（前回 ${pn} / ${cn - pn >= 0 ? "+" : ""}${cn - pn}）` : "";
    console.log(`  ${padEndDisp(name, 36)}${padStartDisp(cn === null ? "—" : cn, 6)}  ${delta}`);
    if (cn !== null && pn !== null && cn < pn) {
      console.log(`    [要確認] 前回より減っています。リモートに無いローカルデータを消していないか確認する`);
    }
  }
  console.log();

  const variantCount = variants.unknown.length + variants.spellingSplits.length;
  const blocking = findings.length + strong + dup.near.length + variantCount;
  console.log(`== まとめ ==`);
  console.log(`  要対応: 科目の誤登録 ${findings.length}件 / 重複（強・中）${strong + dup.near.length}組 / 表記ゆれ ${variantCount}種`);
  console.log(`  この時点では何も書き換えていません。`);
  console.log(`  修正するなら計画JSONを書いて fix --plan で検証 → --apply で修正版ファイルを書き出す。`);
  console.log(`  集計と次アクションは report を使う。`);
  process.exitCode = blocking > 0 ? 1 : 0;
}

// ---------------------------------------------------------------- report

function report() {
  const { cur, prev } = resolveFiles();
  const vocab = buildVocabulary();
  const records = cur.records ?? [];
  const weakMin = Number(argOf("--weak-min", "20"));
  printHeader(cur, prev);

  const { bySubject, bySubtopic } = aggregate(records);

  console.log(`== 科目別 ==`);
  console.log(`  科目   学習時間    問題数   正解数   正答率   記録数`);
  for (const s of [...SUBJECTS, "(未設定)"]) {
    const e = bySubject.get(s);
    if (!e) continue;
    console.log(
      `  ${s.padEnd(7)}${(hours(e.minutes) + "h").padStart(8)}` +
        `${String(e.questions).padStart(10)}${String(e.correct).padStart(9)}` +
        `${pct(e.correct, e.questions).padStart(9)}${String(e.records).padStart(9)}`,
    );
  }
  const totalRow = [...bySubject.values()].reduce(
    (a, e) => ({
      minutes: a.minutes + e.minutes,
      questions: a.questions + e.questions,
      correct: a.correct + e.correct,
      records: a.records + e.records,
    }),
    { minutes: 0, questions: 0, correct: 0, records: 0 },
  );
  console.log(
    `  ${padEndDisp("合計", 7)}${(hours(totalRow.minutes) + "h").padStart(8)}` +
      `${String(totalRow.questions).padStart(10)}${String(totalRow.correct).padStart(9)}` +
      `${pct(totalRow.correct, totalRow.questions).padStart(9)}${String(totalRow.records).padStart(9)}`,
  );
  console.log();

  console.log(`== subtopic 別（問題数 ${weakMin} 問以上、正答率の低い順）==`);
  const rows = [...bySubtopic.values()]
    .filter((e) => e.questions >= weakMin)
    .sort((a, b) => a.correct / a.questions - b.correct / b.questions);
  console.log(`  正答率   問題数  学習時間  単元`);
  for (const e of rows) {
    console.log(
      `  ${pct(e.correct, e.questions).padStart(7)}${String(e.questions).padStart(8)}` +
        `${(hours(e.minutes) + "h").padStart(10)}  ${e.key}`,
    );
  }
  console.log();

  console.log(`== 弱点（問題数 ${weakMin} 問以上 かつ 正答率 70%未満）==`);
  const weak = rows.filter((e) => e.correct / e.questions < 0.7);
  if (weak.length === 0) console.log(`  なし`);
  for (const e of weak) {
    console.log(`  ${pct(e.correct, e.questions).padStart(7)}  ${e.key}  (${e.correct}/${e.questions}問, ${hours(e.minutes)}h)`);
  }
  console.log();

  console.log(`== 問題数が少なく判断できない単元（${weakMin}問未満）==`);
  const thin = [...bySubtopic.values()]
    .filter((e) => e.questions > 0 && e.questions < weakMin)
    .sort((a, b) => a.questions - b.questions);
  for (const e of thin) {
    console.log(`  ${String(e.questions).padStart(4)}問  ${pct(e.correct, e.questions).padStart(7)}  ${e.key}`);
  }
  console.log();

  const d = diffRecords(cur, prev);
  console.log(`== 前回からの増分 ==`);
  if (!d || !d.comparable) {
    console.log(`  比較できません（前回に uscpa-records が無い）`);
  } else {
    const agg = aggregate(d.added);
    console.log(`  比較元: ${d.prevFile}  新規 ${d.added.length}件`);
    for (const [s, e] of agg.bySubject) {
      console.log(`  ${s.padEnd(7)}${(hours(e.minutes) + "h").padStart(8)}${String(e.questions).padStart(8)}問  正答率 ${pct(e.correct, e.questions)}`);
    }
    console.log(`  単元別:`);
    for (const e of [...agg.bySubtopic.values()].sort((a, b) => b.questions - a.questions)) {
      console.log(`    ${String(e.questions).padStart(4)}問  ${pct(e.correct, e.questions).padStart(7)}  ${hours(e.minutes)}h  ${e.key}`);
    }
  }
  console.log();

  // 未検査のまま集計すると数字が嘘になるので、audit の結果を添える
  const { findings } = detectSubjectMismatch(cur, vocab);
  const dup = detectDuplicates(records);
  const variants = detectVariants(records, vocab);
  console.log(`== この集計の信頼性 ==`);
  const variantCount = variants.unknown.length + variants.spellingSplits.length;
  console.log(`  科目の誤登録疑い ${findings.length}件 / 重複（強・中）${dup.byId.length + dup.bySession.length + dup.near.length}組 / 表記ゆれ ${variantCount}種`);
  if (findings.length || variantCount) {
    console.log(`  [注意] 上の科目別・単元別の数字は、これらを直す前の値です。`);
  }
}

// ------------------------------------------------------------------- fix

/**
 * 承認済みの計画JSONを適用して、修正版のバックアップJSONを別名で書き出す。
 * 元ファイルは書き換えない（ローカルデータは常に保護する）。
 *
 * 計画JSON:
 * {
 *   "sourceFile": "uscpa-backup-20260919-1059.json",
 *   "subjectFixes":      [{ "id": "...", "to": "BAR", "reason": "..." }],
 *   "subtopicRenames":   [{ "from": "Derivertives", "to": "Derivatives & Hedging", "reason": "..." }],
 *   "duplicateRemovals": [{ "id": "...", "keepId": "...", "reason": "..." }]
 * }
 */
function fix() {
  const planPath = argOf("--plan");
  if (!planPath) die("--plan が必要です");
  const plan = JSON.parse(readFileSync(expand(planPath), "utf8"));
  const doApply = process.argv.includes("--apply");

  const { cur } = resolveFiles();
  if (plan.sourceFile && plan.sourceFile !== cur.file) {
    die(`計画の sourceFile(${plan.sourceFile}) と対象ファイル(${cur.file}) が食い違っています`);
  }
  if (!cur.records) die(`${cur.file} に uscpa-records が含まれていません`);

  const vocab = buildVocabulary();
  const records = cur.records;
  const byId = new Map(records.map((r) => [r.id, r]));
  const errors = [];

  // 検出結果に無いものは直さない。スクリプトが見つけていない修正を人が足せないようにする
  const { findings } = detectSubjectMismatch(cur, vocab);
  const mismatchIds = new Set(findings.map((f) => f.record.id));
  const dup = detectDuplicates(records);
  const removableIds = new Set(
    [...dup.byId, ...dup.bySession, ...dup.near].flatMap(([, g]) => g.map((r) => r.id)),
  );
  const variants = detectVariants(records, vocab);
  // 直してよいのは「語彙に無い単元名」と「綴り違いで割れている単元名」に現れた綴りだけ
  const variantForms = new Set([
    ...variants.unknown.flatMap((u) => (u.forms ?? []).map(([f]) => f)),
    ...variants.spellingSplits.flatMap((s) => s.forms.map(([f]) => f)),
  ]);

  const subjectFixes = plan.subjectFixes ?? [];
  const renames = plan.subtopicRenames ?? [];
  const removals = plan.duplicateRemovals ?? [];

  for (const f of subjectFixes) {
    if (!byId.has(f.id)) errors.push(`subjectFixes: 存在しない id: ${f.id}`);
    else if (!mismatchIds.has(f.id)) errors.push(`subjectFixes: 誤登録として検出されていない id: ${f.id}`);
    if (!SUBJECTS.includes(f.to)) errors.push(`subjectFixes: to が科目ではありません: ${f.to}`);
    if (!f.reason) errors.push(`subjectFixes: reason がありません: ${f.id}`);
  }
  for (const r of renames) {
    // from は実際に記録に現れた綴りをそのまま書く（正規化して当てない。取り違えを防ぐため）
    if (!variantForms.has(r.from)) {
      errors.push(`subtopicRenames: 表記ゆれとして検出されていない from: "${r.from}"`);
    }
    if (!vocab.byKey.has(normKey(r.to))) {
      errors.push(`subtopicRenames: to が正の語彙にありません: "${r.to}"`);
    }
    if (r.subject && !SUBJECTS.includes(r.subject)) {
      errors.push(`subtopicRenames: subject が科目ではありません: ${r.subject}`);
    }
    if (!r.reason) errors.push(`subtopicRenames: reason がありません: "${r.from}"`);
  }
  for (const r of removals) {
    if (!byId.has(r.id)) errors.push(`duplicateRemovals: 存在しない id: ${r.id}`);
    else if (!removableIds.has(r.id)) errors.push(`duplicateRemovals: 重複（強・中）として検出されていない id: ${r.id}`);
    if (!r.keepId || !byId.has(r.keepId)) errors.push(`duplicateRemovals: keepId が不正です: ${r.id}`);
    if (r.keepId === r.id) errors.push(`duplicateRemovals: keepId と id が同じです: ${r.id}`);
    if (!r.reason) errors.push(`duplicateRemovals: reason がありません: ${r.id}`);
  }

  if (errors.length) {
    console.log(`[NG] ${errors.length}件の問題があります。何も書き出していません。\n`);
    errors.forEach((e) => console.log(`  ${e}`));
    process.exit(1);
  }

  const removeSet = new Set(removals.map((r) => r.id));
  const subjectById = new Map(subjectFixes.map((f) => [f.id, f.to]));

  let nSubject = 0;
  let nRename = 0;
  const next = [];
  for (const r of records) {
    if (removeSet.has(r.id)) continue;
    const copy = { ...r };
    if (subjectById.has(r.id)) {
      copy.subject = subjectById.get(r.id);
      nSubject++;
    }
    // subject 指定があればその科目の記録だけを直す（同じ綴りが複数科目にまたがる場合の保険）
    const hit = renames.find(
      (x) => x.from === r.subtopic && (!x.subject || x.subject === copy.subject),
    );
    if (hit && r.subtopic !== hit.to) {
      copy.subtopic = hit.to;
      nRename++;
    }
    next.push(copy);
  }

  console.log(`== 検証OK ==`);
  console.log(`  学習記録      : ${records.length}件 → ${next.length}件`);
  console.log(`  科目の付け替え: ${nSubject}件`);
  console.log(`  表記の統一    : ${nRename}件（${renames.length}種）`);
  console.log(`  重複の削除    : ${removals.length}件`);

  if (!doApply) {
    console.log(`\n--dry-run（既定）のため書き出していません。実行するには --apply を付けてください。`);
    return;
  }

  // 元ファイルは触らない。修正版を別名で書き出し、アプリの「JSONから復元」で読ませる
  const outPath = expand(
    argOf("--out", join(dirname(cur.path), cur.file.replace(/\.json$/, "-fixed.json"))),
  );
  if (existsSync(outPath)) die(`出力先が既に存在します（上書きしません）: ${outPath}`);

  const payload = JSON.parse(JSON.stringify(cur.payload));
  const store = JSON.parse(payload.data["uscpa-records"]);
  store.state.records = next;
  // data の各値は JSON 文字列でなければならない（localStorage のダンプ形式）
  payload.data["uscpa-records"] = JSON.stringify(store);
  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");

  const verify = loadBackup(outPath);
  console.log(`\n== 突合 ==`);
  console.log(`  書き出し: ${outPath}`);
  console.log(`  想定 ${next.length}件 / 実際 ${verify.records.length}件 ${verify.records.length === next.length ? "✓ 一致" : "✗ 不一致"}`);
  console.log(`  他のデータセットは触っていません（question-bank / tbs-bank / mock-exams / notes / page-memos）`);
  console.log(`  元ファイルはそのまま残しています: ${cur.path}`);
  if (verify.records.length !== next.length) process.exit(1);
}

// ------------------------------------------------------------------ entry

const cmd = process.argv[2];
if (cmd === "audit") audit();
else if (cmd === "report") report();
else if (cmd === "fix") fix();
else {
  console.log("使い方:");
  console.log("  node scripts/study-log-audit.mjs audit  [--file <path>] [--prev <path>] [--dir ~/Downloads]");
  console.log("  node scripts/study-log-audit.mjs report [--file <path>] [--prev <path>] [--weak-min 20]");
  console.log("  node scripts/study-log-audit.mjs fix    --plan <plan.json> [--apply] [--out <path>]");
  process.exit(1);
}
