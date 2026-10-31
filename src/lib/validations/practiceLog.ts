import { z } from "zod";
import { MAX_SEGMENT_CHARS, MAX_SEGMENTS } from "@/lib/sync/practiceLog";

// 1回の送信で書き込むチャンクの上限。Notionのレート制限（3リクエスト/秒）とサーバーの実行時間に収めるため
export const MAX_CHUNKS_PER_REQUEST = 10;

const kindSchema = z.enum(["mcq", "tbs", "mock", "flash"]);

export const practiceLogChunkSchema = z
  .object({
    key: z.string().min(1).max(200),
    deviceId: z.string().min(1).max(100),
    kind: kindSchema,
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "日付は YYYY-MM-DD 形式にしてください"),
    seq: z.number().int().min(0),
    count: z.number().int().min(0),
    hash: z.string().min(1).max(64),
    schemaVersion: z.number().int().min(1),
    segments: z
      .array(z.string().min(1).max(MAX_SEGMENT_CHARS))
      .min(1)
      .max(MAX_SEGMENTS),
  })
  // キーは `${deviceId}:${kind}:${date}:${seq}`。中身と食い違うと別の端末・日のページを上書きしかねないため弾く
  .refine((c) => c.key === `${c.deviceId}:${c.kind}:${c.date}:${c.seq}`, {
    message: "チャンクキーが端末ID・種類・日付・連番と一致しません",
    path: ["key"],
  });

export const practiceLogPushSchema = z.object({
  chunks: z.array(practiceLogChunkSchema).min(1).max(MAX_CHUNKS_PER_REQUEST),
});

export type PracticeLogPushInput = z.infer<typeof practiceLogPushSchema>;
