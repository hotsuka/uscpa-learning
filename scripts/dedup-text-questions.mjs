#!/usr/bin/env node
// enriched-text の問題を既存問題バンクと照合し重複を除去する。

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";

const ENRICHED_DIR = "scripts/_work/enriched-text";
const EXISTING_DIR = "src/data/questions/far";
const DEDUPED_DIR = "scripts/_work/deduped-text";
const REPORT_PATH = "scripts/_work/dedup-text-report.txt";
const SIMILARITY_THRESHOLD = 0.65;

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/\$[\d,]+(\.\d+)?/g, "$NUM")
    .replace(/\d{4}/g, "YEAR")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trigramsOf(text) {
  const norm = normalize(text);
  const set = new Set();
  for (let i = 0; i <= norm.length - 3; i++) set.add(norm.slice(i, i + 3));
  return set;
}

function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function choiceMatch(cA, cB) {
  const sA = new Set(cA.map((c) => normalize(c.text)));
  const sB = new Set(cB.map((c) => normalize(c.text)));
  let m = 0;
  for (const t of sA) if (sB.has(t)) m++;
  return m;
}

function main() {
  mkdirSync(DEDUPED_DIR, { recursive: true });

  const allExisting = {};
  for (const f of readdirSync(EXISTING_DIR).filter((f) => f.endsWith(".json"))) {
    const sec = f.replace(".json", "");
    const data = JSON.parse(readFileSync(join(EXISTING_DIR, f), "utf8"));
    allExisting[sec] = (data.questions || []).map((q) => ({
      ...q,
      _tri: trigramsOf(q.stem),
    }));
  }
  const totalEx = Object.values(allExisting).reduce((s, q) => s + q.length, 0);
  console.log(`既存: ${totalEx}問`);

  const reportLines = ["=== テキスト/その他PDF重複検出 ===", ""];
  let totalNew = 0;
  let totalDup = 0;
  let totalKept = 0;

  for (const f of readdirSync(ENRICHED_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()) {
    const sec = f.replace(".json", "");
    const enriched = JSON.parse(readFileSync(join(ENRICHED_DIR, f), "utf8"));
    if (!enriched.length) continue;

    const kept = [];
    const dups = [];

    for (const nq of enriched) {
      const nTri = trigramsOf(nq.stem);
      let bestSim = 0;
      let bestMatch = null;
      let bestCM = 0;

      for (const [exSec, exQs] of Object.entries(allExisting)) {
        for (const exQ of exQs) {
          const sim = jaccard(nTri, exQ._tri);
          if (sim > bestSim) {
            bestSim = sim;
            bestMatch = { id: exQ.id, sec: exSec, stem: exQ.stem.slice(0, 60) };
            bestCM = choiceMatch(nq.choices, exQ.choices);
          }
        }
      }

      const isDup = bestSim >= 0.75 || (bestSim >= SIMILARITY_THRESHOLD && bestCM >= 3);
      if (isDup) {
        dups.push({
          pdfQ: nq.pdfQuestionNumber,
          sim: bestSim.toFixed(3),
          cm: bestCM,
          id: bestMatch.id,
          nStem: nq.stem.slice(0, 50),
          eStem: bestMatch.stem.slice(0, 50),
        });
      } else {
        kept.push(nq);
      }
    }

    const line = `${sec.padEnd(25)} ${enriched.length} → keep:${kept.length} dup:${dups.length}`;
    console.log(line);
    reportLines.push(`${sec}: ${enriched.length} → keep:${kept.length} dup:${dups.length}`);
    for (const d of dups) {
      reportLines.push(`  Q${d.pdfQ} ↔ ${d.id} (sim=${d.sim} choices=${d.cm}/4)`);
    }

    totalNew += enriched.length;
    totalDup += dups.length;
    totalKept += kept.length;

    writeFileSync(join(DEDUPED_DIR, f), JSON.stringify(kept, null, 2), "utf8");
  }

  console.log("---");
  console.log(
    `入力:${totalNew} 重複:${totalDup} 保持:${totalKept} 重複率:${((totalDup / totalNew) * 100).toFixed(1)}%`
  );
  reportLines.push("", `合計: ${totalNew}→${totalKept} (重複${totalDup})`);
  writeFileSync(REPORT_PATH, reportLines.join("\n"), "utf8");
}

main();
