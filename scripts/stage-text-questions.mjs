#!/usr/bin/env node
// deduped-text問題にID採番し、_staging/ にマージ待ちファイルを生成する。

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const DEDUPED_DIR = "scripts/_work/deduped-text";
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
  "accounting-changes": "Accounting Changes & Error Corrections",
  "cash-equivalents": "Cash and Cash Equivalents",
  "cash-flows": "Statement of Cash Flows",
  "consolidations": "Consolidations",
  "credit-loss-cecl": "Credit Loss (CECL)",
  "derivatives-hedging": "Derivatives & Hedging",
  "equity": "Equity",
  "foreign-currency-eps": "Foreign Currency & EPS",
  "government-accounting": "Government Accounting",
  "income-taxes": "Income Taxes",
  "inventory": "Inventory",
  "investments": "Investments",
  "leases": "Leases (ASC 842)",
  "liabilities": "Liabilities",
  "nonprofit-accounting": "Not-for-Profit Accounting",
  "partnerships": "Partnerships",
  "pensions": "Pensions & Postretirement Benefits",
  "ppe-intangibles": "Property, Plant & Equipment",
  "receivables": "Receivables",
  "revenue-recognition": "Revenue Recognition",
  "stock-compensation": "Stock Compensation",
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

function toFARQuestion(q, id, topic) {
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
    if (deduped.length === 0) {
      console.log(`  ${section}: 0問 → スキップ`);
      continue;
    }

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

    // _staging に既にあるファイルも考慮（前回のステージングと重複しないよう）
    let maxId = getMaxId(section);
    const stagingPath = join(STAGING_DIR, f);
    if (existsSync(stagingPath)) {
      const existing = JSON.parse(readFileSync(stagingPath, "utf8"));
      for (const q of existing) {
        const match = q.id.match(new RegExp(`^${prefix}-(\\d+)$`));
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxId) maxId = num;
        }
      }
    }

    const staged = [];
    for (let i = 0; i < deduped.length; i++) {
      const newNum = maxId + 1 + i;
      const id = `${prefix}-${String(newNum).padStart(3, "0")}`;
      staged.push(toFARQuestion(deduped[i], id, topic));
    }

    // _stagingに既存ファイルがあれば追記
    let finalStaged = staged;
    if (existsSync(stagingPath)) {
      const existing = JSON.parse(readFileSync(stagingPath, "utf8"));
      finalStaged = [...existing, ...staged];
    }

    writeFileSync(stagingPath, JSON.stringify(finalStaged, null, 2), "utf8");
    console.log(
      `  ${section}: ${staged.length}問 (${staged[0].id} ~ ${staged[staged.length - 1].id})`
    );
    totalStaged += staged.length;
  }

  console.log(`\n合計: ${totalStaged}問をステージング → ${STAGING_DIR}`);
}

main();
