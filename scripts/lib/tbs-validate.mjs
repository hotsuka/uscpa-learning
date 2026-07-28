// TBS問題データの検証ロジック（check-tbs.mjs / merge-staged-tbs.mjs 共用）
//
// エラーは2段階に分かれる:
//   - errors   : 構造的な不整合。アプリが正しく動作しない・採点が壊れるレベル。常に失敗扱い。
//   - warnings : docs/tbs-authoring-rules.md の構成ガイドライン違反。既存の初期5問は
//                ルール制定前に作られており該当するため、既定では失敗させない。
//                新規作問（マージ時）は --strict で警告もエラー扱いにする。

export const ANSWER_TYPES = [
  "number",
  "select",
  "multiselect",
  "table",
  "research",
];
export const DIFFICULTIES = ["basic", "intermediate", "advanced"];
export const SUBJECTS = ["FAR", "AUD", "REG", "BAR"];

// 解説内に「自信がない・計算が合わない」ことを示す疑念パターン（check-questions.mjsと同基準）
const SUSPICIOUS = [
  { re: /wait[,\s—]+let me/i, label: "wait-let-me" },
  { re: /hmm[,.]?\s/i, label: "hmm" },
  { re: /not among the choices/i, label: "not-among-choices" },
  { re: /let me re.?calculat/i, label: "recalculate" },
  { re: /let me reconsider/i, label: "reconsider" },
  { re: /let me re.?read/i, label: "re-read" },
  { re: /let me recheck/i, label: "recheck" },
  { re: /closest answer is/i, label: "closest-answer" },
  { re: /doesn.t match|do not match/i, label: "doesnt-match" },
];

// TBSは選択肢をA-Dラベルで参照しない（内容で参照する）
const LABEL_REF = [
  { re: /\bchoice\s+[A-D]\b/i, label: "choice-letter" },
  { re: /\boption\s+[A-D]\b/i, label: "option-letter" },
  { re: /選択肢[A-DＡ-Ｄ]/, label: "sentakushi-letter" },
];

// 2026年ブループリントでFAR範囲外（BAR領域）の論点。誤検出があり得るため警告どまりにし、
// 人間/QCが「本当に出題しているのか、単に文中に出てくるだけか」を判断する。
const OUT_OF_SCOPE = [
  {
    re: /\bpension\b|\bdefined benefit\b|\bprojected benefit obligation\b/i,
    label: "年金",
  },
  {
    re: /\bshare-based (payment|compensation)\b|\bstock option\b|\bstock compensation\b/i,
    label: "株式報酬",
  },
  {
    re: /\bderivative\b|\bhedg(e|ing)\b|\binterest rate swap\b/i,
    label: "デリバティブ・ヘッジ",
  },
  { re: /\bvariable interest entit(y|ies)\b|\bVIE\b/i, label: "VIE" },
  {
    re: /\b(currency|foreign) translation\b|\btranslation adjustment\b|\bfunctional currency\b/i,
    label: "外貨換算",
  },
  {
    re: /\blessor\b|\bsales-type lease\b|\bdirect financing lease\b/i,
    label: "貸手リース",
  },
  { re: /\bpartnership\b|\bpartner'?s? capital\b/i, label: "パートナーシップ" },
  {
    re: /\bacquisition method\b|\bbusiness combination\b/i,
    label: "企業結合の取得法",
  },
];

// ASC引用の正規化（TBSAnswerForm.tsxのnormalizeCitationと同一ロジック）
export function normalizeCitation(value) {
  return String(value)
    .replace(/[^0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);

// 仕訳形式のtableか（Debit列とCredit列を両方持つ）
function isJournalEntryTable(tc) {
  const lower = tc.columns.map((c) => String(c).toLowerCase());
  return (
    lower.some((c) => c.includes("debit")) &&
    lower.some((c) => c.includes("credit"))
  );
}

/**
 * TBS問題1件を検証する。
 * @param {object} q 問題オブジェクト
 * @param {{ seenIds?: Set<string>, existingIds?: Set<string> }} ctx
 * @returns {{ errors: {id: string, message: string}[], warnings: {id: string, message: string}[] }}
 */
export function validateQuestion(q, ctx = {}) {
  const errors = [];
  const warnings = [];
  const qid = q.id ?? "(idなし)";
  const err = (id, message) => errors.push({ id, message });
  const warn = (id, message) => warnings.push({ id, message });

  // --- 基本フィールド ---
  if (!/^far-tbs-[a-z0-9-]+-\d{3}$/.test(q.id ?? "")) {
    err(qid, `id形式が不正: ${q.id}`);
  }
  if (ctx.existingIds?.has(q.id)) err(qid, `id が既存問題と衝突: ${q.id}`);
  if (ctx.seenIds?.has(q.id)) err(qid, "id重複");
  ctx.seenIds?.add(q.id);

  if (!SUBJECTS.includes(q.subject)) err(qid, `subject不正: ${q.subject}`);
  if (!DIFFICULTIES.includes(q.difficulty))
    err(qid, `difficulty不正: ${q.difficulty}`);
  if (
    !isFiniteNumber(q.estimatedMinutes) ||
    q.estimatedMinutes < 5 ||
    q.estimatedMinutes > 40
  )
    err(qid, `estimatedMinutes不正: ${q.estimatedMinutes}`);
  else if (q.estimatedMinutes < 20 || q.estimatedMinutes > 30)
    warn(qid, `estimatedMinutesが推奨範囲(20〜30)外: ${q.estimatedMinutes}`);
  if (!q.topic) err(qid, "topicが空");
  if (!q.title) err(qid, "titleが空");
  if (!q.scenario) err(qid, "scenarioが空");
  if (!q.source) err(qid, "sourceが空");

  // --- Exhibits ---
  if (!Array.isArray(q.exhibits) || q.exhibits.length === 0) {
    err(qid, "exhibitsが空");
  } else {
    for (const ex of q.exhibits) {
      if (!ex.id || !ex.title || !ex.content)
        err(qid, `exhibit不完全: ${ex.id ?? "(idなし)"}`);
    }
    if (q.exhibits.length < 2 || q.exhibits.length > 4)
      warn(qid, `Exhibit数が推奨範囲(2〜4)外: ${q.exhibits.length}枚`);
  }

  // --- Tasks ---
  if (!Array.isArray(q.tasks) || q.tasks.length === 0) {
    err(qid, "tasksが空");
    return { errors, warnings };
  }
  if (q.tasks.length < 5 || q.tasks.length > 7)
    warn(qid, `タスク数が推奨範囲(5〜7)外: ${q.tasks.length}個`);

  const usedTypes = new Set(q.tasks.map((t) => t.answerType));
  if (usedTypes.size === 1)
    warn(qid, `answerTypeが単一(${[...usedTypes][0]}のみ) — 混在させること`);

  const taskIds = new Set();
  for (const t of q.tasks) {
    const tid = `${qid}/${t.id ?? "(idなし)"}`;

    if (taskIds.has(t.id)) err(tid, "task id重複");
    taskIds.add(t.id);

    if (!t.workTab) err(tid, "workTabが空");
    if (!t.title) err(tid, "titleが空");
    if (!t.instruction) err(tid, "instructionが空");
    if (!t.explanation) err(tid, "explanationが空");
    if (!t.explanationJa) err(tid, "explanationJaが空");
    if (!Array.isArray(t.references) || t.references.length === 0)
      warn(tid, "referencesが空 — ASC参照を付けること");
    if (
      t.tolerance !== undefined &&
      (!isFiniteNumber(t.tolerance) || t.tolerance < 0)
    )
      err(tid, `toleranceが不正: ${t.tolerance}`);

    if (!ANSWER_TYPES.includes(t.answerType)) {
      err(tid, `answerType不正: ${t.answerType}`);
      continue;
    }

    // --- answerType別チェック ---
    if (t.answerType === "number") {
      if (!isFiniteNumber(t.correctAnswer))
        err(
          tid,
          `number型なのにcorrectAnswerが有限数でない: ${JSON.stringify(t.correctAnswer)}`,
        );
    }
    if (t.answerType === "select") {
      if (!Array.isArray(t.options) || t.options.length < 2) {
        err(tid, "select型なのにoptionsが2未満");
      } else {
        if (new Set(t.options).size !== t.options.length)
          err(tid, "options重複");
        if (!t.options.includes(t.correctAnswer))
          err(tid, `correctAnswerがoptionsに存在しない: ${t.correctAnswer}`);
      }
    }
    if (t.answerType === "multiselect") {
      if (!Array.isArray(t.options) || t.options.length < 2) {
        err(tid, "multiselect型なのにoptionsが2未満");
      } else if (
        !Array.isArray(t.correctAnswer) ||
        t.correctAnswer.length === 0
      ) {
        err(tid, "multiselect型なのにcorrectAnswerが空配列/非配列");
      } else {
        if (new Set(t.options).size !== t.options.length)
          err(tid, "options重複");
        if (new Set(t.correctAnswer).size !== t.correctAnswer.length)
          err(tid, "correctAnswer要素が重複");
        for (const a of t.correctAnswer) {
          if (!t.options.includes(a))
            err(tid, `correctAnswerの要素がoptionsに存在しない: ${a}`);
        }
      }
    }
    if (t.answerType === "table") {
      // table型はtableConfig.cellsで採点する。correctAnswerがあると採点意図が二重になる
      if (t.correctAnswer !== undefined)
        err(
          tid,
          "table型にcorrectAnswerが設定されている（cellsで採点するため書かない）",
        );

      const tc = t.tableConfig;
      if (
        !tc ||
        !Array.isArray(tc.columns) ||
        !Array.isArray(tc.rows) ||
        !Array.isArray(tc.cells)
      ) {
        err(tid, "table型なのにtableConfigが不完全");
      } else if (tc.cells.length === 0) {
        err(tid, "tableConfig.cellsが空");
      } else {
        const seenCells = new Set();
        for (const c of tc.cells) {
          if (!tc.rows.includes(c.rowLabel))
            err(tid, `cellのrowLabelがrowsに存在しない: ${c.rowLabel}`);
          if (!tc.columns.includes(c.colLabel))
            err(tid, `cellのcolLabelがcolumnsに存在しない: ${c.colLabel}`);
          if (
            c.correctValue === undefined ||
            c.correctValue === null ||
            c.correctValue === ""
          )
            err(tid, `cellのcorrectValueが空: ${c.rowLabel}/${c.colLabel}`);
          if (
            c.tolerance !== undefined &&
            (!isFiniteNumber(c.tolerance) || c.tolerance < 0)
          )
            err(
              tid,
              `cellのtoleranceが不正: ${c.rowLabel}/${c.colLabel} = ${c.tolerance}`,
            );
          const cellKey = `${c.rowLabel}__${c.colLabel}`;
          if (seenCells.has(cellKey)) err(tid, `cell座標重複: ${cellKey}`);
          seenCells.add(cellKey);
        }

        // 仕訳table: 借方・貸方の片側だけをcellsに入れると、入力欄の位置で正解の側がバレる
        if (isJournalEntryTable(tc)) {
          const debitCol = tc.columns.find((c) =>
            String(c).toLowerCase().includes("debit"),
          );
          const creditCol = tc.columns.find((c) =>
            String(c).toLowerCase().includes("credit"),
          );
          const rowsInCells = [...new Set(tc.cells.map((c) => c.rowLabel))];
          let debitSum = 0;
          let creditSum = 0;
          for (const row of rowsInCells) {
            const d = tc.cells.find(
              (c) => c.rowLabel === row && c.colLabel === debitCol,
            );
            const cr = tc.cells.find(
              (c) => c.rowLabel === row && c.colLabel === creditCol,
            );
            if (!d || !cr)
              err(
                tid,
                `仕訳tableで借方・貸方の片側しかcellsにない: ${row}（金額が入らない側は correctValue: 0 を入れる）`,
              );
            if (isFiniteNumber(d?.correctValue)) debitSum += d.correctValue;
            if (isFiniteNumber(cr?.correctValue)) creditSum += cr.correctValue;
          }
          if (Math.abs(debitSum - creditSum) > 1)
            err(
              tid,
              `仕訳tableの借方合計(${debitSum})と貸方合計(${creditSum})が一致しない`,
            );
        }
      }
    }
    if (t.answerType === "research") {
      const normalized = normalizeCitation(t.correctAnswer ?? "");
      if (!/^\d+(-\d+)+$/.test(normalized))
        err(
          tid,
          `research型のcorrectAnswerがASC引用形式でない: ${t.correctAnswer}`,
        );
    }

    // --- 疑念語句・ラベル参照 ---
    const texts = [t.explanation ?? "", t.explanationJa ?? ""];
    for (const text of texts) {
      for (const { re, label } of SUSPICIOUS) {
        if (re.test(text))
          err(tid, `疑念語句(${label}): ${text.slice(0, 60)}...`);
      }
      for (const { re, label } of LABEL_REF) {
        if (re.test(text))
          err(tid, `ラベル参照(${label}): ${text.slice(0, 60)}...`);
      }
    }
  }

  // --- ブループリント範囲（問題全体のテキストを対象に警告のみ） ---
  const wholeText = [
    q.title,
    q.scenario,
    ...(q.exhibits ?? []).map((e) => `${e.title} ${e.content}`),
    ...q.tasks.map(
      (t) =>
        `${t.title} ${t.instruction} ${(t.options ?? []).join(" ")} ${t.explanation}`,
    ),
  ].join("\n");
  for (const { re, label } of OUT_OF_SCOPE) {
    if (re.test(wholeText))
      warn(qid, `FAR範囲外の可能性(${label}) — 出題論点になっていないか確認`);
  }

  return { errors, warnings };
}
