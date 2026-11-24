import { vaToSnellen, estimateSphereFromVa } from './acuity.js';
import { roundSph } from './subjective.js';

export function buildPrescription({
  od = {},
  os = {},
  pd = null,
  add = null,
  notes = '',
}) {
  return {
    od: normalizeEye(od),
    os: normalizeEye(os),
    pd: pd != null ? Number(pd) : null,
    add: add != null ? roundSph(Number(add)) : null,
    notes: String(notes || ''),
    generatedAt: Date.now(),
  };
}

function normalizeEye(eye) {
  return {
    sph: eye.sph != null ? roundSph(Number(eye.sph)) : null,
    cyl: eye.cyl != null ? roundCyl(Number(eye.cyl)) : null,
    axis: eye.axis != null ? Math.round(Number(eye.axis)) % 180 : null,
    va: eye.va != null ? Number(eye.va) : null,
    vaSnellen: eye.va != null ? vaToSnellen(Number(eye.va)) : null,
  };
}

export function roundCyl(v) {
  return Math.round(v / 0.25) * 0.25;
}

export function formatRxLine(eye, label) {
  const e = normalizeEye(eye);
  const parts = [label];
  parts.push(formatDiopter(e.sph, 'SPH'));
  if (e.cyl) parts.push(formatDiopter(e.cyl, 'CYL'));
  if (e.axis != null && e.cyl) parts.push(`× ${e.axis}°`);
  if (e.vaSnellen) parts.push(`VA ${e.vaSnellen}`);
  return parts.join('  ');
}

export function formatDiopter(v, label) {
  if (v == null || !Number.isFinite(v)) return `${label} —`;
  const sign = v > 0 ? '+' : '';
  return `${label} ${sign}${v.toFixed(2)}`;
}

export function formatPrescriptionText(rx) {
  const lines = [
    '════════ 配镜 · 自测处方 ════════',
    `日期：${new Date(rx.generatedAt).toLocaleString('zh-CN')}`,
    '',
    formatRxLine(rx.od, '右眼 OD'),
    formatRxLine(rx.os, '左眼 OS'),
  ];
  if (rx.pd != null) lines.push(`瞳距 PD：${rx.pd.toFixed(1)} mm`);
  if (rx.add) lines.push(`近用 ADD：+${rx.add.toFixed(2)} D`);
  if (rx.notes) lines.push('', `备注：${rx.notes}`);
  lines.push(
    '',
    '⚠ 本结果仅供配镜参考，不能替代执业验光师检查。',
    '如有眼痛、视物变形、突发视力下降，请立即就医。',
  );
  return lines.join('\n');
}

export function mergeEyeResults(acuity, astigmatism, subjective, duochrome) {
  let sph = subjective?.sph ?? estimateSphereFromVa(acuity?.thresholdVa ?? 1.0, 0);
  if (duochrome?.done) sph = duochrome.sph;
  return {
    sph,
    cyl: astigmatism?.cyl ?? 0,
    axis: astigmatism?.axis ?? null,
    va: acuity?.thresholdVa ?? null,
  };
}

export function pdGuideText() {
  return [
    '瞳距 PD 测量指南',
    '1. 面对镜子，用直尺横放在鼻梁上。',
    '2. 闭左眼，让右瞳孔中心对准 0 mm。',
    '3. 闭右眼，读取左瞳孔中心刻度。',
    '4. 成人常见 PD：54–74 mm（单眼约一半）。',
    '5. 也可请他人用直尺在 30 cm 外测量两瞳孔间距。',
  ].join('\n');
}

export function validatePd(mm) {
  const v = Number(mm);
  if (!Number.isFinite(v)) return { ok: false, msg: '请输入有效数字' };
  if (v < 50 || v > 80) return { ok: false, msg: 'PD 通常在 50–80 mm，请复核' };
  return { ok: true, value: v };
}

export const MEDICAL_DISCLAIMER =
  '本应用提供在家视力筛查与配镜参考，不能替代执业眼科/验光师的专业检查。结果受环境光、屏幕质量、配合度影响。';
