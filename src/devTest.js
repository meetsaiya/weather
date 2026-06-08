import { fetchHourlyWeather, sliceHoursByKeys } from './core/weatherEngine.js';
import { getHoursInWindow, getWorstHour, getWeightedAverage } from './utils/timeUtils.js';

const MUMBAI = { latitude: 19.076, longitude: 72.877, label: 'Mumbai' };

/**
 * Dev-only smoke test. Fetches Mumbai weather and extracts the slice for
 * 17:00–19:00 today, logging the worst-hour and weighted-average aggregations.
 *
 * Returns the full result so it can be inspected in the console.
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
