import { useMemo } from 'react';
import { useRoutine } from '../../hooks/useRoutine.js';
import { useWeather } from '../../hooks/useWeather.js';
import { useFeedback } from '../../hooks/useFeedback.js';
import { aggregateExposure } from '../../core/exposureEngine.js';
import { generateRecommendations } from '../../core/recommendEngine.js';
import { generatePlainEnglish } from '../../core/plainEnglish.js';
import { applyDeviations } from '../../utils/deviations.js';
import { windowStatus } from '../Dashboard/WindowCard.jsx';

// Priority for "most critical" — same as plainEnglish, safety > comfort > convenience.
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

function pickNextWindow(windows) {
  // Currently-active windows first (highest urgency), then upcoming, then past.
  const active = windows.filter((w) => windowStatus(w) === 'active');
  if (active.length) return active[0];
  const upcoming = windows
    .filter((w) => windowStatus(w) === 'upcoming')
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  if (upcoming.length) return upcoming[0];
  // Nothing left today.
  return null;
}

export default function WidgetView() {
  const { routine } = useRoutine();
  const { weatherData, lastFetched } = useWeather(routine.location);
  const { thresholdNudge } = useFeedback();

  const summary = useMemo(() => {
    if (!weatherData || routine.windows.length === 0) {
      return { label: null, line: 'All clear for today' };
    }
    const windows = applyDeviations(routine.windows);
    const next = pickNextWindow(windows);
    if (!next) return { label: null, line: 'All clear for today' };

    const exposure = aggregateExposure({
      userWindow: next,
      hourlyWeatherArray: weatherData,
    });
    const recs = generateRecommendations({
      aggregated: exposure.aggregatedWeather,
      riskTolerance: next.riskTolerance,
      tripDurationMins: next.tripDurationMins,
      location: routine.location,
      thresholdNudge,
    });
    const active = recs
      .filter((r) => r.carry)
      .sort((a, b) => rankItem(a.item) - rankItem(b.item));
    if (active.length === 0) {
      return { label: next.label, line: 'Looking clear.' };
    }
    const english = generatePlainEnglish(recs, next.label);
    return { label: next.label, line: english.sentences[0] ?? active[0].reason };
  }, [weatherData, routine.windows, routine.location, thresholdNudge]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-slate-800 rounded-2xl p-5 shadow-xl">
        <p className="text-xs uppercase tracking-wide text-sky-400">WeatherWise</p>
        <div className="mt-2 space-y-1">
          {summary.label && (
            <p className="text-slate-300 text-sm font-medium">{summary.label}</p>
          )}
          <p className="text-slate-100 text-base leading-snug">{summary.line}</p>
          {!weatherData && (
            <p className="text-slate-500 text-xs">No data yet — open the app.</p>
          )}
        </div>
        {lastFetched && (
          <p className="mt-3 text-xs text-slate-500">
            Updated {Math.max(1, Math.floor((Date.now() - lastFetched) / 60000))} min ago
          </p>
        )}
        <a
          href="/"
          className="mt-4 block text-center bg-sky-500 hover:bg-sky-400 text-white text-sm py-2 rounded-lg transition"
        >
          Open
        </a>
      </div>
    </div>
  );
}
