const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

const HOURLY_FIELDS = [
  'precipitation_probability',
  'precipitation',
  'wind_speed_10m',
  'uv_index',
  'temperature_2m',
  'apparent_temperature',
];

/**
 * Fetch hourly weather from Open-Meteo and return a flat array of hour
 * objects.
 *
 * @param {object} params
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {string} [params.timezone='auto']  IANA timezone string. 'auto'
 *   lets Open-Meteo align hours to the location's local time, which matches
 *   how user routine windows are expressed.
 * @param {number} [params.forecastDays=2]
 * @returns {Promise<Array<{
 *   hour: string,
 *   precipitation_probability: number|null,
 *   precipitation: number|null,
 *   wind_speed_10m: number|null,
 *   uv_index: number|null,
 *   temperature_2m: number|null,
 *   apparent_temperature: number|null,
 * }>>}
 */
export async function fetchHourlyWeather({
  latitude,
  longitude,
  timezone = 'auto',
  forecastDays = 2,
} = {}) {
  if (latitude == null || longitude == null) {
    throw new Error('fetchHourlyWeather: latitude and longitude are required');
  }

  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set('latitude', latitude);
  url.searchParams.set('longitude', longitude);
  url.searchParams.set('hourly', HOURLY_FIELDS.join(','));
  url.searchParams.set('timezone', timezone);
  url.searchParams.set('forecast_days', String(forecastDays));
  url.searchParams.set('wind_speed_unit', 'kmh');
  url.searchParams.set('precipitation_unit', 'mm');
  url.searchParams.set('temperature_unit', 'celsius');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Open-Meteo request failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();

  return parseHourly(json);
}

/**
 * Convert Open-Meteo's column-oriented hourly payload into an array of
 * per-hour records.
 */
export function parseHourly(payload) {
  const hourly = payload?.hourly;
  if (!hourly || !Array.isArray(hourly.time)) return [];

  return hourly.time.map((hour, i) => ({
    hour,
    precipitation_probability: hourly.precipitation_probability?.[i] ?? null,
    precipitation: hourly.precipitation?.[i] ?? null,
    wind_speed_10m: hourly.wind_speed_10m?.[i] ?? null,
    uv_index: hourly.uv_index?.[i] ?? null,
    temperature_2m: hourly.temperature_2m?.[i] ?? null,
    apparent_temperature: hourly.apparent_temperature?.[i] ?? null,
  }));
}

// Slice a hourly array down to the hours overlapping `hourKeys` (preserving order).
export function sliceHoursByKeys(hourly, hourKeys) {
  const want = new Set(hourKeys);
  return hourly.filter((h) => want.has(h.hour));
}
