import {
  RAIN_LIGHT,
  RAIN_MODERATE,
  WIND_HIGH,
  UV_MODERATE,
  UV_HIGH,
  TEMP_VERY_COLD,
  TEMP_HOT,
  TEMP_VERY_HOT,
  PROB_LOW,
  PROB_MEDIUM,
  PROB_HIGH,
  PROB_BAR_MAX,
} from './thresholds.js';
import { resolveConflicts } from './conflictResolver.js';
import { getClimateContext } from '../utils/climateContext.js';

const SUNSCREEN_MIN_MINUTES = 20;

/**
 * Map the user's consequence level (how much getting wet matters) to the
 * probability bar at which rain recommendations fire.
 *
 *   high   (staying dry matters) → PROB_LOW    (20%)  trigger early
 *   medium (prefers to stay dry) → PROB_MEDIUM (50%)
 *   low    (rain is fine)        → PROB_HIGH   (70%)  trigger only when very likely
 */
function rainProbThresholdFor(consequenceLevel) {
  if (consequenceLevel === 'high') return PROB_LOW;
  if (consequenceLevel === 'low') return PROB_HIGH;
  return PROB_MEDIUM;
}

/**
 * Apply the user's accumulated feedback nudge to the probability bar.
 *
 *   nudge > 0  → user finds recs helpful → relax → lower bar → more triggers
 *   nudge < 0  → user finds recs unhelpful → tighten → higher bar → fewer
 *
 * Bounded to [-0.15, +0.15] upstream so the effective bar can swing roughly
 * ±15% from baseline. Probability bar is clamped to [1, 99] so feedback can't
 * disable triggers entirely or force them every hour.
 */
function applyNudge(probBar, nudge = 0) {
  const clamped = Math.max(-0.15, Math.min(0.15, nudge));
  const out = probBar * (1 - clamped);
  return Math.max(1, Math.min(99, out));
}

function confidenceFor(prob, precip) {
  if (prob == null) return 'unlikely';
  if (prob > 60 && (precip ?? 0) >= RAIN_MODERATE) return 'likely';
  if (prob >= 30 && prob <= 60) return 'possible';
  if (prob < 30) return 'unlikely';
  return 'possible';
}

/**
 * Produce per-item recommendations for a single exposure window.
 *
 * @param {object} params
 * @param {object} params.aggregated         output of exposureEngine.aggregateExposure
 * @param {string} [params.consequenceLevel]    'low'|'medium'|'high'
 * @param {number} [params.tripDurationMins]
 * @param {{ latitude:number, longitude:number }} [params.location]
 * @param {Date}   [params.now]              for testability
 * @returns {Array<{ item:string, carry:boolean, reason:string, confidence:string, note?:string }>}
 */
export function generateRecommendations({
  aggregated,
  consequenceLevel = 'medium',
  tripDurationMins = 0,
  location,
  thresholdNudge = 0,
  now = new Date(),
} = {}) {
  if (!aggregated) return [];

  const climate = location
    ? getClimateContext({
        latitude: location.latitude,
        longitude: location.longitude,
        month: now.getMonth() + 1,
      })
    : { sensitivityMultiplier: 1.0, label: 'unknown' };

  const rawProb = aggregated.precipitation_probability ?? 0;
  // NOTE: sensitivityMultiplier dampens probability in monsoon regions.
  // TODO: consider removing sensitivityMultiplier — it's potentially redundant
  // with climatology calibration (seasonal RAIN_* percentiles already encode
  // "what's a notable rain rate in this season"). See ALGORITHM_FLOW.md §2e.
  const effectiveProb = rawProb * climate.sensitivityMultiplier;
  const precip = aggregated.precipitation ?? 0;
  const wind = aggregated.wind_speed_10m ?? 0;
  const uv = aggregated.uv_index ?? 0;
  const temp = aggregated.temperature_2m ?? null;
  const appTemp = aggregated.apparent_temperature ?? temp;

  // Cap the bar at PROB_BAR_MAX so the multiplier × low-tolerance combination
  // can't make rain triggers mathematically unreachable. Side effect: this
  // also lowers the relaxed (PROB_HIGH=70) bar to 60 in non-monsoon contexts
  // — 70% rain is "very likely" anyway, so 60% with non-trivial precipitation
  // is a defensible trigger.
  const cappedBar = Math.min(rainProbThresholdFor(consequenceLevel), PROB_BAR_MAX);
  const probBar = applyNudge(cappedBar, thresholdNudge);
  const triggered = [];

  // Rain → umbrella. Raincoat layered on for genuine heavy rain + high wind
  // only — light rain + high wind keeps the umbrella with a "breezy" caveat
  // (added by the conflict resolver).
  const rainTriggered = effectiveProb > probBar && precip > RAIN_LIGHT;
  if (rainTriggered) {
    triggered.push({
      item: 'umbrella',
      carry: true,
      reason: `Rain expected (${Math.round(rawProb)}% chance, ~${precip.toFixed(1)} mm/hr).`,
      confidence: confidenceFor(rawProb, precip),
    });
    if (wind > WIND_HIGH && precip >= RAIN_MODERATE) {
      triggered.push({
        item: 'raincoat',
        carry: true,
        reason: `Heavy rain with high winds (${Math.round(wind)} km/h).`,
        confidence: confidenceFor(rawProb, precip),
      });
    }
  }

  // Wind alone → windcheater.
  if (!rainTriggered && wind > WIND_HIGH) {
    triggered.push({
      item: 'windcheater',
      carry: true,
      reason: `Strong winds (${Math.round(wind)} km/h).`,
      confidence: 'likely',
    });
  }

  // UV high or cold → hat / cap (the same item, separate reasons).
  // hatReason is recorded so the conflict resolver can suppress the UV-driven
  // hat when an action item already covers the user (e.g. umbrella doubles as
  // sun cover) while keeping the cold-driven hat as a genuine carry item.
  const hatForCold = temp != null && temp < TEMP_VERY_COLD;
  const hatForUV = uv > UV_MODERATE;
  if (hatForCold || hatForUV) {
    triggered.push({
      item: 'hat',
      carry: true,
      reason: hatForCold
        ? `Cold (${Math.round(temp)}°C).`
        : `High UV (${uv.toFixed(1)}).`,
      confidence: 'likely',
      hatReason: hatForCold ? 'cold' : 'uv',
    });
  }

  // Apparent temp very cold → scarf.
  if (appTemp != null && appTemp < TEMP_VERY_COLD) {
    triggered.push({
      item: 'scarf',
      carry: true,
      reason: `Feels cold (${Math.round(appTemp)}°C).`,
      confidence: 'likely',
    });
  }

  // UV high AND non-trivial outdoor time → sunscreen reminder.
  if (uv > UV_HIGH && tripDurationMins >= SUNSCREEN_MIN_MINUTES) {
    triggered.push({
      item: 'sunscreen',
      carry: true,
      reason: `High UV (${uv.toFixed(1)}) over a ${tripDurationMins}-min outdoor stretch.`,
      confidence: 'likely',
    });
  }

  // Apparent temp *very* hot → light clothing note. Bar raised from TEMP_HOT
  // (30°C, just "warm" in tropical climates) to TEMP_VERY_HOT (37°C) so the
  // suggestion only fires when it's genuinely uncomfortable, not as a default
  // for every summer afternoon in a hot region.
  if (appTemp != null && appTemp > TEMP_VERY_HOT) {
    triggered.push({
      item: 'light_clothing',
      carry: true,
      reason: `Very hot (feels like ${Math.round(appTemp)}°C). Dress light, drink water.`,
      confidence: 'likely',
    });
  }

  return resolveConflicts(triggered, aggregated);
}
