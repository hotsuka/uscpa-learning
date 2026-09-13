// 問題演習系のストア（Notion同期されない）。移行前バックアップと旧形式バックアップの判定に使う
export const TARGET_KEYS = [
  "uscpa-question-bank",
  "uscpa-tbs-bank",
  "uscpa-mock-exams",
] as const;

export type TargetKey = (typeof TARGET_KEYS)[number];

// バックアップとJSON書き出しの対象
// Notion同期しているデータも含める。同期が止まっていた期間の記録を失わないため
export const BACKUP_KEYS = [
  ...TARGET_KEYS,
  "uscpa-records",
  "uscpa-notes",
  "uscpa-page-memos",
] as const;

export type BackupKey = (typeof BACKUP_KEYS)[number];

// 旧形式（localStorage）バックアップキーの接尾辞パターン
export const PRE_MIGRATE_INFIX = ".pre-v";
export const MANUAL_INFIX = ".manual.";

// 旧形式（localStorage）バックアップの種別
export type BackupType = "pre-migrate" | "manual";

// IndexedDBに保存するバックアップの種別
export type SnapshotType = "auto" | "manual" | "pre-migrate";

// 種別ごとに残す世代数（データの種類ごとに数える）
export const MAX_GENERATIONS: Record<SnapshotType, number> = {
  auto: 7,
  manual: 10,
  "pre-migrate": 10,
};

// 主要配列のキー名（件数の表示用）。配列を持たないデータは含めない
export const RECORD_ARRAY_PATH: Partial<Record<BackupKey, string>> = {
  "uscpa-question-bank": "attempts",
  "uscpa-tbs-bank": "attempts",
  "uscpa-mock-exams": "results",
  "uscpa-records": "records",
  "uscpa-notes": "notes",
};
