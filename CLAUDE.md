# USCPA学習管理アプリケーション - CLAUDE.md

このファイルはClaude Codeがプロジェクトを理解するためのガイドです。

## プロジェクト概要

USCPA（米国公認会計士）試験の学習進捗を管理するPWAアプリケーション。
Notion APIをバックエンドとして使用し、学習時間の計測、過去問演習記録、学習ノートを管理する。

## 技術スタック

| カテゴリ       | 技術                      |
| -------------- | ------------------------- |
| フレームワーク | Next.js 14 (App Router)   |
| 言語           | TypeScript                |
| スタイリング   | Tailwind CSS              |
| UIライブラリ   | shadcn/ui                 |
| バックエンド   | Notion API                |
| 状態管理       | Zustand                   |
| フォーム       | React Hook Form + Zod     |
| グラフ         | Recharts                  |
| PWA            | next-pwa (Service Worker) |
| デプロイ       | Vercel                    |

## ディレクトリ構成

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # 認証関連（ログイン、OAuthコールバック）
│   ├── (main)/             # メイン機能
│   │   ├── dashboard/      # ダッシュボード
│   │   ├── timer/          # タイマー画面
│   │   ├── records/        # 過去問記録
│   │   ├── notes/          # 学習ノート
│   │   ├── materials/      # PDF教材
│   │   ├── analytics/      # 分析・レポート
│   │   └── settings/       # 設定
│   └── api/notion/         # Notion API Routes
├── components/
│   ├── ui/                 # shadcn/ui コンポーネント
│   ├── layout/             # ヘッダー、ナビゲーション
│   ├── providers/          # プロバイダー（SyncProvider等）
│   ├── timer/              # タイマー関連
│   ├── records/            # 過去問記録関連
│   ├── notes/              # 学習ノート関連
│   ├── materials/          # PDF教材関連（PageMemo等）
│   ├── dashboard/          # ダッシュボード関連
│   ├── analytics/          # 分析・グラフ関連
│   └── common/             # 共通コンポーネント
├── lib/
│   ├── notion/             # Notion API操作
│   └── validations/        # Zodスキーマ
├── hooks/                  # カスタムフック（useMediaQuery、useSyncOnMount等）
├── stores/                 # Zustand ストア
└── types/                  # TypeScript型定義
```

## 主要機能

### 1. 学習タイマー

- ストップウォッチ/ポモドーロモード
- 科目選択: FAR, AUD, REG, BAR
- サブテーマ（サブトピック）選択対応
- ボタンラベル表示（Start/Pause/Resume/Reset/Record）
- オフラインでも動作（ローカルストレージ保存）
- セッション終了時にNotion DBへ保存

### 2. 過去問演習記録

- 科目、問題数、正解数、テーマを記録
- 正答率は自動計算
- 周回数管理
- 学習時間の記録
- テキスト復習タイプ対応
- 記録の詳細表示・編集・削除機能

### 3. 学習ノート

- Markdown対応（react-markdown + remark-gfm）
- 編集/プレビュータブ切り替え
- タグ付け、検索機能
- Notionページとして保存
- ノートストア（notesStore）によるlocalStorage永続化

### 4. ダッシュボード

- 科目別試験日カウントダウン
- 科目別必要学習ペース表示（残り時間、○h/日）
- 目標達成見込みの視覚的フィードバック
- 今日の学習サマリー
- 週間進捗バー
- 科目別進捗バー（目標時間に対する達成率）

### 5. 設定

- 科目別試験日の設定
- 科目別目標学習時間の設定
- 平日/休日別の目標時間設定
- 試験日見込み学習時間の表示
- 目標達成可否の判定（視覚的フィードバック）
- 設定ストア（settingsStore）によるlocalStorage永続化

### 6. 分析・レポート

- 学習時間推移グラフ
- 科目別正答率グラフ
- 弱点分野の自動特定
- テーマ別統計（テーマごとの学習時間・問題数・正答率）
- 実データからのグラフ描画（recordStore、settingsStoreと連携）

### 7. PDF教材

- PDFアップロード・IndexedDB保存
- 回答あり/なし2種類のPDF管理・切り替え
- PDFビューア（react-pdf）: ページ移動、ズーム
- PDF文章検索機能
- ページ連動メモ（localStorage + Notion同期）
- ページめくり時のメモ自動保存
- メモ一覧クリックでページジャンプ
- 水平/垂直レイアウト切り替え（localStorageで永続化）
- リサイズ可能パネル（水平・垂直）
- 教材内ミニタイマー（MiniTimer）: 問題数・正解数入力、今日の合計表示
- キーボードショートカット（Ctrl+S, Space, ←→, Q/A, V, [/]）
- サイドバーにショートカット説明表示
- 教材一覧の検索機能

## Notionデータベース構成

### 設計方針（v1.11）

- **ローカルファースト**: localStorageが主データソース、Notionは同期用バックエンド
- **デバイス間同期**: Notionを介して複数デバイス間でデータを同期
- **監査証跡**: Sessions（生データ）とRecords（確定データ）を分離
- **Notion直接編集なし**: ユーザーはアプリからのみデータを操作

### 4つのデータベース

1. **設定 (Settings)**: 目標時間、科目別試験日、デバイスID
2. **学習セッション (Study Sessions)**: タイマー生データ（読み取り専用、監査用）
3. **学習記録 (Practice Records)**: 確定データ（編集可能）
   - `source`: "timer" | "manual"（作成元）
   - `sessionId`: 紐づくセッションID（timer時）
4. **学習ノート (Study Notes)**: ノート + ページメモ統合
   - `noteType`: "note" | "page_memo"
   - `materialId`: PDF教材ID（page_memo時）
   - `pageNumber`: ページ番号（page_memo時）

## 環境変数

```env
NOTION_API_KEY=secret_xxx
NOTION_SETTINGS_DB_ID=xxx
NOTION_SESSIONS_DB_ID=xxx
NOTION_RECORDS_DB_ID=xxx
NOTION_NOTES_DB_ID=xxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 開発コマンド

```bash
npm run dev      # 開発サーバー起動
npm run build    # ビルド
npm run lint     # ESLint実行
npm run test     # テスト実行
```

## コーディング規約

### ファイル命名

- コンポーネント: PascalCase (`TimerDisplay.tsx`)
- フック: camelCase + use接頭辞 (`useTimer.ts`)
- ユーティリティ: camelCase (`analytics.ts`)

### インポート

```typescript
// エイリアスを使用
import { Button } from "@/components/ui/button";
import { useTimer } from "@/hooks/useTimer";
import type { PracticeRecord } from "@/types/practice";
```

### コンポーネント設計

- Presentational/Container パターンを意識
- propsの型は明示的に定義
- 複雑なロジックはカスタムフックに切り出す

### 状態管理

- ローカル状態: useState
- グローバル状態: Zustand (stores/)
  - timerStore: タイマー状態
  - recordStore: 学習記録（CRUD、今日の学習時間）
  - settingsStore: 設定（試験日、目標時間）
  - notesStore: ノート（CRUD）
- サーバー状態: React Query (必要に応じて)

## 重要な実装ポイント

### タイマーのオフライン対応

```typescript
// タイマー計測はローカルで完結
// Page Visibility APIでバックグラウンド対応
// beforeunloadでデータロス防止
// オンライン復帰時にNotion同期
```

### Notion API呼び出し

```typescript
// サーバーサイド (api/notion/) でのみ呼び出し
// APIキーはサーバーサイドで保持
// レート制限: 3リクエスト/秒を考慮
// ISRでキャッシュ活用（5分間隔）
```

### エラーハンドリング

- 全てのAPI呼び出しにtry-catch
- ユーザーフレンドリーな日本語エラーメッセージ
- Notion API障害時はローカル一時保存

## 関連ドキュメント

- [要件定義書](./docs/requirements.md)
- [実装計画書](./docs/implementation-plan.md)
- [リスク分析書](./docs/risk-analysis.md)
- [フォルダ構成](./docs/folder-structure.md)

## PWA設定

### next-pwa

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [...] // フォント、画像、JS、CSS、APIをキャッシュ
})
```

### Service Worker

- ビルド時に`public/sw.js`と`public/workbox-*.js`が自動生成
- 開発環境ではService Workerは無効化
- 本番ビルドでオフラインキャッシュが有効

### マニフェスト

```json
// public/manifest.json
{
  "name": "USCPA学習管理",
  "short_name": "USCPA Study",
  "start_url": "/dashboard",
  "display": "standalone",
  "theme_color": "#3b82f6"
}
```

## 注意事項

1. **Notion APIのレート制限**: 頻繁なAPI呼び出しを避ける
2. **ローカルファースト**: localStorageが主データソース、Notionは同期バックエンド
3. **ローカルデータ保護**: 同期時にリモートに存在しないローカルデータを削除しない
4. **Notionは同期専用**: ユーザーはアプリからのみデータを操作（Notion直接編集なし）
5. **科目コード**: FAR, AUD, REG, BAR の4科目（BARがデフォルト選択科目）
6. **試験日は科目別**: 各科目に異なる試験日を設定可能
7. **Sessions/Recordsの分離**: タイマー生データ(Sessions)と確定データ(Records)を分離して監査証跡を維持
8. **PWA生成ファイル**: `sw.js`と`workbox-*.js`は.gitignoreで除外されている

## データ破壊リスクのある変更について

### 原則: 破壊的な変更は実施しない

ユーザーが localStorage / Notion に蓄積したデータを **一括で書き換える・削除する処理は原則禁止**。具体的には:

- Zustand persist の `migrate` 内で全レコードを再計算する処理（`recalculate`、`normalize`、`transform` 等）
- ストアの中身を一括で空配列・空オブジェクトにリセットする処理
- 複数レコードに対する一括 update / delete

### やむを得ず破壊的処理を書く場合の手順

1. **Plan モードで実装意図をユーザーに説明し、明示的な承認を取る**
2. 既存データの保存時前提（シャッフルの有無、エンコード形式、参照関係）を**コードと実データの両方で確認**してから実装する
3. **migrate 関数の冒頭で必ず `backupBeforeMigrate(storeKey, fromVersion)` を呼ぶ** (`src/lib/backup/utils.ts`)
4. 一括処理ではなく、影響範囲を限定したピンポイント修正（例: 特定の questionId だけを対象）で代替できないか検討する

### ピンポイント修正の例

問題データの正解を1件だけ修正した場合 — `attempts` 全体を `recalculate` するのではなく、対象の `questionId` を持つ attempts だけを更新する。

### Zustand persist の version 更新時のチェックリスト

- [ ] migrate 関数の冒頭で `backupBeforeMigrate` を呼んでいるか
- [ ] 既存データの保存形式の前提を確認したか（特にシャッフル・暗号化・正規化処理の有無）
- [ ] Plan モードでユーザーに承認を取ったか
- [ ] ピンポイント修正で代替できないか検討したか

### 過去の事故

- `fix: 問題データの正解誤りを修正し回答履歴を自動補正` コミットの `recalculate()` がシャッフルを考慮せずに `selectedAnswer` (シャッフル後ラベル) と `correctAnswer` (元ラベル) を比較し、ユーザーの正答データを大量に「不正解」に書き換えた。**保存時の前提（この場合シャッフル）を確認せずに一括書き換えを実装したことが原因**。

## 追加実装（v1.12）

### メモ未保存警告機能

- PageMemoコンポーネント: forwardRef + useImperativeHandleで外部からメソッドを呼び出し可能
- onDirtyChangeコールバック: 未保存状態を親コンポーネントに通知
- 確認ダイアログ: 戻るボタン時に未保存の場合は確認
- beforeunload: ブラウザ終了時に警告表示

### アプリ起動時のNotion同期

- SyncProvider: メインレイアウトで使用するプロバイダー
- useSyncOnMount: 初回マウント時にNotion同期（5分間隔チェック）
- useSyncOnOnline: オンライン復帰時に自動同期

### useMediaQueryフック

- PC/モバイル判定: useIsDesktop()でTailwindのmdブレークポイント（768px）を監視
- 条件付きレンダリング: CSS hiddenではなくJSで切り替えて重複コンポーネント問題を解消

## 追加実装（v1.13）

### 教材内ミニタイマー（MiniTimer）

- 教材ページ内蔵のコンパクトタイマー（開始/停止/リセット）
- 問題数・正解数の入力フィールド（Q/A キーで操作可能）
- 今日の合計勉強時間をリアルタイム表示
- forwardRef + useImperativeHandleで親からincrement/decrement操作

### 教材ページ キーボードショートカット

- Ctrl+S / Cmd+S: メモ保存
- `]` / `[`: ズームイン / ズームアウト
- Space: タイマー開始/停止
- ← / → / PageUp / PageDown: ページ移動
- Q / Shift+Q: 問題数 増/減
- A / Shift+A: 正解数 増/減
- V: 回答あり/なしPDF切り替え
- input/textareaフォーカス時は一部ショートカット無効化
- サイドバーにショートカット説明を表示

### 回答あり/なしPDF管理

- MaterialData型に pdfWithAnswers / pdfWithoutAnswers の2フィールド
- UIボタン + Vキーショートカットで切り替え

### PDF文章検索・教材検索

- PDFViewer内蔵の文章検索機能
- 教材一覧ページの検索フィルター

### レイアウト切り替え

- 水平（左右）/ 垂直（上下）レイアウトモード
- localStorageで設定永続化

### ページめくり時のメモ自動保存

- ページ変更検知をrender内で同期的に実行（prevPageRef）
- useRefで最新の状態を追跡（stale closure回避）
- ページ変更時にlocalStorageへ即時保存 + Notion非同期同期
- 確認ダイアログは廃止（戻るボタン時のみ残存）

### テーマ別統計（分析ページ）

- テーマごとの学習時間・問題数・正答率の詳細表示

## 問題データ作成・修正のルール

### 作成後の必須手順

IMPORTANT: 問題JSONを作成・変更したら、コミット前に必ず以下を実行すること。

```bash
node scripts/check-questions.mjs
```

git pre-commit hookが自動実行するが、コミット前に手動確認することを推奨する。
新しいマシンでクローンした場合は `node scripts/install-hooks.mjs` でhookをインストールすること。

### 作成時の絶対禁止事項

以下のバグは過去に実際に発生したもの。繰り返さないこと。

1. **解説に疑念語句を含めない**
   - `Wait`, `Hmm`, `Let me recalculate`, `not among the choices`, `closest answer is` などを解説に書かない
   - 計算が合わない → 選択肢か問題文を修正する。解説で誤魔化さない

2. **選択肢テキストに重複を設けない**
   - A・B・C・Dそれぞれ異なる値・文言にする

3. **`correctAnswer` と解説の結論を一致させる**
   - 解説で「$X が正解」と計算しているなら `correctAnswer` はその選択肢ラベルにする

4. **正解値が選択肢に存在しないまま進めない**
   - 計算した正解が選択肢にない → 選択肢を修正する。「最も近い値」で誤魔化さない

5. **問題文の数値スケールと選択肢を揃える**
   - 問題文が $10,000,000 なら選択肢も $10,000,000 スケールにする

### correctAnswer の設定ルール

```
"choices": [
  { "label": "A", "text": "$42,000" },
  { "label": "B", "text": "$36,000" },   ← 正解
  { "label": "C", "text": "$18,000" },
  { "label": "D", "text": "$60,000" }
],
"correctAnswer": "B"   ← 選択肢ラベル（A/B/C/D）で指定。$36,000 とは書かない。
```

### チェックスクリプトが検出するもの

| チェック項目                    | 例                                  |
| ------------------------------- | ----------------------------------- |
| `correctAnswer` が A/B/C/D 以外 | `"correctAnswer": "$42,000"`        |
| 選択肢テキスト重複              | A と C が同じ値                     |
| 解説に疑念語句                  | "Hmm, that's not among the choices" |

計算の正誤（数値が本当に正しいか）は自動検証できないため、作成者が必ず手計算で確認すること。
