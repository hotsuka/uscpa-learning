import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const questionsDir = 'src/data/questions/far';

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

const files = readdirSync(questionsDir)
  .filter(f => f.endsWith('.json') && !f.includes('.bak'));

const issues = { INVALID_ANSWER: [], DUPLICATE_CHOICE: [], SUSPICIOUS_EXPLANATION: [] };
let total = 0;

for (const file of files) {
  const raw = JSON.parse(readFileSync(join(questionsDir, file), 'utf8'));
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

    // チェック3: 解説に疑念語句
    const exp = (q.explanation ?? '') + ' ' + (q.explanationJa ?? '');
    for (const { re, label } of SUSPICIOUS) {
      if (re.test(exp)) {
        const snippet = (q.explanation ?? '').slice(0, 200);
        issues.SUSPICIOUS_EXPLANATION.push({ file, id: q.id, label, snippet });
        break;
      }
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

const totalIssues = Object.values(issues).reduce((s, a) => s + a.length, 0);
if (totalIssues === 0) {
  console.log('問題なし — すべて正常です。');
  process.exit(0);
} else {
  console.log(`合計 ${totalIssues} 件の問題を検出。コミット前に修正してください。`);
  process.exit(1);
}
