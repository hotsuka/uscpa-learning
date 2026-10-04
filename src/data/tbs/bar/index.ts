import type { TBSQuestion } from "@/types/tbs";
import businessCombinations from "./business-combinations.json";
import capitalBudgeting from "./capital-budgeting.json";
import derivatives from "./derivatives.json";
import fxTranslation from "./fx-translation.json";
import governmentFunds from "./government-funds.json";
import governmentWide from "./government-wide.json";
import leasesLessor from "./leases-lessor.json";
import stockComp from "./stock-comp.json";
import varianceAnalysis from "./variance-analysis.json";
import mock1 from "./mock/mock-1.json";
import mock2 from "./mock/mock-2.json";

// BAR TBS。Area I（差異分析・資本コスト）・Area II（技術論点）・Area III（政府会計）を混在させる
export const barTBSQuestions: TBSQuestion[] = [
  ...(varianceAnalysis as TBSQuestion[]),
  ...(capitalBudgeting as TBSQuestion[]),
  ...(stockComp as TBSQuestion[]),
  ...(leasesLessor as TBSQuestion[]),
  ...(businessCombinations as TBSQuestion[]),
  ...(derivatives as TBSQuestion[]),
  ...(fxTranslation as TBSQuestion[]),
  ...(governmentFunds as TBSQuestion[]),
  ...(governmentWide as TBSQuestion[]),
];

// 本番形式の通し模試用（4択50問＋TBS 7問）。初見で解くために、演習一覧（barTBSQuestions）には含めない
export interface TBSMockSet {
  id: string;
  name: string;
  questions: TBSQuestion[];
}

export const barMockTBSSets: TBSMockSet[] = [
  { id: "bar-mock-tbs-1", name: "通し模試①", questions: mock1 as TBSQuestion[] },
  { id: "bar-mock-tbs-2", name: "通し模試②", questions: mock2 as TBSQuestion[] },
];
