/**
 * 日本の祝日を取得するユーティリティ
 * 2025年〜2027年の祝日データを含む
 */

// 日本の祝日データ（固定祝日 + 変動祝日）
const JAPAN_HOLIDAYS: Record<string, string> = {
  // 2025年
  "2025-01-01": "元日",
  "2025-01-13": "成人の日",
  "2025-02-11": "建国記念の日",
  "2025-02-23": "天皇誕生日",
  "2025-02-24": "振替休日",
  "2025-03-20": "春分の日",
  "2025-04-29": "昭和の日",
  "2025-05-03": "憲法記念日",
  "2025-05-04": "みどりの日",
  "2025-05-05": "こどもの日",
  "2025-05-06": "振替休日",
  "2025-07-21": "海の日",
  "2025-08-11": "山の日",
  "2025-09-15": "敬老の日",
  "2025-09-23": "秋分の日",
  "2025-10-13": "スポーツの日",
  "2025-11-03": "文化の日",
  "2025-11-23": "勤労感謝の日",
  "2025-11-24": "振替休日",

  // 2026年
  "2026-01-01": "元日",
  "2026-01-12": "成人の日",
  "2026-02-11": "建国記念の日",
  "2026-02-23": "天皇誕生日",
  "2026-03-20": "春分の日",
  "2026-04-29": "昭和の日",
  "2026-05-03": "憲法記念日",
  "2026-05-04": "みどりの日",
  "2026-05-05": "こどもの日",
  "2026-05-06": "振替休日",
  "2026-07-20": "海の日",
  "2026-08-11": "山の日",
  "2026-09-21": "敬老の日",
  "2026-09-22": "国民の休日",
  "2026-09-23": "秋分の日",
  "2026-10-12": "スポーツの日",
  "2026-11-03": "文化の日",
  "2026-11-23": "勤労感謝の日",

  // 2027年
  "2027-01-01": "元日",
  "2027-01-11": "成人の日",
  "2027-02-11": "建国記念の日",
  "2027-02-23": "天皇誕生日",
  "2027-03-21": "春分の日",
  "2027-03-22": "振替休日",
  "2027-04-29": "昭和の日",
  "2027-05-03": "憲法記念日",
  "2027-05-04": "みどりの日",
  "2027-05-05": "こどもの日",
  "2027-07-19": "海の日",
  "2027-08-11": "山の日",
  "2027-09-20": "敬老の日",
  "2027-09-23": "秋分の日",
  "2027-10-11": "スポーツの日",
  "2027-11-03": "文化の日",
  "2027-11-23": "勤労感謝の日",
}

/**
 * 指定日が祝日かどうか判定
 */
export function isHoliday(date: Date): boolean {
  const dateStr = formatDateToString(date)
  return dateStr in JAPAN_HOLIDAYS
}

/**
 * 指定日の祝日名を取得（祝日でない場合はnull）
 */
export function getHolidayName(date: Date): string | null {
  const dateStr = formatDateToString(date)
  return JAPAN_HOLIDAYS[dateStr] || null
}

/**
 * 日付をYYYY-MM-DD形式の文字列に変換
 */
function formatDateToString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * 指定日が週末（土日）かどうか判定
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6 // 0: 日曜, 6: 土曜
}

/**
 * 指定日が平日かどうか判定（祝日も休日として扱う場合）
 */
export function isWeekdayWithHoliday(date: Date, treatHolidayAsWeekend: boolean = true): boolean {
  if (isWeekend(date)) return false
  if (treatHolidayAsWeekend && isHoliday(date)) return false
  return true
}

interface WeekdayCount {
  weekdays: number // 平日数
  weekends: number // 休日数（土日）
  holidays: number // 祝日数（平日にある祝日のみカウント）
  totalWorkDays: number // 実質の平日数（祝日を除く）
  totalRestDays: number // 実質の休日数（土日＋祝日）
}

/**
 * 指定した週の平日・休日・祝日の日数をカウント
 * @param weekStartDate 週の開始日（通常は月曜日）
 */
export function countWeekDays(weekStartDate: Date): WeekdayCount {
  let weekdays = 0
  let weekends = 0
  let holidays = 0

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStartDate)
    date.setDate(date.getDate() + i)

    if (isWeekend(date)) {
      weekends++
    } else {
      weekdays++
      if (isHoliday(date)) {
        holidays++
      }
    }
  }

  return {
    weekdays,
    weekends,
    holidays,
    totalWorkDays: weekdays - holidays,
    totalRestDays: weekends + holidays,
  }
}

/**
 * 今週の月曜日を取得
 */
export function getThisWeekMonday(): Date {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day // 日曜の場合は-6、それ以外は1-曜日
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

/**
 * 週間目標時間を計算
 */
export function calculateWeeklyTarget(
  weekdayHours: number,
  weekendHours: number,
  weekStartDate?: Date
): {
  totalHours: number
  breakdown: {
    weekdayHours: number
    weekendHours: number
    weekdays: number
    weekends: number
    holidays: number
  }
} {
  const startDate = weekStartDate || getThisWeekMonday()
  const { totalWorkDays, totalRestDays, holidays } = countWeekDays(startDate)

  const totalHours = totalWorkDays * weekdayHours + totalRestDays * weekendHours

  return {
    totalHours,
    breakdown: {
      weekdayHours: totalWorkDays * weekdayHours,
      weekendHours: totalRestDays * weekendHours,
      weekdays: totalWorkDays,
      weekends: totalRestDays - holidays,
      holidays,
    },
  }
}

/**
 * 今週の祝日リストを取得
 */
export function getThisWeekHolidays(weekStartDate?: Date): { date: Date; name: string }[] {
  const startDate = weekStartDate || getThisWeekMonday()
  const holidays: { date: Date; name: string }[] = []

  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    const holidayName = getHolidayName(date)
    if (holidayName) {
      holidays.push({ date, name: holidayName })
    }
  }

  return holidays
}
