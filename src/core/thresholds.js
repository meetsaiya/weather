// ──────────────────────────────────────────────────────────────────────────────
// Static thresholds (location-independent)
// ──────────────────────────────────────────────────────────────────────────────

// UV index (WHO scale — physiological, not local)
export const UV_MODERATE = 5; // above 5
export const UV_HIGH = 7; // above 7 — triggers sunscreen

// Apparent temperature (°C). Each constant is the *boundary* of a band:
//   t < TEMP_VERY_COLD          → very cold
//   TEMP_VERY_COLD ≤ t < TEMP_COLD → cold
//   TEMP_HOT < t ≤ TEMP_VERY_HOT   → hot
//   TEMP_VERY_HOT < t ≤ TEMP_BURN  → very hot
//   t > TEMP_BURN               → burn risk
// Kept absolute because human physiology doesn't care about local norms.
export const TEMP_VERY_COLD = 8;
export const TEMP_COLD = 16;
export const TEMP_HOT = 30;
export const TEMP_VERY_HOT = 37;
export const TEMP_BURN = 42;

// Precipitation probability (%) — risk-tolerance triggers
export const PROB_LOW = 20; // < 20
export const PROB_MEDIUM = 50; // < 50
export const PROB_HIGH = 70; // > 70

// Hard ceiling on the effective probability bar after the monsoon multiplier
// is applied. Without this, a low-risk-tolerance user (probBar=70) in a
// monsoon region (multiplier=0.7) would need rawProb > 100%, which is
// impossible — silently disabling all umbrella recommendations for the
// season. See ALGORITHM_FLOW.md §2e.
export const PROB_BAR_MAX = 60;

// getWorstHour eligibility floor: an hour with very low rain probability
// shouldn't outrank a moderate-probability hour just because its precipitation
// number is bigger. Hours below this floor fall to the fallback pool.
export const WORST_HOUR_PROB_FLOOR = 30;

// ──────────────────────────────────────────────────────────────────────────────
// Seasonal climatology-derived thresholds
//
// RAIN_* and WIND_HIGH are computed from a ±7-day window around today's
// calendar date, pulled across the last 10 years (~3,700 hours of in-season
// hourly data per location). This calibrates "high" against what's actually
// normal *for this time of year* — Mumbai-June, not Mumbai-annual.
//
// Start at sensible global defaults and are replaced once
// `loadClimatology({ latitude, longitude })` resolves. ES module bindings are
// live so importers reading the named exports see updates automatically.
// ──────────────────────────────────────────────────────────────────────────────

export const DEFAULT_RAIN_LIGHT = 0.5; // mm/hr
export const DEFAULT_RAIN_MODERATE = 2;
export const DEFAULT_RAIN_HEAVY = 8;
export const DEFAULT_WIND_HIGH = 30; // km/h

export let RAIN_LIGHT = DEFAULT_RAIN_LIGHT;
export let RAIN_MODERATE = DEFAULT_RAIN_MODERATE;
export let RAIN_HEAVY = DEFAULT_RAIN_HEAVY;
export let WIND_HIGH = DEFAULT_WIND_HIGH;

// Snapshot accessor for callers that prefer to read by object.
export function getThresholds() {
  return {
    RAIN_LIGHT,
    RAIN_MODERATE,
    RAIN_HEAVY,
    WIND_HIGH,
    UV_MODERATE,
    UV_HIGH,
    TEMP_VERY_COLD,
    TEMP_COLD,
    TEMP_HOT,
    TEMP_VERY_HOT,
    TEMP_BURN,
    PROB_LOW,
    PROB_MEDIUM,
    PROB_HIGH,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Climatology computation
// ──────────────────────────────────────────────────────────────────────────────

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const CACHE_KEY_PREFIX = 'ww_climatology:';
const CACHE_TTL_DAYS = 7;
const SEASONAL_YEARS = 10;
const SEASONAL_WINDOW_DAYS = 7; // ±7 days around today's calendar date (was ±15)
const WET_HOUR_MIN_MM = 0.1; // an hour with < 0.1mm is treated as dry

/**
 * Linear-interpolated percentile over a numerically sorted ascending array.
 * Returns null for empty input.
 */
export function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  if (p <= 0) return sortedAsc[0];
  if (p >= 100) return sortedAsc[sortedAsc.length - 1];
  const idx = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

/**
 * Pure: given hourly precipitation (mm/hr) and wind speed (km/h) arrays from
 * the seasonal window, derive the climatology thresholds.
 *
 *   RAIN_LIGHT    = p25 of wet hours (≥ 0.1 mm/hr)
 *   RAIN_MODERATE = p75 of wet hours
 *   RAIN_HEAVY    = p95 of wet hours    (no longer max — a single freak storm
 *                                        shouldn't define "heavy")
 *   WIND_HIGH     = p90 of all hours    (was p60 — too sensitive)
 *
 * Wet hours filtered because the long tail of dry hours otherwise collapses
 * every rain percentile to zero.
 */
export function computeClimatology({ precipitation = [], windSpeed = [] } = {}) {
  const wet = precipitation
    .filter((v) => v != null && Number.isFinite(v) && v >= WET_HOUR_MIN_MM)
    .sort((a, b) => a - b);
  const winds = windSpeed
    .filter((v) => v != null && Number.isFinite(v))
    .sort((a, b) => a - b);

  const RAIN_LIGHT_v = wet.length ? percentile(wet, 25) : DEFAULT_RAIN_LIGHT;
  const RAIN_MODERATE_v = wet.length ? percentile(wet, 75) : DEFAULT_RAIN_MODERATE;
  const RAIN_HEAVY_v = wet.length ? percentile(wet, 95) : DEFAULT_RAIN_HEAVY;
  const WIND_HIGH_v = winds.length ? percentile(winds, 90) : DEFAULT_WIND_HIGH;

  return {
    RAIN_LIGHT: round2(RAIN_LIGHT_v),
    RAIN_MODERATE: round2(RAIN_MODERATE_v),
    RAIN_HEAVY: round2(RAIN_HEAVY_v),
    WIND_HIGH: round2(WIND_HIGH_v),
    meta: {
      wetHourCount: wet.length,
      totalHourCount: winds.length,
    },
  };
}

function round2(n) {
  return n == null ? n : Math.round(n * 100) / 100;
}

export function applyClimatology(c) {
  if (c?.RAIN_LIGHT != null) RAIN_LIGHT = c.RAIN_LIGHT;
  if (c?.RAIN_MODERATE != null) RAIN_MODERATE = c.RAIN_MODERATE;
  if (c?.RAIN_HEAVY != null) RAIN_HEAVY = c.RAIN_HEAVY;
  if (c?.WIND_HIGH != null) WIND_HIGH = c.WIND_HIGH;
  return getThresholds();
}

export function resetClimatology() {
  RAIN_LIGHT = DEFAULT_RAIN_LIGHT;
  RAIN_MODERATE = DEFAULT_RAIN_MODERATE;
  RAIN_HEAVY = DEFAULT_RAIN_HEAVY;
  WIND_HIGH = DEFAULT_WIND_HIGH;
  return getThresholds();
}

// ──────────────────────────────────────────────────────────────────────────────
// Cache (localStorage)
// ──────────────────────────────────────────────────────────────────────────────

const cacheKey = (lat, lon) =>
  `${CACHE_KEY_PREFIX}${lat.toFixed(2)},${lon.toFixed(2)}`;

const DAY_MS = 24 * 60 * 60 * 1000;

function readCache(lat, lon, { today = new Date(), allowStale = false } = {}) {
  try {
    const raw = globalThis.localStorage?.getItem(cacheKey(lat, lon));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.computedAt || !parsed?.centerDate) return null;

    const centerMs = new Date(parsed.centerDate + 'T00:00:00').getTime();
    const daysFromCenter = Math.abs(today.getTime() - centerMs) / DAY_MS;
    const isStale = daysFromCenter > CACHE_TTL_DAYS;
    if (isStale && !allowStale) return null;

    return { ...parsed, daysFromCenter, isStale, ageMs: Date.now() - parsed.computedAt };
  } catch {
    return null;
  }
}

function writeCache(lat, lon, climatology, today = new Date()) {
  try {
    globalThis.localStorage?.setItem(
      cacheKey(lat, lon),
      JSON.stringify({
        ...climatology,
        computedAt: Date.now(),
        centerDate: isoDate(today),
      })
    );
  } catch {
    // localStorage unavailable (Safari private mode, SSR) — ignore.
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Archive fetch — seasonal: 10 parallel ±15-day windows
// ──────────────────────────────────────────────────────────────────────────────

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function fetchOneWindow({ latitude, longitude, start, end }) {
  const url = new URL(ARCHIVE_URL);
  url.searchParams.set('latitude', latitude);
  url.searchParams.set('longitude', longitude);
  url.searchParams.set('start_date', isoDate(start));
  url.searchParams.set('end_date', isoDate(end));
  url.searchParams.set('hourly', 'precipitation,wind_speed_10m');
  url.searchParams.set('wind_speed_unit', 'kmh');
  url.searchParams.set('precipitation_unit', 'mm');
  url.searchParams.set('timezone', 'auto');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(
      `Open-Meteo archive ${isoDate(start)}..${isoDate(end)}: ${res.status} ${res.statusText}`
    );
  }
  const json = await res.json();
  return {
    precipitation: json?.hourly?.precipitation ?? [],
    windSpeed: json?.hourly?.wind_speed_10m ?? [],
  };
}

/**
 * Fetch a seasonal hourly archive: for each of the last `SEASONAL_YEARS`
 * years, a 31-day window centered on the same calendar day as `today`.
 *
 * Requests run in parallel. The archive publishes with ~1 day lag, so any
 * portion of a window that falls after yesterday is clamped or skipped.
 *
 * Total transit budget: ~10 × 31 days × 2 fields = ~15k floats, roughly
 * 300 KB across all 10 responses.
 *
 * Leap-year edge case: when today is Feb 29 and a target year is non-leap,
 * `setFullYear` shifts to Mar 1. One-day drift is acceptable for climatology.
 */
export async function fetchSeasonalArchive({
  latitude,
  longitude,
  today = new Date(),
  years = SEASONAL_YEARS,
  windowDays = SEASONAL_WINDOW_DAYS,
} = {}) {
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);

  const requests = [];
  const yearsCovered = [];
  for (let y = 1; y <= years; y++) {
    const center = new Date(today);
    center.setFullYear(today.getFullYear() - y);
    const start = new Date(center);
    start.setDate(center.getDate() - windowDays);
    const end = new Date(center);
    end.setDate(center.getDate() + windowDays);

    if (start > yesterday) continue; // whole window in the future
    const clampedEnd = end > yesterday ? new Date(yesterday) : end;

    yearsCovered.push(center.getFullYear());
    requests.push(fetchOneWindow({ latitude, longitude, start, end: clampedEnd }));
  }

  // Partial-failure tolerance: if some windows 404 or 429, still compute over
  // whatever did succeed. A bad fetch shouldn't take down the climatology.
  const settled = await Promise.allSettled(requests);
  const failures = settled.filter((s) => s.status === 'rejected');
  const successes = settled.filter((s) => s.status === 'fulfilled');

  if (successes.length === 0) {
    throw new Error(
      `All ${requests.length} seasonal archive requests failed; first error: ${failures[0]?.reason?.message ?? 'unknown'}`
    );
  }

  const precipitation = successes.flatMap((s) => s.value.precipitation);
  const windSpeed = successes.flatMap((s) => s.value.windSpeed);

  return {
    precipitation,
    windSpeed,
    range: {
      centerMMDD: isoDate(today).slice(5), // MM-DD
      windowDays: windowDays * 2 + 1,
      yearsCovered,
      requestsAttempted: requests.length,
      requestsSucceeded: successes.length,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Public entry points
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Production entry point: non-blocking. Off the critical path.
 *
 * Synchronously applies any cached climatology (even past TTL) so the current
 * session uses location-aware thresholds when possible. If the cache is
 * missing or its center date is more than 7 days from today, a background
 * fetch is kicked off — the result is written to the cache for the *next*
 * session, but is NOT applied to the current session to avoid a mid-session
 * threshold flip.
 *
 * @returns {{ source: 'cache'|'cache-stale'|'default', ageMs?: number, daysFromCenter?: number, refreshing: boolean }}
 */
export function bootClimatology({ latitude, longitude } = {}) {
  if (latitude == null || longitude == null) {
    return { source: 'default', refreshing: false };
  }

  const today = new Date();
  const cached = readCache(latitude, longitude, { today, allowStale: true });
  if (cached) applyClimatology(cached);

  const needsRefresh = !cached || cached.isStale;
  if (needsRefresh) refreshInBackground({ latitude, longitude, today });

  return {
    source: cached ? (cached.isStale ? 'cache-stale' : 'cache') : 'default',
    ...(cached ? { ageMs: cached.ageMs, daysFromCenter: cached.daysFromCenter } : {}),
    refreshing: needsRefresh,
  };
}

function refreshInBackground({ latitude, longitude, today }) {
  fetchSeasonalArchive({ latitude, longitude, today })
    .then(({ precipitation, windSpeed, range }) => {
      const climatology = computeClimatology({ precipitation, windSpeed });
      writeCache(latitude, longitude, { ...climatology, range }, today);
    })
    .catch((err) => {
      console.warn('[WeatherWise] background climatology refresh failed:', err?.message ?? err);
    });
}

/**
 * Awaitable variant. Fetches, caches, and applies climatology in one go.
 * Used by dev tooling and tests; production should call `bootClimatology()`.
 */
export async function loadClimatology({
  latitude,
  longitude,
  forceRefresh = false,
} = {}) {
  if (latitude == null || longitude == null) {
    return { ...getThresholds(), source: 'default' };
  }

  const today = new Date();
  if (!forceRefresh) {
    const cached = readCache(latitude, longitude, { today });
    if (cached) {
      applyClimatology(cached);
      return {
        ...getThresholds(),
        source: 'cache',
        meta: { range: cached.range, daysFromCenter: cached.daysFromCenter },
      };
    }
  }

  const { precipitation, windSpeed, range } = await fetchSeasonalArchive({
    latitude,
    longitude,
    today,
  });
  const climatology = computeClimatology({ precipitation, windSpeed });
  writeCache(latitude, longitude, { ...climatology, range }, today);
  applyClimatology(climatology);
  return { ...getThresholds(), source: 'network', meta: { ...climatology.meta, range } };
}
