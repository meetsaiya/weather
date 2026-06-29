import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'ww_routine';
const SCHEMA_VERSION = 1;
const MAX_WINDOWS = 5;

export const DEFAULT_ROUTINE = {
  schemaVersion: SCHEMA_VERSION,
  location: null, // { latitude, longitude, label } | null
  windows: [], // [{ id, label, startTime, endTime, tripDurationMins, transportMode, consequenceLevel }]
  notificationTime: '07:00',
  notificationsEnabled: false,
  onboardingComplete: false,
};

/**
 * In-place silent migration: `window.riskTolerance` → `window.consequenceLevel`.
 *
 * The old field name was retired in favor of consequence-framing UI, but the
 * internal values ('high' | 'medium' | 'low') and downstream behavior are
 * unchanged. Old routines stored before the rename are migrated on first
 * read; the result is persisted back so the migration runs at most once.
 */
function migrateWindowsInPlace(parsed) {
  if (!parsed || !Array.isArray(parsed.windows)) return false;
  let changed = false;
  parsed.windows = parsed.windows.map((w) => {
    if (!w || typeof w !== 'object') return w;
    if ('riskTolerance' in w && !('consequenceLevel' in w)) {
      changed = true;
      const { riskTolerance, ...rest } = w;
      return { ...rest, consequenceLevel: riskTolerance };
    }
    return w;
  });
  return changed;
}

function readRoutine() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ROUTINE };
    const parsed = JSON.parse(raw);
    // Schema mismatch: discard rather than guess. MVP — we'll write migrations
    // when there's an actual past version worth preserving.
    if (parsed?.schemaVersion !== SCHEMA_VERSION) return { ...DEFAULT_ROUTINE };
    const migrated = migrateWindowsInPlace(parsed);
    if (migrated) writeRoutine(parsed); // persist so next reader sees the new shape
    return { ...DEFAULT_ROUTINE, ...parsed };
  } catch {
    return { ...DEFAULT_ROUTINE };
  }
}

function writeRoutine(routine) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(routine));
  } catch {
    // localStorage unavailable — ignore silently.
  }
}

// In-memory pub/sub so multiple useRoutine instances stay in sync within a tab.
// Cross-tab sync would need a 'storage' event listener; out of scope for MVP.
const subscribers = new Set();
function notify() {
  for (const s of subscribers) s();
}

function makeWindowId() {
  return `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function useRoutine() {
  const [routine, setRoutine] = useState(readRoutine);

  useEffect(() => {
    const onChange = () => setRoutine(readRoutine());
    subscribers.add(onChange);
    return () => subscribers.delete(onChange);
  }, []);

  const saveRoutine = useCallback((partial) => {
    setRoutine((prev) => {
      const next = { ...prev, ...partial, schemaVersion: SCHEMA_VERSION };
      writeRoutine(next);
      notify();
      return next;
    });
  }, []);

  const addWindow = useCallback((win) => {
    setRoutine((prev) => {
      if (prev.windows.length >= MAX_WINDOWS) return prev;
      const id = win.id ?? makeWindowId();
      const next = { ...prev, windows: [...prev.windows, { ...win, id }] };
      writeRoutine(next);
      notify();
      return next;
    });
  }, []);

  const updateWindow = useCallback((id, patch) => {
    setRoutine((prev) => {
      const next = {
        ...prev,
        windows: prev.windows.map((w) => (w.id === id ? { ...w, ...patch } : w)),
      };
      writeRoutine(next);
      notify();
      return next;
    });
  }, []);

  const deleteWindow = useCallback((id) => {
    setRoutine((prev) => {
      const next = { ...prev, windows: prev.windows.filter((w) => w.id !== id) };
      writeRoutine(next);
      notify();
      return next;
    });
  }, []);

  const resetRoutine = useCallback(() => {
    writeRoutine({ ...DEFAULT_ROUTINE });
    setRoutine({ ...DEFAULT_ROUTINE });
    notify();
  }, []);

  return { routine, saveRoutine, addWindow, updateWindow, deleteWindow, resetRoutine };
}

// Non-hook accessor for boot code (e.g. main.jsx wiring climatology to the
// stored location before React mounts).
export function getStoredRoutine() {
  return readRoutine();
}

export { MAX_WINDOWS };
