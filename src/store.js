const STORAGE_KEY = 'peijing.exams.v1';
const CAL_KEY = 'peijing.calibration.v1';

function uid() {
  return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeExam(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id: String(raw.id || uid()),
    createdAt: Number(raw.createdAt) || Date.now(),
    calibration: raw.calibration || null,
    od: raw.od || {},
    os: raw.os || {},
    pd: raw.pd != null ? Number(raw.pd) : null,
    add: raw.add != null ? Number(raw.add) : null,
    rxText: String(raw.rxText || ''),
    summary: String(raw.summary || ''),
  };
}

export function loadExams(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeExam).filter(Boolean);
  } catch {
    return [];
  }
}

export function saveExams(exams, storage = globalThis.localStorage) {
  const cleaned = (exams || []).map(normalizeExam).filter(Boolean);
  storage?.setItem?.(STORAGE_KEY, JSON.stringify(cleaned));
  return cleaned;
}

export function addExam(exams, payload) {
  const exam = normalizeExam({ ...payload, id: uid(), createdAt: Date.now() });
  if (!exam) return exams.slice();
  return [exam, ...exams];
}

export function removeExam(exams, id) {
  return exams.filter((e) => e.id !== id);
}

export function sortExams(exams) {
  return exams.slice().sort((a, b) => b.createdAt - a.createdAt);
}

export function loadCalibration(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(CAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCalibration(cal, storage = globalThis.localStorage) {
  storage?.setItem?.(CAL_KEY, JSON.stringify(cal));
}

export { STORAGE_KEY, CAL_KEY, uid };
