import type { QuestionSet } from "@/types/questions";

// Proactive AICPA過去問DB（Multiple Choice Core: REG）の全問をチャプターのセクション単位で収録したもの。
// 2011〜2021年の Recently Released（正解のみ公開）は、Core MC と重複しない問題に英日の解説を付けて同じ単元へ追記した。
// 解説は出典の英文解説を元にし、選択肢ラベルの参照は選択肢の文面に置き換えてある（画面で選択肢をシャッフルするため）
import individualTaxation from "./individual-taxation.json";
import corporateTaxation from "./corporate-taxation.json";
import partnershipTaxation from "./partnership-taxation.json";
import trustsGiftExempt from "./trusts-gift-exempt.json";
import propertyTransactions from "./property-transactions.json";
import taxEthics from "./tax-ethics.json";
import contracts from "./contracts.json";
import salesContracts from "./sales-contracts.json";
import bankruptcy from "./bankruptcy.json";
import businessStructure from "./business-structure.json";
import agency from "./agency.json";
import federalRegulation from "./federal-regulation.json";

// 並びは出典の過去問DBのチャプター順に合わせる（教材テキストと突き合わせやすいため）
export const regQuestionSets: QuestionSet[] = [
  individualTaxation,
  corporateTaxation,
  partnershipTaxation,
  trustsGiftExempt,
  propertyTransactions,
  taxEthics,
  contracts,
  salesContracts,
  bankruptcy,
  businessStructure,
  agency,
  // Core MC に章が無い雇用税・労働者区分などの連邦法規（ブループリント Area II-D）。RR 由来の問題だけ
  federalRegulation,
] as QuestionSet[];
