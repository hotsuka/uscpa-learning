"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CloudUpload, ListChecks, RefreshCw } from "lucide-react";
import {
  pushPracticeLog,
  verifyPracticeLogWithNotion,
  type PushProgress,
  type PushResult,
  type VerificationResult,
} from "@/lib/sync/practiceLogPush";
import type { PracticeLogKind } from "@/lib/sync/practiceLog";

const KIND_LABEL: Record<PracticeLogKind, string> = {
  mcq: "四択MC",
  tbs: "TBS",
  mock: "模試",
};

/**
 * 問題演習ログ（回答・TBS・模試）をNotionへ送り、件数を照合するカード
 * 同期の第3段階のため送るだけで、ローカルの回答履歴は書き換えない
 */
export function PracticeLogSyncCard() {
  const [busy, setBusy] = useState<"push" | "verify" | null>(null);
  const [progress, setProgress] = useState<PushProgress | null>(null);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePush = async (force: boolean) => {
    setBusy("push");
    setErrorMessage(null);
    setPushResult(null);
    try {
      const result = await pushPracticeLog({ force, onProgress: setProgress });
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
          問題演習ログのNotion送信
        </CardTitle>
        <CardDescription>
          四択MC・TBS・模試の回答履歴をNotionの「問題演習ログ」へ送ります。送るだけで、この端末の回答履歴は書き換えません。
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

        {busy === "push" && progress && (
          <p className="text-sm text-muted-foreground">
            送信中… {progress.sent} / {progress.total} ページ
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
