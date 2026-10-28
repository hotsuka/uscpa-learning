import { useQuestionBankStore } from "@/stores/questionBankStore";
import { useTBSBankStore } from "@/stores/tbsBankStore";
import { useMockExamStore } from "@/stores/mockExamStore";
import { getDeviceId } from "@/lib/utils";
import { saveSnapshots } from "@/lib/backup/autoBackup";
import { TARGET_KEYS } from "@/lib/backup/constants";
import type { PracticeLogRemoteChunk } from "@/lib/notion/practiceLog";
import {
  itemKey,
  mergePracticeLog,
  parseChunkPayload,
  type PracticeLogKind,
} from "./practiceLog";
import {
  PRACTICE_LOG_KINDS,
  readLocal,
  type LocalPracticeLog,
} from "./practiceLogPush";

/**
 * 他の端末がNotionへ送った問題演習ログを取り込む
 *
 * ローカルに無い回答を足すだけで、ローカルの回答を消したり書き換えたりはしない。
 * 取り込む前に3つのストアをIndexedDBへバックアップし、バックアップできなければ取り込まない。
 * 取り込んだ回答には imported を付け、この端末の分としてNotionへ送り直さない。
 */

export type PracticeLogCounts = Record<PracticeLogKind, number>;

export interface PullPlan {
  /** ローカルに無く、足す回答（imported 付き） */
  additions: LocalPracticeLog;
  added: PracticeLogCounts;
  /** 読めなかったチャンク（JSONが壊れている・未知の形式・種類が不明） */
  unreadableChunks: string[];
}

/** Notionのチャンクから、ローカルに無い他の端末の回答を選ぶ */
export function planPracticeLogPull(params: {
  local: LocalPracticeLog;
  deviceId: string;
  remote: PracticeLogRemoteChunk[];
}): PullPlan {
  const additions: LocalPracticeLog = { mcq: [], tbs: [], mock: [] };
  const seen: Record<PracticeLogKind, Set<string>> = {
    mcq: new Set(params.local.mcq.map((item) => itemKey("mcq", item))),
    tbs: new Set(params.local.tbs.map((item) => itemKey("tbs", item))),
    mock: new Set(params.local.mock.map((item) => itemKey("mock", item))),
  };
  const unreadableChunks: string[] = [];

  for (const chunk of params.remote) {
    // この端末のチャンクは元からローカルにある分なので読まない
    if (chunk.deviceId === params.deviceId) continue;
    const parsed = chunk.kind
      ? parseChunkPayload(chunk.kind, chunk.segments)
      : null;
    if (!chunk.kind || !parsed) {
      unreadableChunks.push(chunk.key || chunk.pageId);
      continue;
    }
    const kind = chunk.kind;
    for (const item of parsed.items) {
      const key = itemKey(kind, item);
      if (seen[kind].has(key)) continue;
      seen[kind].add(key);
      (additions[kind] as unknown[]).push({ ...item, imported: true });
    }
  }

  return {
    additions,
    added: {
      mcq: additions.mcq.length,
      tbs: additions.tbs.length,
      mock: additions.mock.length,
    },
    unreadableChunks,
  };
}

// localStorage の上限（ブラウザによって約500万文字）に対して、取り込み後もこれ以下に収める
const STORAGE_CHAR_LIMIT = 4_800_000;

/** localStorage 全体の文字数（キー＋値） */
const measureLocalStorageChars = (): number => {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === null) continue;
    total += key.length + (localStorage.getItem(key)?.length ?? 0);
  }
  return total;
};

/** Notionの問題演習ログAPIが失敗したときのエラー。503 なら未設定 */
export class PracticeLogHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PracticeLogHttpError";
  }
}

export interface PullResult {
  added: PracticeLogCounts;
  /** 他の端末のチャンクの数 */
  remoteChunks: number;
  unreadableChunks: string[];
  /** 取り込む前にバックアップを取ったか（足すものが無ければ取らない） */
  backedUp: boolean;
}

/** 他の端末の回答をNotionから読み、ローカルに無いものだけを足す */
export async function pullPracticeLog(): Promise<PullResult> {
  const deviceId = getDeviceId();
  const response = await fetch(
    `/api/notion/practice-log?excludeDeviceId=${encodeURIComponent(deviceId)}`,
  );
  if (!response.ok) {
    const body: { error?: string } = await response.json().catch(() => ({}));
    throw new PracticeLogHttpError(
      body.error ?? `HTTP ${response.status}`,
      response.status,
    );
  }
  const { chunks }: { chunks: PracticeLogRemoteChunk[] } =
    await response.json();

  const plan = planPracticeLogPull({ local: readLocal(), deviceId, remote: chunks });
  const result: PullResult = {
    added: plan.added,
    remoteChunks: chunks.length,
    unreadableChunks: plan.unreadableChunks,
    backedUp: false,
  };
  const totalAdded = plan.added.mcq + plan.added.tbs + plan.added.mock;
  if (totalAdded === 0) return result;

  // 書き込めずに途中で止まらないよう、足した後の容量を先に見積もる
  const additionChars = PRACTICE_LOG_KINDS.reduce(
    (sum, kind) => sum + JSON.stringify(plan.additions[kind]).length,
    0,
  );
  if (measureLocalStorageChars() + additionChars > STORAGE_CHAR_LIMIT) {
    throw new Error(
      `取り込むとブラウザの保存容量を超えるため中止しました（追加分 約${Math.ceil(additionChars / 1000)}千文字）`,
    );
  }

  // 取り込む前の状態をIndexedDBへ保存する。保存できなければ何も変えずに止める
  const entries = TARGET_KEYS.flatMap((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? [] : [{ originalKey: key, data: raw }];
  });
  try {
    await saveSnapshots("pre-import", entries);
  } catch (error) {
    throw new Error(
      `バックアップに失敗したため取り込みを中止しました: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  result.backedUp = entries.length > 0;

  // 関数形式で現在の状態に足すので、バックアップ中に解いた回答も失われない
  useQuestionBankStore.setState((state) => ({
    attempts: mergePracticeLog("mcq", state.attempts, plan.additions.mcq).items,
  }));
  useTBSBankStore.setState((state) => ({
    attempts: mergePracticeLog("tbs", state.attempts, plan.additions.tbs).items,
  }));
  useMockExamStore.setState((state) => ({
    results: mergePracticeLog("mock", state.results, plan.additions.mock).items,
  }));

  return result;
}
