import { fetchHourlyWeather, sliceHoursByKeys } from './core/weatherEngine.js';
import { getHoursInWindow, getWorstHour, getWeightedAverage } from './utils/timeUtils.js';
import {
  bootClimatology,
  loadClimatology,
  getThresholds,
  applyClimatology,
} from './core/thresholds.js';
import { aggregateExposure } from './core/exposureEngine.js';
import { generateRecommendations } from './core/recommendEngine.js';
import { generatePlainEnglish } from './core/plainEnglish.js';

const MUMBAI = { latitude: 19.076, longitude: 72.877, label: 'Mumbai' };

// Spread of climates: monsoon, oceanic, mediterranean, desert, equatorial,
// subarctic, humid continental, humid subtropical. Pick by key in the helpers
// below or pass a custom { latitude, longitude, label }.
export const CITY_PRESETS = {
  mumbai:     { latitude:  19.076, longitude:  72.877, label: 'Mumbai' },
  london:     { latitude:  51.507, longitude:  -0.128, label: 'London' },
  sydney:     { latitude: -33.867, longitude: 151.207, label: 'Sydney' },
  phoenix:    { latitude:  33.448, longitude:-112.074, label: 'Phoenix' },
  singapore:  { latitude:   1.352, longitude: 103.820, label: 'Singapore' },
  reykjavik:  { latitude:  64.146, longitude: -21.942, label: 'Reykjavik' },
  newyork:    { latitude:  40.713, longitude: -74.006, label: 'New York' },
  tokyo:      { latitude:  35.689, longitude: 139.692, label: 'Tokyo' },
  losangeles: { latitude:  34.052, longitude:-118.244, label: 'Los Angeles' },
  cairo:      { latitude:  30.044, longitude:  31.236, label: 'Cairo' },
};

/**
 * Dev-only smoke test. Fetches Mumbai weather and extracts the slice for
 * 17:00–19:00 today, logging the worst-hour and weighted-average aggregations.
 */
export async function testWeatherSlice() {
  console.info('[testWeatherSlice] fetching Open-Meteo for', MUMBAI.label, '…');

  const hourly = await fetchHourlyWeather({
    latitude: MUMBAI.latitude,
    longitude: MUMBAI.longitude,
  });

  const hourKeys = getHoursInWindow('17:00', '19:00');
  const slice = sliceHoursByKeys(hourly, hourKeys);

  const result = {
    location: MUMBAI,
    window: { start: '17:00', end: '19:00' },
    hourKeys,
    slice,
    worstHour: getWorstHour(slice),
    weightedAverage: getWeightedAverage(slice),
  };

  console.group('[testWeatherSlice] result');
  console.log('hour keys:', hourKeys);
  console.table(slice);
  console.log('worst hour:', result.worstHour);
  console.log('weighted average:', result.weightedAverage);
  console.groupEnd();

  return result;
}

/**
 * Dev-only smoke test for climatology-derived thresholds. Forces a synchronous
 * fetch of 2 years of Mumbai history (or reads from cache) and logs the
 * resulting rain/wind climatology values alongside the static thresholds.
 */
export async function testThresholds() {
  console.info('[testThresholds] loading climatology for', MUMBAI.label, '…');
  const result = await loadClimatology({
    latitude: MUMBAI.latitude,
    longitude: MUMBAI.longitude,
  });
  console.group('[testThresholds] result');
  console.log('source:', result.source, result.meta ?? '');
  console.table(getThresholds());
  console.groupEnd();
  return result;
}

/**
 * Dev-only smoke test for the recommendation pipeline. Uses the canonical
 * scenario from Session 2:
 *
 *   - Window 17:00–19:00, 20-minute trip, consequenceLevel: 'high'
 *   - Mock weather: 65% rain prob, 3 mm/hr, 45 km/h wind
 *
 * Expected: raincoat carried, umbrella suppressed by the wind conflict.
 */
export function testRecommendations() {
  console.info('[testRecommendations] running canonical Session 2 scenario …');

  const mockAggregated = {
    hour: '2026-06-08T17:00',
    precipitation_probability: 65,
    precipitation: 3,
    wind_speed_10m: 45,
    uv_index: 2,
    temperature_2m: 24,
    apparent_temperature: 25,
  };

  const recs = generateRecommendations({
    aggregated: mockAggregated,
    consequenceLevel: 'high',
    tripDurationMins: 20,
  });

  const english = generatePlainEnglish(recs, 'evening commute');

  console.group('[testRecommendations] result');
  console.table(recs);
  console.log('plain English:', english.summary);
  console.groupEnd();

  const umbrella = recs.find((r) => r.item === 'umbrella');
  const raincoat = recs.find((r) => r.item === 'raincoat');
  const ok = umbrella?.carry === false && raincoat?.carry === true;
  if (ok) console.info('[testRecommendations] ✓ raincoat carried, umbrella suppressed');
  else console.warn('[testRecommendations] ✗ unexpected output');

  return { recommendations: recs, plainEnglish: english, passed: ok };
}

function getDeviceLocation() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation not supported in this environment.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          label: 'Device location',
          accuracyMeters: pos.coords.accuracy,
        }),
      (err) => reject(new Error(`Geolocation failed: ${err.message}`)),
      { timeout: 10000, enableHighAccuracy: false }
    );
  });
}

/**
 * End-to-end: live forecast → exposure → recommendations for a chosen region.
 * Loads the climatology for that region first so thresholds are
 * location-appropriate before recommendations fire.
 *
 *   await testRecommendationsLive()              // device geolocation
 *   await testRecommendationsLive('london')      // preset
 *   await testRecommendationsLive('Phoenix')
 *   await testRecommendationsLive(35.689, 139.692, 'Tokyo')
 *   await testRecommendationsLive({ latitude: 48.86, longitude: 2.35, label: 'Paris' })
 */
export async function testRecommendationsLive(arg, lon, label) {
  let loc;
  if (arg == null) {
    console.info('[testRecommendationsLive] no location given — requesting device location …');
    loc = await getDeviceLocation();
    console.info('[testRecommendationsLive] device location:', loc);
  } else {
    loc = resolveLocation(arg, lon, label);
  }

  console.info('[testRecommendationsLive] loading climatology for', loc.label, '…');
  await loadClimatology({ latitude: loc.latitude, longitude: loc.longitude });

  console.info('[testRecommendationsLive] fetching live forecast for', loc.label, '…');
  const hourly = await fetchHourlyWeather({ latitude: loc.latitude, longitude: loc.longitude });

  const userWindow = {
    startTime: '17:00',
    endTime: '19:00',
    tripDurationMins: 20,
    consequenceLevel: 'medium',
  };
  const exposure = aggregateExposure({ userWindow, hourlyWeatherArray: hourly });
  const recs = generateRecommendations({
    aggregated: exposure.aggregatedWeather,
    consequenceLevel: exposure.consequenceLevel,
    tripDurationMins: userWindow.tripDurationMins,
    location: { latitude: loc.latitude, longitude: loc.longitude },
  });
  const english = generatePlainEnglish(recs, 'evening commute');

  console.group(`[testRecommendationsLive] ${loc.label}`);
  console.log('window:', userWindow);
  console.log('aggregated:', exposure.aggregatedWeather);
  console.log('thresholds in use:', getThresholds());
  console.table(recs);
  console.log('plain English:', english.summary);
  console.groupEnd();

  return { location: loc, exposure, recommendations: recs, plainEnglish: english };
}

function resolveLocation(arg, lon, label) {
  if (arg == null) return MUMBAI;
  if (typeof arg === 'string') {
    const preset = CITY_PRESETS[arg.toLowerCase().replace(/\s+/g, '')];
    if (!preset) {
      throw new Error(
        `Unknown preset "${arg}". Try one of: ${Object.keys(CITY_PRESETS).join(', ')} — or pass (lat, lon).`
      );
    }
    return preset;
  }
  if (typeof arg === 'object') {
    return { latitude: arg.latitude, longitude: arg.longitude, label: arg.label ?? `${arg.latitude},${arg.longitude}` };
  }
  if (typeof arg === 'number' && typeof lon === 'number') {
    return { latitude: arg, longitude: lon, label: label ?? `${arg},${lon}` };
  }
  throw new Error('Expected a preset name, a {latitude, longitude} object, or (lat, lon) numbers.');
}

/**
 * Climatology for any region. Examples in the console:
 *
 *   await testThresholdsFor('london')
 *   await testThresholdsFor('Phoenix')
 *   await testThresholdsFor(35.689, 139.692, 'Tokyo')
 *   await testThresholdsFor({ latitude: 48.86, longitude: 2.35, label: 'Paris' })
 *
 * Side-effect: live rain/wind bindings flip to this region's values
 * (cached per (lat, lon) so subsequent calls are instant). The previous
 * thresholds are returned in `restorePrevious` for callers who want to swap
 * back.
 */
export async function testThresholdsFor(arg, lon, label) {
  const loc = resolveLocation(arg, lon, label);
  const previous = getThresholds();
  console.info('[testThresholdsFor] loading climatology for', loc.label, '…');

  const result = await loadClimatology({ latitude: loc.latitude, longitude: loc.longitude });

  console.group(`[testThresholdsFor] ${loc.label}`);
  console.log('source:', result.source);
  if (result.meta) console.log('meta:', result.meta);
  console.table(getThresholds());
  console.groupEnd();

  return {
    location: loc,
    ...result,
    restorePrevious: () => applyClimatology(previous),
  };
}

/**
 * Side-by-side climatology comparison across multiple regions. Useful for
 * sanity-checking that the seasonal calibration produces sensible values
 * across diverse climates.
 *
 *   await testThresholdsCompare()                       // default 5 cities
 *   await testThresholdsCompare(['mumbai','london','phoenix','reykjavik'])
 *
 * Cities are processed sequentially (10 windows × N cities would otherwise
 * fan out to a lot of parallel requests). Live thresholds are restored to
 * the pre-compare snapshot when done.
 */
export async function testThresholdsCompare(
  presets = ['mumbai', 'london', 'sydney', 'phoenix', 'reykjavik']
) {
  const original = getThresholds();
  const rows = [];

  for (const name of presets) {
    let loc;
    try {
      loc = resolveLocation(name);
    } catch (e) {
      console.warn(e.message);
      continue;
    }
    console.info('[testThresholdsCompare] fetching', loc.label, '…');
    try {
      const result = await loadClimatology({
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
      rows.push({
        city: loc.label,
        RAIN_LIGHT: result.RAIN_LIGHT,
        RAIN_MODERATE: result.RAIN_MODERATE,
        RAIN_HEAVY: result.RAIN_HEAVY,
        WIND_HIGH: result.WIND_HIGH,
        source: result.source,
      });
    } catch (err) {
      console.warn(`[testThresholdsCompare] ${loc.label} failed:`, err.message);
      rows.push({ city: loc.label, error: err.message });
    }
  }

  applyClimatology(original);

  console.group('[testThresholdsCompare] result');
  console.table(rows);
  console.info('Live thresholds restored to pre-compare snapshot.');
  console.groupEnd();
  return rows;
}

/**
 * Dev helper for the production boot path. Returns immediately — the
 * background refresh (if any) writes to the cache for the next session.
 */
export function testBootThresholds() {
  console.info('[testBootThresholds] booting climatology for', MUMBAI.label, '…');
  const result = bootClimatology({
    latitude: MUMBAI.latitude,
    longitude: MUMBAI.longitude,
  });
  console.group('[testBootThresholds] result (synchronous)');
  console.log('boot:', result);
  console.table(getThresholds());
  console.groupEnd();
  if (result.refreshing) {
    console.info(
      '[testBootThresholds] background refresh in flight — refined values will apply on next session.'
    );
  }
  return result;
}

/**
 * Verifies Fix 2: capped probability bar in a monsoon region.
 *
 * Scenario: Mumbai (lat 19, monsoon multiplier 0.7) in July, low risk
 * tolerance (PROB_HIGH = 70). With the cap (PROB_BAR_MAX = 60), the
 * effective bar is min(70, 60) = 60. The trigger condition is
 * `rawProb × 0.7 > 60`, i.e. `rawProb > 85.7`.
 *
 * Expectations:
 *   - rawProb = 85 → effectiveProb = 59.5, 59.5 > 60 = false → NOT triggered
 *   - rawProb = 90 → effectiveProb = 63,   63   > 60 = true  → triggered
 *
 * Pre-fix behavior would have shown no triggers at any rawProb (since
 * rawProb × 0.7 > 70 requires rawProb > 100, which is impossible).
 */
export function testMonsoonBar() {
  const julyTuesday = new Date(2025, 6, 15); // month index 6 = July
  const location = { latitude: 19.076, longitude: 72.877, label: 'Mumbai' };
  const baseAggregated = {
    precipitation: 1.5, // light-moderate rain
    wind_speed_10m: 12,
    uv_index: 1,
    temperature_2m: 28,
    apparent_temperature: 30,
  };

  const run = (rawProb) =>
    generateRecommendations({
      aggregated: { ...baseAggregated, precipitation_probability: rawProb },
      consequenceLevel: 'low',
      location,
      now: julyTuesday,
    }).filter((r) => r.carry && r.item === 'umbrella').length > 0;

  const cases = [60, 75, 85, 86, 90, 95];
  console.group('[testMonsoonBar] Mumbai-July, low risk tolerance');
  console.table(cases.map((p) => ({ rawProb: p, umbrella_triggered: run(p) })));
  console.groupEnd();

  const expect85 = run(85) === false;
  const expect90 = run(90) === true;
  if (expect85 && expect90) {
    console.info('[testMonsoonBar] ✓ 85% does not trigger, 90% does — cap reachable');
  } else {
    console.warn(
      '[testMonsoonBar] ✗ unexpected: rawProb=85 triggered?',
      run(85),
      '· rawProb=90 triggered?',
      run(90)
    );
  }
  return { passed: expect85 && expect90 };
}

/**
 * Verifies Fix 3: getWorstHour ranks by expected precipitation, with a 30%
 * probability floor for eligibility.
 *
 * Scenario: Hour A (8 mm/hr at 15% prob) vs Hour B (2 mm/hr at 75% prob).
 *   - A's expected value: 8 × 0.15 = 1.2
 *   - B's expected value: 2 × 0.75 = 1.5
 *   - A's probability is below the 30% floor → A is ineligible
 *   - Worst should be B
 *
 * Pre-fix behavior would have returned A (higher raw precipitation).
 */
export function testWorstHourRanking() {
  const hourA = {
    hour: '2026-06-16T08:00',
    precipitation: 8,
    precipitation_probability: 15,
    wind_speed_10m: 10,
  };
  const hourB = {
    hour: '2026-06-16T09:00',
    precipitation: 2,
    precipitation_probability: 75,
    wind_speed_10m: 10,
  };
  const worst = getWorstHour([hourA, hourB]);
  const passed = worst?.hour === hourB.hour;
  console.group('[testWorstHourRanking] expected-value ranking');
  console.table([
    { hour: 'A', precip: 8, prob: 15, expected: 1.2, eligible: false },
    { hour: 'B', precip: 2, prob: 75, expected: 1.5, eligible: true },
  ]);
  console.log('worst →', worst?.hour);
  if (passed) {
    console.info('[testWorstHourRanking] ✓ Hour B wins (1.5 > 1.2 expected, passes 30% floor)');
  } else {
    console.warn('[testWorstHourRanking] ✗ Expected Hour B, got', worst?.hour);
  }
  console.groupEnd();

  // Edge case: dry-but-windy window should still tiebreak on wind.
  const dryHourA = {
    hour: '2026-06-16T08:00',
    precipitation: 0,
    precipitation_probability: 0,
    wind_speed_10m: 12,
  };
  const dryHourB = {
    hour: '2026-06-16T09:00',
    precipitation: 0,
    precipitation_probability: 0,
    wind_speed_10m: 45,
  };
  const dryWorst = getWorstHour([dryHourA, dryHourB]);
  const tiebreakOk = dryWorst?.hour === dryHourB.hour;
  console.log(
    '[testWorstHourRanking] dry-day wind tiebreak →',
    dryWorst?.hour,
    tiebreakOk ? '✓' : '✗'
  );
  return { passed: passed && tiebreakOk };
}
