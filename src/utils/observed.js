// Fetch and summarise observed weather for an already-passed window.
//
// Open-Meteo's /v1/forecast endpoint with `past_days=2` returns hourly values
// for the previous two days. For hours that have already happened it
// substitutes observation/analysis values for the original forecast, giving
// us the "what actually occurred" data we need to compare against the
// recommendation we made earlier.

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

export async function fetchObservedHours({
  latitude,
  longitude,
  hourKeys,
  timezone = 'auto',
} = {}) {
  if (!Array.isArray(hourKeys) || hourKeys.length === 0) return [];
  const url = new URL(FORECAST_URL);
  url.searchParams.set('latitude', latitude);
  url.searchParams.set('longitude', longitude);
  url.searchParams.set(
    'hourly',
    'precipitation,precipitation_probability,weather_code,temperature_2m,wind_speed_10m'
  );
  url.searchParams.set('past_days', '2');
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', timezone);
  url.searchParams.set('wind_speed_unit', 'kmh');
  url.searchParams.set('precipitation_unit', 'mm');
  url.searchParams.set('temperature_unit', 'celsius');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Observed fetch failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  const want = new Set(hourKeys);
  const out = [];
  const times = json?.hourly?.time ?? [];
  for (let i = 0; i < times.length; i++) {
    if (!want.has(times[i])) continue;
    out.push({
      hour: times[i],
      precipitation: json.hourly.precipitation?.[i] ?? null,
      precipitation_probability: json.hourly.precipitation_probability?.[i] ?? null,
      weather_code: json.hourly.weather_code?.[i] ?? null,
      temperature_2m: json.hourly.temperature_2m?.[i] ?? null,
      wind_speed_10m: json.hourly.wind_speed_10m?.[i] ?? null,
    });
  }
  return out;
}

// Plain-English rain intensity bands. These are absolute (mm/hr), not
// climatology-derived — the goal is a description a human grasps without
// knowing where they live ("Light rain" reads the same in Mumbai or London).
export function rainIntensityLabel(mmPerHour) {
  if (mmPerHour == null) return 'Unknown';
  if (mmPerHour < 0.1) return 'Dry';
  if (mmPerHour < 0.5) return 'Drizzle';
  if (mmPerHour < 2.5) return 'Light rain';
  if (mmPerHour < 10) return 'Moderate rain';
  return 'Heavy rain';
}

export function summarizeObserved(hours) {
  if (!Array.isArray(hours) || hours.length === 0) {
    return null;
  }
  const precipValues = hours.map((h) => h.precipitation ?? 0);
  const maxPrecip = Math.max(...precipValues, 0);
  const totalPrecip = precipValues.reduce((s, v) => s + v, 0);
  const didRain = maxPrecip >= 0.1;
  return {
    didRain,
    intensity: rainIntensityLabel(maxPrecip),
    maxPrecip: round1(maxPrecip),
    totalPrecip: round1(totalPrecip),
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
