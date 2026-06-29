import { useCallback, useEffect, useState } from 'react';
import { fetchObservedHours, summarizeObserved } from '../utils/observed.js';
import { getHoursInWindow } from '../utils/timeUtils.js';

const STORAGE_KEY = 'ww_outcomes';
const SCHEMA_VERSION = 1;
const MAX_OUTCOMES = 200;

// Single record schema:
//   {
//     schemaVersion, windowId, date (YYYY-MM-DD), windowLabel,
//     forecastProb, forecastPrecip,
//     recommended: { primaryItem, summary, carry: boolean },
//     observed: { didRain, intensity, maxPrecip, totalPrecip } | null,
//     userResponse: 'yes' | 'no' | null,
//     consequenceLevel,
//   }

function read() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((o) => o?.schemaVersion === SCHEMA_VERSION);
  } catch {
    return [];
  }
}

function write(arr) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // localStorage unavailable — ignore.
  }
}

function keyOf(windowId, date) {
  return `${windowId}:${date}`;
}

const subscribers = new Set();
const notify = () => {
  for (const s of subscribers) s();
};

// In-flight ensureOutcome() promises keyed by `windowId:date`, so multiple
// WindowCards or the AccuracySummary requesting the same outcome don't fan
// out into duplicate network requests.
const inFlight = new Map();

export function useOutcomes() {
  const [outcomes, setOutcomes] = useState(read);

  useEffect(() => {
    const onChange = () => setOutcomes(read());
    subscribers.add(onChange);
    return () => subscribers.delete(onChange);
  }, []);

  const upsert = useCallback((outcome) => {
    setOutcomes((prev) => {
      const key = keyOf(outcome.windowId, outcome.date);
      const filtered = prev.filter((o) => keyOf(o.windowId, o.date) !== key);
      const merged = { schemaVersion: SCHEMA_VERSION, ...outcome };
      const next = [...filtered, merged].slice(-MAX_OUTCOMES);
      write(next);
      notify();
      return next;
    });
  }, []);

  const find = useCallback(
    (windowId, date) =>
      outcomes.find((o) => o.windowId === windowId && o.date === date) ?? null,
    [outcomes]
  );

  const setUserResponse = useCallback(
    (windowId, date, userResponse) => {
      const existing = outcomes.find(
        (o) => o.windowId === windowId && o.date === date
      );
      if (!existing) {
        // No outcome yet — record a stub so the answer isn't lost. Will be
        // enriched with observed data the next time ensureOutcome fires.
        upsert({ windowId, date, userResponse, observed: null });
        return;
      }
      upsert({ ...existing, userResponse });
    },
    [outcomes, upsert]
  );

  return { outcomes, upsert, find, setUserResponse };
}

export function readOutcomes() {
  return read();
}

/**
 * Idempotent background helper. Ensures a stored outcome record exists for the
 * given past window, fetching observed weather if the existing record lacks it.
 * Safe to call repeatedly — only one network request per (windowId, date)
 * will be in flight at a time, and a fully-populated record short-circuits.
 *
 * Returns the (possibly updated) outcome record, or null on failure.
 */
export async function ensureOutcome({
  window: win,
  date,
  location,
  forecast, // { precipitation_probability, precipitation }
  recommended, // { primaryItem, summary, carry }
  upsert,
  find,
}) {
  if (!win?.id || !date) return null;
  const existing = find(win.id, date);
  if (existing?.observed) return existing;

  const inFlightKey = keyOf(win.id, date);
  if (inFlight.has(inFlightKey)) return inFlight.get(inFlightKey);

  const task = (async () => {
    let observed = null;
    if (location?.latitude != null && location?.longitude != null) {
      const hourKeys = getHoursInWindow(win.startTime, win.endTime, new Date(date));
      try {
        const hours = await fetchObservedHours({
          latitude: location.latitude,
          longitude: location.longitude,
          hourKeys,
        });
        observed = summarizeObserved(hours);
      } catch {
        observed = null; // graceful degrade — UI shows "—"
      }
    }

    const outcome = {
      windowId: win.id,
      date,
      windowLabel: win.label,
      forecastProb: forecast?.precipitation_probability ?? null,
      forecastPrecip: forecast?.precipitation ?? null,
      recommended: recommended ?? null,
      observed,
      userResponse: existing?.userResponse ?? null,
      consequenceLevel: win.consequenceLevel ?? null,
    };
    upsert(outcome);
    return outcome;
  })().finally(() => {
    inFlight.delete(inFlightKey);
  });

  inFlight.set(inFlightKey, task);
  return task;
}
