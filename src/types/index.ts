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

// 記録のソース（作成元）
export type RecordSource = "timer" | "manual"

// ノートタイプ
export type NoteType = "note" | "page_memo"

// 学習セッション（タイマー生データ、読み取り専用）
export interface StudySession {
  id: string  // ローカル生成UUID
  sessionId: string  // セッション識別子（Notion同期用キー）
  subject: Subject
  subtopic: string | null  // サブテーマ
  durationMinutes: number
  startedAt: string
  endedAt: string
  deviceId: string  // 記録元デバイス識別子
  createdAt: string
}

// 学習記録（過去問演習 + テキスト復習）- 確定データ
export interface StudyRecord {
  id: string  // ローカル生成UUID
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
  // 監査証跡用（v1.11追加）
  source: RecordSource  // 記録の作成元（timer / manual）
  sessionId: string | null  // 紐づくセッションID（timer時のみ、監査用）
  deviceId: string  // 記録元デバイス識別子
  createdAt: string
  updatedAt: string  // 最終更新日時（競合解決用）
}

// 後方互換性のためのエイリアス
export type PracticeRecord = StudyRecord

// 学習ノート（ノート + ページメモ統合）
export interface StudyNote {
  id: string  // ローカル生成UUID
  noteType: NoteType  // ノートタイプ（note / page_memo）
  title: string
  content: string | null
  subject: Subject | null
  tags: string[]
  // ページメモ用（v1.11追加）
  materialId: string | null  // 紐づくPDF教材ID（page_memo時）
  pageNumber: number | null  // PDFページ番号（page_memo時）
  // 同期用
  deviceId: string  // 記録元デバイス識別子
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

// Notion OAuth認証
export interface NotionUser {
  id: string
  botId: string
  workspaceId: string
  workspaceName: string | null
  workspaceIcon: string | null
  accessToken: string
}

export interface AuthSession {
  user: NotionUser | null
  isAuthenticated: boolean
  isLoading: boolean
}
