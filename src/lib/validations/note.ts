import { z } from "zod"

const subjectSchema = z.enum(["FAR", "AUD", "REG", "BAR"])

export const noteSchema = z.object({
  title: z.string().min(1, "タイトルを入力してください").max(200, "タイトルは200文字以内にしてください"),
  content: z.string().min(1, "内容を入力してください"),
  subject: subjectSchema.nullable(),
  tags: z.array(z.string().min(1).max(50)).max(20, "タグは20個まで設定できます"),
})

export type NoteInput = z.infer<typeof noteSchema>
