// BAR問題バンクの出題範囲区分。
// AICPA Uniform CPA Examination Blueprints 2026年版（reference/AICPA_Blueprints_2026.pdf、
// BAR節はp65-81）の本文を機械検索して判定した結果のみを記載する。
//
// IMPORTANT: 記憶や教材名からの推測で区分を書かない。過去に教材5本を記憶ベースで誤判定し、
// 取得済み教材の1/4を「範囲外」として弾いた事故がある。必ずブループリント本文に当たり、
// 判定根拠（検索した語とヒット件数）を note に残すこと。
//
// - in:         BAR出題範囲内
// - out:        BAR範囲外（解いても本番に出ない）
// - mixed:      セット内に範囲内と範囲外が混在（questionRanges を参照）
// - unverified: ブループリント未照合。範囲内と決まったわけではない

// - gray: ブループリントの明示タスクに該当しないが、上位の論点に含まれる可能性がある。
//         判断が割れるものは安全側に倒して演習対象に残す
export type BarScope = "in" | "out" | "gray" | "mixed" | "unverified";

export interface BarScopeInfo {
  scope: BarScope;
  /** 判定根拠。検索した語とBAR節でのヒット件数を含める */
  note: string;
  /** mixed のとき、問題ID範囲での内訳 */
  questionRanges?: BarQuestionRange[];
  /** mixed のとき、連続しない問題IDでの内訳 */
  questionGroups?: BarQuestionGroup[];
}

export interface BarQuestionRange {
  /** 問題IDの範囲（両端を含む） */
  from: string;
  to: string;
  scope: Exclude<BarScope, "mixed">;
  note: string;
}

export interface BarQuestionGroup {
  ids: string[];
  scope: Exclude<BarScope, "mixed">;
  note: string;
}

// キーは QuestionSet.id
export const BAR_SCOPE_BY_SET_ID: Record<string, BarScopeInfo> = {
  // 2026-09-05 検証。教材 M40 が Corporate Governance / Internal Control / ERM の
  // 合本のため、問題側も3分野が混在している。範囲内はERM部分のみ。
  "bar-risk-management-erm": {
    scope: "mixed",
    note: "BAR節での出現数: corporate governance 0 / board of directors 0 / audit committee 0 / internal control 0 / Sarbanes 0 に対し COSO 5 / enterprise risk 4。51問中8問のみ範囲内",
    questionRanges: [
      {
        from: "bar-erm-001",
        to: "bar-erm-028",
        scope: "out",
        note: "取締役会権限・株主権利・SOX・Dodd-Frank・内部監査人・SEC・監査委員会。旧BEC領域で、BAR節に該当語が1件もない",
      },
      {
        from: "bar-erm-029",
        to: "bar-erm-043",
        scope: "out",
        note: "COSO内部統制フレームワーク（5構成要素・統制環境・Section 404）。AUDでは範囲内だがBAR節に internal control は0件",
      },
      {
        from: "bar-erm-044",
        to: "bar-erm-051",
        scope: "in",
        note: "COSO ERM。ブループリント Area I『Recall the purpose and objectives of the COSO ERM framework』に対応。ただし出題は COSO ERM 2004年版（8構成要素）ベースで、ブループリントが参照するのは2017年版『Integrating with Strategy and Performance』。用語が一世代古い",
      },
    ],
  },

  // 2026-09-07 検証。セット名は Strategic Planning だが、実体は予算・予測・回帰分析・
  // 確率分析が大半を占める。名前から「経営戦略論＝範囲外」と判断すると48問を取りこぼす。
  // 逆に名前から「戦略計画＝範囲内」と判断すると22問を無駄に解く。
  "bar-strategic-planning": {
    scope: "mixed",
    note: "BAR Area I B-1『Prepare a budget using supportable assumptions』『Use forecasting and projection techniques』『planning techniques including cost benefit analysis, sensitivity analysis, what-if scenarios, breakeven analysis and predictive analytics』『ratio analysis and explanations of correlations』に対応する問題が48問。経営戦略論はSWOT解釈（Area I B-4）のみ明示で、他は該当タスクなし",
    questionGroups: [
      {
        ids: [
          "bar-sp-026",
          "bar-sp-027",
          "bar-sp-028",
          "bar-sp-029",
          "bar-sp-030",
          "bar-sp-031",
          "bar-sp-032",
          "bar-sp-033",
          "bar-sp-060",
          "bar-sp-061",
          "bar-sp-062",
          "bar-sp-063",
          "bar-sp-064",
          "bar-sp-076",
        ],
        scope: "out",
        note: "経営戦略論そのもの（多角化・市場浸透・スキミング価格・垂直統合・学習する組織・組織ライフサイクル・戦略管理フィードバックモデル・事業部制組織）。Area I の全タスクを照合しても該当なし。SWOT解釈だけが明示タスクだが、この14問にSWOTを問うものはない",
      },
      {
        ids: [
          "bar-sp-018",
          "bar-sp-019",
          "bar-sp-024",
          "bar-sp-055",
          "bar-sp-057",
          "bar-sp-058",
          "bar-sp-059",
          "bar-sp-075",
        ],
        scope: "gray",
        note: "JIT・品質原価・非付加価値活動・サイクルタイム分析。BAR節での出現数は just-in-time 0 / quality 0 / value-added 0 / cycle time 0。ただし上位に A-3『Managerial and cost accounting』があり、原価計算法の列挙は including（例示）なので範囲外と断定できない",
      },
      {
        ids: [
          "bar-sp-006",
          "bar-sp-007",
          "bar-sp-008",
          "bar-sp-041",
          "bar-sp-043",
          "bar-sp-072",
        ],
        scope: "gray",
        note: "責任会計（profit center/cost center の controllable 区分）・学習曲線・正常仕損。明示タスクはないが A-2 業績測定 / A-3 原価計算に隣接する",
      },
    ],
  },
};

// 未検証のセットは "unverified"。"in" に倒さないこと（範囲内と誤認させないため）
export function getBarScopeForSet(setId: string): BarScopeInfo {
  return (
    BAR_SCOPE_BY_SET_ID[setId] ?? {
      scope: "unverified",
      note: "ブループリント未照合",
    }
  );
}

/** 問題ID単位でスコープを引く。mixed セットの内訳を解決する */
export function getBarScopeForQuestion(
  setId: string,
  questionId: string,
): Exclude<BarScope, "mixed"> {
  const info = BAR_SCOPE_BY_SET_ID[setId];
  if (!info) return "unverified";
  if (info.scope !== "mixed") return info.scope;

  const group = info.questionGroups?.find((g) => g.ids.includes(questionId));
  if (group) return group.scope;

  const range = info.questionRanges?.find(
    (r) => questionId >= r.from && questionId <= r.to,
  );
  if (range) return range.scope;

  // questionGroups で範囲外だけを列挙しているセットは、残りが範囲内
  return info.questionGroups?.length ? "in" : "unverified";
}

// UI表示用ラベル
export const BAR_SCOPE_LABELS: Record<BarScope, string> = {
  in: "BAR",
  out: "範囲外",
  gray: "判断保留",
  mixed: "一部範囲外",
  unverified: "未照合",
};

// ブループリントに出題が明記されているのに問題バンクに存在しない論点。
// 作問時の優先候補として記録する。
export const BAR_KNOWN_GAPS: { topic: string; note: string }[] = [
  {
    topic: "COSO ERM × ESGリスク",
    note: "ブループリントに『apply the COSO ERM framework to identify, respond to and report environmental, social and governance (ESG) related risks』と明記され、参照文献にも COSO『Applying ERM to ESG-related Risks』が挙がっているが、bar-risk-management-erm 51問中ESGに言及する問題は0件",
  },
];
