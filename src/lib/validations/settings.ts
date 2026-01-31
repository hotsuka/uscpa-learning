import { z } from "zod"

const subjectSchema = z.enum(["FAR", "AUD", "REG", "BAR"])

export const examDateSchema = z.object({
  subject: subjectSchema,
  date: z.string().nullable(),
})

export const targetHoursSchema = z.object({
  subject: subjectSchema,
  hours: z.number().min(0, "0以上を入力してください").max(10000, "10000以下にしてください"),
})

export const dailyTargetSchema = z.object({
  weekdayTargetHours: z.number().min(0).max(24, "24時間以内にしてください"),
  weekendTargetHours: z.number().min(0).max(24, "24時間以内にしてください"),
})

export const pomodoroSchema = z.object({
  pomodoroMinutes: z.number().int().min(5, "5分以上を入力してください").max(60, "60分以内にしてください"),
  breakMinutes: z.number().int().min(1, "1分以上を入力してください").max(30, "30分以内にしてください"),
})

export type ExamDateInput = z.infer<typeof examDateSchema>
export type TargetHoursInput = z.infer<typeof targetHoursSchema>
export type DailyTargetInput = z.infer<typeof dailyTargetSchema>
export type PomodoroInput = z.infer<typeof pomodoroSchema>
