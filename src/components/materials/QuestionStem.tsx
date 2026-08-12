"use client";

import { MarkdownPreview } from "@/components/notes/MarkdownPreview";

interface QuestionStemProps {
  content: string;
}

type Block =
  { type: "text"; lines: string[] } | { type: "table"; rows: string[][] };

// これより長いセルがある行は、表ではなく箇条書きの字下げとみなす
const MAX_CELL_LENGTH = 45;

/**
 * その行を表の一行として扱ってよいか判定する。
 *
 * 教材PDFから座標で列を復元しているため、箇条書きの記号と本文の間隔まで
 * 列区切りとして拾ってしまっている行がある。それを表にすると本文が
 * 右寄せの細いセルに押し込まれて読めなくなるので、値の一覧に見える行だけを表にする。
 */
function isTableRow(line: string): boolean {
  if (!line.includes(" | ")) return false;
  const cells = line.split(" | ").map((c) => c.trim());
  if (cells.length < 2) return false;
  if (cells.some((c) => c.length > MAX_CELL_LENGTH)) return false;
  // ラベル以外の列に数値がある（金額や数量の一覧）か、全セルが短い（Yes/No の対照表）
  return (
    cells.slice(1).some((c) => /\d/.test(c)) ||
    cells.every((c) => c.length <= 20)
  );
}

function toBlocks(content: string): Block[] {
  const blocks: Block[] = [];

  const pushText = (line: string) => {
    // 表にしない行に残ったパイプは区切り記号として意味を持たないので空白に均す
    const text = line.replace(/\s*\|\s*/g, " ").trim();
    const last = blocks[blocks.length - 1];
    if (last?.type === "text") last.lines.push(text);
    else blocks.push({ type: "text", lines: [text] });
  };

  for (const line of content.split("\n")) {
    if (isTableRow(line)) {
      const cells = line.split(" | ").map((c) => c.trim());
      const last = blocks[blocks.length - 1];
      if (last?.type === "table") last.rows.push(cells);
      else blocks.push({ type: "table", rows: [cells] });
    } else {
      pushText(line);
    }
  }

  // 1行しかない表は表の体をなさないので本文に戻す
  return blocks.flatMap<Block>((b) =>
    b.type === "table" && b.rows.length < 2
      ? [{ type: "text", lines: [b.rows[0].join(" ")] }]
      : [b],
  );
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

        const columns = Math.max(...block.rows.map((r) => r.length));
        // セル数が足りない行の寄せ方を決める。
        // 行頭が語（英字3文字以上）ならラベル列から始まるデータ行なので左詰め、
        // 金額や "No.150" のように語を持たない行は見出しか値だけの行なので右へ寄せる。
        const startsWithLabel = (cells: string[]) =>
          /[A-Za-z]{3,}/.test(cells[0]);

        return (
          <div key={i} className="my-2 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {block.rows.map((cells, r) => {
                  // 見出しは値の列に合わせて右へ寄せ、データ行はラベル列から左詰めにする
                  const pad: string[] = Array(columns - cells.length).fill("");
                  const padded = startsWithLabel(cells)
                    ? [...cells, ...pad]
                    : [...pad, ...cells];
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
                              : "py-1 pl-4 text-right align-top tabular-nums whitespace-nowrap"
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
