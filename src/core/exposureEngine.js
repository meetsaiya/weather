import { sliceHoursByKeys } from './weatherEngine.js';
import {
  getHoursInWindow,
  getWorstHour,
  getWeightedAverage,
  parseTimeOnDate,
} from '../utils/timeUtils.js';

/**
 * Aggregate hourly weather over a user's exposure window.
 *
 * The window's hours are intersected with the forecast and collapsed into a
 * single `aggregatedWeather` object using a strategy chosen by the user's
 * risk tolerance:
 *
 *   - 'high'   (cautious): worst single hour
 *   - 'medium'           : weighted average across overlapping hours
 *   - 'low'    (relaxed) : weighted average — a relaxed probability bar is
 *                          applied downstream in recommendEngine
 *
 * For weighted modes the weight of each hour is the number of trip-minutes
 * that actually fall within it, so a 20-minute trip starting at 17:55 weights
 * the 17:00 hour by 5 and the 18:00 hour by 15. If no trip duration is given
 * we fall back to equal weights.
 *
 * @param {object} params
 * @param {object} params.userWindow      { startTime, endTime, tripDurationMins, riskTolerance }
 * @param {Array}  params.hourlyWeatherArray   parsed Open-Meteo hourly rows
 * @param {Date}   [params.baseDate=new Date()] used to anchor "HH:MM" inputs
 * @returns {{
 *   aggregatedWeather: object|null,
 *   riskTolerance: 'low'|'medium'|'high',
 *   hourKeys: string[],
 *   slice: Array,
 *   strategy: 'worst-hour'|'weighted-average'
 * }}
 */
export function aggregateExposure({
  userWindow,
  hourlyWeatherArray,
  baseDate = new Date(),
} = {}) {
  const {
    startTime,
    endTime,
    tripDurationMins,
    riskTolerance = 'medium',
  } = userWindow ?? {};

  if (!startTime || !endTime || !Array.isArray(hourlyWeatherArray)) {
    return {
      aggregatedWeather: null,
      riskTolerance,
      hourKeys: [],
      slice: [],
      strategy: riskTolerance === 'high' ? 'worst-hour' : 'weighted-average',
    };
  }

  const hourKeys = getHoursInWindow(startTime, endTime, baseDate);
  const slice = sliceHoursByKeys(hourlyWeatherArray, hourKeys);

  let aggregatedWeather;
  let strategy;
  if (riskTolerance === 'high') {
    aggregatedWeather = getWorstHour(slice);
    strategy = 'worst-hour';
  } else {
    const weights = tripOverlapWeights({
      hourKeys,
      startTime,
      endTime,
      tripDurationMins,
      baseDate,
    });
    aggregatedWeather = getWeightedAverage(slice, weights);
    strategy = 'weighted-average';
  }

  return { aggregatedWeather, riskTolerance, hourKeys, slice, strategy };
}

/**
 * For each hour in the window, return the number of trip-minutes that fall
 * inside it. If no trip duration is provided, the trip is assumed to span the
 * full window (equal weights).
 */
function tripOverlapWeights({ hourKeys, startTime, endTime, tripDurationMins, baseDate }) {
  if (!tripDurationMins || tripDurationMins <= 0) return hourKeys.map(() => 1);

  const winStart =
    typeof startTime === 'string' ? parseTimeOnDate(startTime, baseDate) : new Date(startTime);
  const winEnd =
    typeof endTime === 'string' ? parseTimeOnDate(endTime, baseDate) : new Date(endTime);

  // Trip is centred in the window — closer to truth than assuming it starts at
  // the leading edge. The recommendation cares about overlap, not arrival.
  const windowMs = winEnd - winStart;
  const tripMs = tripDurationMins * 60 * 1000;
  const tripStart = new Date(winStart.getTime() + Math.max(0, (windowMs - tripMs) / 2));
  const tripEnd = new Date(tripStart.getTime() + tripMs);

  return hourKeys.map((key) => {
    const hourStart = new Date(key);
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
    const overlap = Math.max(
      0,
      Math.min(tripEnd, hourEnd) - Math.max(tripStart, hourStart)
    );
    return overlap / 60000; // minutes
  });
}
