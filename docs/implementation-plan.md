# USCPA学習管理アプリケーション 実装計画書

**作成日**: 2026年1月17日
**更新日**: 2026年1月31日
**バージョン**: 1.13
**関連文書**: [要件定義書](./requirements.md)

---

## 目次

1. [実装概要](#1-実装概要)
2. [開発環境セットアップ](#2-開発環境セットアップ)
3. [Phase 1: プロジェクト基盤構築](#3-phase-1-プロジェクト基盤構築)
4. [Phase 2: コア機能実装](#4-phase-2-コア機能実装)
5. [Phase 3: 分析・ダッシュボード実装](#5-phase-3-分析ダッシュボード実装)
6. [Phase 4: PWA対応・リリース準備](#6-phase-4-pwa対応リリース準備)
7. [ディレクトリ構成](#7-ディレクトリ構成)
8. [コンポーネント設計](#8-コンポーネント設計)
9. [API設計](#9-api設計)
10. [テスト計画](#10-テスト計画)
11. [デプロイ手順](#11-デプロイ手順)

---

## 1. 実装概要

### 1.1 技術スタック詳細

| カテゴリ | 技術 | バージョン | 用途 |
|----------|------|------------|------|
| フレームワーク | Next.js | 14.x | App Router使用、SSR/SSG対応 |
| 言語 | TypeScript | 5.x | 型安全な開発 |
| スタイリング | Tailwind CSS | 3.x | ユーティリティファーストCSS |
| UIライブラリ | shadcn/ui | latest | アクセシブルなコンポーネント |
| 状態管理 | Zustand | 4.x | 軽量な状態管理 |
| フォーム | React Hook Form | 7.x | フォームバリデーション |
| バリデーション | Zod | 3.x | スキーマバリデーション |
| グラフ | Recharts | 2.x | データ可視化 |
| 日付操作 | date-fns | 3.x | 日付フォーマット・計算 |
| BaaS | Supabase | latest | DB、認証、リアルタイム |
| PWA | next-pwa | 5.x | Service Worker生成 |
| テスト | Vitest + Testing Library | latest | ユニット・統合テスト |
| Linter | ESLint + Prettier | latest | コード品質 |

### 1.2 開発原則

1. **型安全性**: 全てのコードにTypeScriptの厳格な型付け
2. **コンポーネント設計**: Atomic Designに基づく再利用可能な設計
3. **アクセシビリティ**: WAI-ARIA準拠、キーボード操作対応
4. **パフォーマンス**: Core Web Vitals最適化
5. **テスト駆動**: 重要なロジックにはテストを記述

---

## 2. 開発環境セットアップ

### 2.1 前提条件

```bash
# 必要なツール
- Node.js 20.x 以上
- npm 10.x 以上（または pnpm 8.x）
- Git
- VSCode（推奨エディタ）
```

### 2.2 推奨VSCode拡張機能

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "formulahendry.auto-rename-tag"
  ]
}
```

### 2.3 Supabaseセットアップ手順

1. **アカウント作成**
   - https://supabase.com にアクセス
   - GitHubアカウントでサインアップ

2. **プロジェクト作成**
   - 「New Project」をクリック
   - プロジェクト名: `uscpa-learning`
   - リージョン: `Northeast Asia (Tokyo)` 推奨
   - データベースパスワードを設定（安全な場所に保存）

3. **API キー取得**
   - Settings → API から以下を取得
     - `Project URL` → NEXT_PUBLIC_SUPABASE_URL
     - `anon public` → NEXT_PUBLIC_SUPABASE_ANON_KEY

4. **認証設定**
   - Authentication → Providers
   - Email を有効化
   - 「Confirm email」をオフ（開発時）

---

## 3. Phase 1: プロジェクト基盤構築

### 3.1 タスク一覧

| # | タスク | 詳細 | 成果物 |
|---|--------|------|--------|
| 1.1 | プロジェクト作成 | Next.js 14 + TypeScript | 基本プロジェクト |
| 1.2 | Tailwind CSS設定 | カスタムテーマ設定 | tailwind.config.ts |
| 1.3 | shadcn/ui導入 | 必要コンポーネント追加 | components/ui/* |
| 1.4 | Supabase接続 | クライアント設定 | lib/supabase.ts |
| 1.5 | 環境変数設定 | .env.local作成 | .env.local |
| 1.6 | 認証機能実装 | ログイン/サインアップ | app/(auth)/* |
| 1.7 | レイアウト作成 | 共通レイアウト | app/layout.tsx |
| 1.8 | ナビゲーション | ボトムナビ（モバイル）/サイドバー（PC） | components/navigation/* |

### 3.2 実装手順

#### Step 1.1: プロジェクト作成

```bash
# プロジェクト作成
npx create-next-app@latest uscpa-learning --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

cd uscpa-learning

# 追加パッケージインストール
npm install @supabase/supabase-js @supabase/ssr zustand react-hook-form zod @hookform/resolvers date-fns recharts

# 開発用パッケージ
npm install -D @types/node prettier eslint-config-prettier
```

#### Step 1.2: shadcn/ui セットアップ

```bash
# shadcn/ui 初期化
npx shadcn@latest init

# 必要なコンポーネントを追加
npx shadcn@latest add button card input label tabs select dialog toast badge progress dropdown-menu avatar separator
```

#### Step 1.3: 環境変数設定

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

#### Step 1.4: Supabaseクライアント設定

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// src/lib/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component からの呼び出し時は無視
          }
        },
      },
    }
  )
}
```

#### Step 1.5: データベーススキーマ作成

Supabase SQL Editorで実行:

```sql
-- プロファイルテーブル
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  exam_date DATE,
  target_hours INTEGER DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 学習セッションテーブル
CREATE TABLE study_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL CHECK (subject IN ('FAR', 'AUD', 'REG', 'BAR')),
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 過去問演習記録テーブル
CREATE TABLE practice_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL CHECK (subject IN ('FAR', 'AUD', 'REG', 'BAR')),
  topic TEXT,
  total_questions INTEGER NOT NULL CHECK (total_questions > 0),
  correct_answers INTEGER NOT NULL CHECK (correct_answers >= 0),
  round_number INTEGER NOT NULL DEFAULT 1,
  practiced_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_answers CHECK (correct_answers <= total_questions)
);

-- 学習ノートテーブル
CREATE TABLE study_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  tags TEXT[] DEFAULT '{}',
  subject TEXT CHECK (subject IN ('FAR', 'AUD', 'REG', 'BAR')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX idx_study_sessions_started_at ON study_sessions(started_at);
CREATE INDEX idx_practice_records_user_id ON practice_records(user_id);
CREATE INDEX idx_practice_records_practiced_at ON practice_records(practiced_at);
CREATE INDEX idx_study_notes_user_id ON study_notes(user_id);
CREATE INDEX idx_study_notes_tags ON study_notes USING GIN(tags);

-- Row Level Security 有効化
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_notes ENABLE ROW LEVEL SECURITY;

-- RLSポリシー作成
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can manage own sessions" ON study_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own practice records" ON practice_records
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own notes" ON study_notes
  FOR ALL USING (auth.uid() = user_id);

-- プロファイル自動作成トリガー
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

#### Step 1.6: 型定義

```typescript
// src/types/database.ts
export type Subject = 'FAR' | 'AUD' | 'REG' | 'BAR'

export interface Profile {
  id: string
  email: string
  exam_date: string | null
  target_hours: number
  created_at: string
}

export interface StudySession {
  id: string
  user_id: string
  subject: Subject
  duration_seconds: number
  started_at: string
  ended_at: string | null
  created_at: string
}

export interface PracticeRecord {
  id: string
  user_id: string
  subject: Subject
  topic: string | null
  total_questions: number
  correct_answers: number
  round_number: number
  practiced_at: string
  created_at: string
}

export interface StudyNote {
  id: string
  user_id: string
  title: string
  content: string | null
  tags: string[]
  subject: Subject | null
  created_at: string
  updated_at: string
}
```

### 3.3 完了条件

- [x] `npm run dev` でエラーなく起動
- [ ] Supabaseとの接続確認（未実装 - ローカルストレージで代替中）
- [ ] ユーザー登録・ログインができる（未実装）
- [x] 認証後のリダイレクトが正常動作
- [x] レスポンシブレイアウトが表示される

---

## 4. Phase 2: コア機能実装

### 4.1 タスク一覧

| # | タスク | 詳細 | 成果物 |
|---|--------|------|--------|
| 2.1 | タイマーUI | ストップウォッチ/ポモドーロ切替 | components/timer/* |
| 2.2 | タイマーロジック | 時間計測、バックグラウンド対応 | hooks/useTimer.ts |
| 2.3 | セッション保存 | Supabaseへの記録保存 | actions/sessions.ts |
| 2.4 | 過去問記録フォーム | 入力フォームとバリデーション | components/practice/* |
| 2.5 | 過去問記録一覧 | 記録の表示・編集・削除 | app/records/* |
| 2.6 | ノートエディタ | Markdown入力対応 | components/notes/* |
| 2.7 | ノート一覧・検索 | フィルタリング・検索 | app/notes/* |
| 2.8 | タグ管理 | タグの追加・表示 | components/tags/* |

### 4.2 実装詳細

#### 4.2.1 タイマー機能

```typescript
// src/hooks/useTimer.ts
import { useState, useEffect, useCallback, useRef } from 'react'

type TimerMode = 'stopwatch' | 'pomodoro'
type TimerStatus = 'idle' | 'running' | 'paused'

interface UseTimerOptions {
  pomodoroMinutes?: number
  breakMinutes?: number
  onComplete?: () => void
}

export function useTimer(options: UseTimerOptions = {}) {
  const {
    pomodoroMinutes = 25,
    breakMinutes = 5,
    onComplete
  } = options

  const [mode, setMode] = useState<TimerMode>('stopwatch')
  const [status, setStatus] = useState<TimerStatus>('idle')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isBreak, setIsBreak] = useState(false)

  const startTimeRef = useRef<number | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const pomodoroSeconds = pomodoroMinutes * 60
  const breakSeconds = breakMinutes * 60

  // ストップウォッチモード: 経過時間
  // ポモドーロモード: 残り時間
  const displaySeconds = mode === 'stopwatch'
    ? elapsedSeconds
    : (isBreak ? breakSeconds : pomodoroSeconds) - elapsedSeconds

  const start = useCallback(() => {
    if (status === 'running') return

    startTimeRef.current = Date.now() - (elapsedSeconds * 1000)
    setStatus('running')

    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000)
      setElapsedSeconds(elapsed)

      // ポモドーロモードの完了チェック
      if (mode === 'pomodoro') {
        const limit = isBreak ? breakSeconds : pomodoroSeconds
        if (elapsed >= limit) {
          if (!isBreak) {
            setIsBreak(true)
            setElapsedSeconds(0)
            startTimeRef.current = Date.now()
          } else {
            stop()
            onComplete?.()
          }
        }
      }
    }, 1000)
  }, [status, elapsedSeconds, mode, isBreak, pomodoroSeconds, breakSeconds, onComplete])

  const pause = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setStatus('paused')
  }, [])

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setStatus('idle')
    const finalSeconds = elapsedSeconds
    setElapsedSeconds(0)
    setIsBreak(false)
    startTimeRef.current = null
    return finalSeconds
  }, [elapsedSeconds])

  const reset = useCallback(() => {
    stop()
  }, [stop])

  const toggleMode = useCallback((newMode: TimerMode) => {
    if (status !== 'idle') return
    setMode(newMode)
    setElapsedSeconds(0)
  }, [status])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // Page Visibility API でバックグラウンド対応
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && status === 'running' && startTimeRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setElapsedSeconds(elapsed)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [status])

  return {
    mode,
    status,
    elapsedSeconds,
    displaySeconds,
    isBreak,
    start,
    pause,
    stop,
    reset,
    toggleMode,
  }
}
```

#### 4.2.2 過去問記録フォーム

```typescript
// src/lib/validations/practice.ts
import { z } from 'zod'

export const practiceRecordSchema = z.object({
  subject: z.enum(['FAR', 'AUD', 'REG', 'BAR']),
  topic: z.string().optional(),
  total_questions: z.number().min(1, '1問以上入力してください'),
  correct_answers: z.number().min(0, '0以上の数値を入力してください'),
  round_number: z.number().min(1).default(1),
  practiced_at: z.string(),
}).refine(
  (data) => data.correct_answers <= data.total_questions,
  {
    message: '正解数は問題数以下にしてください',
    path: ['correct_answers'],
  }
)

export type PracticeRecordInput = z.infer<typeof practiceRecordSchema>
```

#### 4.2.3 学習ノート機能

```typescript
// src/lib/validations/note.ts
import { z } from 'zod'

export const studyNoteSchema = z.object({
  title: z.string().min(1, 'タイトルを入力してください').max(100),
  content: z.string().optional(),
  tags: z.array(z.string()).default([]),
  subject: z.enum(['FAR', 'AUD', 'REG', 'BAR']).nullable(),
})

export type StudyNoteInput = z.infer<typeof studyNoteSchema>
```

### 4.3 完了条件

- [x] タイマーが正確に動作する（ストップウォッチ/ポモドーロ両モード）
- [x] タブ切り替え後も時間が正しく計測される
- [x] セッション終了時にデータが保存される（ローカルストレージ）
- [x] 過去問記録の CRUD 操作ができる
- [x] バリデーションエラーが適切に表示される
- [x] ノートの作成・編集・削除ができる
- [x] タグでのフィルタリングができる

### 4.4 追加実装済み機能（v1.2）

- [x] 学習記録に学習時間フィールドを追加
- [x] タイマーと記録画面の連動（タイマーの今日の学習時間をデフォルト表示）
- [x] 記録ストア（recordStore）の実装
- [x] テキスト復習タイプの記録対応
- [x] サブテーマ（サブトピック）の選択機能
- [x] 学習記録画面での学習時間表示
- [x] PDF教材ビューア（react-pdf）

### 4.5 追加実装済み機能（v1.3）

- [x] 設定ストア（settingsStore）の実装 - 設定値のlocalStorage永続化
- [x] 学習記録の編集機能（/records/[id]ページ）
- [x] 学習記録の削除機能（確認ダイアログ付き）
- [x] 記録一覧からの詳細画面への遷移（クリックで詳細ページへ）
- [x] タイマーボタンへのラベル追加（Start/Pause/Resume/Reset/Record）

---

## 5. Phase 3: 分析・ダッシュボード実装

### 5.1 タスク一覧

| # | タスク | 詳細 | 成果物 |
|---|--------|------|--------|
| 3.1 | ダッシュボードUI | カード型レイアウト | app/dashboard/* |
| 3.2 | カウントダウン | 試験日までの残り日数 | components/countdown/* |
| 3.3 | 今日のサマリー | 学習時間・問題数 | components/summary/* |
| 3.4 | 学習時間グラフ | 日/週/月の推移 | components/charts/StudyTimeChart.tsx |
| 3.5 | 正答率グラフ | 科目別の正答率 | components/charts/AccuracyChart.tsx |
| 3.6 | 弱点分析 | 低正答率テーマ抽出 | components/analysis/* |
| 3.7 | 進捗バー | 目標達成率 | components/progress/* |

### 5.2 実装詳細

#### 5.2.1 データ集計ユーティリティ

```typescript
// src/lib/analytics.ts
import { StudySession, PracticeRecord } from '@/types/database'
import { startOfDay, startOfWeek, startOfMonth, format } from 'date-fns'

// 日別学習時間集計
export function aggregateStudyTimeByDay(sessions: StudySession[]) {
  const grouped = sessions.reduce((acc, session) => {
    const day = format(new Date(session.started_at), 'yyyy-MM-dd')
    acc[day] = (acc[day] || 0) + session.duration_seconds
    return acc
  }, {} as Record<string, number>)

  return Object.entries(grouped).map(([date, seconds]) => ({
    date,
    hours: Math.round((seconds / 3600) * 10) / 10,
  }))
}

// 科目別学習時間集計
export function aggregateStudyTimeBySubject(sessions: StudySession[]) {
  const grouped = sessions.reduce((acc, session) => {
    acc[session.subject] = (acc[session.subject] || 0) + session.duration_seconds
    return acc
  }, {} as Record<string, number>)

  return Object.entries(grouped).map(([subject, seconds]) => ({
    subject,
    hours: Math.round((seconds / 3600) * 10) / 10,
  }))
}

// 科目別正答率計算
export function calculateAccuracyBySubject(records: PracticeRecord[]) {
  const grouped = records.reduce((acc, record) => {
    if (!acc[record.subject]) {
      acc[record.subject] = { total: 0, correct: 0 }
    }
    acc[record.subject].total += record.total_questions
    acc[record.subject].correct += record.correct_answers
    return acc
  }, {} as Record<string, { total: number; correct: number }>)

  return Object.entries(grouped).map(([subject, data]) => ({
    subject,
    accuracy: Math.round((data.correct / data.total) * 100),
    total: data.total,
    correct: data.correct,
  }))
}

// 弱点テーマ抽出（正答率70%未満）
export function identifyWeakTopics(records: PracticeRecord[], threshold = 70) {
  const grouped = records.reduce((acc, record) => {
    if (!record.topic) return acc

    const key = `${record.subject}:${record.topic}`
    if (!acc[key]) {
      acc[key] = { subject: record.subject, topic: record.topic, total: 0, correct: 0 }
    }
    acc[key].total += record.total_questions
    acc[key].correct += record.correct_answers
    return acc
  }, {} as Record<string, { subject: string; topic: string; total: number; correct: number }>)

  return Object.values(grouped)
    .map(data => ({
      ...data,
      accuracy: Math.round((data.correct / data.total) * 100),
    }))
    .filter(data => data.accuracy < threshold)
    .sort((a, b) => a.accuracy - b.accuracy)
}

// 必要学習ペース計算
export function calculateRequiredPace(
  totalTargetHours: number,
  completedHours: number,
  daysRemaining: number
): number {
  if (daysRemaining <= 0) return 0
  const remainingHours = totalTargetHours - completedHours
  return Math.ceil((remainingHours / daysRemaining) * 10) / 10
}
```

#### 5.2.2 ダッシュボードページ

```typescript
// src/app/(main)/dashboard/page.tsx 構成イメージ

// コンポーネント構成:
// - CountdownCard: 試験日カウントダウン
// - TodaySummaryCard: 今日の学習サマリー
// - WeeklyProgressCard: 週間進捗バー
// - QuickActions: クイックアクションボタン
// - RecentActivityList: 最近の活動一覧
```

### 5.3 完了条件

- [x] ダッシュボードに全情報が表示される
- [x] カウントダウンが正確に計算される
- [x] グラフが正しく描画される
- [x] 弱点分野が正答率に基づいて表示される
- [x] データ更新時にリアルタイムで反映される

### 5.4 追加実装済み機能（v1.2）

- [x] 科目別目標学習時間の設定（設定画面）
- [x] 平日/休日別の目標時間設定
- [x] 祝日考慮の週間目標計算（日本の祝日データ2025-2027年）
- [x] 記録ベースの進捗表示（ダッシュボード）
- [x] 今日の学習時間・問題数・正答率のサマリー
- [x] 週間進捗バー
- [x] 科目別進捗バー（目標時間に対する達成率）

### 5.5 追加実装済み機能（v1.3）

- [x] 試験日見込み学習時間の表示（設定画面）
- [x] 目標達成可否の判定（残り日数×日割り学習時間と残り必要時間の比較）
- [x] 達成可能時は緑色で「現在のペースで目標達成可能」と表示
- [x] 不足時は赤色で「あと○時間不足（1日+○h必要）」と表示
- [x] ノートストア（notesStore）の実装 - ノートのlocalStorage永続化
- [x] 分析画面での実データ表示（recordStore、settingsStoreからデータ取得）

---

## 6. Phase 4: PWA対応・リリース準備

### 6.1 タスク一覧

| # | タスク | 詳細 | 成果物 |
|---|--------|------|--------|
| 4.1 | PWA設定 | next-pwa導入 | next.config.js |
| 4.2 | マニフェスト | アプリ情報定義 | public/manifest.json |
| 4.3 | アイコン作成 | 各サイズのアイコン | public/icons/* |
| 4.4 | オフライン対応 | Service Worker設定 | sw.js |
| 4.5 | レスポンシブ調整 | モバイル最適化 | 各コンポーネント |
| 4.6 | パフォーマンス最適化 | Lighthouse改善 | - |
| 4.7 | 本番環境設定 | 環境変数、ドメイン | Vercel設定 |
| 4.8 | デプロイ | Vercelへデプロイ | 本番URL |

### 6.2 実装詳細

#### 6.2.1 PWA設定

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
})

module.exports = withPWA({
  // Next.js config
})
```

#### 6.2.2 マニフェスト

```json
// public/manifest.json
{
  "name": "USCPA学習管理",
  "short_name": "USCPA Study",
  "description": "USCPA試験の学習進捗を管理するアプリ",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 6.3 完了条件

- [x] PWAとしてインストール可能
- [x] オフラインで基本機能が動作する（Service Workerによるキャッシュ）
- [x] Lighthouse スコア改善（Accessibility 100達成）
- [x] モバイルで快適に操作できる
- [x] 本番環境で全機能が動作する（https://uscpa-learning.vercel.app）

### 6.4 追加実装済み機能（v1.4）

- [x] manifest.json の作成（アプリ名、説明、アイコン設定）
- [x] SVGアイコンの作成
- [x] Apple Web App対応メタタグ
- [x] PWAショートカット設定（タイマー、記録追加）

### 6.5 追加実装済み機能（v1.5）

- [x] next-pwa パッケージの導入
- [x] Service Worker 設定（next.config.js）
- [x] Runtime Caching 設定（フォント、画像、JS、CSS、APIなど）
- [x] .gitignore にPWA生成ファイルを追加（sw.js, workbox-*.js）
- [x] ビルド成功確認（sw.js, workbox.js が生成される）

### 6.6 追加実装済み機能（v1.7）

- [x] Vercelへの本番デプロイ（https://uscpa-learning.vercel.app）
- [x] Next.js 15.5.9へのアップグレード（セキュリティ修正）
- [x] Lighthouseアクセシビリティ改善
  - テキストコントラスト比の改善（WCAG準拠）
  - Badgeコンポーネントのコントラスト比改善
  - Accessibility スコア 100達成

### 6.7 追加実装済み機能（v1.8）

- [x] Notion APIクライアント実装（src/lib/notion/）
  - client.ts: Notionクライアント・環境変数管理
  - settings.ts: 設定DB操作
  - sessions.ts: 学習セッションDB操作
  - records.ts: 学習記録DB操作
  - notes.ts: 学習ノートDB操作（Markdown変換含む）
- [x] Notion APIルート実装（src/app/api/notion/）
  - /api/notion/status: 接続状態確認
  - /api/notion/settings: 設定CRUD
  - /api/notion/sessions: セッションCRUD
  - /api/notion/records: 記録CRUD
  - /api/notion/notes: ノートCRUD
- [x] フロントエンドNotion同期統合
  - useNotionSync.ts: 同期フック（useNotionStatus, useSyncQueue, useNotionApi）
  - settingsStore.ts: 設定自動同期
  - recordStore.ts: 記録CRUD同期
  - notesStore.ts: ノートCRUD同期
  - タイマー終了時のセッション保存

### 6.8 追加実装済み機能（v1.9）

- [x] PDF教材機能の強化
  - IndexedDBによるPDFファイルのローカル保存（src/lib/indexeddb.ts）
  - 教材一覧ページ（/materials）
  - 教材詳細ページ（/materials/[id]）でのPDFビューア
  - 教材メタデータのlocalStorage管理（materialsStore.ts）
- [x] ページ連動メモ機能
  - PageMemo.tsx: ページ番号に紐づくメモ機能
  - メモ入力欄とメモ一覧の表示
  - メモ一覧クリックで該当ページにジャンプ
  - メモのlocalStorage永続化
- [x] リサイズ可能パネル（src/components/ui/resizable-panel.tsx）
  - ResizableHorizontalPanel: 左右パネルの幅をドラッグで調整
  - ResizableVerticalPanel: 上下パネルの高さをドラッグで調整
  - パネルサイズのlocalStorage永続化
- [x] 教材詳細画面のレイアウト改善
  - PC: PDFビューア（左）とメモパネル（右）の水平リサイズ
  - メモパネル内: メモ入力（上）とメモ一覧（下）の垂直リサイズ
  - モバイル: PDF上部、メモ下部の固定レイアウト

### 6.9 追加実装済み機能（v1.10）

- [x] タイマー画面に演習記録入力欄を追加
  - 問題数・正答数の入力フィールド
  - 正答率のリアルタイム表示（色分け: 80%以上=緑、60%以上=黄、60%未満=赤）
  - メモ入力欄
  - 入力値のlocalStorage永続化（timerStore）
- [x] 記録ダイアログへの値引き継ぎ
  - タイマー画面で入力した問題数・正答数・メモをRecordDialogに引き継ぐ
  - ダイアログ表示時に初期値として設定
  - 記録保存・キャンセル時にフィールドをリセット

### 6.11 追加実装済み機能（v1.12）

- [x] メモ未保存警告機能
  - PageMemoコンポーネントにforwardRefとuseImperativeHandleを追加
  - 未保存状態の検出とonDirtyChangeコールバック実装
  - 戻るボタン時に未保存確認ダイアログ表示
  - ブラウザ終了時のbeforeunload警告
  - 「未保存」バッジ表示
- [x] useMediaQueryフック（src/hooks/useMediaQuery.ts）
  - メディアクエリの状態を監視するカスタムフック
  - useIsDesktop()でPC/モバイル判定
  - PC/モバイルの条件付きレンダリングで重複コンポーネント問題を解消
- [x] アプリ起動時のNotion同期機能
  - SyncProvider（src/components/providers/SyncProvider.tsx）
  - useSyncOnMountフック（初回マウント時に同期、5分間隔チェック）
  - useSyncOnOnlineフック（オンライン復帰時に同期）
  - メインレイアウト（src/app/(main)/layout.tsx）への統合

### 6.13 追加実装済み機能（v1.13）

- [x] 教材ページにミニタイマーを追加（src/components/materials/MiniTimer.tsx）
  - 教材ページ内蔵のコンパクトタイマー（開始/停止/リセット）
  - 問題数・正解数の入力フィールド
  - 今日の合計勉強時間をリアルタイム表示
  - forwardRef + useImperativeHandleによる外部操作対応
- [x] 教材ページのキーボードショートカット
  - Ctrl+S / Cmd+S: メモ保存
  - `]` / `[`: ズームイン / ズームアウト
  - Space: タイマー開始/停止
  - ← / → / PageUp / PageDown: ページ移動
  - Q / Shift+Q: 問題数 増/減
  - A / Shift+A: 正解数 増/減
  - V: 回答あり/なしPDF切り替え
  - input/textareaフォーカス時は一部ショートカットを無効化
- [x] サイドバーにショートカット説明を表示（src/components/layout/Sidebar.tsx）
- [x] 回答あり/なし2種類のPDF管理
  - MaterialData型にpdfWithAnswers / pdfWithoutAnswersフィールド
  - 切り替えボタンUI + Vキーショートカット
- [x] PDF文章検索機能（PDFViewer内蔵）
- [x] 教材一覧の検索機能
- [x] 水平/垂直レイアウト切り替え
  - horizontal（左右）/ vertical（上下）モード
  - localStorageで設定を永続化
- [x] ページめくり時のメモ自動保存
  - ページ変更検知をrender内で同期的に実行（prevPageRef使用）
  - useRefによる最新状態の追跡（stale closure回避）
  - localStorageへの即時保存 + Notion非同期同期
  - ページ変更時にlocalStorageから最新メモを再読み込み
- [x] 分析ページにテーマ別統計機能を追加

### 6.14 Notionデータベース構成（v1.11予定）

#### 設計方針

- **ローカルファースト**: localStorageが主データソース、Notionは同期用バックエンド
- **デバイス間同期**: Notionを介して複数デバイス間でデータを同期
- **監査証跡**: Sessions（生データ）とRecords（確定データ）を分離して変更履歴を追跡
- **Notion直接編集なし**: ユーザーはアプリからのみデータを操作

#### DB1: 設定 (Settings)

| プロパティ名 | 型 | 説明 |
|-------------|-----|------|
| 名前 | Title | "マイ設定" |
| デバイスID | Text | 同期元デバイス識別子 |
| 更新日時 | Date | 最終更新日時（競合解決用） |
| FAR目標時間 | Number | FAR目標学習時間（時間） |
| AUD目標時間 | Number | AUD目標学習時間（時間） |
| REG目標時間 | Number | REG目標学習時間（時間） |
| BAR目標時間 | Number | BAR目標学習時間（時間） |
| FAR試験日 | Date | FAR受験予定日 |
| AUD試験日 | Date | AUD受験予定日 |
| REG試験日 | Date | REG受験予定日 |
| BAR試験日 | Date | BAR受験予定日 |
| 平日目標時間 | Number | 平日の日割り目標（時間） |
| 休日目標時間 | Number | 休日の日割り目標（時間） |

#### DB2: 学習セッション (Study Sessions) - 生データ

| プロパティ名 | 型 | 説明 |
|-------------|-----|------|
| 名前 | Title | 自動生成 "2026/01/19 FAR 1h30m" |
| セッションID | Text | ローカル生成UUID（主キー） |
| 科目 | Select | FAR / AUD / REG / BAR |
| サブトピック | Text | サブテーマ（任意） |
| 学習時間(分) | Number | 学習時間（分単位） |
| 開始日時 | Date | セッション開始日時 |
| 終了日時 | Date | セッション終了日時 |
| デバイスID | Text | 記録元デバイス識別子 |
| 作成日時 | Date | レコード作成日時 |

※ このDBは読み取り専用（タイマー終了時に自動作成、編集不可）

#### DB3: 学習記録 (Practice Records) - 確定データ

| プロパティ名 | 型 | 説明 |
|-------------|-----|------|
| 名前 | Title | 自動生成 "2026/01/19 FAR Ch.5" |
| レコードID | Text | ローカル生成UUID（主キー） |
| 科目 | Select | FAR / AUD / REG / BAR |
| サブトピック | Text | サブテーマ（任意） |
| 記録タイプ | Select | practice / textbook |
| 学習時間(分) | Number | 学習時間（分単位） |
| 問題数 | Number | 解いた問題数（practice時） |
| 正解数 | Number | 正解した問題数（practice時） |
| 周回数 | Number | 何周目か（practice時） |
| チャプター | Text | 章・セクション（textbook時） |
| ページ範囲 | Text | ページ範囲（textbook時） |
| メモ | Text | 学習メモ |
| 学習日 | Date | 学習した日付 |
| ソース | Select | timer / manual（記録の作成元） |
| セッションID | Text | 紐づくセッションID（timer時、監査用） |
| デバイスID | Text | 記録元デバイス識別子 |
| 作成日時 | Date | レコード作成日時 |
| 更新日時 | Date | 最終更新日時 |

#### DB4: 学習ノート (Study Notes) - ページメモ統合

| プロパティ名 | 型 | 説明 |
|-------------|-----|------|
| 名前 | Title | ノートタイトル |
| ノートID | Text | ローカル生成UUID（主キー） |
| ノートタイプ | Select | note / page_memo |
| 科目 | Select | FAR / AUD / REG / BAR |
| タグ | Multi-select | 重要度、テーマなど |
| 本文 | Text | ノート内容（Markdown） |
| 教材ID | Text | 紐づくPDF教材ID（page_memo時） |
| ページ番号 | Number | PDFページ番号（page_memo時） |
| デバイスID | Text | 記録元デバイス識別子 |
| 作成日時 | Created time | 自動 |
| 更新日時 | Last edited time | 自動 |

#### 同期仕様

1. **初回同期（アプリ起動時）**
   - NotionからデータをフェッチしlocalStorageと比較
   - 更新日時が新しい方を採用（Last-Write-Wins）

2. **書き込み同期**
   - localStorageへの保存と同時にNotion APIを呼び出し
   - オフライン時はキューに蓄積、オンライン復帰時に一括同期

3. **競合解決**
   - 更新日時（updatedAt）とデバイスIDで判定
   - 新しい更新を優先（Last-Write-Wins）

4. **デバイスID**
   - 初回起動時にUUIDを生成してlocalStorageに保存
   - 同一デバイスからの操作を識別

---

## 7. ディレクトリ構成

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (main)/
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── timer/
│   │   │   └── page.tsx
│   │   ├── records/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── notes/
│   │   │   ├── page.tsx
│   │   │   ├── new/
│   │   │   │   └── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── analytics/
│   │   │   └── page.tsx
│   │   ├── settings/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── api/
│   │   └── auth/
│   │       └── callback/
│   │           └── route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ui/                    # shadcn/ui コンポーネント
│   ├── navigation/
│   │   ├── BottomNav.tsx
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   ├── timer/
│   │   ├── TimerDisplay.tsx
│   │   ├── TimerControls.tsx
│   │   ├── SubjectSelector.tsx
│   │   └── ModeToggle.tsx
│   ├── practice/
│   │   ├── PracticeForm.tsx
│   │   ├── PracticeList.tsx
│   │   └── PracticeCard.tsx
│   ├── notes/
│   │   ├── NoteEditor.tsx
│   │   ├── NoteList.tsx
│   │   ├── NoteCard.tsx
│   │   └── TagInput.tsx
│   ├── charts/
│   │   ├── StudyTimeChart.tsx
│   │   ├── AccuracyChart.tsx
│   │   └── SubjectPieChart.tsx
│   ├── dashboard/
│   │   ├── CountdownCard.tsx
│   │   ├── TodaySummaryCard.tsx
│   │   ├── WeeklyProgressCard.tsx
│   │   └── QuickActions.tsx
│   └── common/
│       ├── Loading.tsx
│       ├── ErrorBoundary.tsx
│       └── EmptyState.tsx
├── hooks/
│   ├── useTimer.ts
│   ├── useAuth.ts
│   ├── useSessions.ts
│   ├── usePracticeRecords.ts
│   └── useStudyNotes.ts
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── validations/
│   │   ├── practice.ts
│   │   └── note.ts
│   ├── analytics.ts
│   └── utils.ts
├── stores/
│   ├── timerStore.ts
│   └── userStore.ts
├── types/
│   └── database.ts
└── middleware.ts
```

---

## 8. コンポーネント設計

### 8.1 コンポーネント一覧

| コンポーネント | 種別 | 説明 |
|----------------|------|------|
| TimerDisplay | Presentational | タイマー表示（時:分:秒） |
| TimerControls | Container | 開始/停止/リセットボタン |
| SubjectSelector | Presentational | 科目選択ドロップダウン |
| PracticeForm | Container | 過去問記録入力フォーム |
| PracticeList | Container | 記録一覧（フィルタ付き） |
| NoteEditor | Container | Markdownエディタ |
| CountdownCard | Presentational | カウントダウン表示 |
| StudyTimeChart | Presentational | 学習時間グラフ |

### 8.2 状態管理設計

```typescript
// src/stores/timerStore.ts
import { create } from 'zustand'
import { Subject } from '@/types/database'

interface TimerState {
  selectedSubject: Subject
  isRunning: boolean
  startTime: number | null
  setSubject: (subject: Subject) => void
  setRunning: (running: boolean) => void
  setStartTime: (time: number | null) => void
}

export const useTimerStore = create<TimerState>((set) => ({
  selectedSubject: 'FAR',
  isRunning: false,
  startTime: null,
  setSubject: (subject) => set({ selectedSubject: subject }),
  setRunning: (running) => set({ isRunning: running }),
  setStartTime: (time) => set({ startTime: time }),
}))
```

---

## 9. API設計

### 9.1 Server Actions

| アクション | 用途 | 入力 | 出力 |
|-----------|------|------|------|
| createSession | セッション作成 | SessionInput | Session |
| updateSession | セッション更新 | id, SessionInput | Session |
| getSessions | セッション取得 | filters | Session[] |
| createPracticeRecord | 記録作成 | PracticeInput | PracticeRecord |
| updatePracticeRecord | 記録更新 | id, PracticeInput | PracticeRecord |
| deletePracticeRecord | 記録削除 | id | void |
| createNote | ノート作成 | NoteInput | StudyNote |
| updateNote | ノート更新 | id, NoteInput | StudyNote |
| deleteNote | ノート削除 | id | void |
| updateProfile | プロフィール更新 | ProfileInput | Profile |

### 9.2 リアルタイム購読

```typescript
// セッション変更の購読例
const channel = supabase
  .channel('study_sessions')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'study_sessions',
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      // 状態更新処理
    }
  )
  .subscribe()
```

---

## 10. テスト計画

### 10.1 テスト種別

| 種別 | 対象 | ツール |
|------|------|--------|
| ユニットテスト | ユーティリティ関数、hooks | Vitest |
| コンポーネントテスト | UIコンポーネント | Testing Library |
| E2Eテスト | 主要フロー | Playwright（将来） |

### 10.2 テスト対象優先度

1. **高**: タイマーロジック（useTimer）
2. **高**: データ集計関数（analytics.ts）
3. **中**: バリデーションスキーマ
4. **中**: 認証フロー
5. **低**: UIコンポーネント表示

### 10.3 テストコマンド

```bash
# 全テスト実行
npm run test

# ウォッチモード
npm run test:watch

# カバレッジ
npm run test:coverage
```

---

## 11. デプロイ手順

### 11.1 事前準備

1. GitHubリポジトリ作成
2. Vercelアカウント作成・GitHub連携
3. 本番用Supabaseプロジェクト作成（または既存を使用）

### 11.2 Vercelデプロイ設定

1. **プロジェクトインポート**
   - Vercelダッシュボードで「New Project」
   - GitHubリポジトリを選択

2. **環境変数設定**
   ```
   NEXT_PUBLIC_SUPABASE_URL=本番URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=本番Key
   ```

3. **ビルド設定**
   - Framework: Next.js（自動検出）
   - Build Command: `npm run build`
   - Output Directory: `.next`

4. **ドメイン設定**（任意）
   - カスタムドメインを設定

### 11.3 デプロイ後の確認

- [ ] トップページが表示される
- [ ] ユーザー登録ができる
- [ ] ログイン/ログアウトができる
- [ ] タイマーが動作する
- [ ] データが保存・取得できる
- [ ] PWAとしてインストールできる

---

## 改訂履歴

| バージョン | 日付 | 内容 | 担当 |
|------------|------|------|------|
| 1.0 | 2026-01-17 | 初版作成 | - |
| 1.1 | 2026-01-17 | Phase 1-2の実装完了を反映 | - |
| 1.2 | 2026-01-18 | 学習時間管理機能、祝日対応週間目標、PDF教材ビューア追加 | - |
| 1.3 | 2026-01-18 | 設定/ノート永続化、学習記録編集・削除、試験日見込み時間表示、タイマーボタンラベル追加 | - |
| 1.4 | 2026-01-18 | ノート編集・削除機能、タグフィルタリング機能、弱点分析機能の完了条件達成 | - |
| 1.5 | 2026-01-18 | PWA Service Worker実装完了（next-pwa、runtime caching設定） | - |
| 1.6 | 2026-01-18 | Markdownプレビュー機能、必要学習ペース計算機能実装 | - |
| 1.7 | 2026-01-18 | Vercelデプロイ、Lighthouseアクセシビリティ改善（スコア100達成） | - |
| 1.8 | 2026-01-18 | Notion API統合（クライアント実装、APIルート、フロントエンド同期） | - |
| 1.9 | 2026-01-19 | PDF教材機能強化（IndexedDB保存、ページ連動メモ、リサイズ可能パネル） | - |
| 1.10 | 2026-01-19 | タイマー画面に問題数・正答数・メモ入力欄を追加、記録ダイアログへの値引き継ぎ | - |
| 1.11 | 2026-01-19 | Notion DB構成確定（4DB維持、Sessions/Records分離、ページメモ統合、同期仕様） | - |
| 1.12 | 2026-01-20 | メモ未保存警告機能、アプリ起動時Notion同期、useMediaQueryフック追加 | - |
| 1.13 | 2026-01-31 | 教材ミニタイマー、キーボードショートカット、PDF検索、回答あり/なしPDF管理、レイアウト切替、テーマ別統計、メモ自動保存 | - |
