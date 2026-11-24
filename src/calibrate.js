/** Distance calibration — credit card (85.6 mm) or manual cm. */

export const CARD_WIDTH_MM = 85.6;

export const DEFAULT_DISTANCE_CM = 250;
export const NEAR_DISTANCE_CM = 40;

export function pxPerMmFromCard(cardPxWidth) {
  if (!cardPxWidth || cardPxWidth <= 0) return null;
  return cardPxWidth / CARD_WIDTH_MM;
}

export function mmToCssPx(mm, pxPerMm) {
  if (!pxPerMm || pxPerMm <= 0) return 0;
  return mm * pxPerMm;
}

export function createCalibration({ method, cardPxWidth, pxPerMm, distanceCm }) {
  const ppm = method === 'card'
    ? pxPerMmFromCard(cardPxWidth)
    : Number(pxPerMm);

  return {
    method: method === 'card' ? 'card' : 'manual',
    cardPxWidth: cardPxWidth || null,
    pxPerMm: ppm && ppm > 0 ? ppm : null,
    distanceCm: Number(distanceCm) > 0 ? Number(distanceCm) : DEFAULT_DISTANCE_CM,
    calibratedAt: Date.now(),
  };
}

export function isCalibrationValid(cal) {
  return Boolean(cal?.pxPerMm && cal.pxPerMm > 0 && cal.distanceCm > 0);
}

export function formatDistance(cm) {
  if (cm >= 100) return `${(cm / 100).toFixed(1)} m`;
  return `${Math.round(cm)} cm`;
}
