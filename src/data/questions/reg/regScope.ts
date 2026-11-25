// REG問題バンクの出題範囲区分。
// AICPA Uniform CPA Examination Blueprints 2026年版（reference/AICPA_Blueprints_2026.pdf、
// REG節 REG1〜REG17）の本文を検索して判定した結果のみを記載する。
//
// IMPORTANT: 記憶や教材名からの推測で区分を書かない。判定根拠（検索した語とヒット件数、
// 該当する Area・タスク）を note に残すこと（BARで記憶ベースの誤判定を起こした経緯は barScope.ts 参照）。
//
// - in:  REG出題範囲内
// - out: REG範囲外（解いても本番に出ない）
// - mixed: セット内に範囲内と範囲外が混在（questionGroups と restScope を参照）

export type RegScope = "in" | "out" | "mixed";

export interface RegQuestionGroup {
  ids: string[];
  scope: Exclude<RegScope, "mixed">;
  note: string;
}

export interface RegScopeInfo {
  scope: RegScope;
  /** 判定根拠 */
  note: string;
  /** mixed のとき、問題IDを列挙した内訳 */
  questionGroups?: RegQuestionGroup[];
  /** mixed のとき、questionGroups に載っていない問題の区分 */
  restScope?: Exclude<RegScope, "mixed">;
}

// キーは QuestionSet.id
export const REG_SCOPE_BY_SET_ID: Record<string, RegScopeInfo> = {
  // 2026-11-25 検証。過去問DBの章「Partnerships, Estate, Trust」とテキスト
  // 「Partnerships, Estate, Trust」「Property Taxation」の後半から集めたセット。
  // REG Area V（Federal Taxation of Entities）の内訳は A.Book-tax差異 / B.C法人 / C.S法人 /
  // D.パートナーシップ / E.LLC / F.免税団体 のみで、贈与税・遺産税・信託や遺産の所得税は無い（TCPへ移管）。
  // REG節での出現数: gift tax 0 / estate tax 0 / generation-skipping 0 / Form 1041 0 / Form 706 0 / Form 709 0。
  // REG節の gift / estate はすべて「贈与・相続で取得した資産の取得価額」（Area III-A）と
  // 「生命保険金・受贈額の非課税」（Area IV-A）の文脈。それらの問題は property-transactions /
  // individual-taxation 側にあり、このセットには無い
  "reg-trusts-gift-exempt": {
    scope: "mixed",
    note: "65問中、免税団体（Area V-F『Recall the different types of tax-exempt organizations』）と個人の寄附金控除の5問のみ範囲内。残る60問は贈与税・遺産税・世代飛越税・信託や遺産の所得税（IRDを含む）で、REG節に該当タスクが無い",
    questionGroups: [
      {
        ids: ["reg-tge-005", "reg-tge-015", "reg-tge-024", "reg-tge-030"],
        scope: "in",
        note: "免税団体（501(c)(3) の要件・UBIの申告・S法人株式からの所得）。Area V-F。明示タスクは種類の想起だが、UBIは同じトピックの論点なので演習対象に残す",
      },
      {
        ids: ["reg-tge-035"],
        scope: "in",
        note: "寄附金控除の対象となるパブリック・チャリティ。個人の項目別控除（Area IV-C）の論点",
      },
    ],
    restScope: "out",
  },
};

// 登録の無いセットは範囲内として扱う。REGの問題は過去問DBの「現行科目での分類：REG」と、
// 取り込み時にブループリントで範囲外（手形・証券法・不動産法など）を除いたテキスト問題だけなので
export function getRegScopeForSet(setId: string): RegScopeInfo {
  return REG_SCOPE_BY_SET_ID[setId] ?? { scope: "in", note: "" };
}

/** 問題ID単位でスコープを引く。mixed セットの内訳を解決する */
export function getRegScopeForQuestion(
  setId: string,
  questionId: string,
): Exclude<RegScope, "mixed"> {
  const info = getRegScopeForSet(setId);
  if (info.scope !== "mixed") return info.scope;
  const group = info.questionGroups?.find((g) => g.ids.includes(questionId));
  if (group) return group.scope;
  // restScope の書き忘れは範囲内に倒す（演習対象から黙って消さないため）
  return info.restScope ?? "in";
}

// UI表示用ラベル（in はラベルを出さない）
export const REG_SCOPE_LABELS: Record<RegScope, string> = {
  in: "REG",
  out: "範囲外",
  mixed: "一部範囲外",
};
