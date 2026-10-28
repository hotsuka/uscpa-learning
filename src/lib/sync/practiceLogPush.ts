import { useQuestionBankStore } from "@/stores/questionBankStore";
import { useTBSBankStore } from "@/stores/tbsBankStore";
import { useMockExamStore } from "@/stores/mockExamStore";
import { getDeviceId } from "@/lib/utils";
import type {
  PracticeLogChunkInput,
  PracticeLogRemoteChunk,
} from "@/lib/notion/practiceLog";
import { MAX_CHUNKS_PER_REQUEST } from "@/lib/validations/practiceLog";
import {
  PRACTICE_LOG_SCHEMA_VERSION,
  buildChunks,
  itemKey,
  parseChunkPayload,
  serializeChunk,
  type PracticeLogItemMap,
  type PracticeLogKind,
} from "./practiceLog";

/**
 * 問題演習ログをNotionへ送る（同期の第3段階: 送るだけ）
 *
 * 回答・TBS・模試のストアは読むだけで書き換えない。
 * ローカルに書くのは「どのチャンクをどの内容で送ったか」を覚える PUSH_STATE_KEY だけ。
 * 他の端末の分の取り込みは次の段階で行う。
 */

export const PRACTICE_LOG_KINDS: readonly PracticeLogKind[] = [
  "mcq",
  "tbs",
  "mock",
];

// 送信済みチャンクのハッシュ（チャンクキー → ハッシュ）。内容が変わったチャンクだけを送るために使う
const PUSH_STATE_KEY = "uscpa-practice-log-push";

export type LocalPracticeLog = {
  [K in PracticeLogKind]: PracticeLogItemMap[K][];
};

export interface PushPlan {
  /** 内容が変わった（または未送信の）チャンク */
  toSend: PracticeLogChunkInput[];
  /** この端末のチャンクの総数 */
  totalChunks: number;
}

/**
 * 送るチャンクを決める。
 * この段階ではまだ他の端末の分を取り込んでいないため、ローカルの回答はすべてこの端末のものとして送る。
 */
export function planPracticeLogPush(params: {
  local: LocalPracticeLog;
  deviceId: string;
  pushedHashes: Record<string, string>;
  force?: boolean;
}): PushPlan {
  const toSend: PracticeLogChunkInput[] = [];
  let totalChunks = 0;
  for (const kind of PRACTICE_LOG_KINDS) {
    const chunks = buildChunks(kind, params.local[kind], params.deviceId);
    totalChunks += chunks.length;
    for (const chunk of chunks) {
      const { segments, hash } = serializeChunk(chunk);
      if (!params.force && params.pushedHashes[chunk.key] === hash) continue;
      toSend.push({
        key: chunk.key,
        deviceId: chunk.deviceId,
        kind: chunk.kind,
        date: chunk.date,
        seq: chunk.seq,
        count: chunk.items.length,
        hash,
        schemaVersion: PRACTICE_LOG_SCHEMA_VERSION,
        segments,
      });
    }
  }
  return { toSend, totalChunks };
}

export interface KindVerification {
  kind: PracticeLogKind;
  /** ローカルの件数 */
  local: number;
  /** Notion上のこの端末のチャンクに入っている件数（キーの重複を除く） */
  ownOnNotion: number;
  /** ローカルにあるのにこの端末のチャンクに無い件数（送信後は0になるはず） */
  missingOnNotion: number;
  /** 他の端末のチャンクにあり、ローカルに無い件数（次の段階で取り込む分） */
  onlyOnOtherDevices: number;
}

export interface VerificationResult {
  kinds: KindVerification[];
  /** 読めなかったチャンク（JSONが壊れている・未知の形式・種類が不明） */
  unreadableChunks: string[];
}

/** ローカルとNotionの件数を突き合わせる */
export function verifyPracticeLog(params: {
  local: LocalPracticeLog;
  deviceId: string;
  remote: PracticeLogRemoteChunk[];
}): VerificationResult {
  const unreadableChunks: string[] = [];
  const ownKeys: Record<PracticeLogKind, Set<string>> = {
    mcq: new Set(),
    tbs: new Set(),
    mock: new Set(),
  };
  const otherKeys: Record<PracticeLogKind, Set<string>> = {
    mcq: new Set(),
    tbs: new Set(),
    mock: new Set(),
  };

  for (const chunk of params.remote) {
    const parsed = chunk.kind
      ? parseChunkPayload(chunk.kind, chunk.segments)
      : null;
    if (!chunk.kind || !parsed) {
      unreadableChunks.push(chunk.key || chunk.pageId);
      continue;
    }
    const target = chunk.deviceId === params.deviceId ? ownKeys : otherKeys;
    for (const item of parsed.items)
      target[chunk.kind].add(itemKey(chunk.kind, item));
  }

  const kinds = PRACTICE_LOG_KINDS.map((kind): KindVerification => {
    const localKeys = new Set(
      params.local[kind].map((item) => itemKey(kind, item)),
    );
    let missingOnNotion = 0;
    for (const key of localKeys) if (!ownKeys[kind].has(key)) missingOnNotion++;
    let onlyOnOtherDevices = 0;
    for (const key of otherKeys[kind])
      if (!localKeys.has(key)) onlyOnOtherDevices++;
    return {
      kind,
      local: params.local[kind].length,
      ownOnNotion: ownKeys[kind].size,
      missingOnNotion,
      onlyOnOtherDevices,
    };
  });

  return { kinds, unreadableChunks };
}

// ---- ブラウザで動かす部分 ----

const readLocal = (): LocalPracticeLog => ({
  mcq: useQuestionBankStore.getState().attempts,
  tbs: useTBSBankStore.getState().attempts,
  mock: useMockExamStore.getState().results,
});

const readPushedHashes = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(PUSH_STATE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
};

const writePushedHashes = (hashes: Record<string, string>): void => {
  try {
    localStorage.setItem(PUSH_STATE_KEY, JSON.stringify(hashes));
  } catch (error) {
    // 保存できなくても次回すべて送り直すだけで、データは失われない
    console.warn("[PracticeLog] 送信済みの記録を保存できませんでした:", error);
  }
};

export interface PushProgress {
  sent: number;
  total: number;
}

export interface PushResult {
  totalChunks: number;
  sent: number;
  failed: { key: string; error: string }[];
}

/**
 * ローカルの回答をNotionへ送る。
 * force=true なら送信済みの記録を無視してすべて送り直す（Notion側のページが消えたときなど）。
 */
export async function pushPracticeLog(options?: {
  force?: boolean;
  onProgress?: (progress: PushProgress) => void;
}): Promise<PushResult> {
  const deviceId = getDeviceId();
  const pushedHashes = readPushedHashes();
  const plan = planPracticeLogPush({
    local: readLocal(),
    deviceId,
    pushedHashes,
    force: options?.force,
  });

  const failed: PushResult["failed"] = [];
  let sent = 0;
  options?.onProgress?.({ sent, total: plan.toSend.length });

  for (let i = 0; i < plan.toSend.length; i += MAX_CHUNKS_PER_REQUEST) {
    const batch = plan.toSend.slice(i, i + MAX_CHUNKS_PER_REQUEST);
    try {
      const response = await fetch("/api/notion/practice-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunks: batch }),
      });
      const body: {
        results?: { key: string }[];
        failed?: { key: string; error: string }[];
        error?: string;
      } = await response.json().catch(() => ({}));
      if (!response.ok && !body.results) {
        for (const c of batch)
          failed.push({
            key: c.key,
            error: body.error ?? `HTTP ${response.status}`,
          });
        // 未設定（503）なら続けても失敗するだけなので止める
        if (response.status === 503) break;
        continue;
      }
      const okKeys = new Set((body.results ?? []).map((r) => r.key));
      for (const c of batch) {
        if (okKeys.has(c.key)) {
          pushedHashes[c.key] = c.hash;
          sent++;
        }
      }
      failed.push(...(body.failed ?? []));
      writePushedHashes(pushedHashes);
    } catch (error) {
      for (const c of batch)
        failed.push({
          key: c.key,
          error: error instanceof Error ? error.message : "通信エラー",
        });
      if (typeof navigator !== "undefined" && !navigator.onLine) break;
    }
    options?.onProgress?.({ sent, total: plan.toSend.length });
  }

  return { totalChunks: plan.totalChunks, sent, failed };
}

/** Notionのすべてのチャンクを読み、ローカルの件数と突き合わせる */
export async function verifyPracticeLogWithNotion(): Promise<VerificationResult> {
  const response = await fetch("/api/notion/practice-log");
  if (!response.ok) {
    const body: { error?: string } = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${response.status}`);
  }
  const { chunks }: { chunks: PracticeLogRemoteChunk[] } =
    await response.json();
  return verifyPracticeLog({
    local: readLocal(),
    deviceId: getDeviceId(),
    remote: chunks,
  });
}
