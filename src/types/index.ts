// 科目の型
export type Subject = "FAR" | "AUD" | "REG" | "BAR"

// 科目の表示名とカラー
export const SUBJECTS: Record<Subject, { name: string; color: string; lightColor: string }> = {
  FAR: { name: "FAR (財務会計)", color: "bg-far", lightColor: "bg-far-light" },
  AUD: { name: "AUD (監査)", color: "bg-aud", lightColor: "bg-aud-light" },
  REG: { name: "REG (税法)", color: "bg-reg", lightColor: "bg-reg-light" },
  BAR: { name: "BAR (ビジネス分析)", color: "bg-bar", lightColor: "bg-bar-light" },
}

// 科目の配列（選択肢用）
export const SUBJECT_OPTIONS: Subject[] = ["FAR", "AUD", "REG", "BAR"]

// サブテーマ（チャプター）定義
export const SUBJECT_SUBTOPICS: Record<Subject, string[]> = {
  FAR: [
    "Conceptual Framework",
    "Financial Statements",
    "Cash and Cash Equivalents",
    "Receivables",
    "Inventory",
    "Property, Plant & Equipment",
    "Intangible Assets",
    "Investments",
    "Liabilities",
    "Equity",
    "Revenue Recognition (ASC 606)",
    "Leases (ASC 842)",
    "Income Taxes",
    "Pensions",
    "Stock Compensation",
    "EPS",
    "Statement of Cash Flows",
    "Accounting Changes & Errors",
    "Consolidations",
    "Government Accounting",
    "Not-for-Profit Accounting",
  ],
  AUD: [
    "Professional Responsibilities",
    "Engagement Planning",
    "Understanding the Entity",
    "Risk Assessment",
    "Internal Control",
    "Audit Evidence",
    "Sampling",
    "Audit Procedures",
    "Completing the Audit",
    "Audit Reports",
    "Review Engagements",
    "Compilation Engagements",
    "Attestation Engagements",
    "SSARS Engagements",
    "Quality Control",
  ],
  REG: [
    "Individual Taxation",
    "Property Transactions",
    "Corporate Taxation",
    "S Corporations",
    "Partnerships",
    "Estates & Trusts",
    "Tax-Exempt Organizations",
    "Business Law",
    "Contracts",
    "Agency",
    "Debtor-Creditor",
    "Business Structure",
    "Federal Tax Procedures",
    "Ethics & Responsibilities",
  ],
  BAR: [
    "Data Analytics",
    "Technology & Data Management",
    "Financial Statement Analysis",
    "Variance Analysis",
    "Cost Accounting",
    "Budgeting & Forecasting",
    "Economic Concepts",
    "Financial Management",
    "Risk Management",
    "Operations Management",
    "Strategic Planning",
  ],
}

// 記録タイプ
export type RecordType = "practice" | "textbook"

// 設定
export interface Settings {
  id: string
  targetHours: number
  examDates: {
    FAR: string | null
    AUD: string | null
    REG: string | null
    BAR: string | null
  }
}

// 学習セッション
export interface StudySession {
  id: string
  subject: Subject
  subtopic: string | null  // サブテーマ
  durationMinutes: number
  startedAt: string
  endedAt: string
  createdAt: string
}

// 学習記録（過去問演習 + テキスト復習）
export interface StudyRecord {
  id: string
  recordType: RecordType
  subject: Subject
  subtopic: string | null  // サブテーマ
  // 学習時間（分単位）
  studyMinutes: number
  // 過去問演習用
  totalQuestions: number | null
  correctAnswers: number | null
  roundNumber: number | null
  // テキスト復習用
  chapter: string | null
  pageRange: string | null  // 例: "100-150"
  // 共通
  studiedAt: string
  memo: string | null  // 自由入力欄（学びや補足）
  createdAt: string
}

// 後方互換性のためのエイリアス
export type PracticeRecord = StudyRecord

// 学習ノート
export interface StudyNote {
  id: string
  title: string
  content: string | null
  subject: Subject | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

// タイマーモード
export type TimerMode = "stopwatch" | "pomodoro"

// タイマー状態
export type TimerStatus = "idle" | "running" | "paused"

// タイマーのローカル保存用
export interface TimerState {
  subject: Subject
  mode: TimerMode
  startTime: number | null
  elapsedSeconds: number
  isRunning: boolean
}

// ダッシュボード用の集計データ
export interface DashboardStats {
  todayStudyMinutes: number
  todayQuestions: number
  todayAccuracy: number
  weeklyStudyMinutes: number
  totalStudyMinutes: number
}

// 科目別の統計
export interface SubjectStats {
  subject: Subject
  totalMinutes: number
  totalQuestions: number
  accuracy: number
  daysUntilExam: number | null
}

// 教材
export interface Material {
  id: string
  name: string
  subject: Subject
  // 回答なし版PDF
  pdfWithoutAnswers: string | null  // URL or base64
  // 回答あり版PDF
  pdfWithAnswers: string | null  // URL or base64
  // ページ数
  totalPages: number
  createdAt: string
  updatedAt: string
}

// 教材へのメモ・書き込み
export interface MaterialAnnotation {
  id: string
  materialId: string
  pageNumber: number
  // 座標（PDF上の相対位置）
  x: number
  y: number
  width: number
  height: number
  // メモの種類
  type: "highlight" | "note" | "drawing"
  // メモ内容（テキスト or SVGパス）
  content: string
  color: string
  createdAt: string
  updatedAt: string
}
