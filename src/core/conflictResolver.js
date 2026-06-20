import {
  WIND_HIGH,
  TEMP_VERY_COLD,
  UV_HIGH,
  RAIN_LIGHT,
  RAIN_MODERATE,
} from './thresholds.js';

/**
 * Resolve conflicts among triggered recommendations.
 *
 * Input is the array produced by recommendEngine plus the aggregated weather
 * the engine reasoned over. Rules are applied in priority order (first match
 * wins per concern: each rule may suppress, annotate, or add items). Output
 * preserves every triggered item — items that lose their conflict are
 * returned with `carry: false` and a reason describing why, so the UI can
 * explain itself.
 *
 * Priority:
 *   1a. heavy rain (≥ RAIN_MODERATE) + high wind → umbrella out, raincoat in
 *       (engine already triggered raincoat for this exact condition)
 *   1b. light rain (< RAIN_MODERATE) + high wind → umbrella stays, mark
 *       windyCaveat: true so plainEnglish renders the "hold on tight"
 *       template. No raincoat (engine didn't trigger it for light rain).
 *   2.  cold + rain      → umbrella out, waterproof_layer in
 *   3.  high UV + rain   → keep umbrella, annotate "doubles as sun cover"
 */
export function resolveConflicts(items = [], aggregated = {}) {
  const out = items.map((i) => ({ ...i }));
  const byItem = (name) => out.find((i) => i.item === name);
  const carryingRain = () => {
    const u = byItem('umbrella');
    return !!u && u.carry;
  };

  const precip = aggregated.precipitation ?? 0;
  const wind = aggregated.wind_speed_10m ?? 0;
  const uv = aggregated.uv_index ?? 0;
  const appTemp = aggregated.apparent_temperature ?? aggregated.temperature_2m ?? null;

  const rainSignal = precip > RAIN_LIGHT;

  // Rule 1a — heavy rain + high wind: umbrella suppressed (raincoat already
  // triggered by the engine for this exact condition).
  if (carryingRain() && wind > WIND_HIGH && precip >= RAIN_MODERATE) {
    const u = byItem('umbrella');
    u.carry = false;
    u.reason = `Heavy rain with high winds (${Math.round(wind)} km/h) make an umbrella impractical — raincoat instead.`;
    u.suppressedBy = 'wind';
  }
  // Rule 1b — light rain + high wind: umbrella stays, annotate as breezy.
  // Raincoat wasn't triggered by the engine in this branch.
  else if (carryingRain() && wind > WIND_HIGH) {
    const u = byItem('umbrella');
    u.windyCaveat = true;
    u.windKmh = Math.round(wind);
  }

  // Rule 2 — cold + rain: umbrella suppressed (still, even if rule 1 already
  // suppressed), waterproof_layer added.
  if (rainSignal && appTemp != null && appTemp < TEMP_VERY_COLD) {
    const u = byItem('umbrella');
    if (u && u.carry) {
      u.carry = false;
      u.reason = `Cold and wet — a waterproof layer is more useful than an umbrella.`;
      u.suppressedBy = 'cold';
    }
    if (!byItem('waterproof_layer')) {
      out.push({
        item: 'waterproof_layer',
        carry: true,
        reason: `Cold (${Math.round(appTemp)}°C) with rain — needs a waterproof shell, not an umbrella.`,
        confidence: 'likely',
      });
    }
  }

  // Rule 3 — high UV + rain: keep umbrella (if still carried), annotate.
  if (rainSignal && uv > UV_HIGH) {
    const u = byItem('umbrella');
    if (u && u.carry) {
      u.note = 'Doubles as sun cover.';
    }
  }

  return out;
}
