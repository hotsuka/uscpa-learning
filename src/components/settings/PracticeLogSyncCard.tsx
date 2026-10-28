"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CloudDownload, CloudUpload, ListChecks, RefreshCw } from "lucide-react";
import {
  pushPracticeLog,
  verifyPracticeLogWithNotion,
  type PushProgress,
  type PushResult,
  type VerificationResult,
} from "@/lib/sync/practiceLogPush";
import { pullPracticeLog, type PullResult } from "@/lib/sync/practiceLogPull";
import {
  readAutoSyncStatus,
  withPracticeLogLock,
  type AutoSyncStatus,
} from "@/lib/sync/practiceLogAutoSync";
import type { PracticeLogKind } from "@/lib/sync/practiceLog";

const KIND_LABEL: Record<PracticeLogKind, string> = {
  mcq: "四択MC",
  tbs: "TBS",
  mock: "模試",
};

/**
 * 問題演習ログ（回答・TBS・模試）をNotionへ送り、他の端末の分を取り込み、件数を照合するカード
 * 取り込みはローカルに無い回答を足すだけで、ローカルの回答を消したり書き換えたりはしない
 */
export function PracticeLogSyncCard() {
  const [busy, setBusy] = useState<"push" | "pull" | "verify" | null>(
    null,
  );
  const [progress, setProgress] = useState<PushProgress | null>(null);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [pullResult, setPullResult] = useState<PullResult | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState<AutoSyncStatus | null>(null);

  // localStorage を読むのでマウント後に表示する（サーバー描画と食い違わないように）
  useEffect(() => {
    setAutoStatus(readAutoSyncStatus());
  }, []);

  const handlePush = async (force: boolean) => {
    setBusy("push");
    setErrorMessage(null);
    setPushResult(null);
    try {
      // 自動同期が送っている最中なら、終わるのを待ってから送る
      const result = await withPracticeLogLock(() =>
        pushPracticeLog({ force, onProgress: setProgress }),
      );
      setPushResult(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "送信に失敗しました",
      );
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const handlePull = async () => {
    setBusy("pull");
    setErrorMessage(null);
    setPullResult(null);
    try {
      setPullResult(await withPracticeLogLock(() => pullPracticeLog()));
    } catch (error) {
      setErrorMessage(
        `取り込みに失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
      );
    } finally {
      setBusy(null);
    }
  };

  const handleVerify = async () => {
    setBusy("verify");
    setErrorMessage(null);
    try {
      setVerification(await verifyPracticeLogWithNotion());
    } catch (error) {
      setErrorMessage(
        `照合に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CloudUpload className="h-5 w-5" />
          問題演習ログのNotion同期
        </CardTitle>
        <CardDescription>
          四択MC・TBS・模試の回答履歴をNotionの「問題演習ログ」へ送り、他の端末で解いた分を取り込みます。取り込みはこの端末に無い回答を足すだけで、この端末の回答は消しません。取り込む前にバックアップを取ります。起動時・オンライン復帰時・回答の後には自動で同期します。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => handlePush(false)} disabled={busy !== null}>
            <CloudUpload className="mr-2 h-4 w-4" />
            Notionへ送る
          </Button>
          <Button
            variant="outline"
            onClick={handlePull}
            disabled={busy !== null}
          >
            <CloudDownload className="mr-2 h-4 w-4" />
            Notionから取り込む
          </Button>
          <Button
            variant="outline"
            onClick={handleVerify}
            disabled={busy !== null}
          >
            <ListChecks className="mr-2 h-4 w-4" />
            件数を照合
          </Button>
          <Button
            variant="ghost"
            onClick={() => handlePush(true)}
            disabled={busy !== null}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            すべて送り直す
          </Button>
        </div>

        {autoStatus && (
          <p
            className={`text-sm ${autoStatus.ok ? "text-muted-foreground" : "text-destructive"}`}
          >
            最終自動同期: {new Date(autoStatus.lastRunAt).toLocaleString("ja-JP")}
            {autoStatus.ok
              ? `（取り込み ${autoStatus.added.toLocaleString()} 件・送信 ${autoStatus.sent.toLocaleString()} ページ）`
              : `（失敗: ${autoStatus.error ?? "不明なエラー"}）`}
          </p>
        )}

        {busy === "push" && progress && (
          <p className="text-sm text-muted-foreground">
            送信中… {progress.sent} / {progress.total} ページ
          </p>
        )}
        {busy === "pull" && (
          <p className="text-sm text-muted-foreground">
            他の端末の分を読み込み中…
          </p>
        )}
        {busy === "verify" && (
          <p className="text-sm text-muted-foreground">
            Notionの内容を読み込み中…
          </p>
        )}

        {errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}

        {pushResult && (
          <div className="text-sm space-y-1">
            <p>
              この端末のページ {pushResult.totalChunks} 件のうち、変更のあった{" "}
              {pushResult.sent} 件を送りました。
            </p>
            {pushResult.failed.length > 0 && (
              <p className="text-destructive">
                {pushResult.failed.length}{" "}
                件は送れませんでした（もう一度「Notionへ送る」を押すと、送れなかった分だけ送り直します）。
              </p>
            )}
          </div>
        )}

        {pullResult && (
          <div className="text-sm space-y-1">
            {pullResult.added.mcq + pullResult.added.tbs + pullResult.added.mock ===
            0 ? (
              <p>
                他の端末のページ {pullResult.remoteChunks}{" "}
                件を確認しました。取り込む回答はありませんでした。
              </p>
            ) : (
              <>
                <p>
                  四択MC {pullResult.added.mcq.toLocaleString()} 件・TBS{" "}
                  {pullResult.added.tbs.toLocaleString()} 件・模試{" "}
                  {pullResult.added.mock.toLocaleString()} 件を取り込みました。
                </p>
                {pullResult.backedUp && (
                  <p className="text-muted-foreground">
                    取り込む前の状態は下の「データバックアップ」に「Notion取り込み前」として保存しました。
                  </p>
                )}
              </>
            )}
            {pullResult.unreadableChunks.length > 0 && (
              <p className="text-destructive">
                読めないページが {pullResult.unreadableChunks.length}{" "}
                件あり、取り込みませんでした:{" "}
                {pullResult.unreadableChunks.slice(0, 3).join(", ")}
              </p>
            )}
          </div>
        )}

        {verification && (
          <div className="space-y-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 font-normal">種類</th>
                  <th className="py-1 font-normal text-right">この端末</th>
                  <th className="py-1 font-normal text-right">
                    Notion（この端末分）
                  </th>
                  <th className="py-1 font-normal text-right">未送信</th>
                  <th className="py-1 font-normal text-right">
                    他の端末だけにある
                  </th>
                </tr>
              </thead>
              <tbody>
                {verification.kinds.map((k) => (
                  <tr key={k.kind} className="border-t">
                    <td className="py-1">{KIND_LABEL[k.kind]}</td>
                    <td className="py-1 text-right">
                      {k.local.toLocaleString()}
                    </td>
                    <td className="py-1 text-right">
                      {k.ownOnNotion.toLocaleString()}
                    </td>
                    <td
                      className={`py-1 text-right ${k.missingOnNotion > 0 ? "text-destructive" : ""}`}
                    >
                      {k.missingOnNotion.toLocaleString()}
                    </td>
                    <td className="py-1 text-right">
                      {k.onlyOnOtherDevices.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {verification.kinds.every((k) => k.missingOnNotion === 0) ? (
              <p className="text-sm text-green-600">
                この端末の回答はすべてNotionにあります。
              </p>
            ) : (
              <p className="text-sm text-destructive">
                未送信の回答があります。「Notionへ送る」を押してください。
              </p>
            )}
            {verification.unreadableChunks.length > 0 && (
              <p className="text-sm text-destructive">
                読めないページが {verification.unreadableChunks.length}{" "}
                件あります:{" "}
                {verification.unreadableChunks.slice(0, 3).join(", ")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
