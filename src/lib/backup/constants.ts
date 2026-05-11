// バックアップ対象の localStorage キー
// Notion 同期されていないストアのみが対象（同期済みデータは Notion から復元可能）
export const TARGET_KEYS = ["uscpa-question-bank", "uscpa-tbs-bank"] as const;

export type TargetKey = (typeof TARGET_KEYS)[number];

// バックアップキーの接尾辞パターン
export const PRE_MIGRATE_INFIX = ".pre-v";
export const MANUAL_INFIX = ".manual.";

// バックアップキーの種別
export type BackupType = "pre-migrate" | "manual";

// 主要配列のキー名（レコード数の表示用）
export const RECORD_ARRAY_PATH: Record<TargetKey, string> = {
  "uscpa-question-bank": "attempts",
  "uscpa-tbs-bank": "attempts",
};
