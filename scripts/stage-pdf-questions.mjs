#!/usr/bin/env node
// deduped問題にID採番し、_staging/ にマージ待ちファイルを生成する。
// 使い方: node scripts/stage-pdf-questions.mjs

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const DEDUPED_DIR = "scripts/_work/deduped";
const EXISTING_DIR = "src/data/questions/far";
const STAGING_DIR = "src/data/questions/far/_staging";

const PREFIX = {
  "accounting-changes": "chg",
  "cash-equivalents": "cce",
  "cash-flows": "cf",
  "consolidations": "con",
  "credit-loss-cecl": "cecl",
  "derivatives-hedging": "deriv",
  "equity": "eq",
  "foreign-currency-eps": "fx",
  "government-accounting": "gov",
  "income-taxes": "tax",
  "inventory": "inv",
  "investments": "inv-i",
  "leases": "lease",
  "liabilities": "liab",
  "nonprofit-accounting": "nfp",
  "partnerships": "part",
  "pensions": "pen",
  "ppe-intangibles": "ppe",
  "receivables": "rec",
  "revenue-recognition": "rev",
  "stock-compensation": "sc",
};

const TOPIC = {
  "cash-equivalents": "Cash and Cash Equivalents",
  "cash-flows": "Statement of Cash Flows",
  "consolidations": "Consolidations",
  "derivatives-hedging": "Derivatives & Hedging",
  "equity": "Equity",
  "foreign-currency-eps": "Foreign Currency & EPS",
  "government-accounting": "Government Accounting",
  "inventory": "Inventory",
  "leases": "Leases (ASC 842)",
  "liabilities": "Liabilities",
  "nonprofit-accounting": "Not-for-Profit Accounting",
  "partnerships": "Partnerships",
  "ppe-intangibles": "Property, Plant & Equipment",
};

function getMaxId(section) {
  const path = join(EXISTING_DIR, `${section}.json`);
  if (!existsSync(path)) return 0;
  const data = JSON.parse(readFileSync(path, "utf8"));
  const questions = data.questions || [];
  if (questions.length === 0) return 0;
  const prefix = PREFIX[section];
  let max = 0;
  for (const q of questions) {
    const match = q.id.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return max;
}

function toFARQuestion(q, id, topic, section) {
  return {
    id,
    topic,
    subtopic: q.subtopic,
    difficulty: q.difficulty,
    stem: q.stem,
    choices: q.choices,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    explanationJa: q.explanationJa,
    references: q.references,
    source: q.source || "FAR Exercise PDF",
  };
}

function main() {
  mkdirSync(STAGING_DIR, { recursive: true });

  const files = readdirSync(DEDUPED_DIR).filter((f) => f.endsWith(".json"));
  console.log(`\n${files.length}セクションをステージング\n`);

  let totalStaged = 0;

  for (const f of files.sort()) {
    const section = f.replace(".json", "");
    const deduped = JSON.parse(readFileSync(join(DEDUPED_DIR, f), "utf8"));
    if (deduped.length === 0) continue;

    const prefix = PREFIX[section];
    if (!prefix) {
      console.warn(`⚠ ${section}: PREFIXマッピングなし → スキップ`);
      continue;
    }

    const topic = TOPIC[section];
    if (!topic) {
      console.warn(`⚠ ${section}: TOPICマッピングなし → スキップ`);
      continue;
    }

    const maxId = getMaxId(section);
    const staged = [];

    for (let i = 0; i < deduped.length; i++) {
      const newNum = maxId + 1 + i;
      const id = `${prefix}-${String(newNum).padStart(3, "0")}`;
      staged.push(toFARQuestion(deduped[i], id, topic, section));
    }

    const outPath = join(STAGING_DIR, f);
    writeFileSync(outPath, JSON.stringify(staged, null, 2), "utf8");
    console.log(`  ${section}: ${staged.length}問 (${prefix}-${String(maxId + 1).padStart(3, "0")} ~ ${prefix}-${String(maxId + deduped.length).padStart(3, "0")})`);
    totalStaged += staged.length;
  }

  console.log(`\n合計: ${totalStaged}問をステージング → ${STAGING_DIR}`);
}

main();
