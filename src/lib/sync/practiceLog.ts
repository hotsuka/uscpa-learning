import type { QuestionAttempt } from "@/types/questions";
import type { TBSAttempt } from "@/types/tbs";
import type { MockExamResult } from "@/stores/mockExamStore";
import { applyAnswerCorrections } from "@/lib/practice/answerCorrections";
import { getJSTDateString } from "@/lib/utils";

/**
 * 問題演習ログ（四択MC・TBS・模試の結果）をNotionで端末間同期するための純粋関数群
 *
 * 1ページ = (端末ID, 種類, JST日付, 連番) のチャンクにまとめ、回答のJSONをテキスト欄へ分割して入れる。
 * 各端末は自分のチャンクだけを書くので書き込みの競合は起きない。
 * 他の端末のチャンクはキーによる和集合で取り込み、ローカルの回答は消さない・上書きしない。
 */

export type PracticeLogKind = "mcq" | "tbs" | "mock";

export interface PracticeLogItemMap {
  mcq: QuestionAttempt;
  tbs: TBSAttempt;
  mock: MockExamResult;
}

export interface PracticeLogChunk<K extends PracticeLogKind> {
  /** Notionページの識別子。`${deviceId}:${kind}:${date}:${seq}` */
  key: string;
  deviceId: string;
  kind: K;
  /** JSTの日付（YYYY-MM-DD） */
  date: string;
  seq: number;
  items: PracticeLogItemMap[K][];
}

// チャンクの中身（JSON）の形式。中身の形を変えるときに上げる
export const PRACTICE_LOG_SCHEMA_VERSION = 1;

// Notionのテキスト1要素は2000字まで
export const MAX_SEGMENT_CHARS = 2000;
// ページ取得では26要素目以降が返らないため25要素までに収める
export const MAX_SEGMENTS = 25;
// 1チャンクのJSONの上限（文字数）。区切り位置のずれを見込んで少し余裕を取る
export const MAX_CHUNK_CHARS = MAX_SEGMENT_CHARS * MAX_SEGMENTS - 1000;

/** 回答を一意に識別するキー。MCは questionId+解答日時の組で重複が無いことを実データで確認済み */
export function itemKey<K extends PracticeLogKind>(
  kind: K,
  item: PracticeLogItemMap[K],
): string {
  switch (kind) {
    case "mcq": {
      const a = item as QuestionAttempt;
      return `${a.questionId}@${a.attemptedAt}`;
    }
    case "tbs": {
      const a = item as TBSAttempt;
      return `${a.tbsId}@${a.completedAt}`;
    }
    default:
      return (item as MockExamResult).id;
  }
}

/** 回答の時刻（チャンクの日付と並び順に使う） */
export function itemTimestamp<K extends PracticeLogKind>(
  kind: K,
  item: PracticeLogItemMap[K],
): string {
  switch (kind) {
    case "mcq":
      return (item as QuestionAttempt).attemptedAt;
    case "tbs":
      return (item as TBSAttempt).completedAt;
    default:
      return (item as MockExamResult).finishedAt;
  }
}

const timeOf = (iso: string): number => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/**
 * ストアに置くときの並び順にそろえる。
 * MC・TBSは古い順（tbsBankStore.getLatestAttempt は配列の末尾を最新として扱う）、模試は新しい順。
 */
function sortForStore<K extends PracticeLogKind>(
  kind: K,
  items: PracticeLogItemMap[K][],
): PracticeLogItemMap[K][] {
  const sign = kind === "mock" ? -1 : 1;
  return [...items].sort(
    (a, b) =>
      sign * (timeOf(itemTimestamp(kind, a)) - timeOf(itemTimestamp(kind, b))),
  );
}

/**
 * この端末の回答をJST日付ごとのチャンクに分ける。
 * 1チャンクのJSONが MAX_CHUNK_CHARS を超える日は連番を振って分割する。
 * 同じ回答の集合からは常に同じチャンクができる（並びを時刻→キーで固定するため）。
 */
export function buildChunks<K extends PracticeLogKind>(
  kind: K,
  items: PracticeLogItemMap[K][],
  deviceId: string,
): PracticeLogChunk<K>[] {
  const byDate = new Map<string, PracticeLogItemMap[K][]>();
  for (const item of items) {
    const date = getJSTDateString(new Date(itemTimestamp(kind, item)));
    const list = byDate.get(date) ?? [];
    list.push(item);
    byDate.set(date, list);
  }

  const chunks: PracticeLogChunk<K>[] = [];
  const dates = Array.from(byDate.keys()).sort();
  for (const date of dates) {
    const dayItems = byDate.get(date)!.sort((a, b) => {
      const diff =
        timeOf(itemTimestamp(kind, a)) - timeOf(itemTimestamp(kind, b));
      if (diff !== 0) return diff;
      const ka = itemKey(kind, a);
      const kb = itemKey(kind, b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });

    let current: PracticeLogItemMap[K][] = [];
    // 配列の "[]" と要素間の "," の分を含めたJSONの文字数
    let currentChars = 2;
    const flush = () => {
      if (current.length === 0) return;
      const seq = chunks.filter((c) => c.date === date).length;
      chunks.push({
        key: `${deviceId}:${kind}:${date}:${seq}`,
        deviceId,
        kind,
        date,
        seq,
        items: current,
      });
      current = [];
      currentChars = 2;
    };
    for (const item of dayItems) {
      const chars = JSON.stringify(item).length;
      if (chars + 2 > MAX_CHUNK_CHARS) {
        throw new Error(
          `回答1件がNotionの1ページに収まりません: ${itemKey(kind, item)}（${chars}字）`,
        );
      }
      const added = (current.length > 0 ? 1 : 0) + chars;
      if (currentChars + added > MAX_CHUNK_CHARS) flush();
      currentChars += (current.length > 0 ? 1 : 0) + chars;
      current.push(item);
    }
    flush();
  }
  return chunks;
}

/** 文字列を MAX_SEGMENT_CHARS ごとに区切る。サロゲートペアの途中では区切らない */
export function splitSegments(text: string): string[] {
  const segments: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + MAX_SEGMENT_CHARS, text.length);
    const code = text.charCodeAt(end - 1);
    if (end < text.length && code >= 0xd800 && code <= 0xdbff) end -= 1;
    segments.push(text.slice(start, end));
    start = end;
  }
  return segments;
}

/** チャンクをNotionに入れるテキストの区切りと、変更検知用のハッシュにする */
export function serializeChunk<K extends PracticeLogKind>(
  chunk: PracticeLogChunk<K>,
): { segments: string[]; hash: string } {
  const text = JSON.stringify({
    v: PRACTICE_LOG_SCHEMA_VERSION,
    items: chunk.items,
  });
  const segments = splitSegments(text);
  if (segments.length > MAX_SEGMENTS) {
    throw new Error(
      `チャンク ${chunk.key} がNotionの1ページに収まりません（${segments.length}区切り）`,
    );
  }
  return { segments, hash: hashString(text) };
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isValidItem = (kind: PracticeLogKind, v: unknown): boolean => {
  if (!isObject(v)) return false;
  switch (kind) {
    case "mcq":
      return (
        typeof v.questionId === "string" &&
        typeof v.topic === "string" &&
        typeof v.selectedAnswer === "string" &&
        (typeof v.isCorrect === "boolean" || v.isCorrect === null) &&
        typeof v.attemptedAt === "string"
      );
    case "tbs":
      return (
        typeof v.tbsId === "string" &&
        typeof v.completedAt === "string" &&
        typeof v.totalScore === "number" &&
        Array.isArray(v.taskAttempts)
      );
    default:
      return (
        typeof v.id === "string" &&
        typeof v.finishedAt === "string" &&
        typeof v.score === "number" &&
        Array.isArray(v.answers)
      );
  }
};

export interface ParsedChunkPayload<K extends PracticeLogKind> {
  items: PracticeLogItemMap[K][];
  /** 形が合わず読み飛ばした件数 */
  skipped: number;
}

/**
 * Notionから読んだテキストの区切りをチャンクの中身に戻す。
 * JSONとして読めない・未知の形式のときは null（そのチャンクは取り込まない）。
 * 形の合わない回答は1件ずつ読み飛ばす。
 */
export function parseChunkPayload<K extends PracticeLogKind>(
  kind: K,
  segments: string[],
): ParsedChunkPayload<K> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(segments.join(""));
  } catch {
    return null;
  }
  if (
    !isObject(parsed) ||
    parsed.v !== PRACTICE_LOG_SCHEMA_VERSION ||
    !Array.isArray(parsed.items)
  ) {
    return null;
  }
  const items: PracticeLogItemMap[K][] = [];
  let skipped = 0;
  for (const item of parsed.items) {
    if (isValidItem(kind, item)) {
      items.push(item as PracticeLogItemMap[K]);
    } else {
      skipped++;
    }
  }
  return { items, skipped };
}

export interface MergePracticeLogResult<K extends PracticeLogKind> {
  items: PracticeLogItemMap[K][];
  /** ローカルに無く、今回追加した件数 */
  added: number;
}

/**
 * 他の端末の回答をローカルに取り込む（キーによる和集合）。
 * - ローカルの回答は消さない・上書きしない（同じキーならローカルを採用）
 * - MCは取り込む回答に正誤補正をかける（他の端末のデータは migrate を通っていないことがあるため）
 * - 追加が無ければローカルの配列をそのまま返す（並べ替えもしない）
 */
export function mergePracticeLog<K extends PracticeLogKind>(
  kind: K,
  local: PracticeLogItemMap[K][],
  remote: PracticeLogItemMap[K][],
): MergePracticeLogResult<K> {
  const seen = new Set(local.map((item) => itemKey(kind, item)));
  const additions: PracticeLogItemMap[K][] = [];
  for (const item of remote) {
    const key = itemKey(kind, item);
    if (seen.has(key)) continue;
    seen.add(key);
    additions.push(
      kind === "mcq"
        ? (applyAnswerCorrections(
            item as QuestionAttempt,
          ) as PracticeLogItemMap[K])
        : item,
    );
  }
  if (additions.length === 0) return { items: local, added: 0 };
  return {
    items: sortForStore(kind, [...local, ...additions]),
    added: additions.length,
  };
}

/**
 * この端末のチャンクに入れる回答を選ぶ。
 * 他の端末のチャンクから取り込んだ回答まで自分のチャンクに入れると、Notion上で同じ回答が端末の数だけ増えるため除く。
 * （両方の端末に元からある回答は両方から送られるが、取り込み時にキーで1件にまとまるので問題ない）
 */
export function selectOwnItems<K extends PracticeLogKind>(
  kind: K,
  local: PracticeLogItemMap[K][],
  otherDeviceKeys: ReadonlySet<string>,
): PracticeLogItemMap[K][] {
  return local.filter((item) => !otherDeviceKeys.has(itemKey(kind, item)));
}

/** 変更検知用の32bitハッシュ（FNV-1a）。暗号用途ではない */
export function hashString(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
