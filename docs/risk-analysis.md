# USCPA学習管理アプリケーション リスク分析・代替案検討書

**作成日**: 2026年1月17日
**バージョン**: 1.0
**関連文書**: [要件定義書](./requirements.md), [実装計画書](./implementation-plan.md)

---

## 目次

1. [要件の不明瞭な点](#1-要件の不明瞭な点)
2. [潜在的なエラー・問題箇所](#2-潜在的なエラー問題箇所)
3. [対応策・リスク軽減策](#3-対応策リスク軽減策)
4. [技術要件を下げる代替案](#4-技術要件を下げる代替案)
5. [推奨アプローチ](#5-推奨アプローチ)

---

## 1. 要件の不明瞭な点

### 1.1 ビジネス要件の不明瞭点

| # | 項目 | 不明瞭な点 | 影響度 | 確認事項 |
|---|------|-----------|--------|----------|
| B-01 | 目標学習時間 | デフォルト値1000時間は適切か？ユーザーごとに大きく異なる可能性 | 中 | 初期設定時に入力必須にするか、推奨値を提示するか |
| B-02 | 試験日管理 | 複数科目の試験日は別々に管理するのか、1つの目標日なのか | 高 | 科目別に試験日を設定できるようにすべきか |
| B-03 | データ保持期間 | 過去データの保持期間は無制限か、一定期間後に削除するか | 低 | ストレージコストに影響 |
| B-04 | 複数デバイス同時利用 | 同時に複数デバイスでタイマーを使用した場合の動作 | 高 | 競合解決ロジックが必要 |
| B-05 | 周回数の定義 | 問題集の「周回」はユーザーが手動で管理？自動インクリメント？ | 中 | UIに影響 |

### 1.2 技術要件の不明瞭点

| # | 項目 | 不明瞭な点 | 影響度 | 確認事項 |
|---|------|-----------|--------|----------|
| T-01 | オフライン対応範囲 | どの機能までオフラインで動作させるか | 高 | タイマーのみ？記録入力も？ |
| T-02 | データ同期タイミング | リアルタイム同期 vs 手動同期 vs 定期同期 | 中 | ネットワークコスト、UXに影響 |
| T-03 | PWAインストール | インストール促進のタイミングと方法 | 低 | UXに影響 |
| T-04 | セッション有効期限 | 認証セッションの有効期間 | 中 | セキュリティとUXのバランス |
| T-05 | エラーリカバリー | ネットワークエラー時のリトライポリシー | 高 | データロス防止に重要 |

### 1.3 UI/UX要件の不明瞭点

| # | 項目 | 不明瞭な点 | 影響度 | 確認事項 |
|---|------|-----------|--------|----------|
| U-01 | タイマー終了後の動作 | 自動保存のみ？確認ダイアログ表示？ | 中 | ユーザー体験に影響 |
| U-02 | グラフの表示期間 | デフォルトで何日/週/月分を表示するか | 低 | パフォーマンスに影響 |
| U-03 | 通知・リマインダー | 学習リマインダー機能は必要か | 中 | PWAの通知制限を考慮 |
| U-04 | ダークモード | 対応するかしないか | 低 | 実装工数に影響 |

---

## 2. 潜在的なエラー・問題箇所

### 2.1 認証・セッション関連

#### 問題点 2.1.1: メール認証のエラーハンドリング不足

**現状の実装計画:**
```typescript
const { data, error } = await auth.signUp({
  email: 'user@example.com',
  password: 'secure-password-123',
})
```

**潜在的なエラー:**
- 既に登録済みのメールアドレス
- パスワードポリシー違反（最小文字数、複雑性）
- ネットワークエラー
- レート制限（短時間に大量のリクエスト）

**対応策:**
```typescript
// エラーハンドリングの強化例
const { data, error } = await auth.signUp({ email, password })

if (error) {
  switch (error.message) {
    case 'User already registered':
      return { error: 'このメールアドレスは既に登録されています' }
    case 'Password should be at least 6 characters':
      return { error: 'パスワードは6文字以上で設定してください' }
    case 'Email rate limit exceeded':
      return { error: '時間をおいて再度お試しください' }
    default:
      return { error: '登録に失敗しました。再度お試しください' }
  }
}
```

#### 問題点 2.1.2: セッション期限切れの処理

**潜在的なエラー:**
- タイマー計測中にセッションが期限切れ → データ保存失敗
- 長時間の学習後に保存しようとして認証エラー

**対応策:**
- セッション自動更新の実装
- 保存前の認証状態チェック
- ローカルストレージへの一時保存

### 2.2 タイマー機能関連

#### 問題点 2.2.1: バックグラウンドでの時間計測精度

**潜在的なエラー:**
- ブラウザがタブをサスペンド → setIntervalが停止
- モバイルブラウザのバックグラウンド制限
- デバイスのスリープ/ロック

**対応策:**
```typescript
// Page Visibility API + 開始時刻ベースの計算
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && startTimeRef.current) {
      // 再表示時に開始時刻から経過時間を再計算
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setElapsedSeconds(elapsed)
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
}, [])
```

#### 問題点 2.2.2: タイマー中のブラウザ/タブ終了

**潜在的なエラー:**
- 誤ってタブを閉じる → 計測データ消失
- ブラウザクラッシュ → データ消失

**対応策:**
- `beforeunload`イベントでの警告表示
- 定期的なローカルストレージへの自動保存
- `navigator.sendBeacon()`による緊急保存

```typescript
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isRunning) {
      e.preventDefault()
      // 緊急保存
      navigator.sendBeacon('/api/sessions/emergency-save', JSON.stringify({
        subject,
        duration: elapsedSeconds,
        startedAt: startTimeRef.current
      }))
    }
  }
  window.addEventListener('beforeunload', handleBeforeUnload)
  return () => window.removeEventListener('beforeunload', handleBeforeUnload)
}, [isRunning, elapsedSeconds])
```

### 2.3 データ同期関連

#### 問題点 2.3.1: オフライン時のデータ入力

**潜在的なエラー:**
- オフラインで記録入力 → オンライン復帰時の同期失敗
- 複数デバイスで同時編集 → データ競合

**対応策:**
- IndexedDBを使用したオフラインキュー
- 競合解決: Last-Write-Wins または マージ戦略
- 同期状態のUI表示

#### 問題点 2.3.2: リアルタイム同期のエラー

**Supabase Realtimeの潜在的エラー:**
- `CHANNEL_ERROR`: チャンネル購読エラー
- `TIMED_OUT`: サーバー応答タイムアウト
- `CLOSED`: 予期しない切断

**対応策:**
```typescript
const channel = supabase
  .channel('study_sessions')
  .on('postgres_changes', { ... }, handleChange)
  .subscribe((status, err) => {
    if (status === 'CHANNEL_ERROR') {
      console.error('Channel error:', err?.message)
      // 再接続ロジック
      setTimeout(() => channel.subscribe(), 5000)
    }
    if (status === 'TIMED_OUT') {
      // タイムアウト処理
      showToast('接続がタイムアウトしました。再接続中...')
    }
  })
```

### 2.4 フォーム入力関連

#### 問題点 2.4.1: バリデーションエラーの不十分なフィードバック

**潜在的なエラー:**
- 正解数が問題数を超える入力
- 負の数値入力
- 日付の不正フォーマット

**対応策:**
```typescript
// Zodスキーマの強化
const practiceRecordSchema = z.object({
  subject: z.enum(['FAR', 'AUD', 'REG', 'BAR']),
  total_questions: z.number()
    .int('整数で入力してください')
    .min(1, '1問以上入力してください')
    .max(1000, '1000問以下で入力してください'),
  correct_answers: z.number()
    .int('整数で入力してください')
    .min(0, '0以上の数値を入力してください'),
  practiced_at: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日付形式が不正です'),
}).refine(
  (data) => data.correct_answers <= data.total_questions,
  {
    message: '正解数は問題数以下にしてください',
    path: ['correct_answers'],
  }
).refine(
  (data) => new Date(data.practiced_at) <= new Date(),
  {
    message: '未来の日付は指定できません',
    path: ['practiced_at'],
  }
)
```

### 2.5 PWA関連

#### 問題点 2.5.1: Service Workerのキャッシュ問題

**潜在的なエラー:**
- 古いキャッシュが残り最新コードが反映されない
- キャッシュサイズ超過

**対応策:**
- バージョン管理されたキャッシュ名
- 古いキャッシュの自動削除
- キャッシュ戦略の明確化（Network First / Cache First）

#### 問題点 2.5.2: iOS PWAの制限

**潜在的なエラー:**
- プッシュ通知が動作しない（iOS 16.4以前）
- バックグラウンド同期の制限
- ローカルストレージの7日間制限

**対応策:**
- iOSユーザーへの代替手段の提示
- 重要データはSupabase側に保存
- 定期的なデータ同期の促進

---

## 3. 対応策・リスク軽減策

### 3.1 優先度別対応策マトリクス

| 優先度 | 問題 | 対応策 | 実装コスト |
|--------|------|--------|------------|
| 高 | タイマーデータ消失 | beforeunload + sendBeacon + ローカル保存 | 中 |
| 高 | セッション期限切れ | 自動更新 + 保存前チェック | 低 |
| 高 | 同時編集競合 | Last-Write-Wins + 競合検出UI | 高 |
| 中 | オフライン対応 | IndexedDB + 同期キュー | 高 |
| 中 | 認証エラー | 日本語エラーメッセージ対応 | 低 |
| 中 | バリデーション | Zodスキーマ強化 | 低 |
| 低 | PWAキャッシュ | バージョン管理 | 低 |
| 低 | iOS制限 | 代替手段の案内 | 低 |

### 3.2 テスト時の重点チェック項目

1. **認証フロー**
   - [ ] 新規登録 → メール確認 → ログイン
   - [ ] パスワードリセット
   - [ ] セッション期限切れ後の再認証

2. **タイマー機能**
   - [ ] タブ切り替え後の時間精度
   - [ ] ブラウザ終了時の警告
   - [ ] 長時間（2時間以上）の計測

3. **データ同期**
   - [ ] オフライン → オンライン復帰時の同期
   - [ ] 2デバイス同時利用
   - [ ] ネットワーク切断中の操作

4. **フォーム入力**
   - [ ] 境界値テスト（0, 1, 999, 1000）
   - [ ] 不正入力の拒否
   - [ ] 日本語入力の動作

---

## 4. 技術要件を下げる代替案

### 4.1 代替案A: エージェント/AIサービス活用

#### 4.1.1 Vercel AI SDK + OpenAI の活用

**適用可能な機能:**
- 学習ノートの自動要約・整理
- 弱点分野の自然言語による解説生成
- 学習アドバイスの自動生成

**メリット:**
- 付加価値の高い機能を追加できる
- ユーザーエンゲージメント向上

**デメリット:**
- API利用コストが発生
- 応答遅延の可能性
- 実装の複雑化

**実装例:**
```typescript
// Vercel AI SDK使用例
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

async function generateStudyAdvice(weakTopics: string[]) {
  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: `以下の苦手分野に対する学習アドバイスを日本語で生成してください: ${weakTopics.join(', ')}`,
  })
  return text
}
```

#### 4.1.2 Claude API による学習支援

**適用可能な機能:**
- 学習ノートの内容に基づくQ&A
- 理解度チェックの問題生成
- 学習計画の自動提案

### 4.2 代替案B: 既存サービス・ツールの活用

#### 4.2.1 Notion API 連携

**構成:**
- フロントエンド: シンプルなNext.js アプリ
- バックエンド: Notion をデータベースとして利用

**メリット:**
- Supabaseのセットアップ不要
- ユーザーが直接Notionでデータを確認・編集可能
- 認証もNotion OAuthで簡略化

**デメリット:**
- Notion APIのレート制限
- リアルタイム同期不可
- カスタマイズ性の制限

**実装工数削減:** 約40%

#### 4.2.2 Google Sheets + Apps Script

**構成:**
- フロントエンド: Next.js + Google Sheets API
- バックエンド: Google Sheets をデータベース代わりに使用

**メリット:**
- 完全無料
- データのエクスポートが容易
- スプレッドシートでの分析が可能

**デメリット:**
- パフォーマンスの制限
- オフライン対応困難
- 複雑なクエリが難しい

**実装工数削減:** 約30%

### 4.3 代替案C: ノーコード/ローコードツール活用

#### 4.3.1 Supabase + Bubble/FlutterFlow

**構成:**
- UI: Bubble または FlutterFlow で構築
- バックエンド: Supabase

**メリット:**
- コーディング量の大幅削減
- 高速なプロトタイピング
- ネイティブアプリ対応（FlutterFlow）

**デメリット:**
- カスタマイズ性の制限
- 月額費用が発生
- 学習コスト

#### 4.3.2 Retool / Appsmith

**構成:**
- 内部ツールとして構築
- Supabase直接接続

**メリット:**
- 管理画面の迅速な構築
- SQLクエリを直接実行可能

**デメリット:**
- モバイル体験が劣る
- 月額費用

### 4.4 代替案D: 機能スコープの縮小

#### MVP をさらに絞る

**Phase 0（超MVP）:**
1. タイマー機能のみ（認証なし、ローカルストレージ保存）
2. 科目選択 + 時間記録
3. 日別の学習時間表示

**メリット:**
- 1-2日で実装可能
- 即座にフィードバック収集可能
- 必要な機能を検証してから拡張

**実装例:**
```typescript
// ローカルストレージのみで動作する超シンプル版
const saveSession = (session: Session) => {
  const sessions = JSON.parse(localStorage.getItem('sessions') || '[]')
  sessions.push(session)
  localStorage.setItem('sessions', JSON.stringify(sessions))
}
```

### 4.5 代替案比較表

| 代替案 | 実装工数 | 月額コスト | スケーラビリティ | オフライン | 推奨度 |
|--------|----------|------------|------------------|------------|--------|
| 現行計画（Supabase + Next.js） | 100% | $0-25 | 高 | 可 | ★★★★☆ |
| A: AI機能追加 | 120% | $20-50 | 高 | 可 | ★★★☆☆ |
| B-1: Notion連携 | 60% | $0 | 中 | 不可 | ★★★☆☆ |
| B-2: Google Sheets | 70% | $0 | 低 | 不可 | ★★☆☆☆ |
| C: ノーコード | 40% | $30-100 | 中 | 一部可 | ★★★☆☆ |
| D: 超MVP | 20% | $0 | 低 | 可 | ★★★★★ |

---

## 5. 推奨アプローチ

### 5.0 採用決定: Notion連携版

ユーザーとの協議の結果、以下の方針で決定:

| 項目 | 決定内容 |
|------|----------|
| バックエンド | **Notion API**（Supabaseではなく） |
| 試験日管理 | **科目別に設定可能** |
| オフライン対応 | **タイマーのみ**（記録はオンライン必須） |

### 5.1 Notion連携版の実装戦略

```
Phase 1: プロジェクトセットアップ（1-2日）
├── Next.js + Tailwind + shadcn/ui
├── Notion Integration作成
├── Notionテンプレート作成（4つのDB）
└── 環境変数設定

Phase 2: コア機能（3-4日）
├── Notion APIクライアント実装
├── タイマー機能（ローカル + Notion保存）
├── 過去問記録フォーム
└── 学習ノート連携

Phase 3: 分析・ダッシュボード（2-3日）
├── ダッシュボード画面
├── 学習時間・正答率グラフ
└── 科目別カウントダウン

Phase 4: PWA対応・仕上げ（1-2日）
├── タイマーのオフライン対応
├── レスポンシブデザイン
└── Vercelデプロイ

合計: 7-11日
```

### 5.2 リスク軽減のための設計原則

1. **オフラインファースト**
   - 全ての操作をまずローカルで完結させる
   - オンライン時にバックグラウンド同期

2. **グレースフルデグラデーション**
   - Supabaseが利用不可でもローカルで動作
   - 機能ごとに独立して動作可能

3. **プログレッシブエンハンスメント**
   - 基本機能は全環境で動作
   - 高度な機能は対応環境のみ

### 5.3 実装時の注意点

1. **エラーハンドリングの徹底**
   - 全てのAPI呼び出しにtry-catch
   - ユーザーフレンドリーな日本語エラーメッセージ

2. **テストの優先順位**
   - タイマーロジック（データロス防止）
   - 認証フロー
   - データ同期

3. **監視・ログ**
   - エラー発生時の詳細ログ
   - ユーザー行動の匿名トラッキング

---

## 改訂履歴

| バージョン | 日付 | 内容 | 担当 |
|------------|------|------|------|
| 1.0 | 2026-01-17 | 初版作成 | - |
