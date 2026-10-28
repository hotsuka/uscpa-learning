import { NextRequest, NextResponse } from "next/server";
import {
  getPracticeLogChunks,
  isPracticeLogConfigured,
  upsertPracticeLogChunk,
  type UpsertResult,
} from "@/lib/notion/practiceLog";
import { practiceLogPushSchema } from "@/lib/validations/practiceLog";

// 1回の送信で最大10チャンク×2リクエスト（検索＋作成/更新）を間隔を空けて送るため、既定の実行時間では足りないことがある
export const maxDuration = 60;

// Notion APIのレート制限（3リクエスト/秒）を超えないよう、チャンクごとに空ける間隔
const WAIT_MS = 700;

const notConfigured = () =>
  NextResponse.json(
    { error: "Practice log is not configured" },
    { status: 503 },
  );

// 問題演習ログのチャンクを取得する
// ?since=ISO8601 でその時刻以降に更新されたもの、?excludeDeviceId= でその端末以外のものに絞る
export async function GET(request: NextRequest) {
  try {
    if (!isPracticeLogConfigured()) return notConfigured();

    const searchParams = request.nextUrl.searchParams;
    const since = searchParams.get("since") || undefined;
    if (since && Number.isNaN(new Date(since).getTime())) {
      return NextResponse.json(
        { error: "since が日時として読めません" },
        { status: 400 },
      );
    }
    const excludeDeviceId = searchParams.get("excludeDeviceId") || undefined;

    const chunks = await getPracticeLogChunks({ since, excludeDeviceId });
    return NextResponse.json({ chunks });
  } catch (error) {
    console.error("Failed to get practice log:", error);
    return NextResponse.json(
      { error: "Failed to get practice log" },
      { status: 500 },
    );
  }
}

// 問題演習ログのチャンクを書き込む（同じキーがあれば更新、無ければ作成）。ページの削除はしない
// 1件ずつ処理し、失敗したチャンクは failed に入れて残りを続ける（呼び出し側が後で送り直す）
export async function POST(request: NextRequest) {
  try {
    if (!isPracticeLogConfigured()) return notConfigured();

    const parsed = practiceLogPushSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid practice log chunks",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const results: UpsertResult[] = [];
    const failed: { key: string; error: string }[] = [];
    for (const [i, chunk] of parsed.data.chunks.entries()) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
      try {
        results.push(await upsertPracticeLogChunk(chunk));
      } catch (error) {
        console.error("Failed to upsert practice log chunk:", chunk.key, error);
        failed.push({
          key: chunk.key,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json(
      { results, failed },
      { status: failed.length > 0 && results.length === 0 ? 502 : 200 },
    );
  } catch (error) {
    console.error("Failed to push practice log:", error);
    return NextResponse.json(
      { error: "Failed to push practice log" },
      { status: 500 },
    );
  }
}
