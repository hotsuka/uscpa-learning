import type { Subject } from "@/types";

const SUBJECT_PREFIXES: Subject[] = ["FAR", "AUD", "REG", "BAR"];
const ANSWER_SUFFIX = "_回答あり";

export interface ParsedMaterialFile {
  /** 教材名。拡張子と「_回答あり」を除いたファイル名をそのまま使う */
  baseName: string;
  /** ファイル名先頭から判定した科目。判定できなければ null */
  subject: Subject | null;
  /** 分野名。科目プレフィックスと「_テキスト」「_演習問題」の間 */
  subtopic: string | null;
  /** 回答あり版かどうか */
  variant: "with" | "without";
}

/**
 * 教材PDFのファイル名を解析する。
 * reference/ 配下の命名規則 `<科目>_<分野名>_テキスト_回答あり.pdf` を前提とし、
 * 回答なし版と回答あり版は baseName が一致することでペアになる。
 */
export function parseMaterialFileName(fileName: string): ParsedMaterialFile {
  // 「FAR-Not-for-profit-Accounting.pdf.pdf」のような二重拡張子にも対応する
  let name = fileName.replace(/(\.pdf)+$/i, "");

  let variant: "with" | "without" = "without";
  if (name.endsWith(ANSWER_SUFFIX)) {
    variant = "with";
    name = name.slice(0, -ANSWER_SUFFIX.length);
  }

  const subject =
    SUBJECT_PREFIXES.find((s) => name.startsWith(`${s}_`)) ?? null;

  // 分野名は科目プレフィックスを除いた先頭部分。
  // 「_テキスト」「_演習問題」以降（出典章のサフィックスを含む）は落とす。
  let subtopic: string | null = null;
  if (subject) {
    const rest = name.slice(subject.length + 1);
    subtopic = rest.split(/_(?:テキスト|演習問題)/)[0] || null;
  }

  return { baseName: name, subject, subtopic, variant };
}

export interface MaterialFileGroup {
  baseName: string;
  subject: Subject | null;
  subtopic: string | null;
  without: File | null;
  with: File | null;
}

/**
 * 複数の教材PDFを baseName ごとにまとめ、回答なし版と回答あり版をペアにする。
 * 表示順が安定するよう baseName の昇順で返す。
 */
export function groupMaterialFiles(files: File[]): MaterialFileGroup[] {
  const groups = new Map<string, MaterialFileGroup>();

  for (const file of files) {
    const parsed = parseMaterialFileName(file.name);
    const group = groups.get(parsed.baseName) ?? {
      baseName: parsed.baseName,
      subject: parsed.subject,
      subtopic: parsed.subtopic,
      without: null,
      with: null,
    };
    if (parsed.variant === "with") {
      group.with = file;
    } else {
      group.without = file;
    }
    groups.set(parsed.baseName, group);
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.baseName.localeCompare(b.baseName),
  );
}
