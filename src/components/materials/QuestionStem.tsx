"use client";

import { MarkdownPreview } from "@/components/notes/MarkdownPreview";

interface QuestionStemProps {
  content: string;
}

type Block =
  | { type: "text"; lines: string[] }
  | { type: "table"; rows: string[][]; caption?: string };

/**
 * 表の直前にある列見出しの行を、表の見出しとして取り込む。
 *
 * PDFによっては見出し行の単語間の空きが狭く列として復元できないため、
 * 「Product Units produced Market value ...」のような行が本文として残ってしまう。
 * 列の対応までは付けられないが、表と切り離して出すよりは読み取れる。
 */
function attachCaptions(blocks: Block[]): Block[] {
  for (let i = 0; i < blocks.length - 1; i++) {
    const cur = blocks[i];
    const next = blocks[i + 1];
    if (cur.type !== "text" || next.type !== "table") continue;

    const last = (cur.lines[cur.lines.length - 1] ?? "").trim();
    // 文の途中や導入文（「〜は以下のとおり:」）は見出しではない
    if (!last || last.length >= 100 || /[?.:;,]$/.test(last)) continue;

    next.caption = last;
    cur.lines.pop();
  }
  return blocks.filter(
    (b) => b.type !== "text" || b.lines.some((l) => l.trim()),
  );
}

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

/**
 * 列数が足りない行に空セルを補って列位置を揃える。
 *
 * - 列見出し（表の冒頭に並ぶ数値を含まない行）は値の列の上に来るよう右へ寄せる
 * - 行頭が語ならラベル始まりのデータ行なので左詰め
 * - "$99,000" や "No.150" のように語を持たない行は値だけの行なので右へ寄せる
 */
export function padRow(
  cells: string[],
  columns: number,
  isHeader: boolean,
): string[] {
  const pad: string[] = Array(Math.max(0, columns - cells.length)).fill("");
  const startsWithLabel = /[A-Za-z]{3,}/.test(cells[0] ?? "");
  return isHeader || !startsWithLabel ? [...pad, ...cells] : [...cells, ...pad];
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
  const merged = blocks.flatMap<Block>((b) =>
    b.type === "table" && b.rows.length < 2
      ? [{ type: "text", lines: [b.rows[0].join(" ")] }]
      : [b],
  );
  return attachCaptions(merged);
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

        // 表の冒頭に並ぶ「数値を含まない行」までが列見出し（Number of / units など）。
        // 見出しは値の列の上に来るよう右へ寄せる。
        let headerRows = 0;
        while (
          headerRows < block.rows.length &&
          !block.rows[headerRows].some((c) => /\d/.test(c))
        ) {
          headerRows++;
        }

        return (
          <div key={i} className="my-2 overflow-x-auto">
            {block.caption && (
              <div className="pb-1 text-xs font-medium text-muted-foreground">
                {block.caption}
              </div>
            )}
            <table className="w-full text-sm">
              <tbody>
                {block.rows.map((cells, r) => {
                  // 見出しは値の列に合わせて右へ寄せ、データ行はラベル列から左詰めにする
                  const padded = padRow(cells, columns, r < headerRows);
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
