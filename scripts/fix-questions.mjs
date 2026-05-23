import { readFileSync, writeFileSync } from 'fs';

function load(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
function save(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
function patchQuestion(data, id, patchFn) {
  const q = data.questions.find(x => x.id === id);
  if (!q) throw new Error(`${id} not found`);
  patchFn(q);
  console.log(`  ✓ ${id} patched`);
}

// ───── cash-equivalents.json ─────
{
  const path = 'src/data/questions/far/cash-equivalents.json';
  const data = load(path);
  patchQuestion(data, 'cce-039', q => {
    // A=C=$64,330, B=D=$64,780 → CとDを別値に変更
    q.choices.find(c => c.label === 'C').text = '$65,230';
    q.choices.find(c => c.label === 'D').text = '$64,250';
    q.explanation =
      'Starting with book balance $62,000: (1) NSF check −$2,400; ' +
      '(2) bank service charges −$150; (3) interest earned +$80; ' +
      '(4) note collected by bank +$5,000 plus interest +$250; ' +
      '(5) check recorded as $270 instead of $720 → overstated by $450, deduct $450. ' +
      'Adjusted book balance = $62,000 − $2,400 − $150 + $80 + $5,000 + $250 − $450 = $64,330. ' +
      'Trap (B) $64,780 ignores the recording error adjustment. ' +
      'Trap (C) $65,230 incorrectly adds $450 instead of subtracting. ' +
      'Trap (D) $64,250 omits the $80 interest earned.';
    q.explanationJa =
      '帳簿残高$62,000からスタート：(1)NSF小切手−$2,400；(2)銀行手数料−$150；' +
      '(3)利息+$80；(4)銀行が回収した手形+$5,000＋利息+$250；' +
      '(5)$720の小切手を$270と記帳→帳簿が$450過大→差引$450。' +
      '調整後帳簿残高=$62,000−$2,400−$150+$80+$5,000+$250−$450=$64,330。';
  });
  save(path, data);
}

// ───── stock-compensation.json ─────
{
  const path = 'src/data/questions/far/stock-compensation.json';
  const data = load(path);
  patchQuestion(data, 'sc-014', q => {
    // A=B=$95,000 → Aを$85,000（没収率15%誤算）に変更
    q.choices.find(c => c.label === 'A').text = '$85,000';
    q.explanation =
      'Total compensation cost = 20,000 options × $15 FV × (1 − 5% forfeiture rate) = $285,000. ' +
      'Straight-line over 3-year cliff vest: annual expense = $285,000 / 3 = $95,000. ' +
      'Trap (A) $85,000 uses a 15% forfeiture rate ($255,000 / 3). ' +
      'Trap (C) $100,000 ignores forfeitures ($300,000 / 3). ' +
      'Trap (D) $90,000 uses a 10% forfeiture rate ($270,000 / 3).';
    q.explanationJa =
      '総報酬コスト=20,000株×$15×(1−5%没収率)=$285,000。' +
      '3年クリフベスト、定額法：年間費用=$285,000÷3=$95,000。' +
      '誤答(A)$85,000は没収率15%($255,000÷3)、' +
      '(C)$100,000は没収率無視($300,000÷3)、' +
      '(D)$90,000は没収率10%($270,000÷3)の誤り。';
  });
  save(path, data);
}

// ───── credit-loss-cecl.json ─────
{
  const path = 'src/data/questions/far/credit-loss-cecl.json';
  const data = load(path);
  patchQuestion(data, 'cecl-013', q => {
    // 問題文の$10,000,000を$1,000,000に修正（選択肢と整合）
    q.stem = q.stem.replace('$10,000,000', '$1,000,000');
    q.explanation =
      'Under ASC 326 (CECL), lifetime expected credit losses cover the full contractual term. ' +
      'Forecast period (Years 1–2): $1,000,000 × 1.8% × 2 years = $36,000. ' +
      'Reversion period (Years 3–5, immediate reversion to historical): $1,000,000 × 1.2% × 3 years = $36,000. ' +
      'Total lifetime ECL = $36,000 + $36,000 = $72,000. ' +
      'Trap (B) $90,000 applies 1.8% for all 5 years. ' +
      'Trap (C) $60,000 applies only the forecast-period loss. ' +
      'Trap (D) $96,000 uses incorrect period weighting.';
    q.explanationJa =
      'ASC 326(CECL)では全契約期間の信用損失を見積る。' +
      '予測期間（Year 1–2）：$1,000,000×1.8%×2年=$36,000。' +
      '回帰期間（Year 3–5、即時回帰）：$1,000,000×1.2%×3年=$36,000。' +
      '生涯予想信用損失=$36,000+$36,000=$72,000。';
  });
  save(path, data);
}

// ───── income-taxes.json (tax-038, tax-053) ─────
{
  const path = 'src/data/questions/far/income-taxes.json';
  const data = load(path);

  patchQuestion(data, 'tax-038', q => {
    // B=25.94% → 25.11%（正確な計算値）
    q.choices.find(c => c.label === 'B').text = '25.11%';
    q.explanation =
      'State tax: ($600,000 × 6%) + ($400,000 × 4%) = $36,000 + $16,000 = $52,000 (blended state rate 5.2%). ' +
      'Federal taxable income (state taxes deductible): $1,000,000 − $52,000 = $948,000. ' +
      'Federal tax: $948,000 × 21% = $199,080. ' +
      'Total tax: $52,000 + $199,080 = $251,080. ' +
      'Effective rate: $251,080 / $1,000,000 = 25.108% ≈ 25.11%. ' +
      'Alternatively: 5.2% + 21% × (1 − 5.2%) = 5.2% + 19.908% = 25.11%. ' +
      'Trap (A) 26.0% adds 5% + 21% without the deduction offset. ' +
      'Trap (C) 27.0% ignores the deductibility of state taxes. ' +
      'Trap (D) 25.0% is an approximation that ignores the federal-state interaction.';
    q.explanationJa =
      '州税：($600,000×6%)+($400,000×4%)=$52,000（混合州税率5.2%）。' +
      '連邦課税所得（州税は損金算入可）：$1,000,000−$52,000=$948,000。' +
      '連邦税：$948,000×21%=$199,080。' +
      '合計税：$52,000+$199,080=$251,080。' +
      '実効税率：$251,080÷$1,000,000=25.108%≈25.11%。' +
      '計算式：5.2%+21%×(1−5.2%)=25.11%。';
  });

  patchQuestion(data, 'tax-053', q => {
    // correctAnswer: "C"(19.95%) → "B"(20.48%) が正解
    q.correctAnswer = 'B';
    q.explanation =
      'Effective tax rate reconciliation: ' +
      'Tax at statutory rate: $2,000,000 × 21% = $420,000. ' +
      'Tax effect of tax-exempt municipal bond interest: −$100,000 × 21% = −$21,000. ' +
      'Tax effect of non-deductible meals: +$50,000 × 21% = +$10,500. ' +
      'Total income tax expense: $420,000 − $21,000 + $10,500 = $409,500. ' +
      'Effective tax rate: $409,500 / $2,000,000 = 20.475% ≈ 20.48%. ' +
      'Verification: taxable income = $2,000,000 − $100,000 + $50,000 = $1,950,000; ' +
      'tax = $1,950,000 × 21% = $409,500 ✓. ' +
      'Trap (A) 21.0% ignores both permanent differences. ' +
      'Trap (C) 19.95% subtracts the non-deductible amount instead of adding it. ' +
      'Trap (D) 22.05% adds the tax-exempt income instead of subtracting.';
    q.explanationJa =
      '実効税率調整：法定税率×簿価利益=$2,000,000×21%=$420,000。' +
      '市中債利息（非課税）の効果：−$100,000×21%=−$21,000。' +
      '交際費（損金不算入）の効果：+$50,000×21%=+$10,500。' +
      '所得税費用=$420,000−$21,000+$10,500=$409,500。' +
      '実効税率=$409,500÷$2,000,000=20.475%≈20.48%。' +
      '検証：課税所得=$2,000,000−$100,000+$50,000=$1,950,000、税=$1,950,000×21%=$409,500 ✓。';
  });

  save(path, data);
}

// ───── inventory.json (inv-050, inv-053) ─────
{
  const path = 'src/data/questions/far/inventory.json';
  const data = load(path);

  patchQuestion(data, 'inv-050', q => {
    // correctAnswer: "A"($3,150) → "B"($4,125)
    // Gross profit = Revenue - COGS(含む配分輸送料)、手数料は販売費
    q.correctAnswer = 'B';
    q.explanation =
      'Gross profit = Net revenue − Cost of goods sold (including allocated freight). ' +
      'Revenue: 150 × $60 = $9,000. ' +
      'COGS: 150 × $30 = $4,500. ' +
      'Allocated freight (sold units): 150/200 × $500 = $375. ' +
      'Total COGS including freight: $4,500 + $375 = $4,875. ' +
      'Gross profit: $9,000 − $4,875 = $4,125. ' +
      'Note: The 15% commission ($1,350) is a selling expense reported below gross profit, not a component of COGS. ' +
      'Trap (A) $3,150 omits the freight allocation ($9,000 − $4,500 − $1,350). ' +
      'Trap (C) $3,525 uses incorrect freight allocation. ' +
      'Trap (D) $4,500 equals COGS only, ignoring revenue.';
    q.explanationJa =
      '粗利益=売上収益−売上原価（配分輸送料含む）。' +
      '収益：150×$60=$9,000。COGS：150×$30=$4,500。' +
      '配分輸送料（販売分）：150/200×$500=$375。' +
      '合計COGS：$4,500+$375=$4,875。' +
      '粗利益：$9,000−$4,875=$4,125。' +
      '15%手数料($1,350)は販売費であり売上原価ではない（粗利益より下の項目）。';
  });

  patchQuestion(data, 'inv-053', q => {
    // correctAnswer: "B"($132,000) は正しい。解説のみ整理
    q.explanation =
      'Dollar-value LIFO calculation: ' +
      'Step 1 — Deflate Year 2 ending inventory to base-year cost: $143,000 / 1.10 = $130,000. ' +
      'Step 2 — Determine Year 1 base-year inventory: base layer $100,000 + Year 1 increment at base = $15,000 / 1.05 = $14,286; total = $114,286. ' +
      'Step 3 — Year 2 increment at base-year cost: $130,000 − $114,286 = $15,714. ' +
      'Step 4 — Restate Year 2 increment at current-year prices: $15,714 × 1.10 = $17,286. ' +
      'Step 5 — Year 2 LIFO inventory: base layer $100,000 + Year 1 layer $15,000 + Year 2 layer $17,286 = $132,286 ≈ $132,000.';
    q.explanationJa =
      'ドルバリューLIFO計算：' +
      'Step 1：Year 2期末棚卸を基準年原価に換算：$143,000÷1.10=$130,000。' +
      'Step 2：Year 1の基準年在庫：基礎層$100,000＋Year 1増分（基準年）=$15,000÷1.05=$14,286、合計$114,286。' +
      'Step 3：Year 2の増分（基準年）：$130,000−$114,286=$15,714。' +
      'Step 4：Year 2増分を当年価格に換算：$15,714×1.10=$17,286。' +
      'Step 5：LIFO棚卸高：$100,000+$15,000+$17,286=$132,286≈$132,000。';
  });

  save(path, data);
}

// ───── partnerships.json ─────
{
  const path = 'src/data/questions/far/partnerships.json';
  const data = load(path);
  patchQuestion(data, 'part-040', q => {
    // Safe payment: P=$28,000が正解。A=$24,000→$28,000、D=$30,000→$24,000
    q.choices.find(c => c.label === 'A').text = '$28,000';
    q.choices.find(c => c.label === 'D').text = '$24,000';
    q.explanation =
      'Safe payment method assumes remaining non-cash assets ($90,000 capital − $60,000 cash = $30,000) are worthless. ' +
      'Step 1 — Allocate maximum potential loss by profit ratio: ' +
      'P: $30,000 × 40% = $12,000; Q: $30,000 × 30% = $9,000; R: $30,000 × 30% = $9,000. ' +
      'Step 2 — Compute safe capital balances: ' +
      'P: $40,000 − $12,000 = $28,000; Q: $30,000 − $9,000 = $21,000; R: $20,000 − $9,000 = $11,000. ' +
      'Total: $28,000 + $21,000 + $11,000 = $60,000 ✓. ' +
      'Partner P receives $28,000. ' +
      'Trap (B) $40,000 pays P the full capital balance ignoring potential losses. ' +
      'Trap (C) $20,000 is R\'s capital balance, not P\'s. ' +
      'Trap (D) $24,000 incorrectly uses a simple profit-ratio allocation ($60,000 × 40%).';
    q.explanationJa =
      '安全払出法：残余非現金資産（資本合計$90,000−キャッシュ$60,000=$30,000）がゼロになると仮定。' +
      'Step 1：最大潜在損失を利益分配率で配分：P=$12,000（40%）、Q=$9,000、R=$9,000。' +
      'Step 2：安全資本残高：P=$40,000−$12,000=$28,000、Q=$21,000、R=$11,000。合計=$60,000 ✓。' +
      'パートナーPへの安全払出額=$28,000。' +
      '誤答(D)$24,000は利益分配率による単純比例分配（$60,000×40%）の誤り。';
  });
  save(path, data);
}

console.log('\n全修正完了。');
