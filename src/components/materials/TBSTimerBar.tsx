"use client";

import { useRef } from "react";
import { MiniTimer, type MiniTimerRef } from "./MiniTimer";
import { useTimerShortcuts } from "@/hooks/useTimerShortcuts";

// TBS詳細ページ用のミニタイマーバー（Space/Q/Aのショートカット操作に対応）
export function TBSTimerBar() {
  const miniTimerRef = useRef<MiniTimerRef>(null);
  useTimerShortcuts(miniTimerRef);

  return (
    <>
      <div className="sm:hidden border-b bg-muted/30 p-2 flex justify-center shrink-0">
        <MiniTimer />
      </div>
      <div className="hidden sm:flex justify-center px-3 py-1.5 border-b bg-muted/30 shrink-0">
        <MiniTimer ref={miniTimerRef} />
      </div>
    </>
  );
}
