import type { QuestionSet } from "@/types/questions";

// Proactive AICPA過去問DB（Multiple Choice Core: REG）の全問をチャプターのセクション単位で収録したもの。
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
] as QuestionSet[];
