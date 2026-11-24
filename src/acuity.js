/** Visual acuity — ISO 8596 Landolt C, adaptive staircase. */

const DEG_PER_ARCMIN = Math.PI / (180 * 60);

/** Decimal VA levels used in staircase (approx logMAR steps). */
export const VA_LEVELS = [
  0.05, 0.063, 0.08, 0.1, 0.125, 0.16, 0.2, 0.25, 0.32, 0.4, 0.5, 0.63, 0.8, 1.0, 1.25, 1.6, 2.0,
];

export const LANDOLT_GAPS = [0, 90, 180, 270]; // deg: right, down, left, up

/**
 * Optotype outer diameter in mm at given distance & decimal VA (ISO 8596 ~5 arcmin @ 1.0).
 */
export function optotypeDiameterMm(distanceCm, decimalVa) {
  const dM = distanceCm / 100;
  const va = Math.max(0.02, decimalVa);
  const angleRad = (5 * DEG_PER_ARCMIN) / va;
  return dM * 1000 * Math.tan(angleRad);
}

export function vaToSnellen(decimalVa) {
  const denom = Math.round(20 / Math.max(0.02, decimalVa));
  return `20/${denom}`;
}

export function vaToLogMar(decimalVa) {
  return -Math.log10(Math.max(0.02, decimalVa));
}

export function logMarToVa(logMar) {
  return Math.pow(10, -logMar);
}

export function estimateSphereFromVa(decimalVa, baseline = 0) {
  if (decimalVa >= 1.0) return baseline;
  const logMar = vaToLogMar(decimalVa);
  const est = baseline - logMar * 0.75;
  return Math.round(est * 4) / 4;
}

export function createAcuitySession(eye = 'OD') {
  return {
    eye,
    levelIdx: VA_LEVELS.indexOf(0.5) >= 0 ? VA_LEVELS.indexOf(0.5) : 8,
    direction: 1,
    reversals: 0,
    lastCorrect: null,
    trials: [],
    thresholdVa: null,
    done: false,
  };
}

export function randomGap() {
  return LANDOLT_GAPS[Math.floor(Math.random() * LANDOLT_GAPS.length)];
}

export function recordAcuityAnswer(session, gapDeg, answerDeg) {
  const correct = gapDeg === answerDeg;
  const va = VA_LEVELS[session.levelIdx];
  session.trials.push({ va, correct, gapDeg, answerDeg });

  if (correct) {
    if (session.direction === -1) session.reversals += 1;
    session.direction = 1;
    session.levelIdx = Math.min(VA_LEVELS.length - 1, session.levelIdx + 1);
  } else {
    if (session.direction === 1) session.reversals += 1;
    session.direction = -1;
    session.levelIdx = Math.max(0, session.levelIdx - 1);
  }

  session.lastCorrect = correct;

  if (session.reversals >= 3 || session.levelIdx === 0 || session.levelIdx === VA_LEVELS.length - 1) {
    session.done = true;
    const lastTrials = session.trials.filter((t) => t.correct).slice(-3);
    const avg = lastTrials.length
      ? lastTrials.reduce((s, t) => s + t.va, 0) / lastTrials.length
      : va;
    session.thresholdVa = avg;
  }

  return session;
}

export function landoltSvg(sizePx, gapDeg, strokeRatio = 0.2) {
  const stroke = sizePx * strokeRatio;
  const r = (sizePx - stroke) / 2;
  const cx = sizePx / 2;
  const cy = sizePx / 2;
  const rad = (gapDeg * Math.PI) / 180;
  const gapArc = Math.PI / 4.5;
  const start = rad + gapArc / 2;
  const end = start + Math.PI * 2 - gapArc;
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const large = 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${sizePx} ${sizePx}" aria-hidden="true">
    <path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round"/>
  </svg>`;
}
