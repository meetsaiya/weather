import {
  RAIN_LIGHT,
  RAIN_MODERATE,
  WIND_HIGH,
  UV_MODERATE,
  UV_HIGH,
  TEMP_VERY_COLD,
  TEMP_HOT,
  PROB_LOW,
  PROB_MEDIUM,
  PROB_HIGH,
} from './thresholds.js';
import { resolveConflicts } from './conflictResolver.js';
import { getClimateContext } from '../utils/climateContext.js';

const SUNSCREEN_MIN_MINUTES = 20;

/**
 * Map the user's risk tolerance to the probability bar at which rain
 * recommendations fire.
 *
 *   high   (cautious) → PROB_LOW    (20%)  trigger early
 *   medium            → PROB_MEDIUM (50%)
 *   low    (relaxed)  → PROB_HIGH   (70%)  trigger only when very likely
 */
function rainProbThresholdFor(riskTolerance) {
  if (riskTolerance === 'high') return PROB_LOW;
  if (riskTolerance === 'low') return PROB_HIGH;
  return PROB_MEDIUM;
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
 * @param {string} [params.riskTolerance]    'low'|'medium'|'high'
 * @param {number} [params.tripDurationMins]
 * @param {{ latitude:number, longitude:number }} [params.location]
 * @param {Date}   [params.now]              for testability
 * @returns {Array<{ item:string, carry:boolean, reason:string, confidence:string, note?:string }>}
 */
export function generateRecommendations({
  aggregated,
  riskTolerance = 'medium',
  tripDurationMins = 0,
  location,
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
  const effectiveProb = rawProb * climate.sensitivityMultiplier;
  const precip = aggregated.precipitation ?? 0;
  const wind = aggregated.wind_speed_10m ?? 0;
  const uv = aggregated.uv_index ?? 0;
  const temp = aggregated.temperature_2m ?? null;
  const appTemp = aggregated.apparent_temperature ?? temp;

  const probBar = rainProbThresholdFor(riskTolerance);
  const triggered = [];

  // Rain → umbrella, with optional raincoat layered on for high winds.
  const rainTriggered = effectiveProb > probBar && precip > RAIN_LIGHT;
  if (rainTriggered) {
    triggered.push({
      item: 'umbrella',
      carry: true,
      reason: `Rain expected (${Math.round(rawProb)}% chance, ~${precip.toFixed(1)} mm/hr).`,
      confidence: confidenceFor(rawProb, precip),
    });
    if (wind > WIND_HIGH) {
      triggered.push({
        item: 'raincoat',
        carry: true,
        reason: `Rain with high winds (${Math.round(wind)} km/h).`,
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

  // UV high or cold → hat / cap (the same item, separate reasons per ALGORITHM.md).
  if (uv > UV_MODERATE || (temp != null && temp < TEMP_VERY_COLD)) {
    triggered.push({
      item: 'hat',
      carry: true,
      reason:
        uv > UV_MODERATE
          ? `High UV (${uv.toFixed(1)}).`
          : `Cold (${Math.round(temp)}°C).`,
      confidence: 'likely',
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

  // Apparent temp hot → light clothing note.
  if (appTemp != null && appTemp > TEMP_HOT) {
    triggered.push({
      item: 'light_clothing',
      carry: true,
      reason: `Hot (feels like ${Math.round(appTemp)}°C). Dress light.`,
      confidence: 'likely',
    });
  }

  return resolveConflicts(triggered, aggregated);
}
