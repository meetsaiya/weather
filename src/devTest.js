import { fetchHourlyWeather, sliceHoursByKeys } from './core/weatherEngine.js';
import { getHoursInWindow, getWorstHour, getWeightedAverage } from './utils/timeUtils.js';
import { bootClimatology, loadClimatology, getThresholds } from './core/thresholds.js';

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
