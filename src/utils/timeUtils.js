// Pad helper for local ISO formatting
const pad = (n) => String(n).padStart(2, '0');

// Format a Date as an Open-Meteo hourly key: "YYYY-MM-DDTHH:00"
export function toHourKey(date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:00`
  );
}

// Parse "HH:MM" against a base date (defaults to today). Returns a Date in local TZ.
export function parseTimeOnDate(hhmm, baseDate = new Date()) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(baseDate);
  d.setHours(h, m || 0, 0, 0);
  return d;
}

/**
 * Returns an array of ISO hour strings (YYYY-MM-DDTHH:00) that overlap the
 * window [startTime, endTime). Accepts either Date objects or "HH:MM" strings;
 * for "HH:MM" strings the current local date is used.
 *
 * The window is inclusive of the start hour and inclusive of any hour the
 * window still overlaps (e.g. 17:00–19:00 → 17:00, 18:00).
 */
export function getHoursInWindow(startTime, endTime, baseDate = new Date()) {
  const start =
    typeof startTime === 'string' ? parseTimeOnDate(startTime, baseDate) : new Date(startTime);
  const end =
    typeof endTime === 'string' ? parseTimeOnDate(endTime, baseDate) : new Date(endTime);

  if (!(end > start)) return [];

  const hours = [];
  const cursor = new Date(start);
  cursor.setMinutes(0, 0, 0);

  while (cursor < end) {
    hours.push(toHourKey(cursor));
    cursor.setHours(cursor.getHours() + 1);
  }

  return hours;
}

// Returns the single hour object with the heaviest precipitation. Ties broken
// by higher precipitation_probability, then higher wind_speed_10m.
export function getWorstHour(hoursData) {
  if (!Array.isArray(hoursData) || hoursData.length === 0) return null;

  return hoursData.reduce((worst, h) => {
    if (!worst) return h;
    const dP = (h.precipitation ?? 0) - (worst.precipitation ?? 0);
    if (dP !== 0) return dP > 0 ? h : worst;
    const dProb = (h.precipitation_probability ?? 0) - (worst.precipitation_probability ?? 0);
    if (dProb !== 0) return dProb > 0 ? h : worst;
    const dWind = (h.wind_speed_10m ?? 0) - (worst.wind_speed_10m ?? 0);
    return dWind > 0 ? h : worst;
  }, null);
}

const AVG_FIELDS = [
  'precipitation_probability',
  'precipitation',
  'wind_speed_10m',
  'uv_index',
  'temperature_2m',
  'apparent_temperature',
];

/**
 * Weighted average across hours. With no explicit weights every hour is
 * equally weighted, so this collapses to a simple mean — callers can pass a
 * `weights` array to bias certain hours (e.g. the trip's exposure share).
 */
export function getWeightedAverage(hoursData, weights) {
  if (!Array.isArray(hoursData) || hoursData.length === 0) return null;

  const w = Array.isArray(weights) && weights.length === hoursData.length
    ? weights
    : hoursData.map(() => 1);

  const totalWeight = w.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return null;

  const out = { hour: hoursData[0].hour };
  for (const field of AVG_FIELDS) {
    let sum = 0;
    let count = 0;
    hoursData.forEach((h, i) => {
      const v = h[field];
      if (v != null && Number.isFinite(v)) {
        sum += v * w[i];
        count += w[i];
      }
    });
    out[field] = count > 0 ? sum / count : null;
  }
  return out;
}
