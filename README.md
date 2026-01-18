# USCPA学習管理アプリケーション

USCPA（米国公認会計士）試験の学習を効率的に管理するためのPWAアプリケーションです。

## 機能

### 学習タイマー
- ストップウォッチモード / ポモドーロモード
- 科目・サブテーマ選択
- バックグラウンド計測対応
- 今日の累計学習時間表示

### 過去問演習記録
- 科目、問題数、正解数、テーマを記録
- 正答率は自動計算
- 周回数管理
- 学習時間の記録

### 学習ノート
- Markdown対応
- タグ付け、検索機能
- 編集/プレビュー切り替え

### ダッシュボード
- 科目別試験日カウントダウン
- 必要学習ペース表示（○h/日）
- 週間進捗バー
- 科目別進捗バー

### 分析・レポート
- 週間学習時間グラフ
- 科目別統計
- 要強化テーマの自動抽出

## 技術スタック

- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **UIライブラリ**: shadcn/ui
- **状態管理**: Zustand
- **グラフ**: Recharts
- **PWA**: next-pwa

## セットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# 本番ビルド
npm run build

# 本番サーバーの起動
npm start
```

## 環境変数

`.env.local` ファイルを作成し、以下の変数を設定してください：

```env
# Notion API（将来の実装用）
NOTION_API_KEY=your_api_key
NOTION_SETTINGS_DB_ID=your_db_id
```

## 対応科目

- **FAR**: Financial Accounting and Reporting（財務会計）
- **AUD**: Auditing and Attestation（監査と証明業務）
- **REG**: Taxation and Regulation（税法と商法）
- **BAR**: Business Analysis and Reporting（ビジネス分析と報告）

## ライセンス

MIT
