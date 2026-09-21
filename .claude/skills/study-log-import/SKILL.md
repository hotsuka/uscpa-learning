---
name: study-log-import
description: ダウンロードフォルダに置かれた学習記録のバックアップJSON（uscpa-backup-YYYYMMDD-HHMM.json）を検査し、科目の誤登録・重複レコード・subtopic の表記ゆれを機械的に洗い出してから集計と次アクションを出す。検査結果の内訳表を必ず先に提示して止まり、承認されたものだけ直す。「ダウンロードフォルダに最新の学習記録を格納しました。確認を」「最新の学習記録のJSONデータを格納しました」「次のアクションを提案ください」「学習記録が重複してんぞ」「BARで登録した案件が全部FARになっている」といったときに使う。
---

# 学習記録バックアップの取り込みと検査

## このスキルが解こうとしている問題

ユーザは週3回ほど「ダウンロードフォルダに最新の学習記録を格納しました。確認を」と依頼する。
そのたびに、**取り込み側の不具合をユーザが目で見つけて指摘している**。

| 日付 | ユーザの指摘 | 実際に起きていたこと |
| --- | --- | --- |
| 2026-09-13 | 「BAR問題バンクで登録した案件が全てFARとして登録されているからでは？」 | BAR専用セット由来の記録が `subject: "FAR"` で入っていた。修正後 FAR 347.7h / BAR 54.0h |
| 2026-09-13 | 「学習記録が重複してんぞ」 | 同一内容のレコードが二重に入っていた |
| 2026-09-15 | 「Area2/3の問題がFARの区分のままで表示されて、かつFARの区分でも問題見れなくなってる」 | BAR Area II/III は FAR セットを参照する設計なのに、片方へ寄せたため両方壊れた |

**数字がずれること自体は起きる。異常なのは、ずれに気づくのが毎回ユーザだという流れのほう。**
だからこのスキルは、**集計を出す前に必ず検査の内訳表を出して止まる**。
「645件を渡されて、科目を機械判定できるのは388件だけ」を先に言う。

## 設計方針

判断（この表記ゆれをどれに寄せるか／この重複を消してよいか）と、機械的検査（科目の突合・重複判定・件数の集計・世代間差分）を分ける。
**LLMがやるのは内容の読み取りだけで、数えるのは全部スクリプトに固定する。手で数えない。**

| 層 | 手段 | 落とすもの |
| --- | --- | --- |
| 1 | `node scripts/study-log-audit.mjs audit` | 内訳表、科目の誤登録、重複（4段階）、表記ゆれ候補、前回との差分 |
| 2 | Claude が計画JSONを書き、ユーザに承認を取る | どの表記ゆれをどれに寄せるか／どの重複を消すか |
| 3 | `study-log-audit.mjs fix --plan <file> --apply` | 検出結果に無い修正の拒否、修正版JSONの書き出し、件数の突合 |
| 4 | `study-log-audit.mjs report` | 科目別・単元別の集計、弱点抽出、前回からの増分 |

**`fix` は検出結果に無い修正を受け付けない。** 計画JSONに書いた `id` が audit で誤登録・重複として
検出されていなければエラーで落ちる。人が「ついでに」直したくなったものを混ぜられないようにしている。

## 入力データ

ユーザが置くのは `~/Downloads/uscpa-backup-YYYYMMDD-HHMM.json`。アプリの
設定 →「データバックアップ」→ JSONダウンロードで出力されたもの（`src/lib/backup/exportImport.ts`）。

```
{ "schema": "uscpa-backup", "schemaVersion": 1, "exportedAt": "...",
  "data": { "uscpa-question-bank": "<JSON文字列>", "uscpa-tbs-bank": "<JSON文字列>",
            "uscpa-mock-exams": "<JSON文字列>", "uscpa-records": "<JSON文字列>",
            "uscpa-notes": "<JSON文字列>", "uscpa-page-memos": "<JSON文字列>" } }
```

**`data` の各値はオブジェクトではなく JSON 文字列**（localStorage の生ダンプ）。
`uscpa-records` をパースすると `{"state":{"records":[...]},"version":0}` になる。
書き戻すときも文字列に戻さないとアプリが読めない。

**2026-09 中旬より前の世代は `uscpa-question-bank` / `uscpa-tbs-bank` / `uscpa-mock-exams` の3キーしか持たない。**
`uscpa-records` がバックアップ対象に入ったのはそれ以降。差分の比較元には
**学習記録を含む世代**を選ぶこと（`audit` は自動でそうする）。それ以前を比較元にすると全件が「新規」に化ける。

## 科目の正はリポジトリ側にある

subtopic → 科目の対応は2系統ある。どちらもリポジトリが正で、バックアップ側が従う。

| 系統 | 出どころ | 使われる場面 |
| --- | --- | --- |
| A. 問題バンクの topic | `src/data/questions/{far,bar}/*.json` の `topic` | `fromQuestionBank: true` の記録 |
| B. 手入力のサブテーマ | `src/types/index.ts` の `SUBJECT_SUBTOPICS` | タイマー・手入力の記録 |

**2つの語彙は一致していない。** Aには `Derivatives & Hedging` `Partnerships` `Credit Loss (CECL)`
`Foreign Currency & EPS` があるが、Bにはない。Bには `EPS` `Intangible Assets` `Financial Management`
があるが、Aにはない。表記ゆれの大半はこの差から出ている。

### IMPORTANT: 「FARの単元なのに科目がBAR」は正常

BAR Area II/III は FAR の問題セットを**コピーせずそのまま参照している**
（`src/data/questions/bar/index.ts` の `barAreaIIIIIQuestionSets`）。問題IDが同じなので
FAR時代の解答履歴を引き継げる、という設計。対象は `barScope.ts` の `BAR_AREA_II_III_SOURCES`:

```
far-ppe-intangibles / far-revenue-recognition / far-stock-compensation / far-consolidations /
far-derivatives-hedging / far-leases / far-pensions / far-government-accounting
```

したがって `subject: "BAR", subtopic: "Derivatives & Hedging"` は**誤登録ではない**。
**ここを「FARに寄せる」と直したのが 2026-09-15 の事故。** 片方に寄せると両方から見えなくなる。
スクリプトは `barScope.ts` から機械抽出してこれを許容している。手で写さないこと。

## 重複判定キーの設計

2026-09-13 に重複が残ったとき、`id` 一致だけを見ていては拾えなかった。
現在のデータでも `id` 重複・`sessionId` 重複はともに0件だが、内容が同じレコードは存在する。
**単一キーでは取りこぼすし、単一キーで消すと正常なデータを消す。** だから4段階に分けて
**強さごとに扱いを変える**。

| 段階 | キー | 根拠 | 扱い |
| --- | --- | --- | --- |
| 強 | `id` 一致 | 同一レコードが配列に二重に入っている。正常にはあり得ない | 削除候補 |
| 強 | `sessionId` 一致（`source: "timer"`） | 1タイマーセッション = 1レコードが前提。破れていれば二重保存・二重同期 | 削除候補 |
| 中 | 内容一致 かつ `createdAt` が10分以内 | 同じ内容を短時間に2回登録＝二重送信の疑い | 確認のうえ削除候補 |
| 弱 | 内容一致だが `createdAt` が離れている | **同じ日に同じ単元を2回やっただけの正常ケースが多い** | 参考表示のみ。消さない |

内容キーは `recordType / subject / subtopic / studiedAt / studyMinutes / totalQuestions / correctAnswers / roundNumber`。

**弱を消さないのが重要。** 2026-09-19 時点の実データでは弱が3組あるが、中身は 2026-01 の
Notion移行期の手入力記録（`studyMinutes: 0`、問題数 null）で、時刻が数時間離れた別々の入力である。
これを「重複」として消すと、リモートに存在しないローカルデータを消すことになる（CLAUDE.md の鉄則に反する）。

## 手順

### Step 0. 対象ファイルを確定する（省略禁止）

`~/Downloads` の `uscpa-backup-*.json` のうち**どれが今回のものか**を先に確定する。
`audit` は既定で最新世代を今回、学習記録を含む直前世代を前回として扱う。
ユーザが別の世代を指しているなら `--file` / `--prev` で明示する。**推測で始めない。**

### Step 1. 検査する

```bash
node scripts/study-log-audit.mjs audit
```

この時点では**何も書き換えていない**。出るのは次の5つ。

1. 科目の誤登録（`fromQuestionBank: true` の記録のみ。時間窓の演習履歴を根拠として添える）
2. 重複（強／中／弱の4段階）
3. subtopic の表記ゆれ（`[3-a]` 語彙に無い単元名＋寄せ先候補3つ / `[3-b]` 記号・空白だけが違う綴り）
4. 前回バックアップとの差分（新規／変更／**消失**）
5. データセット別の件数と前回比

### Step 2. 内訳表を出して止まる（省略禁止）

`audit` の出力をそのまま貼らず、**次の形に整理してユーザへ出す**。

```
学習記録: 645件
  ├ 科目を機械判定できる（fromQuestionBank: true）: 388件
  │   ├ 科目一致            : 348件
  │   ├ 科目の誤登録疑い    :   0件
  │   └ 単元名が語彙に無い  :  40件  ← 表記ゆれ側で扱う
  └ 機械判定できない                : 257件
      ├ 手入力の practice   : 154件（科目はユーザが選んだもの）
      └ textbook            : 103件
```

**「388件しか機械判定できない」を先に言う。** これを言わずに集計だけ出すと、
後から「この数字は誤登録を直した後のものか」と聞かれ、そこから逆算して説明することになる。

表記ゆれは**候補を出して止まる**。寄せ先はスクリプトが決めない。
類似度が高くても意味が違うことがある（例: `Property, Plant & Equipment / Intangible Assets` は
`Property, Plant & Equipment` と `Intangible Assets` のどちらにも寄せうる合本ラベル）。
**ここでユーザの確認を待つ。勝手に fix へ進まない。**

### Step 3. 計画JSONを書く

承認されたものだけを `scripts/_work/study-log-plan.json` に書く。

```json
{
  "sourceFile": "uscpa-backup-20260919-1059.json",
  "subjectFixes": [
    { "id": "...", "to": "BAR", "reason": "bar-cost-accounting 由来。時間窓の演習履歴もBAR" }
  ],
  "subtopicRenames": [
    { "from": "Derivertives", "to": "Derivatives & Hedging", "subject": "BAR", "reason": "綴り誤り" },
    { "from": "Module9 Task-Based Simulation", "to": "Module 9 Task-Based Simulation", "reason": "空白の有無だけの違い" }
  ],
  "duplicateRemovals": [
    { "id": "...", "keepId": "...", "reason": "内容一致かつ createdAt 同一の二重登録" }
  ]
}
```

- `from` は**実際に記録に現れた綴りをそのまま**書く。正規化して当てない（取り違えを防ぐため）
- `to` は正の語彙（AまたはB）に存在する文字列でなければ `fix` が落ちる
- `subject` は任意。同じ綴りが複数科目にまたがるときだけ付ける
- **`reason` は全項目に必須。** 無いと落ちる。後から「なぜ消したか」を説明できない修正を作らないため

### Step 4. 検証して修正版を書き出す

```bash
node scripts/study-log-audit.mjs fix --plan scripts/_work/study-log-plan.json
```

まず `--dry-run`（既定）で回り、次を弾く。

- `audit` が誤登録として検出していない `id` の `subjectFixes`
- `audit` が重複（強・中）として検出していない `id` の `duplicateRemovals`
- `audit` が表記ゆれとして検出していない綴りの `subtopicRenames`
- `to` が正の語彙に無い、`keepId` が存在しない、`reason` が無い

すべて通ったら `--apply` を付ける。**元ファイルは書き換えない。**
`uscpa-backup-YYYYMMDD-HHMM-fixed.json` を別名で書き出す（既に存在すれば落ちる）。
`uscpa-records` 以外のデータセットには一切触らない。

### Step 5. 修正版をユーザに戻す

書き出したファイルは**アプリの 設定 →「データバックアップ」→「JSONから復元」で読み込む**。
復元は localStorage を上書きし、ページがリロードされる（復元前のスナップショットはアプリ側が自動で取る）。
**Claudeがアプリのデータを直接書き換える手段は無い。** ここはユーザの操作になるので、そう伝える。

復元後、ユーザが再度バックアップを出したら `audit` を流し直して、
Step 2 で予告した件数と実際の変化が一致していることを確認する。ずれていたら止めて原因を出す。

### Step 6. 集計と次アクションを出す

```bash
node scripts/study-log-audit.mjs report
```

報告には必ず次を含める。

1. **科目別**（FAR/AUD/REG/BAR）の学習時間・問題数・正答率
2. **subtopic 別の正答率**（問題数の少ない単元は別枠。`--weak-min` の既定は20問）
3. **弱点** = 問題数20問以上 かつ 正答率70%未満
4. **前回バックアップとの差分** — どの範囲が新しく増えたか（学習日レンジ・単元別の増分）
5. **次のアクション**

`report` の末尾は「この集計の信頼性」を出す。**未修正の誤登録・表記ゆれが残っていれば、
科目別・単元別の数字はその影響を受けている。** 数字だけ出して信頼性を黙らない。

次のアクションは、弱点・増分・試験日（`uscpa-records` には入っていない。バックアップ対象外なので
設定画面の値をユーザに聞く。`src/stores/settingsStore.ts` が持っている）から組み立てる。
**「正答率が低いから復習」で終わらせない。** 問題数が少なくて判断できない単元（`report` が別枠で出す）は
「まず問題数を積む」が正しいアクションで、弱点とは処方が違う。

## 押さえどころ

- **検査結果を先に出す。** このスキルの存在理由がここにある。集計だけ先に出さない
- **BAR Area II/III は FAR セットを参照している。** `FARの単元 × 科目BAR` は正常。潰すと 2026-09-15 の再発
- **弱い重複は消さない。** 同じ日に同じ単元を2回やるのは正常。ローカルデータは常に保護する
- **表記ゆれの寄せ先は人が決める。** スクリプトは候補と類似度を出すだけ
- **元ファイルは残す。** 修正版は必ず別名で書き出す
- **`src/` は変更しない。** 語彙がずれているなら直すのはバックアップ側。リポジトリ側を記録に合わせない
- **`data` の各値は JSON 文字列。** オブジェクトのまま書き戻すとアプリが読めない
- `audit` は要対応があれば終了コード1で返る。スクリプト内から呼ぶときはそれを前提にする

## 実データの現況（2026-09-19 時点。スキル作成時に実際に流して確認した）

`uscpa-backup-20260919-1059.json`（学習記録645件）に対して:

- 科目の誤登録: **0件**（2026-09-13 の修正が効いている）
- 重複: 強0組 / 中0組 / **弱3組**（2026-01 の手入力。正常として残す）
- 表記ゆれ: **計7種**（語彙に無い単元名6種 + 記号・空白だけが違う綴り1種）。未修正のまま残っている

```
"Partnership"                                    14件 FAR  → "Partnerships"            (92%)
"Derivertive & Hedges"                           13件 FAR  → "Derivatives & Hedging"   (67%)
"Credit Loss"                                    10件 FAR  → "Credit Loss (CECL)"      (71%)
"Foreign Currency"                                7件 FAR  → "Foreign Currency & EPS"  (83%)
"Property, Plant & Equipment / Intangible Assets"  5件 FAR  → 合本ラベル。要判断
"Derivertives"                                    1件 BAR  → "Derivatives & Hedging"   (50%)
"Module9 Task-Based Simulation" 14件 / "Module 9 Task-Based Simulation" 45件  ← 空白の有無で集計が割れている
```

**これらは集計を割っている。** 例えば Derivatives は
`FAR | Derivertive & Hedges` 105問・`FAR | Derivatives & Hedging` 16問・
`BAR | Derivatives & Hedging` 39問・`BAR | Derivertives` 6問 の4行に散っている。
ユーザに寄せ先を確認して直すのが、このスキルの最初の実務。

集計（未修正のまま）: FAR 347.5h / 8,577問 / 85.8%、BAR 59.1h / 1,254問 / 73.9%。
弱点は `FAR | Module 9 Task-Based Simulation` 65.0%、`BAR | Financial Management (CH51)` 66.1%、
`BAR | Economic Theory` 69.5%。

## 関連

- `scripts/study-log-audit.mjs` — 本スキルの検査・集計・修正スクリプト
- `src/lib/backup/exportImport.ts` — バックアップJSONの書式とインポート処理（正）
- `src/data/questions/bar/barScope.ts` — BAR出題範囲と Area II/III の FAR セット参照
- `material-import` — 教材PDFの取り込み。件数の内訳を先に出す考え方はこちらが先
- `tbs-add` — TBS問題バンクへの作問・投入
