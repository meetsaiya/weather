import { fetchHourlyWeather, sliceHoursByKeys } from './core/weatherEngine.js';
import { getHoursInWindow, getWorstHour, getWeightedAverage } from './utils/timeUtils.js';
import { bootClimatology, loadClimatology, getThresholds } from './core/thresholds.js';
import { aggregateExposure } from './core/exposureEngine.js';
import { generateRecommendations } from './core/recommendEngine.js';
import { generatePlainEnglish } from './core/plainEnglish.js';

const MUMBAI = { latitude: 19.076, longitude: 72.877, label: 'Mumbai' };

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
 *   - Window 17:00–19:00, 20-minute trip, riskTolerance: 'high'
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
    riskTolerance: 'high',
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

/**
 * End-to-end variant: real Mumbai forecast → exposure → recommendations.
 */
export async function testRecommendationsLive() {
  console.info('[testRecommendationsLive] fetching live forecast for Mumbai …');
  const hourly = await fetchHourlyWeather({ latitude: 19.076, longitude: 72.877 });
  const exposure = aggregateExposure({
    userWindow: { startTime: '17:00', endTime: '19:00', tripDurationMins: 20, riskTolerance: 'medium' },
    hourlyWeatherArray: hourly,
  });
  const recs = generateRecommendations({
    aggregated: exposure.aggregatedWeather,
    riskTolerance: exposure.riskTolerance,
    tripDurationMins: 20,
    location: { latitude: 19.076, longitude: 72.877 },
  });
  const english = generatePlainEnglish(recs, 'evening commute');
  console.group('[testRecommendationsLive] result');
  console.log('aggregated:', exposure.aggregatedWeather);
  console.table(recs);
  console.log('plain English:', english.summary);
  console.groupEnd();
  return { exposure, recommendations: recs, plainEnglish: english };
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
