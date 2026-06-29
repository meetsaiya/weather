import { useCallback, useMemo, useState } from 'react';
import { useRoutine } from '../../hooks/useRoutine.js';
import { useWeather } from '../../hooks/useWeather.js';
import { useFeedback } from '../../hooks/useFeedback.js';
import { useNotifications } from '../../hooks/useNotifications.js';
import { aggregateExposure } from '../../core/exposureEngine.js';
import { generateRecommendations } from '../../core/recommendEngine.js';
import { generatePlainEnglish } from '../../core/plainEnglish.js';
import { applyDeviations } from '../../utils/deviations.js';
import { buildDailyBrief } from '../../utils/dailyBrief.js';
import {
  todayISO,
  tomorrowISO,
  parseISOAsLocalDate,
  formatLongDate,
} from '../../utils/dateHelpers.js';
import DaySummary from './DaySummary.jsx';
import DateToggle from './DateToggle.jsx';
import WindowCard, { windowStatus } from './WindowCard.jsx';
import Skeleton from './Skeleton.jsx';
import BriefBanner from './BriefBanner.jsx';
import AccuracySummary from './AccuracySummary.jsx';
import DeviationModal from '../Deviation/DeviationModal.jsx';
import LocationPicker from '../Location/LocationPicker.jsx';
import RoutineEditor from '../Routine/RoutineEditor.jsx';
import InstallPrompt from '../Install/InstallPrompt.jsx';

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

export default function Dashboard() {
  const { routine } = useRoutine();
  const { weatherData, isStale, isOffline, lastFetched, isLoading, error, refresh } = useWeather(
    routine.location
  );
  const { thresholdNudge } = useFeedback();
  const [deviationOpen, setDeviationOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [routineOpen, setRoutineOpen] = useState(false);
  const [, setDeviationsTick] = useState(0); // bump to re-merge when modal closes
  const [view, setView] = useState('today'); // 'today' | 'tomorrow'

  const closeDeviation = () => {
    setDeviationOpen(false);
    setDeviationsTick((n) => n + 1);
  };

  const targetDateISO = view === 'tomorrow' ? tomorrowISO() : todayISO();
  const targetDate = parseISOAsLocalDate(targetDateISO);
  const isTomorrow = view === 'tomorrow';

  // Whether the loaded weather actually contains hours for the target date.
  // Open-Meteo's response covers today + tomorrow in one fetch, so this is
  // true once the initial fetch completes. Used to gate the skeleton on the
  // Tomorrow tab when the cache is missing or pre-first-fetch.
  const haveTargetDateData =
    Array.isArray(weatherData) &&
    weatherData.some((h) => typeof h.hour === 'string' && h.hour.startsWith(targetDateISO));

  // Morning briefing: always uses today's data — tomorrow's view is a
  // dashboard-only planning aid and never feeds the notification.
  const computeBrief = useCallback(
    () => buildDailyBrief({ routine, weatherData, thresholdNudge }),
    [routine, weatherData, thresholdNudge]
  );
  const { inAppBrief, dismissBanner } = useNotifications({
    enabled: !!routine.notificationsEnabled,
    time: routine.notificationTime,
    dataKey: lastFetched,
    computeBrief,
  });

  // Run the per-window pipeline for the selected day. Deviations apply to
  // today only — on Tomorrow we always use the base routine.
  const cards = useMemo(() => {
    if (!weatherData) return [];
    const windows = isTomorrow ? routine.windows : applyDeviations(routine.windows);
    return windows.map((win) => {
      const exposure = aggregateExposure({
        userWindow: win,
        hourlyWeatherArray: weatherData,
        baseDate: targetDate,
      });
      const recs = generateRecommendations({
        aggregated: exposure.aggregatedWeather,
        consequenceLevel: win.consequenceLevel,
        tripDurationMins: win.tripDurationMins,
        location: routine.location,
        thresholdNudge,
        now: targetDate,
      });
      const english = generatePlainEnglish(recs, win.label, exposure.aggregatedWeather);
      return {
        window: win,
        recs,
        english,
        // Tomorrow's windows are always "upcoming" — no past/active states.
        status: isTomorrow ? 'upcoming' : windowStatus(win),
        aggregated: exposure.aggregatedWeather,
      };
    });
    // setDeviationsTick is referenced to register the dep; re-merge on modal close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    weatherData,
    routine.windows,
    routine.location,
    thresholdNudge,
    isTomorrow,
    targetDateISO,
    setDeviationsTick,
  ]);

  const headerDateLabel = formatLongDate(targetDate);
  const showSkeleton = !haveTargetDateData && (isLoading || !error);

  return (
    <div className="min-h-screen p-6 max-w-md mx-auto pb-24">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">{headerDateLabel}</p>
        <button
          type="button"
          onClick={() => setLocationOpen(true)}
          className="group flex items-center gap-2 text-left -ml-1 px-1 py-0.5 rounded hover:bg-slate-800/60 transition"
          aria-label="Change location"
        >
          <h1 className="text-2xl font-semibold text-slate-100">
            {routine.location?.label ?? 'WeatherWise'}
          </h1>
          <span
            className="text-slate-500 group-hover:text-sky-400 transition text-sm"
            aria-hidden
          >
            ▾
          </span>
        </button>
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

      <div className="mb-4">
        <DateToggle value={view} onChange={setView} />
      </div>

      <BriefBanner brief={inAppBrief} onDismiss={dismissBanner} />
      <InstallPrompt />

      {isStale && (
        <div
          className="mb-4 bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm rounded-lg p-3"
          role="status"
        >
          Weather data may be outdated{isOffline ? ' — you appear to be offline' : ''}. Last
          updated {relativeTime(lastFetched)}.
        </div>
      )}

      {error && !haveTargetDateData && (
        <div
          className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm rounded-lg p-3"
          role="alert"
        >
          {isOffline
            ? 'No forecast data available offline. Connect to get the latest.'
            : `Couldn't load the forecast: ${error}.`}
          <button
            type="button"
            onClick={refresh}
            className="block mt-2 text-rose-100 underline"
          >
            Try again
          </button>
        </div>
      )}

      {haveTargetDateData && (
        <>
          <DaySummary weatherData={weatherData} targetDate={targetDateISO} />

          <section className="mt-4 space-y-3">
            {cards.length === 0 && routine.windows.length > 0 && !isTomorrow && (
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
                aggregated={c.aggregated}
                targetDate={targetDateISO}
              />
            ))}
            {routine.windows.length === 0 && (
              <div className="bg-slate-800 rounded-xl p-4">
                <p className="text-slate-300 text-sm">
                  No windows set up yet. Add one to get recommendations.
                </p>
                <button
                  type="button"
                  onClick={() => setRoutineOpen(true)}
                  className="mt-3 text-sm text-sky-400 hover:text-sky-300"
                >
                  Add a window
                </button>
              </div>
            )}
            {routine.windows.length > 0 && (
              <button
                type="button"
                onClick={() => setRoutineOpen(true)}
                className="w-full border border-dashed border-slate-700 hover:border-sky-400 hover:bg-sky-400/10 text-slate-400 hover:text-sky-300 py-3 rounded-xl min-h-[44px] transition text-sm"
              >
                + Add or edit windows
              </button>
            )}
          </section>

          {!isTomorrow && <AccuracySummary />}
        </>
      )}

      {showSkeleton && <Skeleton />}

      {/* Deviation button is today-only. On Tomorrow we hide it entirely
          and surface an explanatory tag in the bottom strip instead. */}
      {!isTomorrow ? (
        <button
          type="button"
          onClick={() => setDeviationOpen(true)}
          className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-sky-500 hover:bg-sky-400 text-white font-medium py-3 rounded-full shadow-lg min-h-[44px] transition"
        >
          Today I'm doing something different
        </button>
      ) : (
        <div
          className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-slate-800 text-slate-400 text-xs text-center py-3 rounded-full shadow-lg ring-1 ring-slate-700"
          role="note"
        >
          Deviations apply to today only.
        </div>
      )}

      <DeviationModal open={deviationOpen} onClose={closeDeviation} />
      <LocationPicker open={locationOpen} onClose={() => setLocationOpen(false)} />
      <RoutineEditor open={routineOpen} onClose={() => setRoutineOpen(false)} />
    </div>
  );
}
