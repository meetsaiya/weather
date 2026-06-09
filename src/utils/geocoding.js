const OPEN_METEO_SEARCH = 'https://geocoding-api.open-meteo.com/v1/search';
const BIGDATACLOUD_REVERSE = 'https://api-bdc.net/data/reverse-geocode-client';

/**
 * Forward geocode: free-text city name → list of candidates with
 * { latitude, longitude, label, name, country, countryCode }.
 *
 * Open-Meteo's geocoding endpoint is free, keyless, and reasonably comprehensive.
 */
export async function searchCity(query, { count = 5, language = 'en' } = {}) {
  if (!query || query.trim().length < 2) return [];
  const url = new URL(OPEN_METEO_SEARCH);
  url.searchParams.set('name', query.trim());
  url.searchParams.set('count', String(count));
  url.searchParams.set('language', language);
  url.searchParams.set('format', 'json');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status} ${res.statusText}`);
  const json = await res.json();
  return (json.results ?? []).map((r) => ({
    latitude: r.latitude,
    longitude: r.longitude,
    label: [r.name, r.admin1, r.country_code].filter(Boolean).join(', '),
    name: r.name,
    country: r.country,
    countryCode: r.country_code,
  }));
}

/**
 * Reverse geocode: lat/lon → city/locality label via BigDataCloud (free, no key).
 *
 * Returns null on failure rather than throwing, so callers can fall back to a
 * coordinate string without try/catch boilerplate. Result shape:
 * { city, country, label }.
 */
export async function reverseGeocode({ latitude, longitude, language = 'en' } = {}) {
  if (latitude == null || longitude == null) return null;
  const url = new URL(BIGDATACLOUD_REVERSE);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('localityLanguage', language);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const json = await res.json();
    const city = json.city || json.locality || json.principalSubdivision || null;
    if (!city) return null;
    return {
      city,
      country: json.countryName,
      label: [city, json.countryCode].filter(Boolean).join(', '),
    };
  } catch {
    return null;
  }
}
