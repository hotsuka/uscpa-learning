import {
  TARGET_KEYS,
  PRE_MIGRATE_INFIX,
  MANUAL_INFIX,
  RECORD_ARRAY_PATH,
  type BackupType,
  type TargetKey,
} from "./constants";

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
 * 現在の localStorage の生の文字列を `${key}.pre-v{fromVersion}.{ISO8601}` キーに退避する。
 * 失敗しても migrate を止めないように try/catch で握る。
 */
export function backupBeforeMigrate(key: string, fromVersion: number): void {
  if (!isBrowser()) return;
  try {
    const current = localStorage.getItem(key);
    if (!current) return;
    const backupKey = `${key}${PRE_MIGRATE_INFIX}${fromVersion}.${new Date().toISOString()}`;
    localStorage.setItem(backupKey, current);
  } catch {
    // バックアップ失敗で本体処理を止めるのは本末転倒
  }
}

/**
 * 「今すぐバックアップ」ボタン用。
 * 対象ストアそれぞれの現在値を `${key}.manual.{ISO8601}` キーに保存する。
 */
export function createManualBackup(): { savedKeys: string[] } {
  if (!isBrowser()) return { savedKeys: [] };
  const timestamp = new Date().toISOString();
  const saved: string[] = [];
  for (const key of TARGET_KEYS) {
    try {
      const current = localStorage.getItem(key);
      if (!current) continue;
      const backupKey = `${key}${MANUAL_INFIX}${timestamp}`;
      localStorage.setItem(backupKey, current);
      saved.push(backupKey);
    } catch {
      // 個別失敗はスキップ
    }
  }
  return { savedKeys: saved };
}

/**
 * localStorage 全体を走査して、TARGET_KEYS に紐づくバックアップキーを列挙する。
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
