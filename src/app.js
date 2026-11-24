import {
  createCalibration,
  isCalibrationValid,
  mmToCssPx,
  CARD_WIDTH_MM,
  DEFAULT_DISTANCE_CM,
  NEAR_DISTANCE_CM,
  formatDistance,
} from './calibrate.js';
import {
  createAcuitySession,
  randomGap,
  recordAcuityAnswer,
  optotypeDiameterMm,
  landoltSvg,
  vaToSnellen,
  estimateSphereFromVa,
  VA_LEVELS,
} from './acuity.js';
import { createAstigmatismResult, CLOCK_HOURS } from './astigmatism.js';
import {
  createSubjectiveSession,
  applySphereChoice,
  compareBlurOptions,
  createDuochromeSession,
  recordDuochromeChoice,
  estimateNearAdd,
} from './subjective.js';
import {
  buildPrescription,
  formatPrescriptionText,
  mergeEyeResults,
  pdGuideText,
  validatePd,
  MEDICAL_DISCLAIMER,
} from './prescription.js';
import {
  loadExams,
  saveExams,
  addExam,
  sortExams,
  loadCalibration,
  saveCalibration,
} from './store.js';
import { createWearableInput } from './wearable-input.js';

const $ = (sel, root = document) => root.querySelector(sel);

const STEPS = [
  { id: 'calibrate', label: '校准' },
  { id: 'acuity', label: '视力' },
  { id: 'astigmatism', label: '散光' },
  { id: 'subjective', label: '屈光' },
  { id: 'duochrome', label: '红绿' },
  { id: 'near', label: '近视力' },
  { id: 'pd', label: '瞳距' },
  { id: 'result', label: '处方' },
];

const EYES = ['OD', 'OS'];

const state = {
  step: 'home',
  stepIdx: 0,
  calibration: null,
  eyeIdx: 0,
  acuity: { OD: null, OS: null },
  acuityGap: 0,
  astigmatism: { OD: null, OS: null },
  astPhase: 'clearest',
  subjective: { OD: null, OS: null },
  duochrome: { OD: null, OS: null },
  nearVa: null,
  pd: null,
  add: null,
  exams: [],
  wearableOn: false,
  focusChoice: 0,
};

const els = {};
let wearable = null;

async function haptic(style = 'Light') {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle[style] || ImpactStyle.Light });
  } catch { /* browser */ }
}

function toast(msg) {
  const t = els.toast;
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

function currentEye() {
  return EYES[state.eyeIdx];
}

function showStep(id) {
  state.step = id;
  document.querySelectorAll('.screen').forEach((s) => {
    s.classList.toggle('active', s.dataset.screen === id);
  });
  if (id !== 'home') {
    const idx = STEPS.findIndex((s) => s.id === id);
    state.stepIdx = idx >= 0 ? idx : 0;
    renderProgress();
  }
}

function renderProgress() {
  const active = document.querySelector('.screen.active');
  const bar = active?.querySelector('.progress-bar');
  const label = active?.querySelector('.step-label');
  if (!bar) return;
  const pct = ((state.stepIdx + 1) / STEPS.length) * 100;
  bar.style.width = `${pct}%`;
  if (label) label.textContent = STEPS[state.stepIdx]?.label || '';
}

function initFromStorage() {
  state.calibration = loadCalibration();
  state.exams = loadExams();
}

function renderHome() {
  const calOk = isCalibrationValid(state.calibration);
  els.calStatus.textContent = calOk
    ? `已校准 · ${formatDistance(state.calibration.distanceCm)}`
    : '未校准 — 请先完成距离校准';
  els.calStatus.className = `pill ${calOk ? 'ok' : 'warn'}`;

  const list = sortExams(state.exams);
  els.historyList.innerHTML = list.slice(0, 6).map((e) => `
    <button type="button" class="hist-item" data-id="${e.id}">
      <span class="date">${new Date(e.createdAt).toLocaleDateString('zh-CN')}</span>
      <span class="rx">${e.summary || '验光记录'}</span>
    </button>
  `).join('') || '<p class="muted">暂无历史记录</p>';

  els.historyList.querySelectorAll('.hist-item').forEach((btn) => {
    btn.addEventListener('click', () => showExamDetail(btn.dataset.id));
  });
}

function showExamDetail(id) {
  const e = state.exams.find((x) => x.id === id);
  if (!e) return;
  els.rxOutput.textContent = e.rxText || '无详情';
  showStep('result');
}

function startExam() {
  if (!isCalibrationValid(state.calibration)) {
    toast('请先完成屏幕校准');
    showStep('calibrate');
    return;
  }
  state.eyeIdx = 0;
  state.acuity = { OD: createAcuitySession('OD'), OS: null };
  state.acuityGap = randomGap();
  state.astigmatism = { OD: { clearest: null, blurriest: null }, OS: { clearest: null, blurriest: null } };
  state.astPhase = 'clearest';
  state.subjective = { OD: null, OS: null };
  state.duochrome = { OD: null, OS: null };
  state.nearVa = null;
  state.pd = null;
  state.add = null;
  showStep('acuity');
  renderAcuity();
  haptic('Medium');
}

/* ── Calibration ── */

function renderCalibrate() {
  const cardPx = Number(els.cardSlider?.value || 280);
  els.cardPreview.style.width = `${cardPx}px`;
  els.cardPreview.textContent = `${CARD_WIDTH_MM} mm`;
  els.cardPxLabel.textContent = `${cardPx} px`;
}

function finishCalibration() {
  const method = els.calMethodCard?.checked ? 'card' : 'manual';
  const cardPx = Number(els.cardSlider?.value || 280);
  const manualPpm = Number(els.manualPpm?.value || 0);
  const distanceCm = Number(els.distanceInput?.value || DEFAULT_DISTANCE_CM);

  const cal = createCalibration({
    method,
    cardPxWidth: method === 'card' ? cardPx : null,
    pxPerMm: method === 'manual' ? manualPpm : null,
    distanceCm,
  });

  if (!isCalibrationValid(cal)) {
    toast('校准失败，请检查输入');
    return;
  }
  state.calibration = cal;
  saveCalibration(cal);
  toast(`校准完成 · 验光距离 ${formatDistance(distanceCm)}`);
  showStep('home');
  renderHome();
  haptic('Medium');
}

/* ── Acuity ── */

function renderAcuity() {
  const eye = currentEye();
  let session = state.acuity[eye];
  if (!session) {
    session = createAcuitySession(eye);
    state.acuity[eye] = session;
    state.acuityGap = randomGap();
  }

  els.acuityEye.textContent = eye === 'OD' ? '右眼 OD' : '左眼 OS';
  els.acuityHint.textContent = session.done
    ? `本眼完成 · ${vaToSnellen(session.thresholdVa)}`
    : '辨认 C 字缺口方向（上/下/左/右）';

  const currentVa = session.done
    ? session.thresholdVa
    : VA_LEVELS[session.levelIdx];

  const diaMm = optotypeDiameterMm(state.calibration.distanceCm, currentVa);
  const sizePx = mmToCssPx(diaMm, state.calibration.pxPerMm);
  els.landoltHost.innerHTML = landoltSvg(Math.max(24, sizePx), state.acuityGap);
  els.acuityMeta.textContent = session.done
    ? `阈值 ${vaToSnellen(session.thresholdVa)} (${session.thresholdVa.toFixed(2)})`
    : `级别 ${vaToSnellen(currentVa)} · 反转 ${session.reversals}/3`;

  els.acuityNext.disabled = !session.done;
}

function answerAcuity(gapDeg) {
  const eye = currentEye();
  const session = state.acuity[eye];
  if (!session || session.done) return;
  recordAcuityAnswer(session, state.acuityGap, gapDeg);
  if (!session.done) state.acuityGap = randomGap();
  renderAcuity();
  haptic(session.lastCorrect ? 'Light' : 'Medium');
}

function nextAcuityEye() {
  const eye = currentEye();
  if (!state.acuity[eye]?.done) return;

  if (state.eyeIdx === 0) {
    state.eyeIdx = 1;
    state.acuity.OS = createAcuitySession('OS');
    state.acuityGap = randomGap();
    renderAcuity();
    toast('请遮左眼，测试左眼');
    return;
  }

  state.eyeIdx = 0;
  state.astPhase = 'clearest';
  showStep('astigmatism');
  renderAstigmatism();
}

/* ── Astigmatism ── */

function renderAstigmatism() {
  const eye = currentEye();
  const data = state.astigmatism[eye];
  els.astEye.textContent = eye === 'OD' ? '右眼 OD' : '左眼 OS';
  els.astPhase.textContent = state.astPhase === 'clearest'
    ? '哪条线最清晰？'
    : '哪条线最模糊？';

  els.clockDial.innerHTML = CLOCK_HOURS.map((h) => `
    <button type="button" class="clock-line" data-hour="${h}" aria-label="${h}点方向">
      <span style="transform:rotate(${(h % 12) * 30 - 90}deg)"></span>
    </button>
  `).join('');

  els.clockDial.querySelectorAll('.clock-line').forEach((btn) => {
    btn.addEventListener('click', () => pickAstHour(Number(btn.dataset.hour)));
  });
}

function pickAstHour(hour) {
  const eye = currentEye();
  const data = state.astigmatism[eye];
  if (state.astPhase === 'clearest') {
    data.clearest = hour;
    state.astPhase = 'blurriest';
    renderAstigmatism();
    toast('请选择最模糊的方向');
  } else {
    data.blurriest = hour;
    state.astigmatism[eye] = createAstigmatismResult(data.clearest, data.blurriest);
    if (state.eyeIdx === 0) {
      state.eyeIdx = 1;
      state.astPhase = 'clearest';
      renderAstigmatism();
      toast('请测试左眼散光');
    } else {
      state.eyeIdx = 0;
      startSubjective();
    }
  }
  haptic('Light');
}

function startSubjective() {
  for (const eye of EYES) {
    const va = state.acuity[eye]?.thresholdVa ?? 0.8;
    const startSph = estimateSphereFromVa(va, 0);
    state.subjective[eye] = createSubjectiveSession(eye, startSph);
  }
  showStep('subjective');
  renderSubjective();
}

/* ── Subjective ── */

function renderSubjective() {
  const eye = currentEye();
  const session = state.subjective[eye];
  els.subjEye.textContent = eye === 'OD' ? '右眼 OD' : '左眼 OS';

  if (!session || session.done) {
    els.subjPrompt.textContent = session?.done ? '本眼屈光完成' : '准备中…';
    els.subjCompare.hidden = true;
    els.subjNext.disabled = !session?.done;
    return;
  }

  const opts = compareBlurOptions(session.sph, NEAR_DISTANCE_CM);
  els.subjPrompt.textContent = '哪边更清晰？';
  els.subjCompare.hidden = false;
  els.subjA.style.filter = `blur(${opts.A.blur}px)`;
  els.subjB.style.filter = `blur(${opts.B.blur}px)`;
  els.subjALabel.textContent = `A (${opts.A.sph >= 0 ? '+' : ''}${opts.A.sph.toFixed(2)})`;
  els.subjBLabel.textContent = `B (${opts.B.sph >= 0 ? '+' : ''}${opts.B.sph.toFixed(2)})`;
  els.subjNext.disabled = true;
}

function pickSubjective(choice) {
  const eye = currentEye();
  const session = state.subjective[eye];
  if (!session || session.done) return;
  applySphereChoice(session, choice);
  if (session.done) {
    toast(`${eye} 球镜约 ${session.sph.toFixed(2)} D`);
    if (state.eyeIdx === 0) {
      state.eyeIdx = 1;
      renderSubjective();
      toast('请测试左眼屈光');
    } else {
      state.eyeIdx = 0;
      startDuochrome();
    }
  } else {
    renderSubjective();
  }
  haptic('Light');
}

function startDuochrome() {
  for (const eye of EYES) {
    const sph = state.subjective[eye]?.sph ?? 0;
    state.duochrome[eye] = createDuochromeSession(sph);
  }
  showStep('duochrome');
  renderDuochrome();
}

/* ── Duochrome ── */

function renderDuochrome() {
  const eye = currentEye();
  const session = state.duochrome[eye];
  els.duoEye.textContent = eye === 'OD' ? '右眼 OD' : '左眼 OS';
  els.duoHint.textContent = session?.done
    ? `微调完成 · ${session.sph.toFixed(2)} D`
    : '红底与绿底哪边字母更清晰？';
  els.duoNext.disabled = !session?.done;
}

function pickDuochrome(side) {
  const eye = currentEye();
  const session = state.duochrome[eye];
  if (!session || session.done) return;
  recordDuochromeChoice(session, side);
  if (session.done) {
    state.subjective[eye].sph = session.sph;
    if (state.eyeIdx === 0) {
      state.eyeIdx = 1;
      renderDuochrome();
      toast('请测试左眼红绿平衡');
    } else {
      state.eyeIdx = 0;
      showStep('near');
      renderNear();
    }
  } else {
    renderDuochrome();
  }
  haptic('Light');
}

function nextDuochromeEye() {
  if (!state.duochrome[currentEye()]?.done) return;
  if (state.eyeIdx === 0) {
    state.eyeIdx = 1;
    renderDuochrome();
  } else {
    showStep('near');
    renderNear();
  }
}

/* ── Near vision ── */

function renderNear() {
  if (!state.nearSession) {
    state.nearSession = createAcuitySession('OU');
    state.nearGap = randomGap();
  }
  const session = state.nearSession;
  const currentVa = session.done ? session.thresholdVa : VA_LEVELS[session.levelIdx];
  const diaMm = optotypeDiameterMm(NEAR_DISTANCE_CM, currentVa);
  const sizePx = mmToCssPx(diaMm, state.calibration.pxPerMm);
  els.nearHost.innerHTML = landoltSvg(Math.max(20, sizePx), state.nearGap);
  els.nearMeta.textContent = session.done
    ? `近视力 ${vaToSnellen(session.thresholdVa)}`
    : `阅读距离 ${NEAR_DISTANCE_CM} cm · ${vaToSnellen(currentVa)}`;
  els.nearNext.disabled = !session.done;
}

function answerNear(gapDeg) {
  const session = state.nearSession;
  if (!session || session.done) return;
  recordAcuityAnswer(session, state.nearGap, gapDeg);
  if (!session.done) state.nearGap = randomGap();
  else {
    state.nearVa = session.thresholdVa;
    state.add = estimateNearAdd(session.thresholdVa, NEAR_DISTANCE_CM);
  }
  renderNear();
}

function finishNear() {
  showStep('pd');
  els.pdGuide.textContent = pdGuideText();
}

/* ── PD ── */

function savePd() {
  const v = validatePd(els.pdInput.value);
  if (!v.ok) {
    toast(v.msg);
    return;
  }
  state.pd = v.value;
  finishExam();
}

function finishExam() {
  const od = mergeEyeResults(
    state.acuity.OD,
    state.astigmatism.OD,
    state.subjective.OD,
    state.duochrome.OD,
  );
  const os = mergeEyeResults(
    state.acuity.OS,
    state.astigmatism.OS,
    state.subjective.OS,
    state.duochrome.OS,
  );

  const rx = buildPrescription({ od, os, pd: state.pd, add: state.add });
  const rxText = formatPrescriptionText(rx);
  els.rxOutput.textContent = rxText;

  const summary = `OD ${od.sph?.toFixed(2) ?? '—'} / OS ${os.sph?.toFixed(2) ?? '—'}`;
  state.exams = addExam(state.exams, { od, os, pd: state.pd, add: state.add, rxText, summary, calibration: state.calibration });
  saveExams(state.exams);

  showStep('result');
  renderHome();
  haptic('Heavy');
}

async function copyRx() {
  const text = els.rxOutput.textContent;
  try {
    await navigator.clipboard.writeText(text);
    toast('已复制处方');
  } catch {
    toast('复制失败，请手动选择文本');
  }
}

/* ── Wearable ── */

function setupWearable() {
  wearable = createWearableInput({
    onRingTiltLeft: () => { state.focusChoice = 0; highlightChoice(); },
    onRingTiltRight: () => { state.focusChoice = 1; highlightChoice(); },
    onRingShake: () => confirmWearableChoice(),
    onCaneTap: () => advanceWearable(),
    onCaneSwingLeft: () => { state.focusChoice = 0; highlightChoice(); },
    onCaneSwingRight: () => { state.focusChoice = 1; highlightChoice(); },
  });
}

function highlightChoice() {
  document.querySelectorAll('[data-choice]').forEach((el, i) => {
    el.classList.toggle('focused', i === state.focusChoice);
  });
}

function confirmWearableChoice() {
  const step = state.step;
  if (step === 'acuity') {
    const gaps = [0, 90, 180, 270];
    answerAcuity(gaps[state.focusChoice % 4]);
  } else if (step === 'subjective') {
    pickSubjective(state.focusChoice === 0 ? 'A' : 'B');
  } else if (step === 'duochrome') {
    pickDuochrome(state.focusChoice === 0 ? 'red' : 'green');
  }
}

function advanceWearable() {
  if (state.step === 'acuity' && state.acuity[currentEye()]?.done) nextAcuityEye();
  else if (state.step === 'duochrome') nextDuochromeEye();
  else if (state.step === 'near' && state.nearSession?.done) finishNear();
}

async function toggleWearable() {
  if (!wearable) setupWearable();
  if (!state.wearableOn) {
    const ok = await wearable.requestPermission();
    if (!ok) { toast('传感器权限被拒绝'); return; }
    wearable.start();
    state.wearableOn = true;
    els.wearBtn.classList.add('on');
    toast('穿戴输入已启用');
  } else {
    wearable.stop();
    state.wearableOn = false;
    els.wearBtn.classList.remove('on');
    toast('穿戴输入已关闭');
  }
}

function bindElements() {
  [
    'toast', 'progressBar', 'progressLabel', 'calStatus', 'historyList',
    'cardSlider', 'cardPreview', 'cardPxLabel', 'calMethodCard', 'manualPpm',
    'distanceInput', 'acuityEye', 'acuityHint', 'landoltHost', 'acuityMeta', 'acuityNext',
    'astEye', 'astPhase', 'clockDial',
    'subjEye', 'subjPrompt', 'subjCompare', 'subjA', 'subjB', 'subjALabel', 'subjBLabel', 'subjNext',
    'duoEye', 'duoHint', 'duoNext',
    'nearHost', 'nearMeta', 'nearNext',
    'pdGuide', 'pdInput', 'rxOutput', 'wearBtn',
  ].forEach((id) => { els[id] = $(`#${id}`); });
}

function bindEvents() {
  $('#btnStart')?.addEventListener('click', startExam);
  $('#btnCalibrate')?.addEventListener('click', () => { showStep('calibrate'); renderCalibrate(); });
  $('#btnFinishCal')?.addEventListener('click', finishCalibration);
  els.cardSlider?.addEventListener('input', renderCalibrate);

  document.querySelectorAll('[data-gap]').forEach((btn) => {
    btn.addEventListener('click', () => answerAcuity(Number(btn.dataset.gap)));
  });
  els.acuityNext?.addEventListener('click', nextAcuityEye);

  $('#subjA')?.addEventListener('click', () => pickSubjective('A'));
  $('#subjB')?.addEventListener('click', () => pickSubjective('B'));
  els.subjNext?.addEventListener('click', () => {
    if (state.eyeIdx === 0) { state.eyeIdx = 1; renderSubjective(); }
    else startDuochrome();
  });

  $('#duoRed')?.addEventListener('click', () => pickDuochrome('red'));
  $('#duoGreen')?.addEventListener('click', () => pickDuochrome('green'));
  els.duoNext?.addEventListener('click', nextDuochromeEye);

  document.querySelectorAll('[data-near-gap]').forEach((btn) => {
    btn.addEventListener('click', () => answerNear(Number(btn.dataset.nearGap)));
  });
  els.nearNext?.addEventListener('click', finishNear);

  $('#btnSavePd')?.addEventListener('click', savePd);
  $('#btnCopyRx')?.addEventListener('click', copyRx);
  $('#btnHome')?.addEventListener('click', () => { showStep('home'); renderHome(); });

  els.wearBtn?.addEventListener('click', toggleWearable);

  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.nav;
      if (target === 'home') { showStep('home'); renderHome(); }
      else showStep(target);
    });
  });
}

function init() {
  bindElements();
  bindEvents();
  setupWearable();
  initFromStorage();
  renderCalibrate();
  renderHome();
  showStep('home');
}

document.addEventListener('DOMContentLoaded', init);
