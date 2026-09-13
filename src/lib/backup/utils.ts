import {
  TARGET_KEYS,
  PRE_MIGRATE_INFIX,
  MANUAL_INFIX,
  RECORD_ARRAY_PATH,
  type BackupType,
  type TargetKey,
} from "./constants";
import { collectBackupEntries, saveSnapshots } from "./autoBackup";

export interface BackupItem {
  originalKey: TargetKey;
  backupKey: string;
  createdAt: string; // ISO8601
  type: BackupType;
  byteSize: number;
  recordCount: number | null;
}

const isBrowser = (): boolean =>
  typeof window !== "undefined" && typeof localStorage !== "undefined";

// Zustand persist の保存形式 { state: {...}, version: N } を想定して、配列長を読み取る
const extractRecordCount = (
  originalKey: string,
  rawJson: string | null,
): number | null => {
  if (!rawJson) return null;
  try {
    const parsed = JSON.parse(rawJson) as { state?: Record<string, unknown> };
    const arrayKey = RECORD_ARRAY_PATH[originalKey as TargetKey];
    if (!arrayKey || !parsed?.state) return null;
    const arr = parsed.state[arrayKey];
    return Array.isArray(arr) ? arr.length : null;
  } catch {
    return null;
  }
};

const byteSizeOf = (s: string | null): number => (s ? s.length : 0);

/**
 * migrate 関数の冒頭で呼ぶ。
 * 現在の localStorage の生の文字列を、移行前バックアップとしてIndexedDBに退避する。
 * localStorageに退避すると容量上限（約5MB）を圧迫し、本体データの保存が失敗するため使わない。
 * 値はここで同期的に読み取るので、書き込み完了前にmigrateが進んでも移行前の内容が残る。
 * 失敗しても migrate を止めないように握る。
 */
export function backupBeforeMigrate(key: string, fromVersion: number): void {
  if (!isBrowser()) return;
  try {
    const current = localStorage.getItem(key);
    if (!current) return;
    saveSnapshots("pre-migrate", [{ originalKey: key, data: current }], `v${fromVersion}`).catch(
      (error) => console.error("[Backup] 移行前バックアップの保存に失敗:", key, error),
    );
  } catch {
    // バックアップ失敗で本体処理を止めるのは本末転倒
  }
}

/**
 * 「今すぐバックアップ」ボタンと、復元・読み込み前のスナップショット用。
 * バックアップ対象のデータをまとめてIndexedDBに保存する。
 */
export async function createManualBackup(): Promise<{ savedKeys: string[] }> {
  const entries = collectBackupEntries();
  if (entries.length === 0) return { savedKeys: [] };
  await saveSnapshots("manual", entries);
  return { savedKeys: entries.map((entry) => entry.originalKey) };
}

/**
 * 旧形式（localStorageに保存していた頃）のバックアップキーを列挙する。
 * 日時降順で返す。
 */
export function listBackups(): BackupItem[] {
  if (!isBrowser()) return [];
  const items: BackupItem[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    for (const originalKey of TARGET_KEYS) {
      const preMigratePrefix = `${originalKey}${PRE_MIGRATE_INFIX}`;
      const manualPrefix = `${originalKey}${MANUAL_INFIX}`;

      if (key.startsWith(preMigratePrefix)) {
        const suffix = key.slice(preMigratePrefix.length); // 例: "2.2026-05-11T..."
        const dotIdx = suffix.indexOf(".");
        const createdAt = dotIdx >= 0 ? suffix.slice(dotIdx + 1) : "";
        const raw = localStorage.getItem(key);
        items.push({
          originalKey,
          backupKey: key,
          createdAt,
          type: "pre-migrate",
          byteSize: byteSizeOf(raw),
          recordCount: extractRecordCount(originalKey, raw),
        });
      } else if (key.startsWith(manualPrefix)) {
        const createdAt = key.slice(manualPrefix.length);
        const raw = localStorage.getItem(key);
        items.push({
          originalKey,
          backupKey: key,
          createdAt,
          type: "manual",
          byteSize: byteSizeOf(raw),
          recordCount: extractRecordCount(originalKey, raw),
        });
      }
    }
  }

  // 日時降順
  items.sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );
  return items;
}

/**
 * 指定したバックアップキーの値を元のキーに書き戻す。
 * 呼び出し側で `window.location.reload()` を行うこと。
 * 戻り値: 復元成功時の元キー、失敗時は null
 */
export function restoreBackup(backupKey: string): TargetKey | null {
  if (!isBrowser()) return null;
  const originalKey = TARGET_KEYS.find(
    (k) =>
      backupKey.startsWith(`${k}${PRE_MIGRATE_INFIX}`) ||
      backupKey.startsWith(`${k}${MANUAL_INFIX}`),
  );
  if (!originalKey) return null;
  try {
    const raw = localStorage.getItem(backupKey);
    if (raw === null) return null;
    localStorage.setItem(originalKey, raw);
    return originalKey;
  } catch {
    return null;
  }
}

/**
 * 指定したバックアップキーを削除する。
 */
export function deleteBackup(backupKey: string): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(backupKey);
  } catch {
    // noop
  }
}
