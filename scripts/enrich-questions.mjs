#!/usr/bin/env node
// 抽出済みPDF問題にClaude APIで正解・解説・subtopic・難易度を付与する。
// 使い方: ANTHROPIC_API_KEY=sk-... node scripts/enrich-questions.mjs [section...]
// レジューム対応: 既に enriched ファイルが存在すれば未処理分のみ実行。

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const EXTRACTED_DIR = "scripts/_work/extracted";
const ENRICHED_DIR = "scripts/_work/enriched";
const BATCH_SIZE = 5;
const DELAY_MS = 1500;
const MODEL = "claude-sonnet-4-20250514";

const TOPIC_MAP = {
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

function buildPrompt(batch, section) {
  const topic = TOPIC_MAP[section] || section;
  const questionsJson = batch.map((q, i) => ({
    index: i,
    stem: q.stem,
    choices: q.choices,
  }));

  return `You are a US CPA exam expert specializing in FAR (Financial Accounting and Reporting).
For each question below, determine the correct answer and provide enrichment data.

Topic area: ${topic}

CRITICAL RULES — violations will cause data corruption:
1. In explanations, NEVER reference choices by label (A, B, C, D, "option A", "choice B"). Always refer to the actual VALUE or CONTENT of the choice (e.g., "$42,000" not "choice B", "the straight-line method" not "option C").
2. Do NOT use any of these phrases: "Wait", "Hmm", "let me recalculate", "closest answer", "not among the choices", "let me reconsider", "doesn't match".
3. correctAnswer must be exactly one of: "A", "B", "C", "D".
4. Show calculation steps when applicable.
5. Reference specific ASC (Accounting Standards Codification) sections.
6. difficulty: "basic" = recall/definition, "intermediate" = application/calculation, "advanced" = complex multi-step or judgment.

Questions:
${JSON.stringify(questionsJson, null, 2)}

Respond with ONLY a JSON array (no markdown fences, no preamble). Each element:
{
  "index": <number matching the question index>,
  "correctAnswer": "A"|"B"|"C"|"D",
  "explanation": "<English explanation, 2-5 sentences, include calculation steps and ASC references>",
  "explanationJa": "<Japanese explanation, same content as English>",
  "references": ["ASC XXX-XX-XX", ...],
  "subtopic": "<concise subtopic name in English>",
  "difficulty": "basic"|"intermediate"|"advanced"
}`;
}

function parseResponse(text) {
  // マークダウンコードブロックの除去
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(cleaned);
}

function validateEnrichment(e, idx) {
  const errs = [];
  if (e.index !== idx) errs.push(`index mismatch: ${e.index} vs ${idx}`);
  if (!["A", "B", "C", "D"].includes(e.correctAnswer)) errs.push(`invalid correctAnswer: ${e.correctAnswer}`);
  if (typeof e.explanation !== "string" || e.explanation.length < 20) errs.push("explanation too short");
  if (typeof e.explanationJa !== "string" || e.explanationJa.length < 10) errs.push("explanationJa too short");
  if (!Array.isArray(e.references) || e.references.length === 0) errs.push("references empty");
  if (typeof e.subtopic !== "string" || !e.subtopic.trim()) errs.push("subtopic empty");
  if (!["basic", "intermediate", "advanced"].includes(e.difficulty)) errs.push(`invalid difficulty: ${e.difficulty}`);

  // ラベル参照チェック
  const fullExp = (e.explanation || "") + " " + (e.explanationJa || "");
  if (/\b(choice|option|answer)\s+[A-D]\b/i.test(fullExp)) errs.push("label reference in explanation");
  if (/\bthe answer is [A-D][.\s]/i.test(fullExp)) {
    // "The answer is X." 形式は QuestionCard.tsx が変換するので許容
  }
  return errs;
}

async function enrichBatch(client, batch, section, retries = 2) {
  const prompt = buildPrompt(batch, section);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0]?.text;
      if (!text) throw new Error("Empty response");

      const enrichments = parseResponse(text);
      if (!Array.isArray(enrichments) || enrichments.length !== batch.length) {
        throw new Error(`Expected ${batch.length} enrichments, got ${enrichments?.length}`);
      }

      // 検証
      const allErrs = [];
      for (let i = 0; i < enrichments.length; i++) {
        const errs = validateEnrichment(enrichments[i], i);
        if (errs.length) allErrs.push(`  [${i}] ${errs.join(", ")}`);
      }
      if (allErrs.length) {
        console.warn(`  ⚠ 検証エラー (attempt ${attempt + 1}):\n${allErrs.join("\n")}`);
        if (attempt < retries) continue;
        console.warn("  → 最大リトライ超過、検証エラーありのまま使用");
      }

      return enrichments;
    } catch (err) {
      console.error(`  ✗ API error (attempt ${attempt + 1}): ${err.message}`);
      if (attempt < retries) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processSection(client, section) {
  const extractedPath = join(EXTRACTED_DIR, `${section}.json`);
  const enrichedPath = join(ENRICHED_DIR, `${section}.json`);

  if (!existsSync(extractedPath)) {
    console.error(`✗ ${section}: 抽出ファイルなし`);
    return { section, added: 0, total: 0, error: true };
  }

  const extracted = JSON.parse(readFileSync(extractedPath, "utf8"));

  // レジューム: 既存のenrichedファイルから処理済み数を取得
  let enriched = [];
  if (existsSync(enrichedPath)) {
    enriched = JSON.parse(readFileSync(enrichedPath, "utf8"));
    if (enriched.length >= extracted.length) {
      console.log(`✓ ${section}: 全${extracted.length}問処理済み — スキップ`);
      return { section, added: 0, total: enriched.length, error: false };
    }
    console.log(`  ${section}: ${enriched.length}/${extracted.length} 処理済み — 残り${extracted.length - enriched.length}問`);
  }

  const startIdx = enriched.length;
  let addedThisRun = 0;

  for (let i = startIdx; i < extracted.length; i += BATCH_SIZE) {
    const batch = extracted.slice(i, i + BATCH_SIZE);
    const batchEnd = Math.min(i + BATCH_SIZE, extracted.length);
    process.stdout.write(`  [${i + 1}-${batchEnd}/${extracted.length}] `);

    try {
      const enrichments = await enrichBatch(client, batch, section);

      // 抽出データと合成
      for (let j = 0; j < batch.length; j++) {
        const orig = batch[j];
        const enr = enrichments[j];
        enriched.push({
          ...orig,
          correctAnswer: enr.correctAnswer,
          explanation: enr.explanation,
          explanationJa: enr.explanationJa,
          references: enr.references,
          subtopic: enr.subtopic,
          difficulty: enr.difficulty,
          source: "FAR Exercise PDF",
        });
      }

      addedThisRun += batch.length;
      // バッチごとに保存（レジューム対応）
      writeFileSync(enrichedPath, JSON.stringify(enriched, null, 2), "utf8");
      console.log("✓");

      if (batchEnd < extracted.length) await sleep(DELAY_MS);
    } catch (err) {
      console.error(`✗ 致命的エラー: ${err.message}`);
      // 処理済み分は保存済み — 次回レジュームで継続可能
      return { section, added: addedThisRun, total: enriched.length, error: true };
    }
  }

  return { section, added: addedThisRun, total: enriched.length, error: false };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("エラー: ANTHROPIC_API_KEY 環境変数を設定してください。");
    console.error("使い方: ANTHROPIC_API_KEY=sk-ant-... node scripts/enrich-questions.mjs");
    process.exit(1);
  }

  mkdirSync(ENRICHED_DIR, { recursive: true });
  const client = new Anthropic();

  const argSections = process.argv.slice(2);
  const sections = argSections.length
    ? argSections
    : readdirSync(EXTRACTED_DIR)
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(".json", ""));

  console.log(`\n${sections.length}セクションを処理します（モデル: ${MODEL}）\n`);

  const results = [];
  let totalAdded = 0;

  for (const section of sections) {
    console.log(`\n--- ${section} ---`);
    const result = await processSection(client, section);
    results.push(result);
    totalAdded += result.added;
  }

  // サマリー
  console.log("\n=== 結果 ===");
  for (const r of results) {
    const status = r.error ? "✗" : "✓";
    console.log(`${status} ${r.section}: ${r.total}問 (+${r.added})`);
  }
  console.log(`合計: +${totalAdded}問 enriched`);
}

main().catch((err) => {
  console.error("致命的エラー:", err);
  process.exit(1);
});
