# USCPA学習管理アプリケーション フォルダ構成

**作成日**: 2026年1月17日
**更新日**: 2026年1月31日
**技術スタック**: Next.js 14 (App Router) + ローカルストレージ + Notion API連携

---

## プロジェクトルート構成

```
uscpa-learning/
├── docs/                          # ドキュメント
│   ├── requirements.md            # 要件定義書
│   ├── implementation-plan.md     # 実装計画書
│   ├── risk-analysis.md           # リスク分析書
│   └── folder-structure.md        # 本ファイル
│
├── src/                           # ソースコード
│   ├── app/                       # Next.js App Router
│   ├── components/                # Reactコンポーネント
│   ├── lib/                       # ユーティリティ・ライブラリ
│   ├── hooks/                     # カスタムフック
│   ├── stores/                    # 状態管理（Zustand）
│   ├── types/                     # TypeScript型定義
│   └── styles/                    # グローバルスタイル
│
├── public/                        # 静的ファイル
│   ├── icons/                     # PWAアイコン
│   └── manifest.json              # PWAマニフェスト
│
├── .env.local                     # 環境変数（Git管理外）
├── .env.example                   # 環境変数サンプル
├── .gitignore
├── next.config.js                 # Next.js設定
├── tailwind.config.ts             # Tailwind CSS設定
├── tsconfig.json                  # TypeScript設定
├── package.json
└── README.md
```

---

## 詳細フォルダ構成

### src/app/ - Next.js App Router

```
src/app/
├── (auth)/                        # 認証関連（グループ）
│   ├── login/
│   │   └── page.tsx               # ログインページ
│   ├── callback/
│   │   └── route.ts               # Notion OAuth コールバック
│   └── layout.tsx                 # 認証レイアウト（ヘッダーなし）
│
├── (main)/                        # メイン機能（グループ）
│   ├── dashboard/
│   │   └── page.tsx               # ダッシュボード（進捗表示、サマリー）
│   ├── timer/
│   │   └── page.tsx               # タイマー画面（サブテーマ選択対応、ボタンラベル付き）
│   ├── records/
│   │   ├── page.tsx               # 学習記録一覧（クリックで詳細へ）
│   │   ├── new/
│   │   │   └── page.tsx           # 新規記録入力（学習時間、タイマー連動）
│   │   └── [id]/
│   │       └── page.tsx           # 記録詳細・編集・削除 ★追加
│   ├── notes/
│   │   ├── page.tsx               # 学習ノート一覧
│   │   ├── new/
│   │   │   └── page.tsx           # 新規ノート作成
│   │   └── [id]/
│   │       └── page.tsx           # ノート詳細・編集
│   ├── materials/                 # ★追加
│   │   ├── page.tsx               # 教材一覧
│   │   └── [id]/
│   │       └── page.tsx           # 教材詳細（PDFビューア）
│   ├── analytics/
│   │   └── page.tsx               # 分析・レポート画面
│   ├── settings/
│   │   └── page.tsx               # 設定画面（科目別目標、週間目標）
│   └── layout.tsx                 # メインレイアウト（ナビ付き）
│
├── api/                           # API Routes
│   ├── notion/
│   │   ├── sessions/
│   │   │   └── route.ts           # 学習セッションCRUD
│   │   ├── records/
│   │   │   └── route.ts           # 過去問記録CRUD
│   │   ├── notes/
│   │   │   └── route.ts           # 学習ノートCRUD
│   │   └── settings/
│   │       └── route.ts           # 設定取得・更新
│   └── auth/
│       └── [...nextauth]/
│           └── route.ts           # 認証API（必要に応じて）
│
├── layout.tsx                     # ルートレイアウト
├── page.tsx                       # トップページ（リダイレクト）
├── loading.tsx                    # グローバルローディング
├── error.tsx                      # グローバルエラー
├── not-found.tsx                  # 404ページ
└── globals.css                    # グローバルCSS
```

### src/components/ - Reactコンポーネント

```
src/components/
├── ui/                            # shadcn/ui コンポーネント
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── label.tsx
│   ├── select.tsx
│   ├── tabs.tsx
│   ├── dialog.tsx
│   ├── toast.tsx
│   ├── badge.tsx
│   ├── progress.tsx
│   ├── dropdown-menu.tsx
│   ├── avatar.tsx
│   ├── separator.tsx
│   ├── textarea.tsx
│   └── resizable-panel.tsx         # リサイズ可能パネル（水平/垂直）★追加
│
├── layout/                        # レイアウトコンポーネント
│   ├── Header.tsx                 # ヘッダー
│   ├── BottomNav.tsx              # モバイル用ボトムナビ
│   ├── Sidebar.tsx                # PC用サイドバー（ショートカット説明表示付き）
│   └── PageContainer.tsx          # ページコンテナ
│
├── providers/                     # プロバイダー ★追加
│   └── SyncProvider.tsx           # アプリ起動時Notion同期プロバイダー
│
├── timer/                         # タイマー関連
│   ├── TimerDisplay.tsx           # タイマー表示（時:分:秒）
│   ├── TimerControls.tsx          # 開始/停止/リセットボタン
│   ├── SubjectSelector.tsx        # 科目選択
│   ├── SubtopicSelector.tsx       # サブテーマ選択 ★追加
│   ├── ModeToggle.tsx             # ストップウォッチ/ポモドーロ切替
│   └── index.ts                   # コンポーネントエクスポート
│
├── records/                       # 過去問記録関連
│   ├── PracticeForm.tsx           # 記録入力フォーム
│   ├── PracticeList.tsx           # 記録一覧
│   ├── PracticeCard.tsx           # 記録カード
│   └── PracticeFilters.tsx        # フィルター（科目、日付）
│
├── notes/                         # 学習ノート関連
│   ├── NoteEditor.tsx             # ノートエディタ
│   ├── NoteList.tsx               # ノート一覧
│   ├── NoteCard.tsx               # ノートカード
│   ├── TagInput.tsx               # タグ入力
│   ├── NoteSearch.tsx             # 検索バー
│   └── MarkdownPreview.tsx        # Markdownプレビュー（react-markdown）★追加
│
├── dashboard/                     # ダッシュボード関連
│   ├── CountdownCard.tsx          # 試験日カウントダウン
│   ├── TodaySummary.tsx           # 今日のサマリー
│   ├── WeeklyProgress.tsx         # 週間進捗バー
│   ├── QuickActions.tsx           # クイックアクション
│   └── RecentActivity.tsx         # 最近の活動
│
├── analytics/                     # 分析関連
│   ├── StudyTimeChart.tsx         # 学習時間グラフ
│   ├── AccuracyChart.tsx          # 正答率グラフ
│   ├── SubjectPieChart.tsx        # 科目別円グラフ
│   ├── WeakTopicsList.tsx         # 弱点テーマリスト
│   └── ProgressOverview.tsx       # 進捗概要
│
├── settings/                      # 設定関連
│   ├── ExamDateSettings.tsx       # 試験日設定（科目別）
│   ├── TargetHoursSettings.tsx    # 目標時間設定
│   └── NotionConnection.tsx       # Notion接続状態
│
├── materials/                     # 教材関連 ★追加
│   ├── PDFViewer.tsx              # PDFビューア（react-pdf、文章検索機能付き）
│   ├── MiniTimer.tsx              # 教材内ミニタイマー（問題数・正解数入力付き）★追加
│   └── PageMemo.tsx               # ページ連動メモ機能（自動保存対応）★追加
│
└── common/                        # 共通コンポーネント
    ├── Loading.tsx                # ローディングスピナー
    ├── ErrorMessage.tsx           # エラーメッセージ
    ├── EmptyState.tsx             # 空状態表示
    ├── ConfirmDialog.tsx          # 確認ダイアログ
    └── SubjectBadge.tsx           # 科目バッジ（色分け）
```

### src/lib/ - ユーティリティ・ライブラリ

```
src/lib/
├── notion/                        # Notion API関連
│   ├── client.ts                  # Notion クライアント初期化
│   ├── sessions.ts                # 学習セッション操作
│   ├── records.ts                 # 過去問記録操作
│   ├── notes.ts                   # 学習ノート操作
│   ├── settings.ts                # 設定操作
│   └── types.ts                   # Notion API用型定義
│
├── validations/                   # バリデーション
│   ├── practice.ts                # 過去問記録スキーマ
│   ├── note.ts                    # ノートスキーマ
│   └── settings.ts                # 設定スキーマ
│
├── analytics.ts                   # データ集計・分析ロジック
├── date.ts                        # 日付操作ユーティリティ
├── format.ts                      # フォーマット関数
├── holidays.ts                    # 日本の祝日データ・週間目標計算 ★追加
├── indexeddb.ts                   # IndexedDBユーティリティ（PDF保存用）★追加
├── storage.ts                     # ローカルストレージ操作
└── utils.ts                       # 汎用ユーティリティ（cn関数、formatMinutes等）
```

### src/hooks/ - カスタムフック

```
src/hooks/
├── useTimer.ts                    # タイマーロジック
├── useNotionSync.ts               # Notion同期（useNotionStatus, useSyncQueue, useNotionApi）
├── useSyncOnMount.ts              # アプリ起動時同期（useSyncOnMount + useSyncOnOnline）
└── useMediaQuery.ts               # メディアクエリ監視（useIsDesktop）
```

### src/stores/ - 状態管理

```
src/stores/
├── timerStore.ts                  # タイマー状態（科目、モード、セッション管理、問題数・正解数）
├── recordStore.ts                 # 学習記録状態（記録一覧、今日の学習時間、CRUD操作）
├── settingsStore.ts               # 設定状態（試験日、目標時間、ポモドーロ設定）
└── notesStore.ts                  # ノート状態（ノート一覧、CRUD操作）
```

### src/types/ - 型定義

```
src/types/
├── index.ts                       # 型のエクスポート
├── notion.ts                      # Notion関連型
├── timer.ts                       # タイマー関連型
├── practice.ts                    # 過去問記録型
├── note.ts                        # ノート型
└── settings.ts                    # 設定型
```

### public/ - 静的ファイル

```
public/
├── icons/
│   └── icon.svg                   # アプリアイコン（SVG形式）
│
├── favicon.ico
├── manifest.json                  # PWAマニフェスト
├── sw.js                          # Service Worker（ビルド時に自動生成）
├── workbox-*.js                   # Workboxライブラリ（ビルド時に自動生成）
└── robots.txt
```

**注意**: `sw.js`と`workbox-*.js`はnext-pwaによるビルド時に自動生成され、`.gitignore`で除外されています。

---

## 環境変数

### .env.example

```env
# Notion API
NOTION_API_KEY=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_SETTINGS_DB_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NOTION_SESSIONS_DB_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NOTION_RECORDS_DB_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NOTION_NOTES_DB_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Notion OAuth（Public Integration用）
NOTION_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NOTION_CLIENT_SECRET=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_REDIRECT_URI=http://localhost:3000/callback

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 主要ファイルの役割

| ファイル | 役割 |
|----------|------|
| `src/lib/notion/client.ts` | Notion APIクライアントの初期化 |
| `src/hooks/useTimer.ts` | タイマーのコアロジック（ローカル計測） |
| `src/lib/storage.ts` | ローカルストレージでのタイマーバックアップ |
| `src/app/api/notion/*/route.ts` | サーバーサイドでNotion API呼び出し |
| `src/stores/timerStore.ts` | タイマー状態のグローバル管理 |
| `src/lib/analytics.ts` | 学習データの集計・弱点分析 |
| `src/lib/indexeddb.ts` | PDFファイルのIndexedDB保存・読み込み |
| `src/components/ui/resizable-panel.tsx` | 水平/垂直リサイズ可能パネル |
| `src/components/materials/PageMemo.tsx` | ページ連動メモ機能（自動保存対応） |
| `src/components/materials/MiniTimer.tsx` | 教材内ミニタイマー（問題数・正解数入力付き） |
| `src/components/materials/PDFViewer.tsx` | PDFビューア（文章検索機能付き） |
| `src/hooks/useSyncOnMount.ts` | アプリ起動時Notion同期・オンライン復帰時同期 |
| `src/hooks/useMediaQuery.ts` | PC/モバイル判定（useIsDesktop） |

---

## 命名規則

| 種類 | 規則 | 例 |
|------|------|-----|
| コンポーネント | PascalCase | `TimerDisplay.tsx` |
| フック | camelCase + use接頭辞 | `useTimer.ts` |
| ユーティリティ | camelCase | `analytics.ts` |
| 型定義 | PascalCase | `PracticeRecord` |
| 定数 | SCREAMING_SNAKE_CASE | `MAX_QUESTIONS` |
| CSSクラス | kebab-case (Tailwind) | `text-primary` |

---

## インポートエイリアス

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/stores/*": ["./src/stores/*"],
      "@/types/*": ["./src/types/*"]
    }
  }
}
```

**使用例:**
```typescript
import { Button } from '@/components/ui/button'
import { useTimer } from '@/hooks/useTimer'
import { createSession } from '@/lib/notion/sessions'
import type { PracticeRecord } from '@/types/practice'
```
