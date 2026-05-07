"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TBSExhibit } from "@/types/tbs";

interface TBSExhibitPanelProps {
  scenario: string;
  exhibits: TBSExhibit[];
}

export function TBSExhibitPanel({ scenario, exhibits }: TBSExhibitPanelProps) {
  const [activeTab, setActiveTab] = useState<string>("scenario");

  const tabs = [
    { id: "scenario", label: "シナリオ" },
    ...exhibits.map((ex) => ({ id: ex.id, label: ex.title.split(":")[0] })),
  ];

  const activeContent =
    activeTab === "scenario"
      ? scenario
      : (exhibits.find((ex) => ex.id === activeTab)?.content ?? "");

  return (
    <div className="flex flex-col h-full border-r">
      <div className="flex overflow-x-auto border-b bg-gray-50 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-blue-500 text-blue-600 bg-white"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 prose prose-sm max-w-none">
          {activeTab !== "scenario" && (
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              {exhibits.find((ex) => ex.id === activeTab)?.title}
            </p>
          )}
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {activeContent}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
