"use client";

import { MarkdownPreview } from "@/components/notes/MarkdownPreview";

interface QuestionStemProps {
  content: string;
}

type Block =
  { type: "text"; lines: string[] } | { type: "table"; rows: string[][] };

/**
 * 問題文を描画する。
 *
 * 教材PDFから取り込んだ設問は「ラベル | 値」の行で表を表しているため、
 * そのまま流すと数値がどの項目のものか読み取れない。
 * 連続するパイプ区切り行だけを表として組み、それ以外は通常の本文として扱う。
 * データ側は変換しない（過去に問題データのテーブル化で数値を破損させたため）。
 */
function toBlocks(content: string): Block[] {
  const blocks: Block[] = [];

  for (const line of content.split("\n")) {
    const isRow = line.includes(" | ");
    const last = blocks[blocks.length - 1];

    if (isRow) {
      const cells = line.split(" | ").map((c) => c.trim());
      if (last?.type === "table") last.rows.push(cells);
      else blocks.push({ type: "table", rows: [cells] });
    } else {
      if (last?.type === "text") last.lines.push(line);
      else blocks.push({ type: "text", lines: [line] });
    }
  }

  return blocks;
}

export function QuestionStem({ content }: QuestionStemProps) {
  const blocks = toBlocks(content);

  return (
    <div className="space-y-1">
      {blocks.map((block, i) => {
        if (block.type === "text") {
          const text = block.lines.join("\n").trim();
          if (!text) return null;
          return <MarkdownPreview key={i} content={text} breaks />;
        }

        // 見出し行はラベル列を持たないことがあるため、左側を空セルで埋めて列を揃える
        const columns = Math.max(...block.rows.map((r) => r.length));
        return (
          <div key={i} className="overflow-x-auto">
            <table className="my-2 text-sm">
              <tbody>
                {block.rows.map((cells, r) => {
                  const padded = [
                    ...Array(columns - cells.length).fill(""),
                    ...cells,
                  ];
                  return (
                    <tr
                      key={r}
                      className="border-b border-border/40 last:border-0"
                    >
                      {padded.map((cell, c) => (
                        <td
                          key={c}
                          className={
                            c === 0
                              ? "py-1 pr-6 align-top"
                              : "py-1 pr-6 text-right align-top tabular-nums whitespace-nowrap"
                          }
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
