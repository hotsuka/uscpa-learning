#!/usr/bin/env node
// PDF演習問題からMCQを抽出し、セクション別JSONに出力する。
// 使い方: node scripts/extract-pdf-questions.mjs

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, resolve } from "path";

const REF_DIR = "reference";
const OUT_DIR = "scripts/_work/extracted";

const PDF_MAPPING = {
  "FAR_Bond & Other Liabilities_演習問題.pdf": { defaultTarget: "liabilities" },
  "FAR_Cash Flow_演習問題.pdf": { defaultTarget: "cash-flows" },
  "FAR_Cash Recievable Markeatble Securities_演習問題.pdf": {
    defaultTarget: "cash-equivalents",
    multiTarget: ["cash-equivalents", "receivables", "investments"],
  },
  "FAR_Consolidation_演習問題.pdf": { defaultTarget: "consolidations" },
  "FAR_Derivertive & Hedges_演習問題.pdf": { defaultTarget: "derivatives-hedging" },
  "FAR_Foreign Currency & EPS_演習問題.pdf": { defaultTarget: "foreign-currency-eps" },
  "FAR_Governmental Accounting_演習問題.pdf": { defaultTarget: "government-accounting" },
  "FAR_Inventory, Fixed Assets & Intangibles_演習問題.pdf": {
    defaultTarget: "inventory",
    sectionMap: [
      { pattern: /inventory/i, target: "inventory" },
      { pattern: /fixed assets?|property|plant|equipment|depreciation/i, target: "ppe-intangibles" },
      { pattern: /intangible/i, target: "ppe-intangibles" },
    ],
  },
  "FAR_Leases_演習問題.pdf": { defaultTarget: "leases" },
  "FAR_Non Profit Accounting_演習問題.pdf": { defaultTarget: "nonprofit-accounting" },
  "FAR_Partnership_演習問題.pdf": { defaultTarget: "partnerships" },
  "FAR_Stockholder's Equity_演習問題.pdf": { defaultTarget: "equity" },
};

// 全ページのテキストアイテムから最頻出フォント（ボディフォント）を特定
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
    if (count > bestCount) { best = font; bestCount = count; }
  }
  return best;
}

// テキストアイテムをトークン列に変換（問題番号・選択肢ラベル・テキスト・ページ区切り）
function tokenizePages(pages) {
  const tokens = [];
  const dominantFont = findDominantFont(pages);

  // 問題番号の連番検証: 逆行する番号（"Year 1."等）を除外
  let lastQNum = 0;
  let sectionSinceLastQ = true; // PDF冒頭はセクション境界とみなす

  for (const { pageNum, items } of pages) {
    tokens.push({ type: "page-break", pageNum });

    // 段落区切り（空アイテム）を追跡して問題番号の誤検出を防止
    let prevWasEmpty = true; // ページ先頭は段落区切りとみなす

    for (let ii = 0; ii < items.length; ii++) {
      const item = items[ii];
      const str = item.str;
      const font = item.fontName || "";

      // 空文字列は段落区切りフラグのみ更新
      if (!str.trim()) {
        prevWasEmpty = true;
        continue;
      }

      // ページ番号（太字フォントf1で数字のみ）
      if (/f1|bold/i.test(font) && /^\d+$/.test(str.trim())) {
        prevWasEmpty = true;
        continue;
      }

      // 独立した問題番号アイテム: "1.", "18.", "135."
      // 段落区切り後かつ連番チェック（逆行する番号を除外）
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

      // テキスト先頭に埋め込まれた問題番号: "18. According to..."
      // 後続テキストが大文字で始まるもののみ + 連番チェック
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

      // 選択肢ラベル（独立）: "a.", "b.", "c.", "d."
      if (/^[a-d]\.$/.test(str.trim())) {
        tokens.push({ type: "choice-label", label: str.trim()[0].toUpperCase() });
        prevWasEmpty = false;
        continue;
      }

      // 選択肢ラベル（分割）: "a" + "." が別アイテムに分かれるケース
      if (/^[a-d]$/.test(str.trim())) {
        let peek = ii + 1;
        while (peek < items.length && !items[peek].str?.trim()) peek++;
        if (peek < items.length && items[peek].str?.trim() === ".") {
          tokens.push({ type: "choice-label", label: str.trim().toUpperCase() });
          ii = peek; // "."アイテムをスキップ
          prevWasEmpty = false;
          continue;
        }
      }

      // 選択肢ラベル（インライン）: "a. $4,158" "b. Five years" 等
      const inlineChoiceMatch = str.match(/^([a-d])\.\s+(.+)/);
      if (inlineChoiceMatch) {
        tokens.push({ type: "choice-label", label: inlineChoiceMatch[1].toUpperCase() });
        tokens.push({ type: "text", text: inlineChoiceMatch[2] });
        prevWasEmpty = false;
        continue;
      }

      // 選択肢ラベル（ピリオドなし、数値）: "a 136,000" "b $5,000" "c 0"
      const noPeriodChoiceMatch = str.match(/^([a-d])\s+(\$?\d[\d,.]*)$/);
      if (noPeriodChoiceMatch && prevWasEmpty) {
        tokens.push({ type: "choice-label", label: noPeriodChoiceMatch[1].toUpperCase() });
        tokens.push({ type: "text", text: noPeriodChoiceMatch[2] });
        prevWasEmpty = false;
        continue;
      }

      // セクションヘッダー（f2フォントかつボディフォントでない長いテキスト）
      if (/f2/i.test(font) && font !== dominantFont && str.trim().length > 5 && !/^\d/.test(str.trim())) {
        tokens.push({ type: "section-header", text: str.trim() });
        sectionSinceLastQ = true;
        lastQNum = 0;
        prevWasEmpty = false;
        continue;
      }

      // 通常テキスト
      tokens.push({ type: "text", text: str });
      prevWasEmpty = false;
    }
  }

  return tokens;
}

// トークン列からMCQ問題を組み立てる
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

      // stemテキストを収集（次のchoice-labelまたは次のquestion-numまで）
      const stemParts = [];
      while (i < tokens.length && tokens[i].type !== "choice-label" && tokens[i].type !== "question-num") {
        if (tokens[i].type === "text") stemParts.push(tokens[i].text);
        else if (tokens[i].type === "section-header") currentSection = tokens[i].text;
        i++;
      }

      // 選択肢を収集
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
          else if (tokens[i].type === "page-break") {
            /* ページまたぎは無視 */
          } else if (tokens[i].type === "section-header") {
            currentSection = tokens[i].text;
          }
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
        console.warn(`  ⚠ Q${qNum} (p${qPage}): 選択肢${choices.length}個, stem長${stem.length} → スキップ`);
      }
      continue;
    }

    // question-num 以外のトークンは読み飛ばす
    i++;
  }

  return questions;
}

function joinText(parts) {
  return parts
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
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
      // セクションヘッダーとstemの両方でパターンマッチ
      const textToMatch = (q.sectionHeader || "") + " " + q.stem;
      for (const sec of config.sectionMap) {
        if (sec.pattern.test(textToMatch)) {
          return { ...q, targetFile: sec.target };
        }
      }
      return { ...q, targetFile: config.defaultTarget };
    });
  }

  return questions.map((q) => ({
    ...q,
    targetFile: config.defaultTarget,
    ...(config.multiTarget ? { multiTarget: config.multiTarget } : {}),
  }));
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const pdfs = readdirSync(REF_DIR).filter((f) => f.includes("演習問題") && f.endsWith(".pdf"));
  console.log(`\n${pdfs.length}個の演習問題PDFを処理します\n`);

  const allByTarget = {};
  let totalExtracted = 0;
  let totalSkipped = 0;

  for (const pdf of pdfs) {
    console.log(`\n${pdf}`);
    const pdfPath = resolve(REF_DIR, pdf);
    const pages = await extractPdfItems(pdfPath);
    console.log(`  ページ数: ${pages.length}`);

    const tokens = tokenizePages(pages);
    const questions = assembleQuestions(tokens, pdf);
    const assigned = assignTargets(questions, pdf, PDF_MAPPING);

    // sectionHeaderはJSON出力には不要なので除去
    const cleaned = assigned.map(({ sectionHeader, ...rest }) => rest);

    console.log(`  抽出: ${cleaned.length}問`);
    totalExtracted += cleaned.length;

    for (const q of cleaned) {
      const target = q.targetFile || "unknown";
      if (!allByTarget[target]) allByTarget[target] = [];
      allByTarget[target].push(q);
    }
  }

  // セクション別にJSON出力
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
