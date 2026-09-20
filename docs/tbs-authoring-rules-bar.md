# BAR TBS作問ルール（英語出題・実試験相当）

基本ルールは [tbs-authoring-rules.md](./tbs-authoring-rules.md) と同じ。**執筆順序・スキーマ・構成要件・絶対禁止事項は必ずそちらを読むこと**。
このファイルはBAR固有の差分だけを書く。

## FAR版との違い

| 項目           | FAR                                            | BAR                                            |
| -------------- | ---------------------------------------------- | ---------------------------------------------- |
| 出力先         | `src/data/tbs/far/_staging/<topic>.json`       | `src/data/tbs/bar/_staging/<topic>.json`       |
| 検算スクリプト | `src/data/tbs/far/_staging/calc/<id>.calc.mjs` | `src/data/tbs/bar/_staging/calc/<id>.calc.mjs` |
| `subject`      | `"FAR"`                                        | `"BAR"`                                        |
| `id`           | `far-tbs-<slug>-00N`                           | `bar-tbs-<slug>-00N`                           |
| `source`       | `FAR TBS Practice (original)`                  | `BAR TBS Practice (original)`                  |

## 検証コマンド

```bash
node scripts/check-tbs.mjs --strict src/data/tbs/bar/_staging
node scripts/verify-tbs-calc.mjs src/data/tbs/bar/_staging
node scripts/check-tbs.mjs --list-ids src/data/tbs/bar      # 既存BAR TBSのID一覧
node scripts/merge-staged-tbs.mjs --dir=src/data/tbs/bar <topic>
```

## 出題範囲（2026年ブループリント BAR節）

FAR版の「FAR範囲外＝出題禁止」リストは、BARでは**逆にすべて出題対象**になる。

出題してよい論点:

- **Area I（Business Analysis, 40-50%）**: 財務諸表分析と比率、非財務・非GAAP指標、原価計算（吸収/変動/ABC/工程別/個別）、**差異分析**、売上の価格・数量・ミックス分析、予算と予測、**資本コスト（WACC）と資本構成**、**投資案の比較（NPV・IRR・回収期間・EVA）**、COSO ERM、経済・市場環境の影響
- **Area II（Technical Accounting and Reporting, 35-45%）**: のれん・無期限無形の減損、社内開発ソフトウェア、収益認識（データ分析の出力の解釈を含む）、**株式報酬（資本分類・負債分類）**、研究開発費、**企業結合**、連結（VIE・**在外子会社の換算**）、**デリバティブとヘッジ会計**、**貸手リース・セール&リースバック**、公開会社の開示（S-X/S-K・XBRL・セグメント）、**従業員給付制度そのものの財務諸表**
- **Area III（State and Local Governments, 10-20%）**: 政府全体・政府ファンド・プロプライエタリ・受託の各財務諸表の作成、ファンドから政府全体への調整、純資産とファンド残高の区分、構成単位

BARで**問われない**もの（出題禁止）: 監査・証明業務、税務計算、企業法・商法、FAR固有の基礎論点だけで完結する問題（現金・売掛金・棚卸資産の基礎、借手リースの基礎など）。
リースは**貸手側とセール&リースバック**が主役。借手側は「契約書を解釈して借手の仕訳を作る」形でのみ出題できる。

## BAR固有の出題形式

ブループリントに以下が明記されているため、TBSでも積極的に取り入れる。

- **データ分析の出力の解釈**: レポートや可視化の出力（表）を Exhibit として与え、傾向・外れ値・不整合を読み取らせる
- **契約書・合意書の解釈**: 契約条項の抜粋を Exhibit に置き、会計処理を判断させる
- **リサーチ**: FASB ASC だけでなく **GASB の基準参照**も出題対象（Area IIIの場合）
