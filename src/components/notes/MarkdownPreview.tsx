"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownPreviewProps {
  content: string;
  /**
   * 単一の改行をそのまま改行として表示する。
   * 問題文は「ラベル | 値」の行を積み上げた表形式を含むため、
   * Markdown既定の「単一改行は空白」では1行に潰れてしまう。
   */
  breaks?: boolean;
}

export function MarkdownPreview({
  content,
  breaks = false,
}: MarkdownPreviewProps) {
  if (!content) {
    return <p className="text-muted-foreground italic">内容がありません</p>;
  }

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-md prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-ul:list-disc prose-ol:list-decimal prose-li:marker:text-muted-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {breaks ? content.replace(/\n/g, "  \n") : content}
      </ReactMarkdown>
    </div>
  );
}
