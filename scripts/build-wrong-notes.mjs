// 模試（uscpa-mock-exams）で誤答した問題を抽出し、論点別の復習ノートHTMLを生成する。
//
//   node scripts/build-wrong-notes.mjs <バックアップJSON> [出力先HTML]
//   例: node scripts/build-wrong-notes.mjs ~/Downloads/uscpa-backup-20260808-0726.json
//
// 出力先を省略すると docs/review/far-wrong-notes.html に書き出す。
// 「落とし方」等の注釈は scripts/data/wrong-note-annotations.json に持たせているため、
// 新しいバックアップで再生成した場合、注釈のない問題はその欄が省略される。
//
// 注意:
// - バックアップのタイムスタンプはUTC。日付表示はすべてJST(+9h)に換算する
// - 模試記録の selectedAnswer / correctAnswer は問題バンクと同じ元ラベル（シャッフル後ではない）。
//   両者の一致は生成時に検証し、崩れていれば中断する

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const backupPath = process.argv[2];
const outPath = process.argv[3] || 'docs/review/far-wrong-notes.html';
if (!backupPath) {
  console.error('使い方: node scripts/build-wrong-notes.mjs <バックアップJSON> [出力先HTML]');
  process.exit(1);
}

const questionsDir = 'src/data/questions/far';
const annotationsPath = 'scripts/data/wrong-note-annotations.json';

const raw = JSON.parse(readFileSync(backupPath, 'utf8'));
// Zustand persist の値はJSON文字列なので二重パースが必要
const parse = (key) => (raw.data?.[key] ? JSON.parse(raw.data[key]).state : null);
const bank = parse('uscpa-question-bank');
const mockStore = parse('uscpa-mock-exams');
if (!mockStore) {
  console.error('バックアップに uscpa-mock-exams が含まれていない');
  process.exit(1);
}
const attempts = (bank?.attempts || []).filter((a) => typeof a.isCorrect === 'boolean');
const mocks = mockStore.results.slice().sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));

// 問題バンクの索引
const Q = {};
for (const file of readdirSync(questionsDir)) {
  if (!file.endsWith('.json')) continue;
  const json = JSON.parse(readFileSync(join(questionsDir, file), 'utf8'));
  for (const set of Array.isArray(json) ? json : [json]) {
    for (const q of set.questions || []) Q[q.id] = { ...q, topic: set.topic || set.name || set.id };
  }
}

// 模試記録のラベルが問題バンクと一致するか（シャッフル後ラベルが混入していないか）を検証
let checked = 0;
for (const m of mocks) {
  for (const a of m.answers || []) {
    const q = Q[a.questionId];
    if (!q) continue;
    if (q.correctAnswer !== a.correctAnswer) {
      console.error(`ラベル不一致: ${a.questionId} bank=${q.correctAnswer} mock=${a.correctAnswer}`);
      console.error('模試記録がシャッフル後ラベルで保存されている可能性がある。選択肢の突き合わせを中止する。');
      process.exit(1);
    }
    checked++;
  }
}

const jstDate = (iso) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10);

// questionId ごとの解答履歴（時系列）
const history = {};
for (const a of attempts) (history[a.questionId] = history[a.questionId] || []).push(a);
for (const list of Object.values(history)) list.sort((a, b) => (a.attemptedAt < b.attemptedAt ? -1 : 1));

// 模試で落とした問題を集約
const rec = {};
for (const m of mocks) {
  for (const a of m.answers || []) {
    if (a.isCorrect !== false) continue;
    const q = Q[a.questionId];
    if (!q) {
      console.warn(`問題バンクに存在しない: ${a.questionId}`);
      continue;
    }
    if (!rec[a.questionId]) {
      const list = history[a.questionId] || [];
      const last = list[list.length - 1];
      rec[a.questionId] = {
        id: a.questionId,
        topic: q.topic,
        subtopic: q.subtopic,
        difficulty: q.difficulty,
        stem: q.stem,
        choices: q.choices,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        explanationJa: q.explanationJa,
        references: q.references || [],
        mockDates: [],
        picked: [],
        lastCorrect: last ? last.isCorrect : null,
      };
    }
    rec[a.questionId].mockDates.push(jstDate(m.startedAt));
    rec[a.questionId].picked.push(a.selectedAnswer);
  }
}
const items = Object.values(rec);

const ann = JSON.parse(readFileSync(annotationsPath, 'utf8'));
const { traps = {}, topicLead = {}, patterns = [] } = ann;

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const DIFF_JA = { basic: '基礎', intermediate: '標準', advanced: '応用' };

const topicOrder = Object.entries(items.reduce((a, r) => ((a[r.topic] = (a[r.topic] || 0) + 1), a), {})).sort(
  (a, b) => b[1] - a[1]
);
const open = items.filter((r) => !r.lastCorrect).length;
const repeat = items.filter((r) => r.mockDates.length > 1).length;
const diffCount = items.reduce((a, r) => ((a[r.difficulty] = (a[r.difficulty] || 0) + 1), a), {});
const period = mocks.length ? `${jstDate(mocks[0].startedAt)} → ${jstDate(mocks[mocks.length - 1].startedAt)}` : '';
const totalWrong = items.reduce((s, r) => s + r.mockDates.length, 0);

let cards = '';
for (const [topic, n] of topicOrder) {
  cards += `<section class="topic" data-topic="${esc(slug(topic))}">
  <h2 id="t-${esc(slug(topic))}"><span>${esc(topic)}</span><em>${n}問</em></h2>
  ${topicLead[topic] ? `<p class="lead">${topicLead[topic]}</p>` : ''}\n`;
  for (const r of items.filter((x) => x.topic === topic)) {
    const picked = r.picked[0];
    const chs = r.choices
      .map((c) => {
        const isC = c.label === r.correctAnswer;
        const isP = c.label === picked;
        const mark = isC ? '正解' : isP ? '選択' : '';
        return `<li class="${isC ? 'ok' : isP ? 'ng' : ''}"><b>${c.label}</b><span>${esc(c.text)}</span>${
          mark ? `<em>${mark}</em>` : ''
        }</li>`;
      })
      .join('');
    cards += `  <article class="q" data-id="${esc(r.id)}" data-diff="${esc(r.difficulty)}" data-open="${
      r.lastCorrect ? '0' : '1'
    }">
    <header>
      <label class="done"><input type="checkbox" data-check="${esc(r.id)}" /><span>済</span></label>
      <div class="hd">
        <p class="sub">${esc(r.subtopic || '')}</p>
        <p class="ids"><code>${esc(r.id)}</code><span class="chip d-${esc(r.difficulty)}">${
      DIFF_JA[r.difficulty] || r.difficulty
    }</span>${r.mockDates.length > 1 ? `<span class="chip rep">模試で${r.mockDates.length}回</span>` : ''}${
      r.lastCorrect ? '<span class="chip fixed">その後正解</span>' : '<span class="chip openx">未解決</span>'
    }<span class="dates">模試 ${r.mockDates.join(' / ')}</span></p>
      </div>
      <button class="rev" type="button">解答を見る</button>
    </header>
    <div class="stem">${esc(r.stem)}</div>
    <ol class="ch">${chs}</ol>
    <div class="ans">
      ${traps[r.id] ? `<p class="trap"><b>落とし方</b>${esc(traps[r.id])}</p>` : ''}
      <p class="exp">${esc(r.explanationJa)}</p>
      <p class="expen">${esc(r.explanation)}</p>
      <p class="ref">${r.references.map((x) => `<code>${esc(x)}</code>`).join(' ')}</p>
    </div>
  </article>\n`;
  }
  cards += `</section>\n`;
}

const patternHtml = patterns
  .map(
    (p) => `<article class="pat">
  <h3>${esc(p.t)}<em>${p.n}問</em></h3>
  <p>${p.body}</p>
  <p class="pids">${p.ids.map((i) => `<a href="#" data-goto="${esc(i)}"><code>${esc(i)}</code></a>`).join('')}</p>
</article>`
  )
  .join('\n');

const nav = topicOrder
  .map(
    ([t, n]) =>
      `<button type="button" data-filter="${esc(slug(t))}">${esc(
        t.replace(/ \(.*\)|Accounting$| - Current.*/g, '').trim()
      )}<em>${n}</em></button>`
  )
  .join('');

const html = `<title>模試の誤答 ${items.length}問 — 論点別 復習ノート</title>
<style>
:root{
  --paper:#f4f5f0;--paper-2:#eceee6;--card:#fbfbf8;--ink:#16201a;--ink-2:#465049;--ink-3:#6f7973;
  --rule:#cfd4cb;--rule-2:#dfe3da;--accent:#1d6647;--accent-soft:#dbe8e0;
  --crit:#9d3129;--crit-soft:#f2e2df;--warn:#8a6414;--warn-soft:#f0e7d0;--good:#2c6f4e;--good-soft:#dcebe1;
  --mono:"SFMono-Regular","Consolas","Roboto Mono",ui-monospace,monospace;
  --sans:system-ui,-apple-system,"Segoe UI","Yu Gothic UI","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;
  --serif:"Hiragino Mincho ProN","Yu Mincho","YuMincho","Noto Serif JP","Times New Roman",serif;
}
@media (prefers-color-scheme:dark){:root{
  --paper:#121714;--paper-2:#1a201c;--card:#171d19;--ink:#e6ebe5;--ink-2:#aab3ac;--ink-3:#7d867f;
  --rule:#2e3833;--rule-2:#262f2a;--accent:#63b391;--accent-soft:#1c2f27;
  --crit:#e08a80;--crit-soft:#33211f;--warn:#d5ab5c;--warn-soft:#2e2718;--good:#6fbb92;--good-soft:#1b2c22;}}
:root[data-theme="dark"]{
  --paper:#121714;--paper-2:#1a201c;--card:#171d19;--ink:#e6ebe5;--ink-2:#aab3ac;--ink-3:#7d867f;
  --rule:#2e3833;--rule-2:#262f2a;--accent:#63b391;--accent-soft:#1c2f27;
  --crit:#e08a80;--crit-soft:#33211f;--warn:#d5ab5c;--warn-soft:#2e2718;--good:#6fbb92;--good-soft:#1b2c22;}
:root[data-theme="light"]{
  --paper:#f4f5f0;--paper-2:#eceee6;--card:#fbfbf8;--ink:#16201a;--ink-2:#465049;--ink-3:#6f7973;
  --rule:#cfd4cb;--rule-2:#dfe3da;--accent:#1d6647;--accent-soft:#dbe8e0;
  --crit:#9d3129;--crit-soft:#f2e2df;--warn:#8a6414;--warn-soft:#f0e7d0;--good:#2c6f4e;--good-soft:#dcebe1;}

*{box-sizing:border-box}
body{background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:15.5px;line-height:1.75;margin:0;padding:0 20px 100px;-webkit-font-smoothing:antialiased}
.wrap{max-width:880px;margin:0 auto}
a{color:var(--accent)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

.masthead{padding:52px 0 24px;border-bottom:2px solid var(--ink)}
.eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3);margin:0 0 12px}
h1{font-family:var(--serif);font-weight:600;font-size:32px;line-height:1.35;margin:0 0 12px;text-wrap:balance}
.sub-meta{font-family:var(--mono);font-size:12.5px;color:var(--ink-3);margin:0;display:flex;flex-wrap:wrap;gap:4px 18px}

.howto{margin:26px 0 0;padding:18px 22px;background:var(--paper-2);border-left:3px solid var(--accent)}
.howto p{margin:0 0 8px}
.howto p:last-child{margin:0}
.howto b{font-weight:700}

.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:1px;background:var(--rule);border:1px solid var(--rule);margin:26px 0 0}
.stat{background:var(--paper);padding:14px 16px}
.stat dt{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);margin:0 0 4px}
.stat dd{margin:0;font-family:var(--mono);font-size:23px;font-variant-numeric:tabular-nums;line-height:1.2}
.stat dd small{font-size:12px;color:var(--ink-3);font-family:var(--sans)}

h2.big{font-family:var(--serif);font-size:21px;font-weight:600;margin:48px 0 6px;padding-bottom:8px;border-bottom:1px solid var(--rule)}
.h2note{color:var(--ink-2);font-size:14.5px;margin:0 0 20px}

.pat{border-left:3px solid var(--accent-soft);padding:2px 0 2px 18px;margin:0 0 22px}
.pat h3{font-size:16px;margin:0 0 6px;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.pat h3 em{font-family:var(--mono);font-style:normal;font-size:11.5px;color:var(--accent);background:var(--accent-soft);padding:1px 7px;border-radius:2px}
.pat p{margin:0 0 8px}
.pids{display:flex;flex-wrap:wrap;gap:6px}
.pids a{text-decoration:none}
.pids code{font-family:var(--mono);font-size:11.5px;border:1px solid var(--rule);padding:2px 7px;color:var(--ink-2);display:inline-block}
.pids a:hover code{border-color:var(--accent);color:var(--accent)}

.bar{position:sticky;top:0;z-index:20;background:var(--paper);border-bottom:1px solid var(--rule);margin:44px 0 0;padding:10px 0 12px}
.bar .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.bar button{font-family:var(--sans);font-size:12.5px;background:none;border:1px solid var(--rule);color:var(--ink-2);padding:4px 10px;cursor:pointer;line-height:1.5}
.bar button em{font-family:var(--mono);font-style:normal;font-size:10.5px;color:var(--ink-3);margin-left:6px}
.bar button:hover{border-color:var(--accent);color:var(--accent)}
.bar button.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.bar button.on em{color:var(--paper)}
.bar .row+.row{margin-top:8px}
.bar .prog{font-family:var(--mono);font-size:12px;color:var(--ink-3);margin-left:auto;white-space:nowrap;font-variant-numeric:tabular-nums}

.topic{margin-top:44px}
.topic h2{font-family:var(--serif);font-size:20px;font-weight:600;margin:0 0 10px;padding-bottom:8px;border-bottom:1px solid var(--rule);display:flex;justify-content:space-between;align-items:baseline;gap:14px}
.topic h2 em{font-family:var(--mono);font-style:normal;font-size:12px;color:var(--ink-3)}
.lead{color:var(--ink-2);font-size:14.5px;margin:0 0 22px}
.lead b{color:var(--ink);font-weight:700}

.q{background:var(--card);border:1px solid var(--rule-2);padding:16px 18px;margin:0 0 14px}
.q.hide{display:none}
.q.done{opacity:.45}
.q header{display:flex;gap:12px;align-items:flex-start;margin-bottom:10px}
.q .hd{flex:1;min-width:0}
.sub{margin:0;font-weight:700;font-size:14.5px;line-height:1.5}
.ids{margin:2px 0 0;display:flex;flex-wrap:wrap;gap:5px 8px;align-items:center}
.ids code{font-family:var(--mono);font-size:11.5px;color:var(--ink-3)}
.chip{font-family:var(--mono);font-size:10px;letter-spacing:.06em;padding:1px 6px;border-radius:2px;text-transform:uppercase}
.chip.d-basic{background:var(--good-soft);color:var(--good)}
.chip.d-intermediate{background:var(--warn-soft);color:var(--warn)}
.chip.d-advanced{background:var(--crit-soft);color:var(--crit)}
.chip.rep{background:var(--crit);color:var(--paper)}
.chip.openx{border:1px solid var(--crit);color:var(--crit)}
.chip.fixed{border:1px solid var(--rule);color:var(--ink-3)}
.dates{font-family:var(--mono);font-size:11px;color:var(--ink-3)}
.done{display:flex;align-items:center;gap:4px;cursor:pointer;user-select:none;padding-top:2px}
.done input{width:16px;height:16px;accent-color:var(--accent);cursor:pointer;margin:0}
.done span{font-family:var(--mono);font-size:10.5px;color:var(--ink-3)}
.rev{font-family:var(--sans);font-size:12px;background:none;border:1px solid var(--rule);color:var(--ink-2);padding:4px 10px;cursor:pointer;white-space:nowrap}
.rev:hover{border-color:var(--accent);color:var(--accent)}

.stem{font-size:14.5px;line-height:1.85;margin-bottom:12px;color:var(--ink)}
ol.ch{list-style:none;margin:0;padding:0;display:grid;gap:1px;background:var(--rule-2);border:1px solid var(--rule-2)}
ol.ch li{background:var(--card);display:flex;gap:10px;padding:7px 11px;font-size:14px;align-items:baseline}
ol.ch li b{font-family:var(--mono);color:var(--ink-3);font-weight:400;flex:none;width:1.1em}
ol.ch li span{flex:1}
ol.ch li em{display:none;font-style:normal;font-family:var(--mono);font-size:10px;letter-spacing:.06em;padding:1px 6px;flex:none;align-self:center}
.q.show ol.ch li.ok{background:var(--good-soft)}
.q.show ol.ch li.ok b,.q.show ol.ch li.ok span{color:var(--good);font-weight:700}
.q.show ol.ch li.ng{background:var(--crit-soft)}
.q.show ol.ch li.ng b,.q.show ol.ch li.ng span{color:var(--crit)}
.q.show ol.ch li em{display:inline-block}
.q.show ol.ch li.ok em{background:var(--good);color:var(--paper)}
.q.show ol.ch li.ng em{background:var(--crit);color:var(--paper)}

.ans{display:none;margin-top:14px;padding-top:12px;border-top:1px dashed var(--rule)}
.q.show .ans{display:block}
.trap{margin:0 0 10px;font-size:14.5px;background:var(--warn-soft);padding:10px 13px;line-height:1.75}
.trap b{display:block;font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--warn);margin-bottom:3px}
.exp{margin:0 0 8px;font-size:14.5px;line-height:1.85}
.expen{margin:0 0 8px;font-size:13px;line-height:1.7;color:var(--ink-3)}
.ref{margin:0;display:flex;flex-wrap:wrap;gap:5px}
.ref code{font-family:var(--mono);font-size:11px;color:var(--ink-3);border:1px solid var(--rule-2);padding:1px 6px}

footer{margin-top:60px;padding-top:18px;border-top:1px solid var(--rule);font-family:var(--mono);font-size:12px;color:var(--ink-3);line-height:1.8}
@media (max-width:620px){
  body{padding-left:14px;padding-right:14px;font-size:15px}
  h1{font-size:25px}
  .q header{flex-wrap:wrap}
  .rev{width:100%;margin-top:4px}
  .bar .prog{margin-left:0;width:100%}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>

<div class="wrap">
<header class="masthead">
  <p class="eyebrow">FAR / 模試 誤答ノート</p>
  <h1>模試で落とした${items.length}問を、論点の型で束ねて潰す</h1>
  <p class="sub-meta"><span>模試${mocks.length}回（${period}）の全誤答</span><span>${items.length}問 / 延べ${totalWrong}回</span><span>${esc(
  backupPath.split(/[\\/]/).pop()
)}</span></p>
</header>

<div class="howto">
  <p><b>使い方</b> — 各問題は最初、選択肢だけが見える状態になっている。まず自分で答えを決めてから「解答を見る」を押す。正解・自分が選んだ選択肢・落とし方・解説がまとめて開く。</p>
  <p>解けたら「済」にチェック。チェックはこの端末に保存されるので、続きから再開できる。</p>
</div>

<dl class="stats">
  <div class="stat"><dt>誤答した問題</dt><dd>${items.length}<small> 問</small></dd></div>
  <div class="stat"><dt>未解決</dt><dd>${open}<small> 問（その後も正解していない）</small></dd></div>
  <div class="stat"><dt>模試で2回以上</dt><dd>${repeat}<small> 問</small></dd></div>
  <div class="stat"><dt>難易度</dt><dd>${diffCount.advanced || 0}<small> 応用 / ${diffCount.intermediate || 0} 標準 / ${
  diffCount.basic || 0
} 基礎</small></dd></div>
</dl>

${
  patterns.length
    ? `<h2 class="big">再発している${patterns.length}つの型</h2>
<p class="h2note">${items.length}問を個別に覚え直すより、同じ原因で落ちている問題をまとめて処理するほうが早い。各型のIDをクリックするとその問題に飛ぶ。</p>
${patternHtml}`
    : ''
}

<div class="bar">
  <div class="row">
    <button type="button" data-filter="all" class="on">すべて<em>${items.length}</em></button>
    <button type="button" data-flag="open">未解決のみ<em>${open}</em></button>
    <button type="button" data-flag="advanced">応用のみ<em>${diffCount.advanced || 0}</em></button>
    <button type="button" data-flag="basic">基礎のみ<em>${diffCount.basic || 0}</em></button>
    <button type="button" id="toggleAll">解答を一括表示</button>
    <span class="prog" id="prog">済 0 / ${items.length}</span>
  </div>
  <div class="row" id="topicNav">${nav}</div>
</div>

${cards}

<footer>
出典: ${esc(backupPath.split(/[\\/]/).pop())} の uscpa-mock-exams（模試${mocks.length}回・全${checked}解答）から isCorrect=false の問題を抽出<br />
問題文・選択肢・解説は src/data/questions/far/*.json の原文。「落とし方」は scripts/data/wrong-note-annotations.json<br />
模試記録の correctAnswer が問題バンクと全件一致することを生成時に検証済み（シャッフル後ラベルではない）<br />
再生成: node scripts/build-wrong-notes.mjs &lt;バックアップJSON&gt;
</footer>
</div>

<script>
(function(){
  var qs=[].slice.call(document.querySelectorAll('.q'));
  var store={};
  try{store=JSON.parse(localStorage.getItem('far-wrong-done')||'{}');}catch(e){store={};}
  function save(){try{localStorage.setItem('far-wrong-done',JSON.stringify(store));}catch(e){}}
  function prog(){
    var n=0;for(var k in store){if(store[k])n++;}
    document.getElementById('prog').textContent='済 '+n+' / '+qs.length;
  }
  qs.forEach(function(q){
    var id=q.dataset.id;
    var box=q.querySelector('input[data-check]');
    if(store[id]){box.checked=true;q.classList.add('done');}
    box.addEventListener('change',function(){
      store[id]=box.checked;q.classList.toggle('done',box.checked);save();prog();
    });
    var btn=q.querySelector('.rev');
    btn.addEventListener('click',function(){
      var on=q.classList.toggle('show');
      btn.textContent=on?'解答を隠す':'解答を見る';
    });
  });
  prog();

  var filterTopic='all',flag=null;
  function apply(){
    qs.forEach(function(q){
      var sec=q.closest('.topic');
      var okT=filterTopic==='all'||sec.dataset.topic===filterTopic;
      var okF=!flag||(flag==='open'?q.dataset.open==='1':q.dataset.diff===flag);
      q.classList.toggle('hide',!(okT&&okF));
    });
    [].forEach.call(document.querySelectorAll('.topic'),function(sec){
      var any=[].some.call(sec.querySelectorAll('.q'),function(q){return !q.classList.contains('hide');});
      sec.style.display=any?'':'none';
    });
  }
  [].forEach.call(document.querySelectorAll('[data-filter]'),function(b){
    b.addEventListener('click',function(){
      filterTopic=b.dataset.filter;
      [].forEach.call(document.querySelectorAll('[data-filter]'),function(x){x.classList.toggle('on',x===b);});
      apply();
      if(filterTopic!=='all'){var h=document.getElementById('t-'+filterTopic);if(h)h.scrollIntoView({block:'start'});}
    });
  });
  [].forEach.call(document.querySelectorAll('[data-flag]'),function(b){
    b.addEventListener('click',function(){
      flag=flag===b.dataset.flag?null:b.dataset.flag;
      [].forEach.call(document.querySelectorAll('[data-flag]'),function(x){x.classList.toggle('on',x.dataset.flag===flag);});
      apply();
    });
  });
  var tg=document.getElementById('toggleAll'),allOn=false;
  tg.addEventListener('click',function(){
    allOn=!allOn;
    qs.forEach(function(q){
      q.classList.toggle('show',allOn);
      q.querySelector('.rev').textContent=allOn?'解答を隠す':'解答を見る';
    });
    tg.textContent=allOn?'解答を一括で隠す':'解答を一括表示';
    tg.classList.toggle('on',allOn);
  });
  [].forEach.call(document.querySelectorAll('[data-goto]'),function(a){
    a.addEventListener('click',function(e){
      e.preventDefault();
      filterTopic='all';flag=null;
      [].forEach.call(document.querySelectorAll('[data-filter]'),function(x){x.classList.toggle('on',x.dataset.filter==='all');});
      [].forEach.call(document.querySelectorAll('[data-flag]'),function(x){x.classList.remove('on');});
      apply();
      var t=document.querySelector('.q[data-id="'+a.dataset.goto+'"]');
      if(t){t.scrollIntoView({block:'center'});t.classList.add('show');t.querySelector('.rev').textContent='解答を隠す';}
    });
  });
})();
</script>
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html);
console.log(`${outPath} を生成 (${(html.length / 1024).toFixed(0)}KB)`);
console.log(`模試${mocks.length}回 / 誤答${items.length}問（延べ${totalWrong}回・未解決${open}問）`);
const noTrap = items.filter((r) => !traps[r.id]);
if (noTrap.length) console.log(`注釈なし: ${noTrap.length}問 (${noTrap.map((r) => r.id).join(', ')})`);
