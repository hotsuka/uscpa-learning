# TBS作問ルール（FAR・英語出題・実試験相当）

## 出力形式

- 指定されたファイルに **TBSQuestionオブジェクトのJSON配列** をWriteする。トップレベルは `[ ... ]`。
- 文字列内改行は `\n`。Markdownテーブルが exhibits.content で使える（既存問題と同形式）。
- 金額はカンマなしの数値。表示用テキスト内では `$80,000` 形式可。

## スキーマ（全フィールド必須、optionalは型に応じて）

```json
{
  "id": "far-tbs-<slug>-00N",
  "subject": "FAR",
  "topic": "<指定されたtopic値>",
  "title": "<English title>",
  "scenario": "<English。Exhibit参照を **Exhibit 1** 形式で含める>",
  "exhibits": [
    { "id": "ex-1", "title": "Exhibit 1: <English>", "content": "<English, Markdown table可>" }
  ],
  "tasks": [ <5〜7個> ],
  "difficulty": "intermediate | advanced",
  "estimatedMinutes": 20〜30,
  "source": "FAR TBS Practice (original)"
}
```

### task共通

```json
{
  "id": "task-N",
  "workTab": "Work Tab N",
  "title": "<English>",
  "instruction": "<English。単位・端数処理・形式を明示>",
  "answerType": "number | select | multiselect | table | research",
  "explanation": "<English。計算過程を示す>",
  "explanationJa": "<日本語。計算過程をステップで示す。Markdown可>",
  "references": ["ASC XXX-XX-XX-XX"]
}
```

### answerType別ルール

- **number**: `"correctAnswer": 48000`（数値）、`"tolerance": 1`（PV計算等の丸めが絡む場合は10〜100）。instructionに "(in whole dollars, no commas)" を明記。
- **select**: `"options": [...]`（英語、2〜4個、重複禁止）、correctAnswerはoptionsの文字列と完全一致。
- **multiselect**: options 3〜6個、correctAnswerは文字列配列（1個以上）。
- **table**（仕訳・スケジュール用）:
  ```json
  "tableConfig": {
    "columns": ["Debit", "Credit"],
    "rows": ["Cash", "Sales revenue"],
    "cells": [
      { "rowLabel": "Cash", "colLabel": "Debit", "correctValue": 5000, "tolerance": 1 },
      { "rowLabel": "Cash", "colLabel": "Credit", "correctValue": 0, "tolerance": 0 },
      { "rowLabel": "Sales revenue", "colLabel": "Debit", "correctValue": 0, "tolerance": 0 },
      { "rowLabel": "Sales revenue", "colLabel": "Credit", "correctValue": 5000, "tolerance": 1 }
    ]
  }
  ```
  - cellsに含めないセルは「—」表示で入力不可になる。**仕訳問題では借方・貸方の両セルを必ずcellsに含め、金額が入らない側は correctValue: 0 にする**（そうしないと正解の側が入力欄の位置でバレる）。instructionに "Enter 0 in cells that should have no amount." を明記。
  - correctAnswerフィールドは**書かない**（table型はcellsで採点）。
  - スケジュール型（償却表等）は列=期間/項目、行=行ラベル。空欄にすべきセルだけをcellsに含めてもよい（この場合0埋め不要）。
- **research**: `"correctAnswer": "606-10-32-28"`（数字とハイフンのみ、ASC接頭辞なし）。instructionに "Cite the ASC reference in XXX-XX-XX-XX format." を明記。採点は区切り文字を無視して数字グループで比較される。

## 構成要件（実試験相当のボリューム）

1. **タスク5〜7個/問**。全タスクを直列連鎖にしない — 少なくとも2タスクは他タスクの答えに依存せず独立に解けること。
2. **Exhibit 2〜4枚**。うち少なくとも1枚（または1枚内の複数行）に**解答に使わないダミー情報**を含める（例: 無関係な取引、使わない利率、別部門のデータ）。ダミーは会計的に矛盾のない自然な情報にする。解説で「これはダミー」とは書かない（解説では単に使わない）。
3. estimatedMinutes 20〜30、difficulty は intermediate または advanced。
4. answerTypeは混在させる（number中心 + table/select/multiselect/researchを織り交ぜる）。

## 絶対禁止（過去に実際に発生したバグ）

1. 解説に疑念語句を書かない: `Wait` / `Hmm` / `Let me recalculate` / `not among the choices` / `closest answer is` / `doesn't match` 等。計算が合わない場合は問題文か選択肢を直す。
2. select/multiselectの選択肢に重複を設けない。
3. correctAnswerと解説の結論を必ず一致させる。
4. 解説で選択肢をA/B/C/D等のラベルで参照しない（「Choice B」「選択肢A」禁止）。**値・内容で参照する**。
5. 問題文の数値スケールと解答値のスケールを揃える。
6. **全ての数値を作問後に手計算で2回検算する**。tableの各セル値・各タスクの数値の整合（例: 表の合計とタスク解答の一致）も確認。

## 出題範囲の制約（2026年ブループリント）

FAR範囲外（BAR領域）は出題禁止: 年金 / 株式報酬 / デリバティブ・ヘッジ / VIE / 外貨換算（FC translation。FC取引=transactionはFAR可）/ 貸手（lessor）リース / パートナーシップ会計 / 企業結合の取得法・のれん計算。
連結はFAR範囲（内部取引消去の基礎、NCIへの利益帰属・残高ロールフォワード）に限定。

## 言語

- scenario / exhibits / tasks(title, instruction, options) / title: **英語**（実試験準拠。簡潔でフォーマルな試験英語）
- explanation: 英語、explanationJa: 日本語（学習者向けに計算ステップを丁寧に）

## 既存ID（衝突禁止）

far-tbs-rev-001, far-tbs-lease-001, far-tbs-tax-001, far-tbs-gov-001, far-tbs-cons-001
