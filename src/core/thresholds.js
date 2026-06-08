// ──────────────────────────────────────────────────────────────────────────────
// Static thresholds (location-independent)
// ──────────────────────────────────────────────────────────────────────────────

// UV index
export const UV_MODERATE = 5; // above 5
export const UV_HIGH = 7; // above 7 — triggers sunscreen

// Apparent temperature (°C). Each constant is the *boundary* of a band:
//   t < TEMP_VERY_COLD          → very cold
//   TEMP_VERY_COLD ≤ t < TEMP_COLD → cold
//   TEMP_HOT < t ≤ TEMP_VERY_HOT   → hot
//   TEMP_VERY_HOT < t ≤ TEMP_BURN  → very hot
//   t > TEMP_BURN               → burn risk
export const TEMP_VERY_COLD = 8;
export const TEMP_COLD = 16;
export const TEMP_HOT = 30;
export const TEMP_VERY_HOT = 37;
export const TEMP_BURN = 42;

// Precipitation probability (%) — risk-tolerance triggers
export const PROB_LOW = 20; // < 20
export const PROB_MEDIUM = 50; // < 50
export const PROB_HIGH = 70; // > 70

// ──────────────────────────────────────────────────────────────────────────────
// Climatology-derived thresholds
//
// RAIN_* and WIND_HIGH are computed from 3 years of hourly archive data for the
// device's location. They start at sensible global defaults and are replaced
// once `loadClimatology({ latitude, longitude })` resolves. Importers reading
// the named bindings (e.g. `import { RAIN_LIGHT } from './thresholds'`) see the
// updated values automatically because ES module bindings are live.
// ──────────────────────────────────────────────────────────────────────────────

export const DEFAULT_RAIN_LIGHT = 0.5; // mm/hr — 25th pct of wet hours
export const DEFAULT_RAIN_MODERATE = 2; // mm/hr — 75th pct of wet hours
export const DEFAULT_RAIN_HEAVY = 5; // mm/hr — top of the wet-hour distribution
export const DEFAULT_WIND_HIGH = 40; // km/h  — 60th pct of all hours

export let RAIN_LIGHT = DEFAULT_RAIN_LIGHT;
export let RAIN_MODERATE = DEFAULT_RAIN_MODERATE;
export let RAIN_HEAVY = DEFAULT_RAIN_HEAVY;
export let WIND_HIGH = DEFAULT_WIND_HIGH;

// Snapshot accessor for callers that prefer to read by object rather than rely
// on live bindings (e.g. JSON logging).
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
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const WET_HOUR_MIN_MM = 0.1; // an hour with < 0.1mm is treated as dry

/**
 * Linear-interpolated percentile over a numerically sorted ascending array.
 * Returns null for empty input.
 */
export function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  if (p <= 0) return sortedAsc[0];
  if (p >= 100) return sortedAsc[sortedAsc.length - 1];
  const idx = ((p / 100) * (sortedAsc.length - 1));
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

/**
 * Pure: given hourly precipitation (mm/hr) and wind speed (km/h) arrays, derive
 * the climatology thresholds. Rain percentiles are taken over *wet* hours only
 * (≥ WET_HOUR_MIN_MM) — otherwise the long tail of dry hours collapses every
 * percentile to zero. Wind is over all hours.
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
  const RAIN_HEAVY_v = wet.length ? wet[wet.length - 1] : DEFAULT_RAIN_HEAVY;
  const WIND_HIGH_v = winds.length ? percentile(winds, 60) : DEFAULT_WIND_HIGH;

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

/**
 * Apply a computed climatology to the live module bindings. Returns the values
 * that were applied so callers can log/inspect.
 */
export function applyClimatology(c) {
  if (c?.RAIN_LIGHT != null) RAIN_LIGHT = c.RAIN_LIGHT;
  if (c?.RAIN_MODERATE != null) RAIN_MODERATE = c.RAIN_MODERATE;
  if (c?.RAIN_HEAVY != null) RAIN_HEAVY = c.RAIN_HEAVY;
  if (c?.WIND_HIGH != null) WIND_HIGH = c.WIND_HIGH;
  return getThresholds();
}

/**
 * Reset all climatology-derived thresholds back to module defaults. Mainly
 * useful for tests and for switching between cached locations.
 */
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

function readCache(lat, lon) {
  try {
    const raw = globalThis.localStorage?.getItem(cacheKey(lat, lon));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.computedAt || Date.now() - parsed.computedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(lat, lon, climatology) {
  try {
    globalThis.localStorage?.setItem(
      cacheKey(lat, lon),
      JSON.stringify({ ...climatology, computedAt: Date.now() })
    );
  } catch {
    // localStorage may be unavailable (Safari private mode, SSR) — ignore.
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Archive fetch
// ──────────────────────────────────────────────────────────────────────────────

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Fetch hourly precipitation + wind speed from the Open-Meteo archive for the
 * three years ending yesterday.
 */
export async function fetchArchive({ latitude, longitude, years = 3 } = {}) {
  const end = new Date();
  end.setDate(end.getDate() - 1); // archive is published with ~1 day lag
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - years);

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
    throw new Error(`Open-Meteo archive request failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return {
    precipitation: json?.hourly?.precipitation ?? [],
    windSpeed: json?.hourly?.wind_speed_10m ?? [],
    range: { start: isoDate(start), end: isoDate(end) },
  };
}

/**
 * Top-level entry point: load climatology-derived thresholds for a location.
 * Uses the localStorage cache (30 day TTL) when available and falls back to a
 * fresh archive fetch otherwise. The live bindings (RAIN_LIGHT, RAIN_MODERATE,
 * RAIN_HEAVY, WIND_HIGH) are updated as a side-effect.
 *
 * @param {object} params
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {boolean} [params.forceRefresh=false] — bypass the cache
 * @returns {Promise<ReturnType<typeof getThresholds> & { source: 'cache'|'network'|'default' }>}
 */
export async function loadClimatology({
  latitude,
  longitude,
  forceRefresh = false,
} = {}) {
  if (latitude == null || longitude == null) {
    return { ...getThresholds(), source: 'default' };
  }

  if (!forceRefresh) {
    const cached = readCache(latitude, longitude);
    if (cached) {
      applyClimatology(cached);
      return { ...getThresholds(), source: 'cache' };
    }
  }

  const { precipitation, windSpeed, range } = await fetchArchive({ latitude, longitude });
  const climatology = computeClimatology({ precipitation, windSpeed });
  writeCache(latitude, longitude, { ...climatology, range });
  applyClimatology(climatology);
  return { ...getThresholds(), source: 'network', meta: { ...climatology.meta, range } };
}
