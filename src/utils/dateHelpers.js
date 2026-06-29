// Shared date helpers for the Today / Tomorrow toggle and downstream
// pipeline. All values are local time — no UTC offsets, no timezone math.

const pad = (n) => String(n).padStart(2, '0');

export function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(now = new Date()) {
  return isoDate(now);
}

// Robust against month/year/DST rollovers — JS Date#setDate handles all of
// those (e.g. 31 Dec + 1 → 1 Jan of next year), so a routine update at
// 11:59 pm on the last of the month still resolves to the correct tomorrow.
export function tomorrowISO(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  return isoDate(d);
}

// Parse "YYYY-MM-DD" → Date at local midnight on that calendar day.
export function parseISOAsLocalDate(iso) {
  if (!iso || typeof iso !== 'string') return new Date();
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function isTodayISO(iso, now = new Date()) {
  return iso === todayISO(now);
}

export function isTomorrowISO(iso, now = new Date()) {
  return iso === tomorrowISO(now);
}

export function formatLongDate(d) {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}
