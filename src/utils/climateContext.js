/**
 * Coarse climate context for a location + month.
 *
 * The returned `sensitivityMultiplier` scales the *effective* rain probability
 * before it's compared to recommendation thresholds. A value below 1.0 dampens
 * triggers (monsoon regions where 60% chance is the seasonal baseline, not a
 * signal); 1.0 leaves things alone.
 *
 * Tropical monsoon belt is lat 0–25; Jun–Sep in the northern hemisphere,
 * Dec–Mar in the southern. Everything else is treated as temperate.
 *
 * @param {object} params
 * @param {number} params.latitude
 * @param {number} params.longitude   currently unused — included for future region rules
 * @param {number} params.month       1–12
 * @returns {{ sensitivityMultiplier: number, label: string }}
 */
export function getClimateContext({ latitude, longitude, month } = {}) {
  if (latitude == null || month == null) {
    return { sensitivityMultiplier: 1.0, label: 'unknown' };
  }

  const absLat = Math.abs(latitude);
  const inTropics = absLat <= 25;

  if (inTropics && latitude >= 0 && month >= 6 && month <= 9) {
    return { sensitivityMultiplier: 0.7, label: 'tropical-monsoon-northern' };
  }
  if (inTropics && latitude < 0 && (month >= 12 || month <= 3)) {
    return { sensitivityMultiplier: 0.7, label: 'tropical-monsoon-southern' };
  }

  return { sensitivityMultiplier: 1.0, label: 'temperate' };
}
