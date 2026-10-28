import { pushPracticeLog } from "./practiceLogPush";
import { PracticeLogHttpError, pullPracticeLog } from "./practiceLogPull";

/**
 * 問題演習ログの自動同期（同期の第5段階）
 *
 * 起動時・オンライン復帰時・画面に戻ったときに「取り込み→送信」を、回答の後に「送信」だけを行う。
 * 取り込みは pullPracticeLog と同じく足すだけで、足す前にバックアップを取る。
 * 手動のボタンと自動同期、複数のタブが同時に送ると同じチャンクのページが二重に作られうるため、
 * すべて withPracticeLogLock で1つずつ実行する。
 */

const LOCK_NAME = "uscpa-practice-log-sync";
const STATUS_KEY = "uscpa-practice-log-auto";

/** 起動時・画面に戻ったときは、前回の自動同期からこれだけ空いていれば取り込む */
export const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;
/** 最後の回答からこれだけ待って送る（続けて解いている間は送らない） */
export const PUSH_AFTER_ANSWER_DELAY_MS = 30 * 1000;

// navigator.locks が無い環境用の、このタブの中だけのロック
let fallbackChain: Promise<unknown> = Promise.resolve();
let fallbackBusy = false;

/**
 * 問題演習ログの同期を1つずつ実行する（他のタブとも排他）。
 * ifAvailable なら実行中のものがあるときは待たずに null を返す。
 */
export async function withPracticeLogLock<T>(
  fn: () => Promise<T>,
  options?: { ifAvailable?: boolean },
): Promise<T | null> {
  const ifAvailable = options?.ifAvailable ?? false;
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(LOCK_NAME, { ifAvailable }, (lock) =>
      lock ? fn() : null,
    );
  }
  if (ifAvailable && fallbackBusy) return null;
  const run = fallbackChain.then(async () => {
    fallbackBusy = true;
    try {
      return await fn();
    } finally {
      fallbackBusy = false;
    }
  });
  // 失敗しても後の実行は続ける
  fallbackChain = run.catch(() => undefined);
  return run;
}

export interface AutoSyncStatus {
  /** 最後に自動同期を試みた日時 */
  lastRunAt: string;
  ok: boolean;
  /** 取り込んだ件数（MC・TBS・模試の合計） */
  added: number;
  /** 送ったページ数 */
  sent: number;
  error?: string;
}

export function readAutoSyncStatus(): AutoSyncStatus | null {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as AutoSyncStatus)
      : null;
  } catch {
    return null;
  }
}

const writeAutoSyncStatus = (status: AutoSyncStatus): void => {
  try {
    localStorage.setItem(STATUS_KEY, JSON.stringify(status));
  } catch {
    // 状態の記録に失敗しても同期そのものには影響させない
  }
};

/** 前回の自動同期から間隔が空いていれば true */
export function isAutoSyncDue(
  status: AutoSyncStatus | null,
  now: number = Date.now(),
): boolean {
  if (!status) return true;
  const last = new Date(status.lastRunAt).getTime();
  return Number.isNaN(last) || now - last >= AUTO_SYNC_INTERVAL_MS;
}

// Notion側が未設定（503）とわかったら、このページを開いている間は試さない
let notConfigured = false;
// このページを開いてから一度でも同期できたか。回答後の送信は、同期できる環境とわかってから行う
let syncedThisSession = false;

/**
 * 自動同期を1回行う。pull=false なら送るだけ（回答の後）。
 * 他の同期が実行中・オフライン・未設定なら何もしない。失敗は記録するだけで投げない。
 */
export async function runPracticeLogAutoSync(options: {
  pull: boolean;
}): Promise<AutoSyncStatus | null> {
  if (typeof window === "undefined" || notConfigured) return null;
  if (!navigator.onLine) return null;
  if (!options.pull && !syncedThisSession) return null;

  return withPracticeLogLock(
    async () => {
      const status: AutoSyncStatus = {
        lastRunAt: new Date().toISOString(),
        ok: true,
        added: 0,
        sent: 0,
      };
      try {
        if (options.pull) {
          const pulled = await pullPracticeLog();
          status.added =
            pulled.added.mcq + pulled.added.tbs + pulled.added.mock;
        }
        const pushed = await pushPracticeLog();
        status.sent = pushed.sent;
        if (pushed.failed.length > 0) {
          status.ok = false;
          status.error = `${pushed.failed.length} ページを送れませんでした（${pushed.failed[0].error}）`;
        }
        syncedThisSession = true;
      } catch (error) {
        if (error instanceof PracticeLogHttpError && error.status === 503) {
          notConfigured = true;
        }
        status.ok = false;
        status.error = error instanceof Error ? error.message : String(error);
        console.warn("[PracticeLog] 自動同期に失敗しました:", error);
      }
      // 送るだけのときは取り込みの時刻を進めない（起動時の取り込みを省かないため）
      if (options.pull) writeAutoSyncStatus(status);
      else {
        const previous = readAutoSyncStatus();
        writeAutoSyncStatus({
          ...status,
          lastRunAt: previous?.lastRunAt ?? status.lastRunAt,
        });
      }
      if (status.added > 0 || status.sent > 0) {
        console.log(
          `[PracticeLog] 自動同期: ${status.added} 件取り込み、${status.sent} ページ送信`,
        );
      }
      return status;
    },
    { ifAvailable: true },
  );
}
