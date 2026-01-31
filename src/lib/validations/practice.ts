import { z } from "zod"

const subjectSchema = z.enum(["FAR", "AUD", "REG", "BAR"])

const practiceSchema = z.object({
  recordType: z.literal("practice"),
  subject: subjectSchema,
  subtopic: z.string().nullable(),
  studyMinutes: z.number().int().min(1, "学習時間は1分以上を入力してください"),
  totalQuestions: z.number().int().min(1, "問題数は1以上を入力してください"),
  correctAnswers: z.number().int().min(0, "正解数は0以上を入力してください"),
  roundNumber: z.number().int().min(1).nullable(),
  chapter: z.string().nullable(),
  pageRange: z.string().nullable(),
  studiedAt: z.string().min(1, "学習日を入力してください"),
  memo: z.string().nullable(),
}).refine(
  (data) => data.correctAnswers <= data.totalQuestions,
  { message: "正解数は問題数以下にしてください", path: ["correctAnswers"] }
)

const textbookSchema = z.object({
  recordType: z.literal("textbook"),
  subject: subjectSchema,
  subtopic: z.string().nullable(),
  studyMinutes: z.number().int().min(1, "学習時間は1分以上を入力してください"),
  totalQuestions: z.null(),
  correctAnswers: z.null(),
  roundNumber: z.null(),
  chapter: z.string().nullable(),
  pageRange: z.string().nullable(),
  studiedAt: z.string().min(1, "学習日を入力してください"),
  memo: z.string().nullable(),
})

export const practiceRecordSchema = z.union([practiceSchema, textbookSchema])

export type PracticeRecordInput = z.infer<typeof practiceRecordSchema>
