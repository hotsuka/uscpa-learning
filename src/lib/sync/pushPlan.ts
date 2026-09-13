import type { StudyRecord } from "@/types"

// Notionの日付プロパティは分単位で保存されるため、この差までは同じ更新とみなす
export const UPDATED_AT_TOLERANCE_MS = 60 * 1000

// 1回の同期で送り直す上限（Notion APIのレート制限と、想定外の大量送信を防ぐため）
export const MAX_PUSH_PER_SYNC = 50

export interface NotionPushPlan {
  /** この端末で作成したのにNotionに無い記録 */
  toCreate: StudyRecord[]
  /** Notionより1分以上新しい編集が入っている記録 */
  toUpdate: StudyRecord[]
}

interface PlanNotionPushArgs {
  localRecords: StudyRecord[]
  /** Notionから全件取得した記録（取得に失敗した場合は呼ばないこと） */
  notionRecords: StudyRecord[]
  notionIdMap: Record<string, string>
  deviceId: string
  limit?: number
}

/**
 * Notionへ送り直す記録を決める。
 *
 * 作成は「この端末で作った記録」に限る。他端末で作られ、そちらで削除された記録を
 * この端末が持っていた場合に、Notionへ復活させないため。
 * 更新はNotionに同じ記録があり、ローカルの方が明確に新しいものだけを対象にする。
 */
export function planNotionPush({
  localRecords,
  notionRecords,
  notionIdMap,
  deviceId,
  limit = MAX_PUSH_PER_SYNC,
}: PlanNotionPushArgs): NotionPushPlan {
  const notionById = new Map(notionRecords.map((r) => [r.id, r]))
  const toCreate: StudyRecord[] = []
  const toUpdate: StudyRecord[] = []
  const seen = new Set<string>()

  for (const local of localRecords) {
    if (seen.has(local.id)) continue
    seen.add(local.id)

    const notion = notionById.get(local.id) ?? notionById.get(notionIdMap[local.id] ?? "")
    if (!notion) {
      if (local.deviceId === deviceId) toCreate.push(local)
      continue
    }

    const localUpdated = new Date(local.updatedAt).getTime()
    const notionUpdated = new Date(notion.updatedAt).getTime()
    if (localUpdated - notionUpdated > UPDATED_AT_TOLERANCE_MS) toUpdate.push(local)
  }

  // 古い順に送る。上限は作成を優先して配分する
  const byUpdatedAt = (a: StudyRecord, b: StudyRecord) =>
    new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
  toCreate.sort(byUpdatedAt)
  toUpdate.sort(byUpdatedAt)
  const create = toCreate.slice(0, limit)
  const update = toUpdate.slice(0, Math.max(0, limit - create.length))

  return { toCreate: create, toUpdate: update }
}
