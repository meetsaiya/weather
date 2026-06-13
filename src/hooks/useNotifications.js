import { useEffect, useRef, useState } from 'react';

const LAST_SENT_KEY = 'ww_last_brief';

function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseHHMM(time) {
  if (!time) return [7, 0];
  const [h, m] = time.split(':').map(Number);
  return [h || 0, m || 0];
}

// Milliseconds until the next occurrence of HH:MM (today if it hasn't passed,
// otherwise tomorrow).
function msUntilNext(time, now = new Date()) {
  const [h, m] = parseHHMM(time);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}

function todayBriefAlreadyShownAt(time, now = new Date()) {
  const [h, m] = parseHHMM(time);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  return now >= target;
}

function readLastSent() {
  try {
    return globalThis.localStorage?.getItem(LAST_SENT_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeLastSent(date) {
  try {
    globalThis.localStorage?.setItem(LAST_SENT_KEY, date);
  } catch {
    // ignore
  }
}

async function showViaServiceWorker(title, body) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg) return false;
  // Preferred path: SW's showNotification (works when app is backgrounded).
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', title, body });
    return true;
  }
  // Fallback: ask the registration directly.
  try {
    await reg.showNotification(title, { body, icon: '/pwa-192x192.png' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Daily morning briefing.
 *
 * @param {object} params
 * @param {boolean} params.enabled
 * @param {string}  params.time            'HH:MM' (24h)
 * @param {*}       params.dataKey         changes when computeBrief would yield
 *                                         a different result (e.g. weather
 *                                         lastFetched timestamp); triggers an
 *                                         in-app banner re-check.
 * @param {() => { title: string, body: string, allClear?: boolean }} params.computeBrief
 *
 * @returns {{ inAppBrief: { title, body } | null, dismissBanner: () => void }}
 *   `inAppBrief` is non-null when today's notification time has already passed
 *   but we never delivered the brief (e.g., notifications disabled, permission
 *   denied, or this is the first app open of the day) — render it as an
 *   in-app banner.
 */
export function useNotifications({ enabled, time, dataKey, computeBrief }) {
  const [inAppBrief, setInAppBrief] = useState(null);
  const computeRef = useRef(computeBrief);
  computeRef.current = computeBrief;

  // Show the in-app banner if today's time has passed and we haven't recorded
  // a delivery for today. Re-evaluates when dataKey changes (e.g. weather
  // refreshes and the brief content shifts).
  useEffect(() => {
    if (!enabled || !time || typeof computeRef.current !== 'function') {
      setInAppBrief(null);
      return;
    }
    const today = todayISO();
    if (readLastSent() === today) {
      setInAppBrief(null);
      return;
    }
    if (!todayBriefAlreadyShownAt(time)) {
      setInAppBrief(null);
      return;
    }
    const brief = computeRef.current();
    if (!brief || brief.allClear) {
      setInAppBrief(null);
      return;
    }
    setInAppBrief(brief);
  }, [enabled, time, dataKey]);

  // Schedule the next OS-level notification while the tab is open.
  useEffect(() => {
    if (!enabled || !time) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    let timerId = null;
    let cancelled = false;

    const schedule = () => {
      const delay = msUntilNext(time);
      timerId = setTimeout(async () => {
        if (cancelled) return;
        const today = todayISO();
        if (readLastSent() !== today) {
          const brief = computeRef.current?.();
          if (brief && !brief.allClear) {
            const ok = await showViaServiceWorker(brief.title, brief.body);
            if (!ok) {
              try {
                new Notification(brief.title || 'WeatherWise', { body: brief.body });
              } catch {
                // Permission revoked between checks — give up silently.
              }
            }
          }
          writeLastSent(today);
        }
        schedule();
      }, delay);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [enabled, time]);

  const dismissBanner = () => {
    writeLastSent(todayISO());
    setInAppBrief(null);
  };

  return { inAppBrief, dismissBanner };
}
