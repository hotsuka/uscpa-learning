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
