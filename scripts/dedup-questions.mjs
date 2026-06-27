#!/usr/bin/env node
// enriched PDF問題と既存問題バンクの重複を検出する。
// 使い方: node scripts/dedup-questions.mjs
// 出力: scripts/_work/deduped/<section>.json + scripts/_work/dedup-report.txt

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const ENRICHED_DIR = "scripts/_work/enriched";
const EXISTING_DIR = "src/data/questions/far";
const DEDUPED_DIR = "scripts/_work/deduped";
const REPORT_PATH = "scripts/_work/dedup-report.txt";

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

function trigrams(text) {
  const norm = normalize(text);
  const set = new Set();
  for (let i = 0; i <= norm.length - 3; i++) {
    set.add(norm.slice(i, i + 3));
  }
  return set;
}

function jaccardSimilarity(setA, setB) {
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function choiceTextsMatch(choicesA, choicesB) {
  const setA = new Set(choicesA.map((c) => normalize(c.text)));
  const setB = new Set(choicesB.map((c) => normalize(c.text)));
  let matches = 0;
  for (const t of setA) {
    if (setB.has(t)) matches++;
  }
  return matches;
}

function loadExistingQuestions(section) {
  const path = join(EXISTING_DIR, `${section}.json`);
  if (!existsSync(path)) return [];
  const data = JSON.parse(readFileSync(path, "utf8"));
  return data.questions || [];
}

function loadEnrichedQuestions(section) {
  const path = join(ENRICHED_DIR, `${section}.json`);
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8"));
}

function findDuplicates(newQ, existingQuestions, allExistingBySection) {
  const newTrigrams = trigrams(newQ.stem);
  const candidates = [];

  const sectionsToCheck = Object.entries(allExistingBySection);
  for (const [section, questions] of sectionsToCheck) {
    for (const existQ of questions) {
      const existTrigrams = trigrams(existQ.stem);
      const sim = jaccardSimilarity(newTrigrams, existTrigrams);

      if (sim >= SIMILARITY_THRESHOLD) {
        const choiceMatches = choiceTextsMatch(newQ.choices, existQ.choices);
        candidates.push({
          existingId: existQ.id,
          existingSection: section,
          existingStem: existQ.stem.slice(0, 80),
          similarity: sim,
          choiceMatches,
          isDuplicate: sim >= 0.75 || (sim >= SIMILARITY_THRESHOLD && choiceMatches >= 3),
        });
      }
    }
  }

  candidates.sort((a, b) => b.similarity - a.similarity);
  return candidates;
}

function main() {
  mkdirSync(DEDUPED_DIR, { recursive: true });

  const enrichedFiles = readdirSync(ENRICHED_DIR).filter((f) => f.endsWith(".json"));
  console.log(`\n${enrichedFiles.length}セクションの重複検出を開始\n`);

  const allExisting = {};
  const existingFiles = readdirSync(EXISTING_DIR).filter((f) => f.endsWith(".json"));
  for (const f of existingFiles) {
    const section = f.replace(".json", "");
    allExisting[section] = loadExistingQuestions(section);
  }
  const totalExisting = Object.values(allExisting).reduce((s, q) => s + q.length, 0);
  console.log(`既存問題: ${totalExisting}問 (${existingFiles.length}セクション)\n`);

  // 既存問題のtrigramを事前計算
  const existingTrigrams = {};
  for (const [section, questions] of Object.entries(allExisting)) {
    existingTrigrams[section] = questions.map((q) => ({
      question: q,
      trigrams: trigrams(q.stem),
    }));
  }

  const reportLines = [];
  reportLines.push("=== 重複検出レポート ===");
  reportLines.push(`実行日: ${new Date().toISOString().slice(0, 10)}`);
  reportLines.push(`既存問題: ${totalExisting}問`);
  reportLines.push("");

  let totalNew = 0;
  let totalDuplicates = 0;
  let totalKept = 0;

  for (const f of enrichedFiles.sort()) {
    const section = f.replace(".json", "");
    const enriched = loadEnrichedQuestions(section);
    if (enriched.length === 0) continue;

    console.log(`--- ${section} (${enriched.length}問) ---`);
    reportLines.push(`--- ${section} (${enriched.length}問) ---`);

    const kept = [];
    const duplicates = [];

    for (const newQ of enriched) {
      const newTri = trigrams(newQ.stem);
      let bestMatch = null;
      let bestSim = 0;
      let bestChoiceMatches = 0;

      for (const [exSection, exItems] of Object.entries(existingTrigrams)) {
        for (const { question: exQ, trigrams: exTri } of exItems) {
          const sim = jaccardSimilarity(newTri, exTri);
          if (sim > bestSim) {
            bestSim = sim;
            bestMatch = { id: exQ.id, section: exSection, stem: exQ.stem.slice(0, 80) };
            bestChoiceMatches = choiceTextsMatch(newQ.choices, exQ.choices);
          }
        }
      }

      const isDup =
        bestSim >= 0.75 || (bestSim >= SIMILARITY_THRESHOLD && bestChoiceMatches >= 3);

      if (isDup) {
        duplicates.push({
          pdfQ: newQ.pdfQuestionNumber,
          similarity: bestSim.toFixed(3),
          choiceMatches: bestChoiceMatches,
          matchId: bestMatch.id,
          matchSection: bestMatch.section,
          newStem: newQ.stem.slice(0, 60),
          existStem: bestMatch.stem.slice(0, 60),
        });
      } else {
        kept.push(newQ);
      }
    }

    console.log(`  保持: ${kept.length}, 重複: ${duplicates.length}`);
    reportLines.push(`  保持: ${kept.length}, 重複: ${duplicates.length}`);

    if (duplicates.length > 0) {
      reportLines.push("  重複一覧:");
      for (const d of duplicates) {
        reportLines.push(
          `    PDF Q${d.pdfQ} ↔ ${d.matchId} (sim=${d.similarity}, choices=${d.choiceMatches}/4)`
        );
        reportLines.push(`      新: ${d.newStem}...`);
        reportLines.push(`      既: ${d.existStem}...`);
      }
    }
    reportLines.push("");

    totalNew += enriched.length;
    totalDuplicates += duplicates.length;
    totalKept += kept.length;

    const outPath = join(DEDUPED_DIR, f);
    writeFileSync(outPath, JSON.stringify(kept, null, 2), "utf8");
  }

  // サマリー
  const summary = [
    "",
    "=== サマリー ===",
    `入力: ${totalNew}問 (enriched)`,
    `重複検出: ${totalDuplicates}問`,
    `保持: ${totalKept}問`,
    `重複率: ${((totalDuplicates / totalNew) * 100).toFixed(1)}%`,
  ];
  for (const line of summary) {
    console.log(line);
    reportLines.push(line);
  }

  writeFileSync(REPORT_PATH, reportLines.join("\n"), "utf8");
  console.log(`\nレポート: ${REPORT_PATH}`);
}

main();
