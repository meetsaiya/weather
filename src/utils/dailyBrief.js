import { aggregateExposure } from '../core/exposureEngine.js';
import { generateRecommendations } from '../core/recommendEngine.js';
import { generatePlainEnglish } from '../core/plainEnglish.js';
import { applyDeviations } from './deviations.js';

// Same priority order as plainEnglish, kept here so this module is self-contained.
const ITEM_PRIORITY = [
  'raincoat',
  'waterproof_layer',
  'umbrella',
  'scarf',
  'windcheater',
  'sunscreen',
  'hat',
  'light_clothing',
];

function rankItem(item) {
  const i = ITEM_PRIORITY.indexOf(item);
  return i === -1 ? 99 : i;
}

/**
 * Build the day's headline recommendations across every window, ordered by
 * priority. Picks the highest-priority active item per window, then dedupes
 * by item so we don't say "carry an umbrella" three times.
 *
 * Output:
 *   {
 *     title: 'Today',
 *     body:  "Morning commute: …. Evening return: …."   // 1–2 sentences
 *     lines: [{ windowLabel, line }],
 *     allClear: boolean,
 *   }
 */
export function buildDailyBrief({
  routine,
  weatherData,
  thresholdNudge = 0,
  maxLines = 2,
}) {
  if (!routine?.windows?.length || !Array.isArray(weatherData) || weatherData.length === 0) {
    return { title: 'Today', body: 'All clear for today.', lines: [], allClear: true };
  }

  const windows = applyDeviations(routine.windows);
  const perWindow = windows.map((win) => {
    const exposure = aggregateExposure({ userWindow: win, hourlyWeatherArray: weatherData });
    const recs = generateRecommendations({
      aggregated: exposure.aggregatedWeather,
      riskTolerance: win.riskTolerance,
      tripDurationMins: win.tripDurationMins,
      location: routine.location,
      thresholdNudge,
    });
    const active = recs
      .filter((r) => r.carry)
      .sort((a, b) => rankItem(a.item) - rankItem(b.item));
    const english = generatePlainEnglish(recs, win.label);
    return { win, recs, active, english, topItem: active[0]?.item ?? null };
  });

  const interesting = perWindow.filter((p) => p.active.length > 0);
  if (interesting.length === 0) {
    return { title: 'Today', body: 'Looking clear for your routine.', lines: [], allClear: true };
  }

  // Order by item priority, dedupe by topItem so we don't repeat the same advice.
  const seen = new Set();
  const ordered = [...interesting].sort(
    (a, b) => rankItem(a.topItem) - rankItem(b.topItem)
  );
  const lines = [];
  for (const p of ordered) {
    if (seen.has(p.topItem)) continue;
    seen.add(p.topItem);
    lines.push({ windowLabel: p.win.label, line: p.english.sentences[0] ?? p.active[0].reason });
    if (lines.length >= maxLines) break;
  }

  const body = lines.map((l) => `${l.windowLabel}: ${l.line}`).join(' ');
  return { title: 'Today', body, lines, allClear: false };
}
