/** Astigmatism screening — clock dial line clarity. */

export const CLOCK_HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export function hourToAxis(hour) {
  const h = ((Number(hour) % 12) + 12) % 12;
  return h === 0 ? 180 : (180 - h * 30 + 360) % 180;
}

export function axisToHour(axis) {
  const a = ((Number(axis) % 180) + 180) % 180;
  const hour = Math.round((180 - a) / 30) % 12;
  return hour === 0 ? 12 : hour;
}

export function estimateCylinder(clearestHour, blurriestHour) {
  if (clearestHour == null || blurriestHour == null) return 0;
  const diff = Math.abs(((clearestHour - blurriestHour + 6) % 12) - 6);
  const severity = diff / 6;
  if (severity < 0.25) return 0;
  if (severity < 0.5) return -0.25;
  if (severity < 0.75) return -0.5;
  return -0.75;
}

export function createAstigmatismResult(clearestHour, blurriestHour) {
  const axis = hourToAxis(clearestHour);
  const cyl = estimateCylinder(clearestHour, blurriestHour);
  return {
    clearestHour,
    blurriestHour,
    axis,
    cyl,
    note: cyl === 0 ? '未发现明显散光' : `散光约 ${Math.abs(cyl).toFixed(2)} D，轴位约 ${axis}°`,
  };
}

export function clockLineStyle(hour, lengthPx = 120, blurPx = 0) {
  const angle = (hour % 12) * 30 - 90;
  return {
    transform: `rotate(${angle}deg)`,
    width: `${lengthPx}px`,
    filter: blurPx ? `blur(${blurPx}px)` : 'none',
  };
}
