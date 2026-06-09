import { getTodayDeviations } from './deviationStore.js';

/**
 * Merge today's deviation overrides into a routine's windows.
 *
 *   - `skip: true` → window dropped from the list
 *   - `startTime` / `endTime` overrides → patched onto the base window
 *
 * Pure: takes the windows + overrides, returns a new list. The caller passes
 * `getTodayDeviations()` in or lets this read from localStorage by default.
 */
export function applyDeviations(windows, overrides = getTodayDeviations()) {
  if (!Array.isArray(windows)) return [];
  return windows
    .map((w) => {
      const o = overrides?.[w.id];
      if (!o) return w;
      if (o.skip) return null;
      return {
        ...w,
        ...(o.startTime ? { startTime: o.startTime } : {}),
        ...(o.endTime ? { endTime: o.endTime } : {}),
        ...(o.tripDurationMins ? { tripDurationMins: o.tripDurationMins } : {}),
        deviated: true,
      };
    })
    .filter(Boolean);
}
