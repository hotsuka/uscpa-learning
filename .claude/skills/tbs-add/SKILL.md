---
name: tbs-add
description: FAR TBS問題バンク(src/data/tbs/far)に新規問題を追加する。作問 → 機械チェック → 検算 → QC → マージの手順を最小トークンで回す。「TBS問題を追加」「TBSを作って」「〇〇のTBSを作問」等のときに使う。
---

# TBS新規作問

## 設計方針（重要 — 逸脱するとトークンが跳ね上がる）

QCを3層に分け、**LLMには最後の薄い層だけ**をやらせる。

| 層  | 手段                       | 落とすもの                                               | LLMトークン |
| --- | -------------------------- | -------------------------------------------------------- | ----------- |
| 1   | `check-tbs.mjs --strict`   | 構造・スキーマ・借貸バランス・疑念語句・構成ガイドライン | 0           |
| 2   | `verify-tbs-calc.mjs`      | 数値の誤り                                               | 0           |
| 3   | QCサブエージェント(Sonnet) | 会計処理の妥当性・出題範囲・解説の質                     | 小          |

**親セッションで守ること:**

- **問題JSONを Read しない**。1問あたり約4kトークンあり、以降の全ターンの入力に乗り続ける。中身の確認はスクリプトの出力で行う。
- **作問エージェントに既存問題ファイルを読ませない**。トピックファイルは1本20〜32KBある。渡すのはルール文書と既存ID一覧だけでよい。
- サブエージェントは**作問1本 + QC1本のみ**。修正が必要なときは新規に立てず `SendMessage` で同じエージェントに差し戻す（コンテキストが残っているぶん安い）。

## 手順

### 0. 対象を決める

引数からトピック（既存トピックファイル名 or 新規）と問題数を読み取る。未指定なら聞く。新規IDは既存と衝突させないため、次を実行して既存ID一覧を得る（本文は読まない）。

```bash
node scripts/check-tbs.mjs --list-ids
```

### 1. 作問（サブエージェント1本 / model: opus）

`Agent` を1回だけ起動する。プロンプトに必ず含めること:

- `docs/tbs-authoring-rules.md` を最初に読むこと
- 対象トピック・topic値・問題数・割り当てる新規ID
- 出力先: `src/data/tbs/far/_staging/<トピックファイル名>.json`（TBSQuestionの配列）
- 検算スクリプト: `src/data/tbs/far/_staging/calc/<問題id>.calc.mjs`
- **執筆順序を厳守**: ① scenario と exhibits を確定 → ② ①だけを見て `calc.mjs` を書く → ③ ②の結果を使って問題JSONを書く。②を①だけから書かせることで、③のcorrectAnswerとは独立した2回目の計算になる（順序を崩すと検算が形骸化する）
- 既存の問題JSONファイルは読まないこと（IDは渡された一覧で足りる）
- 書き終えたら自分で `node scripts/check-tbs.mjs --strict src/data/tbs/far/_staging` と `node scripts/verify-tbs-calc.mjs` を実行し、通るまで直してから報告すること

### 2. 機械チェック（層1・層2）

```bash
node scripts/check-tbs.mjs --strict src/data/tbs/far/_staging && node scripts/verify-tbs-calc.mjs
```

失敗したら**エラー出力だけ**を `SendMessage` で作問エージェントに渡して修正させる。親でJSONを開いて直さない。

`verify-tbs-calc.mjs` の不一致は「JSONと検算のどちらが正しいか」が未確定であることを意味する。片方に合わせるのではなく、手計算で確定させてから直すよう指示すること。

### 3. QC（サブエージェント1本 / model: sonnet）

層1・2を通過した後に依頼するのは以下だけ。数値の再検算は済んでいるので指示しない。

- 会計処理として妥当か（基準の適用・認識時点・分類）
- 2026年ブループリントのFAR範囲内か（`check-tbs.mjs` の範囲外警告が出ていればその箇所を重点的に）
- ダミー情報が会計的に自然か、解答に使われていないか
- `explanationJa` が学習者向けに計算ステップを追えているか
- Exhibitの数値とタスクの前提に矛盾がないか

指摘があれば作問エージェントに `SendMessage` で差し戻し、2に戻る。

### 4. マージ

```bash
node scripts/merge-staged-tbs.mjs <トピック名>
```

バックアップ(`.bak-tbs-<timestamp>`)を取ってから配列末尾へ追記する。既存問題は書き換えない。strict検証と検算スクリプトの存在を再確認するため、工程を飛ばしているとここで止まる。

### 5. 仕上げ

```bash
npx prettier --write src/data/tbs/far/*.json && node scripts/check-tbs.mjs
```

- 新規トピックファイルを作った場合は `src/data/tbs/far/index.ts` に import と配列展開を追加する
- 確認できたら `src/data/tbs/far/_staging` を削除する
- `.bak-tbs-*` はコミットしない（`git status` で確認）
- コミットメッセージは「なぜ」を書く（例: `feat: リースTBSを3問追加し実試験のタスク数に合わせる`）

## 注意

- `_staging` を消す前に `node scripts/check-tbs.mjs` が通っていることを必ず確認する。作問エージェントの成果物はここにしか無い。
- ステージングを消し忘れたまま再度マージするとID衝突で止まる（データは壊れない）。
