/** Subjective refraction — A/B blur comparison & duochrome fine-tune. */

export const SPH_RANGE = { min: -8, max: 4, step: 0.25 };
export const CYL_RANGE = { min: -2, max: 0, step: 0.25 };

/** Approximate CSS blur px per diopter at ~40cm (screen simulation). */
export function diopterToBlurPx(diopters, distanceCm = 40) {
  const d = Math.abs(diopters);
  const scale = distanceCm / 40;
  return d * 1.2 * scale;
}

export function blurPxToDiopter(blurPx, distanceCm = 40) {
  const scale = distanceCm / 40;
  return blurPx / (1.2 * scale);
}

export function createSubjectiveSession(eye = 'OD', startSph = 0) {
  return {
    eye,
    phase: 'sphere',
    sph: startSph,
    cyl: 0,
    axis: 0,
    lowSph: SPH_RANGE.min,
    highSph: SPH_RANGE.max,
    trials: [],
    done: false,
  };
}

export function applySphereChoice(session, preferSharper) {
  const mid = session.sph;
  if (session.phase === 'sphere') {
    if (preferSharper === 'A') {
      session.highSph = mid;
      session.sph = roundSph((session.lowSph + mid) / 2);
    } else {
      session.lowSph = mid;
      session.sph = roundSph((mid + session.highSph) / 2);
    }
    session.trials.push({ phase: 'sphere', sph: session.sph, choice: preferSharper });
    if (Math.abs(session.highSph - session.lowSph) <= SPH_RANGE.step) {
      session.sph = preferSharper === 'A' ? session.highSph : session.lowSph;
      session.phase = 'done';
      session.done = true;
    }
  }
  return session;
}

export function roundSph(v) {
  return Math.round(v / SPH_RANGE.step) * SPH_RANGE.step;
}

export function createDuochromeSession(currentSph) {
  return {
    sph: currentSph,
    redClearer: 0,
    greenClearer: 0,
    trials: 0,
    done: false,
  };
}

/**
 * Duochrome: red clearer → increase minus; green clearer → increase plus.
 * Returns adjusted sphere after user picks side.
 */
export function recordDuochromeChoice(session, side) {
  if (side === 'red') session.redClearer += 1;
  else session.greenClearer += 1;
  session.trials += 1;

  if (session.trials >= 3) {
    session.done = true;
    if (session.redClearer > session.greenClearer) {
      session.sph = roundSph(session.sph - 0.25);
    } else if (session.greenClearer > session.redClearer) {
      session.sph = roundSph(session.sph + 0.25);
    }
  }
  return session;
}

export function nearAddFromAge(age) {
  if (!age || age < 40) return 0;
  if (age < 45) return 0.75;
  if (age < 50) return 1.0;
  if (age < 55) return 1.25;
  if (age < 60) return 1.5;
  return 2.0;
}

export function estimateNearAdd(nearVa, distanceCm = 40) {
  if (nearVa >= 1.0) return 0;
  const logMar = -Math.log10(Math.max(0.05, nearVa));
  const add = Math.max(0, (logMar - 0.1) * 0.8);
  return Math.round(add * 4) / 4;
}

export function compareBlurOptions(baseSph, distanceCm = 40) {
  const aSph = baseSph - 0.25;
  const bSph = baseSph + 0.25;
  return {
    A: { sph: aSph, blur: diopterToBlurPx(-aSph, distanceCm) },
    B: { sph: bSph, blur: diopterToBlurPx(-bSph, distanceCm) },
  };
}
