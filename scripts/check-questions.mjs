import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const questionDirs = ['src/data/questions/far', 'src/data/questions/bar'];

// 解説内に「自信がない・計算が合わない」ことを示す疑念パターン
const SUSPICIOUS = [
  { re: /wait[,\s—]+let me/i,            label: 'wait-let-me' },
  { re: /hmm[,.]?\s/i,                   label: 'hmm' },
  { re: /not among the choices/i,         label: 'not-among-choices' },
  { re: /let me re.?calculat/i,           label: 'recalculate' },
  { re: /let me reconsider/i,             label: 'reconsider' },
  { re: /let me re.?read/i,              label: 're-read' },
  { re: /let me recheck/i,               label: 'recheck' },
  { re: /but i wrote/i,                  label: 'but-i-wrote' },
  { re: /answer should be [A-D][. ]/i,   label: 'answer-should-be' },
  { re: /closest answer is/i,            label: 'closest-answer' },
  // 「alternative approach」は ASC 606 等の会計基準の正式用語のため除外
  { re: /doesn.t match|do not match/i,   label: 'doesnt-match' },
  { re: /that gives [A-D][.,]/i,         label: 'that-gives' },
  { re: /so the answer should be [A-D]/i,label: 'so-answer-should-be' },
  { re: /answer is [A-D]\. but/i,        label: 'answer-but' },
];

// 科目ごとのディレクトリを走査する（BAR以降の科目を追加してもチェック漏れが出ないように）
const files = questionDirs.flatMap(dir =>
  existsSync(dir)
    ? readdirSync(dir)
        // _sets.json のような作問用メタファイルは問題セットではないので除く
        .filter(f => f.endsWith('.json') && !f.includes('.bak') && !f.startsWith('_'))
        .map(f => ({ dir, file: f }))
    : []
);

const issues = { INVALID_ANSWER: [], DUPLICATE_CHOICE: [], SUSPICIOUS_EXPLANATION: [], ANSWER_NOT_IN_EXPLANATION: [], BROKEN_TABLE: [] };

// 問題文の「 | 」区切りの表が、PDF抽出で行ごと崩れていないかを調べる。
// 崩れ方は2つ: ①表の行の間に「 | 」を含まない行が挟まる（セルが前後の行へ割れた）
//              ②本体の行どうしで列数が揃わない（見出し行だけは1列少なくてよい）
function findBrokenTable(text) {
  const lines = text.split('\n');
  const isRow = l => l.includes(' | ') && !l.trim().startsWith('|'); // Markdown表（|---|）は別形式なので対象外
  const cells = l => l.split(' | ').length;
  const problems = [];
  // 崩れの実例（bar-pc-003）は「Number of frames」のような短い断片行が表の行の間に挟まる形。
  // 文章（ピリオド・コロンで終わる、または長い行）は表の外の説明文なので対象外にする
  for (let i = 1; i < lines.length - 1; i++) {
    const l = lines[i].trim();
    if (!isRow(lines[i]) && l !== '' && l.length <= 30 && !/[.:。：]$/.test(l)
        && isRow(lines[i - 1]) && isRow(lines[i + 1])) {
      problems.push(`表の行の間に断片行: "${l}"`);
    }
  }
  return problems;
}

let total = 0;

for (const { dir, file } of files) {
  const raw = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const questions = raw.questions ?? raw;

  for (const q of questions) {
    total++;
    const validLabels = q.choices.map(c => c.label);

    // チェック1: correctAnswer が選択肢ラベルに存在するか
    if (!validLabels.includes(q.correctAnswer)) {
      issues.INVALID_ANSWER.push({
        file, id: q.id,
        detail: `correctAnswer="${q.correctAnswer}" 選択肢ラベル: ${validLabels.join('/')}`
      });
    }

    // チェック2: 選択肢テキストの重複
    const texts = q.choices.map(c => c.text);
    const dupes = texts.filter((t, i) => texts.indexOf(t) !== i);
    if (dupes.length > 0) {
      issues.DUPLICATE_CHOICE.push({
        file, id: q.id,
        detail: `重複テキスト: ${[...new Set(dupes)].join(' | ')}`
      });
    }

    // チェック5: 問題文・選択肢・解説の表崩れ
    for (const [where, text] of [['stem', q.stem ?? ''], ['explanation', q.explanation ?? ''], ...q.choices.map(c => ['choice ' + c.label, c.text ?? ''])]) {
      for (const detail of findBrokenTable(text)) {
        issues.BROKEN_TABLE.push({ file, id: q.id, detail: `${where}: ${detail}` });
      }
    }

    // チェック3: 解説に疑念語句
    const exp = (q.explanation ?? '') + ' ' + (q.explanationJa ?? '');
    for (const { re, label } of SUSPICIOUS) {
      if (re.test(exp)) {
        const snippet = (q.explanation ?? '').slice(0, 200);
        issues.SUSPICIOUS_EXPLANATION.push({ file, id: q.id, label, snippet });
        break;
      }
    }

    // チェック4: 計算問題で、解説の中に正解の数値が現れるか
    // 正解に至る計算を書かずに結論だけ述べている解説（＝逆算した嘘の論理）を検出する
    const correct = q.choices.find(c => c.label === q.correctAnswer);
    const nums = correct ? (correct.text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []) : [];
    const isCalc = nums.some(n => n.replace(/[,.]/g, '').length >= 2);
    // 解説未記入（出典だけを入れてある問題）は対象外
    const hasWrittenExplanation = !exp.includes('Refer to the video explanation');
    if (isCalc && hasWrittenExplanation && !nums.some(n => exp.includes(n))) {
      issues.ANSWER_NOT_IN_EXPLANATION.push({
        file, id: q.id,
        detail: `正解 ${q.correctAnswer}="${correct.text}" の値が解説に現れない`
      });
    }
  }
}

// ---- 結果出力 ----
console.log(`\n=== 整合性チェック結果 (対象 ${total} 問) ===\n`);

if (issues.INVALID_ANSWER.length) {
  console.log(`[1] correctAnswer 不正 (${issues.INVALID_ANSWER.length} 件)`);
  for (const i of issues.INVALID_ANSWER)
    console.log(`  ${i.id} (${i.file})\n    ${i.detail}`);
  console.log();
}

if (issues.DUPLICATE_CHOICE.length) {
  console.log(`[2] 選択肢テキスト重複 (${issues.DUPLICATE_CHOICE.length} 件)`);
  for (const i of issues.DUPLICATE_CHOICE)
    console.log(`  ${i.id} (${i.file})\n    ${i.detail}`);
  console.log();
}

if (issues.SUSPICIOUS_EXPLANATION.length) {
  console.log(`[3] 解説に疑念語句 (${issues.SUSPICIOUS_EXPLANATION.length} 件)`);
  for (const i of issues.SUSPICIOUS_EXPLANATION) {
    console.log(`  ${i.id} (${i.file}) [${i.label}]`);
    console.log(`    "${i.snippet.replace(/\n/g,' ')}..."`);
  }
  console.log();
}

// [5] 表崩れ（BAR問題で 2026-09〜10 に計8問見つかった型）。
// 既存データに表の小見出し・合計行の誤検出が11件あるため警告に留め、コミットは止めない。
// 新しく作った問題がここに出たら、画面で表を見て確認する。
if (issues.BROKEN_TABLE.length) {
  console.log(`[警告] 表崩れの疑い (${issues.BROKEN_TABLE.length} 件)`);
  for (const i of issues.BROKEN_TABLE)
    console.log(`  ${i.id} (${i.file})
    ${i.detail}`);
  console.log();
}

// [4] は既存データにも該当が多いため警告に留め、コミットは止めない
if (issues.ANSWER_NOT_IN_EXPLANATION.length) {
  console.log(`[警告] 解説に正解の値が現れない (${issues.ANSWER_NOT_IN_EXPLANATION.length} 件)`);
  console.log('  解説を新規に書いた問題がここに出た場合は、逆算した誤った論理の疑いがあるため要確認。');
  for (const i of issues.ANSWER_NOT_IN_EXPLANATION.slice(0, 10))
    console.log(`  ${i.id} (${i.file})`);
  if (issues.ANSWER_NOT_IN_EXPLANATION.length > 10)
    console.log(`  ... 他 ${issues.ANSWER_NOT_IN_EXPLANATION.length - 10} 件`);
  console.log();
}

const blocking = issues.INVALID_ANSWER.length + issues.DUPLICATE_CHOICE.length
  + issues.SUSPICIOUS_EXPLANATION.length;
if (blocking === 0) {
  console.log('問題なし — すべて正常です。');
  process.exit(0);
} else {
  console.log(`合計 ${blocking} 件の問題を検出。コミット前に修正してください。`);
  process.exit(1);
}
