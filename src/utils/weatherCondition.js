// WMO weather codes → human-readable label + emoji-style icon.
// Reference: https://open-meteo.com/en/docs (weather_code interpretation table).

const TABLE = {
  0: { label: 'Clear', icon: '☀️' },
  1: { label: 'Mostly clear', icon: '🌤️' },
  2: { label: 'Partly cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Fog', icon: '🌫️' },
  48: { label: 'Freezing fog', icon: '🌫️' },
  51: { label: 'Light drizzle', icon: '🌦️' },
  53: { label: 'Drizzle', icon: '🌦️' },
  55: { label: 'Heavy drizzle', icon: '🌧️' },
  56: { label: 'Freezing drizzle', icon: '🌧️' },
  57: { label: 'Freezing drizzle', icon: '🌧️' },
  61: { label: 'Light rain', icon: '🌦️' },
  63: { label: 'Rain', icon: '🌧️' },
  65: { label: 'Heavy rain', icon: '🌧️' },
  66: { label: 'Freezing rain', icon: '🌧️' },
  67: { label: 'Freezing rain', icon: '🌧️' },
  71: { label: 'Light snow', icon: '🌨️' },
  73: { label: 'Snow', icon: '🌨️' },
  75: { label: 'Heavy snow', icon: '❄️' },
  77: { label: 'Snow grains', icon: '🌨️' },
  80: { label: 'Rain showers', icon: '🌦️' },
  81: { label: 'Heavy showers', icon: '🌧️' },
  82: { label: 'Violent showers', icon: '⛈️' },
  85: { label: 'Snow showers', icon: '🌨️' },
  86: { label: 'Heavy snow showers', icon: '❄️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
  96: { label: 'Thunderstorm + hail', icon: '⛈️' },
  99: { label: 'Severe thunderstorm', icon: '⛈️' },
};

export function describeWeather(code) {
  if (code == null) return { label: 'Unknown', icon: '·' };
  return TABLE[code] ?? { label: 'Unknown', icon: '·' };
}

// Pick a representative condition for a set of hours: whichever code appears
// with the highest precipitation or, failing that, most often. The day's
// "headline" condition.
export function dominantWeatherCode(hours) {
  if (!Array.isArray(hours) || hours.length === 0) return null;

  const wettest = hours
    .filter((h) => (h.precipitation ?? 0) > 0)
    .sort((a, b) => (b.precipitation ?? 0) - (a.precipitation ?? 0))[0];
  if (wettest && wettest.weather_code != null) return wettest.weather_code;

  // Fallback: modal weather code.
  const counts = new Map();
  for (const h of hours) {
    if (h.weather_code == null) continue;
    counts.set(h.weather_code, (counts.get(h.weather_code) ?? 0) + 1);
  }
  let bestCode = null;
  let bestCount = 0;
  for (const [code, n] of counts) {
    if (n > bestCount) {
      bestCount = n;
      bestCode = code;
    }
  }
  return bestCode;
}

export function uvBand(uv) {
  if (uv == null) return { label: '—', tone: 'slate' };
  if (uv >= 11) return { label: 'Extreme', tone: 'rose' };
  if (uv >= 8) return { label: 'Very high', tone: 'rose' };
  if (uv >= 6) return { label: 'High', tone: 'amber' };
  if (uv >= 3) return { label: 'Moderate', tone: 'yellow' };
  return { label: 'Low', tone: 'emerald' };
}
