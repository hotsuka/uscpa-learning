import type { StudyRecord } from "@/types"

export interface MergeRecordsResult {
  records: StudyRecord[]
  notionIdMap: Record<string, string>
}

/**
 * Notionから取得した学習記録をローカルの記録とマージする（Last-Write-Wins）。
 *
 * ローカルとNotionの対応は notionIdMap を優先し、無ければ同じIDの記録を同一とみなす。
 * 対応付けが無いというだけでNotion側を別の記録として追加すると、
 * 別経路でNotionに作成された記録（一括送信など）がローカルで重複するため。
 */
export function mergeNotionRecords(
  localRecords: StudyRecord[],
  notionRecords: StudyRecord[],
  existingNotionIdMap: Record<string, string>,
): MergeRecordsResult {
  const notionIdMap: Record<string, string> = { ...existingNotionIdMap }

  // NotionレコードのIDでマップを作成
  const notionRecordMap = new Map<string, StudyRecord>()
  for (const record of notionRecords) {
    notionRecordMap.set(record.id, record)
    notionIdMap[record.id] = record.id
  }

  const merged: StudyRecord[] = []

  for (const localRecord of localRecords) {
    const mappedId = existingNotionIdMap[localRecord.id]
    const notionId =
      mappedId && notionRecordMap.has(mappedId)
        ? mappedId
        : notionRecordMap.has(localRecord.id)
          ? localRecord.id
          : undefined

    if (!notionId) {
      // まだNotionに無い、または今回の取得範囲外 → ローカルを保持（ローカルデータを優先保護）
      merged.push(localRecord)
      continue
    }

    const notionRecord = notionRecordMap.get(notionId)!
    const localUpdated = new Date(localRecord.updatedAt).getTime()
    const notionUpdated = new Date(notionRecord.updatedAt).getTime()
    // 同時刻ならローカルを採用する
    merged.push(localUpdated >= notionUpdated ? localRecord : notionRecord)
    notionRecordMap.delete(notionId)
  }

  // Notionにのみ存在する記録を追加
  for (const notionRecord of notionRecordMap.values()) {
    merged.push(notionRecord)
  }

  // 作成日時の新しい順にソート
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return { records: merged, notionIdMap }
}
