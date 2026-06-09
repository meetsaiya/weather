import { useCallback, useEffect, useState } from 'react';
import { fetchHourlyWeather } from '../core/weatherEngine.js';

const STORAGE_KEY = 'ww_weather_cache';
const CACHE_TTL_MS = 1000 * 60 * 60 * 2; // 2 hours

function readCache() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(payload) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function sameLocation(a, b) {
  if (!a || !b) return false;
  return Math.abs(a.latitude - b.latitude) < 0.01 && Math.abs(a.longitude - b.longitude) < 0.01;
}

/**
 * Fetch hourly weather for the user's location with a 2-hour localStorage
 * cache and offline fallback.
 *
 *   - On mount: read cache. If fresh (< 2h) AND matches location → use it.
 *   - Else fetch fresh. On success: store + use. On failure: fall back to
 *     cache with `isStale: true` if any exists for the same location;
 *     otherwise surface the error.
 *
 * Re-runs whenever the location changes (passed-in lat/lon differ from cached
 * lat/lon by >~0.01 degrees, ~1km).
 *
 * @param {{latitude:number, longitude:number} | null | undefined} location
 * @returns {{
 *   weatherData: Array | null,
 *   isStale: boolean,
 *   isOffline: boolean,
 *   lastFetched: number | null,
 *   isLoading: boolean,
 *   error: string | null,
 *   refresh: () => Promise<void>
 * }}
 */
export function useWeather(location) {
  const [state, setState] = useState({
    weatherData: null,
    isStale: false,
    isOffline: false,
    lastFetched: null,
    isLoading: false,
    error: null,
  });

  const load = useCallback(
    async ({ force = false } = {}) => {
      if (!location?.latitude || !location?.longitude) return;

      const cache = readCache();
      const cacheFresh =
        cache &&
        sameLocation(cache.location, location) &&
        Date.now() - cache.fetchedAt < CACHE_TTL_MS;

      if (cacheFresh && !force) {
        setState({
          weatherData: cache.data,
          isStale: false,
          isOffline: false,
          lastFetched: cache.fetchedAt,
          isLoading: false,
          error: null,
        });
        return;
      }

      // Optimistic: show cache while we fetch, if we have one for this location.
      const haveLocationCache = cache && sameLocation(cache.location, location);
      setState((prev) => ({
        ...prev,
        weatherData: haveLocationCache ? cache.data : prev.weatherData,
        lastFetched: haveLocationCache ? cache.fetchedAt : prev.lastFetched,
        isLoading: true,
        error: null,
      }));

      try {
        const data = await fetchHourlyWeather({
          latitude: location.latitude,
          longitude: location.longitude,
        });
        const fetchedAt = Date.now();
        writeCache({ location, fetchedAt, data });
        setState({
          weatherData: data,
          isStale: false,
          isOffline: false,
          lastFetched: fetchedAt,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        const offline =
          typeof navigator !== 'undefined' ? navigator.onLine === false : false;
        if (haveLocationCache) {
          setState({
            weatherData: cache.data,
            isStale: true,
            isOffline: offline,
            lastFetched: cache.fetchedAt,
            isLoading: false,
            error: null,
          });
        } else {
          setState({
            weatherData: null,
            isStale: false,
            isOffline: offline,
            lastFetched: null,
            isLoading: false,
            error: err?.message ?? 'Failed to fetch weather.',
          });
        }
      }
    },
    [location?.latitude, location?.longitude]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Auto-retry when the browser regains connectivity.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => load({ force: true });
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [load]);

  return { ...state, refresh: () => load({ force: true }) };
}
