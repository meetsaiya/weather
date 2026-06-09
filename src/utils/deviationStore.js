// Pure storage for today's per-window deviations. Kept JSX-free so non-UI
// callers (utils, tests, dashboard pipeline) can read without pulling in
// React or the modal component.

const DEVIATION_KEY = 'ww_deviation_today';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getTodayDeviations() {
  try {
    const raw = globalThis.localStorage?.getItem(DEVIATION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed?.date !== todayISO()) {
      // Yesterday's overrides — clear them.
      globalThis.localStorage?.removeItem(DEVIATION_KEY);
      return {};
    }
    return parsed.overrides ?? {};
  } catch {
    return {};
  }
}

export function writeTodayDeviations(overrides) {
  try {
    globalThis.localStorage?.setItem(
      DEVIATION_KEY,
      JSON.stringify({ date: todayISO(), overrides })
    );
  } catch {
    // ignore
  }
}
