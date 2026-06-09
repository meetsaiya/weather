import { useMemo, useState } from 'react';
import { useRoutine } from '../../hooks/useRoutine.js';
import { useWeather } from '../../hooks/useWeather.js';
import { useFeedback } from '../../hooks/useFeedback.js';
import { aggregateExposure } from '../../core/exposureEngine.js';
import { generateRecommendations } from '../../core/recommendEngine.js';
import { generatePlainEnglish } from '../../core/plainEnglish.js';
import { applyDeviations } from '../../utils/deviations.js';
import DaySummary from './DaySummary.jsx';
import WindowCard, { windowStatus } from './WindowCard.jsx';
import DeviationModal from '../Deviation/DeviationModal.jsx';

function relativeTime(ms) {
  if (ms == null) return '—';
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return `${Math.floor(hr / 24)} day ago`;
}

function todayLabel(d = new Date()) {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function Dashboard() {
  const { routine, resetRoutine } = useRoutine();
  const { weatherData, isStale, isOffline, lastFetched, isLoading, error, refresh } = useWeather(
    routine.location
  );
  const { thresholdNudge } = useFeedback();
  const [deviationOpen, setDeviationOpen] = useState(false);
  const [, setDeviationsTick] = useState(0); // bump to re-merge when modal closes
  const closeDeviation = () => {
    setDeviationOpen(false);
    setDeviationsTick((n) => n + 1);
  };

  // Merge today's deviations and run the pipeline per window.
  const cards = useMemo(() => {
    if (!weatherData) return [];
    const windows = applyDeviations(routine.windows);
    return windows.map((win) => {
      const exposure = aggregateExposure({
        userWindow: win,
        hourlyWeatherArray: weatherData,
      });
      const recs = generateRecommendations({
        aggregated: exposure.aggregatedWeather,
        riskTolerance: win.riskTolerance,
        tripDurationMins: win.tripDurationMins,
        location: routine.location,
        thresholdNudge,
      });
      const english = generatePlainEnglish(recs, win.label);
      return { window: win, recs, english, status: windowStatus(win) };
    });
    // setDeviationsTick is referenced to register the dep; re-merge on modal close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weatherData, routine.windows, routine.location, thresholdNudge, setDeviationsTick]);

  return (
    <div className="min-h-screen p-6 max-w-md mx-auto pb-24">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">{todayLabel()}</p>
        <h1 className="text-2xl font-semibold text-slate-100">
          {routine.location?.label ?? 'WeatherWise'}
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-slate-500">Updated {relativeTime(lastFetched)}</p>
          <button
            type="button"
            onClick={refresh}
            disabled={isLoading}
            className="text-xs text-sky-400 hover:text-sky-300 disabled:text-slate-600 transition"
          >
            {isLoading ? 'refreshing…' : 'refresh'}
          </button>
        </div>
      </header>

      {isStale && (
        <div
          className="mb-4 bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm rounded-lg p-3"
          role="status"
        >
          Weather data may be outdated{isOffline ? ' — you appear to be offline' : ''}. Last
          updated {relativeTime(lastFetched)}.
        </div>
      )}

      {error && !weatherData && (
        <div
          className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm rounded-lg p-3"
          role="alert"
        >
          Couldn't load the forecast: {error}.
          <button
            type="button"
            onClick={refresh}
            className="block mt-2 text-rose-100 underline"
          >
            Try again
          </button>
        </div>
      )}

      {weatherData && (
        <>
          <DaySummary weatherData={weatherData} />

          <section className="mt-4 space-y-3">
            {cards.length === 0 && routine.windows.length > 0 && (
              <div className="bg-slate-800 rounded-xl p-4 text-slate-400 text-sm">
                All windows skipped today. Tap the button below to undo.
              </div>
            )}
            {cards.map((c) => (
              <WindowCard
                key={c.window.id}
                window={c.window}
                recs={c.recs}
                english={c.english}
                status={c.status}
              />
            ))}
            {routine.windows.length === 0 && (
              <div className="bg-slate-800 rounded-xl p-4">
                <p className="text-slate-300 text-sm">
                  No windows set up yet. Add one to get recommendations.
                </p>
                <button
                  type="button"
                  onClick={resetRoutine}
                  className="mt-3 text-sm text-sky-400 hover:text-sky-300"
                >
                  Go to setup
                </button>
              </div>
            )}
          </section>
        </>
      )}

      {!weatherData && isLoading && (
        <div className="bg-slate-800 rounded-xl p-4 text-slate-400 text-sm animate-pulse">
          Loading forecast…
        </div>
      )}

      <button
        type="button"
        onClick={() => setDeviationOpen(true)}
        className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-sky-500 hover:bg-sky-400 text-white font-medium py-3 rounded-full shadow-lg min-h-[44px] transition"
      >
        Today I'm doing something different
      </button>

      <DeviationModal open={deviationOpen} onClose={closeDeviation} />
    </div>
  );
}
