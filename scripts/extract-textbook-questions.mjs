#!/usr/bin/env node
// テキスト・その他PDFからMCQを抽出する。
// extract-pdf-questions.mjs と同じトークナイズロジックを使用。
// 出力: scripts/_work/extracted-text/<section>.json

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, resolve } from "path";

const REF_DIR = "reference";
const OUT_DIR = "scripts/_work/extracted-text";

const PDF_MAPPING = {
  "FAR_Bond & Other Liabilities_テキスト.pdf": { defaultTarget: "liabilities" },
  // Cash Recievable テキスト: MCQ 0件検出のためスキップ
  "FAR_Deffered Tax_テキスト.pdf": { defaultTarget: "income-taxes" },
  "FAR_Derivertive & Hedges_テキスト.pdf": { defaultTarget: "derivatives-hedging" },
  "FAR_Foreign Currency & EPS_テキスト.pdf": { defaultTarget: "foreign-currency-eps" },
  "FAR_Governmental Accounting_テキスト.pdf": { defaultTarget: "government-accounting" },
  "FAR_Inventory, Fixed Assets & Intangibles_テキスト.pdf": {
    defaultTarget: "inventory",
    sectionMap: [
      { pattern: /inventory|LIFO|FIFO|cost flow|lower of cost/i, target: "inventory" },
      {
        pattern:
          /fixed assets?|property|plant|equipment|depreciat|intangible|goodwill|impairment|capitali[sz]/i,
        target: "ppe-intangibles",
      },
    ],
  },
  "FAR_Non Profit Accounting_テキスト.pdf": { defaultTarget: "nonprofit-accounting" },
  "FAR_Revenue Recognition & IS Presentation_テキスト.pdf": {
    defaultTarget: "revenue-recognition",
  },
  "FAR_Stockholder's Equity_テキスト.pdf": { defaultTarget: "equity" },
  "FAR_Cash Flows.pdf": { defaultTarget: "cash-flows" },
  "FAR_Consolidation.pdf": { defaultTarget: "consolidations" },
  "FAR_Credit Loss.pdf": { defaultTarget: "credit-loss-cecl" },
  "FAR_Deffered Tax.pdf": { defaultTarget: "income-taxes" },
  "FAR_Leases.pdf": { defaultTarget: "leases" },
  "FAR_Partnership.pdf": { defaultTarget: "partnerships" },
  "FAR_Revenue Recognition & IS Presentation.pdf": { defaultTarget: "revenue-recognition" },
};

function findDominantFont(pages) {
  const counts = {};
  for (const { items } of pages) {
    for (const item of items) {
      if ("str" in item && item.str.trim() && item.fontName) {
        counts[item.fontName] = (counts[item.fontName] || 0) + 1;
      }
    }
  }
  let best = "";
  let bestCount = 0;
  for (const [font, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = font;
      bestCount = count;
    }
  }
  return best;
}

function tokenizePages(pages) {
  const tokens = [];
  const dominantFont = findDominantFont(pages);
  let lastQNum = 0;
  let sectionSinceLastQ = true;

  for (const { pageNum, items } of pages) {
    tokens.push({ type: "page-break", pageNum });
    let prevWasEmpty = true;

    for (let ii = 0; ii < items.length; ii++) {
      const item = items[ii];
      const str = item.str;
      const font = item.fontName || "";

      if (!str.trim()) {
        prevWasEmpty = true;
        continue;
      }

      if (/f1|bold/i.test(font) && /^\d+$/.test(str.trim())) {
        prevWasEmpty = true;
        continue;
      }

      if (/^\d+\.$/.test(str.trim()) && prevWasEmpty) {
        const num = parseInt(str.trim(), 10);
        if (num > lastQNum || sectionSinceLastQ) {
          tokens.push({ type: "question-num", num, pageNum });
          lastQNum = num;
          sectionSinceLastQ = false;
          prevWasEmpty = false;
          continue;
        }
      }

      const embeddedQMatch = str.match(/^(\d+)\.\s+([A-Z].+)/);
      if (embeddedQMatch && embeddedQMatch[2].length > 5 && prevWasEmpty) {
        const num = parseInt(embeddedQMatch[1], 10);
        if (num > lastQNum || sectionSinceLastQ) {
          tokens.push({ type: "question-num", num, pageNum });
          tokens.push({ type: "text", text: embeddedQMatch[2] });
          lastQNum = num;
          sectionSinceLastQ = false;
          prevWasEmpty = false;
          continue;
        }
      }

      if (/^[a-d]\.$/.test(str.trim())) {
        tokens.push({ type: "choice-label", label: str.trim()[0].toUpperCase() });
        prevWasEmpty = false;
        continue;
      }

      if (/^[a-d]$/.test(str.trim())) {
        let peek = ii + 1;
        while (peek < items.length && !items[peek].str?.trim()) peek++;
        if (peek < items.length && items[peek].str?.trim() === ".") {
          tokens.push({ type: "choice-label", label: str.trim().toUpperCase() });
          ii = peek;
          prevWasEmpty = false;
          continue;
        }
      }

      const inlineChoiceMatch = str.match(/^([a-d])\.\s+(.+)/);
      if (inlineChoiceMatch) {
        tokens.push({ type: "choice-label", label: inlineChoiceMatch[1].toUpperCase() });
        tokens.push({ type: "text", text: inlineChoiceMatch[2] });
        prevWasEmpty = false;
        continue;
      }

      const noPeriodChoiceMatch = str.match(/^([a-d])\s+(\$?\d[\d,.]*)$/);
      if (noPeriodChoiceMatch && prevWasEmpty) {
        tokens.push({ type: "choice-label", label: noPeriodChoiceMatch[1].toUpperCase() });
        tokens.push({ type: "text", text: noPeriodChoiceMatch[2] });
        prevWasEmpty = false;
        continue;
      }

      if (
        /f2/i.test(font) &&
        font !== dominantFont &&
        str.trim().length > 5 &&
        !/^\d/.test(str.trim())
      ) {
        tokens.push({ type: "section-header", text: str.trim() });
        sectionSinceLastQ = true;
        lastQNum = 0;
        prevWasEmpty = false;
        continue;
      }

      tokens.push({ type: "text", text: str });
      prevWasEmpty = false;
    }
  }

  return tokens;
}

function assembleQuestions(tokens, pdfFileName) {
  const questions = [];
  let currentSection = null;
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === "page-break") {
      i++;
      continue;
    }

    if (token.type === "section-header") {
      currentSection = token.text;
      i++;
      continue;
    }

    if (token.type === "question-num") {
      const qNum = token.num;
      const qPage = token.pageNum;
      i++;

      const stemParts = [];
      while (
        i < tokens.length &&
        tokens[i].type !== "choice-label" &&
        tokens[i].type !== "question-num"
      ) {
        if (tokens[i].type === "text") stemParts.push(tokens[i].text);
        else if (tokens[i].type === "section-header") currentSection = tokens[i].text;
        i++;
      }

      const choices = [];
      while (i < tokens.length && tokens[i].type === "choice-label") {
        const label = tokens[i].label;
        i++;
        const textParts = [];
        while (
          i < tokens.length &&
          tokens[i].type !== "choice-label" &&
          tokens[i].type !== "question-num"
        ) {
          if (tokens[i].type === "text") textParts.push(tokens[i].text);
          else if (tokens[i].type === "section-header") currentSection = tokens[i].text;
          i++;
        }
        choices.push({ label, text: joinText(textParts) });
      }

      const stem = joinText(stemParts);

      if (choices.length === 4 && stem.length > 10) {
        questions.push({
          pdfSource: pdfFileName,
          pdfQuestionNumber: qNum,
          pdfPage: qPage,
          stem,
          choices,
          sectionHeader: currentSection,
          targetFile: null,
        });
      } else if (choices.length > 0 || stem.length > 10) {
        console.warn(
          `  ⚠ Q${qNum} (p${qPage}): 選択肢${choices.length}個, stem長${stem.length} → スキップ`
        );
      }
      continue;
    }

    i++;
  }

  return questions;
}

function joinText(parts) {
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

async function extractPdfItems(pdfPath) {
  const data = new Uint8Array(readFileSync(pdfPath));
  const doc = await getDocument({ data }).promise;
  const pages = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items = tc.items.filter((item) => "str" in item);
    pages.push({ pageNum: p, items });
  }

  return pages;
}

function assignTargets(questions, pdfFileName, mapping) {
  const config = mapping[pdfFileName];
  if (!config) {
    console.warn(`  ⚠ マッピング未定義: ${pdfFileName}`);
    return questions.map((q) => ({ ...q, targetFile: "unknown" }));
  }

  if (config.sectionMap) {
    return questions.map((q) => {
      const textToMatch = (q.sectionHeader || "") + " " + q.stem;
      for (const sec of config.sectionMap) {
        if (sec.pattern.test(textToMatch)) {
          return { ...q, targetFile: sec.target };
        }
      }
      return { ...q, targetFile: config.defaultTarget };
    });
  }

  return questions.map((q) => ({ ...q, targetFile: config.defaultTarget }));
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const mappedFiles = Object.keys(PDF_MAPPING);
  const existing = new Set(readdirSync(REF_DIR));
  const pdfs = mappedFiles.filter((f) => existing.has(f));

  console.log(`\n${pdfs.length}個のテキスト・その他PDFを処理します\n`);

  const allByTarget = {};
  let totalExtracted = 0;

  for (const pdf of pdfs) {
    console.log(`\n${pdf}`);
    const pdfPath = resolve(REF_DIR, pdf);
    const pages = await extractPdfItems(pdfPath);
    console.log(`  ページ数: ${pages.length}`);

    const tokens = tokenizePages(pages);
    const questions = assembleQuestions(tokens, pdf);
    const assigned = assignTargets(questions, pdf, PDF_MAPPING);
    const cleaned = assigned.map(({ sectionHeader, multiTarget, ...rest }) => rest);

    console.log(`  抽出: ${cleaned.length}問`);
    totalExtracted += cleaned.length;

    for (const q of cleaned) {
      const target = q.targetFile || "unknown";
      if (!allByTarget[target]) allByTarget[target] = [];
      allByTarget[target].push(q);
    }
  }

  console.log("\n--- 出力 ---");
  for (const [target, questions] of Object.entries(allByTarget).sort()) {
    const outPath = join(OUT_DIR, `${target}.json`);
    writeFileSync(outPath, JSON.stringify(questions, null, 2), "utf8");
    console.log(`  ${outPath}: ${questions.length}問`);
  }

  console.log(`\n完了: ${totalExtracted}問抽出`);
}

main().catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
