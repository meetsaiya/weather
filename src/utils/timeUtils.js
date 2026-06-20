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

/**
 * Returns the hour representing the "worst" conditions in the window for a
 * cautious user. Ranks by *expected precipitation* (`precipitation × prob/100`)
 * over hours that clear a probability floor — a 10 mm/hr forecast at 5%
 * probability shouldn't outrank a 2 mm/hr forecast at 75% probability.
 *
 * Hours below the probability floor are excluded as candidates; if no hour
 * clears the floor (dry window), we fall back to the full pool so we still
 * return something — and tiebreak on wind so dry-but-windy windows still
 * surface the gust hour for the cautious-user pipeline.
 *
 * Tiebreak (when expected-rain scores match — typically all zeros on a dry
 * window) is by wind speed, preserving the wind-driven worst-hour signal.
 */
export function getWorstHour(hoursData, probFloorPct = 30) {
  if (!Array.isArray(hoursData) || hoursData.length === 0) return null;

  const eligible = hoursData.filter(
    (h) => (h.precipitation_probability ?? 0) >= probFloorPct
  );
  const pool = eligible.length > 0 ? eligible : hoursData;
  const score = (h) =>
    (h.precipitation ?? 0) * ((h.precipitation_probability ?? 0) / 100);

  return pool.reduce((worst, h) => {
    if (!worst) return h;
    const dScore = score(h) - score(worst);
    if (dScore !== 0) return dScore > 0 ? h : worst;
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
