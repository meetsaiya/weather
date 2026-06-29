import { useEffect, useState } from 'react';
import { useFeedback } from '../../hooks/useFeedback.js';
import { useOutcomes } from '../../hooks/useOutcomes.js';

const FEEDBACK_EXPIRY_MS = 6 * 60 * 60 * 1000; // 6 hours past the window end

function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toMinutes(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function isFeedbackExpired(window, date, now = new Date()) {
  if (!window?.endTime || !date) return false;
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return false;
  const endMin = toMinutes(window.endTime);
  const windowEnd = new Date(y, m - 1, d, Math.floor(endMin / 60), endMin % 60, 0, 0);
  return now.getTime() - windowEnd.getTime() > FEEDBACK_EXPIRY_MS;
}

/**
 * Inline feedback prompt for a window that has already passed.
 *
 *   - Shows a small "forecast vs actual" comparison line (sourced from the
 *     stored outcome record — fetched in background by WindowCard).
 *   - Asks "Did the recommendation make sense for your situation?" with two
 *     text-button options. Maps the answer to wasHelpful for the existing
 *     nudge logic.
 *   - Acknowledges inline. No modals, no over-promise.
 *   - Self-hides if 6 hours have passed since the window ended.
 */
export default function FeedbackPrompt({ window: win, date }) {
  const actualDate = date ?? todayISO();
  const { submitFeedback, hasAnswered } = useFeedback();
  const { find, setUserResponse } = useOutcomes();
  const [acknowledgment, setAcknowledgment] = useState(null);

  const outcome = find(win.id, actualDate);
  const answered = hasAnswered(win.id, actualDate);
  const expired = isFeedbackExpired(win, actualDate);

  // Tick once so the "expired" check re-evaluates as time crosses the 6-hour
  // mark while the page stays open. Cheap because the parent re-renders
  // anyway on most state changes; the timeout is just a safety net.
  const [, force] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => force((n) => n + 1), 5 * 60 * 1000);
    return () => clearTimeout(id);
  }, []);

  if (answered || expired) return null;

  const respond = (felt) => {
    const wasHelpful = felt === 'yes';
    submitFeedback(win.id, wasHelpful, actualDate);
    setUserResponse(win.id, actualDate, felt);
    setAcknowledgment(
      felt === 'yes' ? 'Good to know — noted.' : "Noted. We'll adjust over time."
    );
  };

  if (acknowledgment) {
    return (
      <div className="mt-3 text-xs text-slate-400" role="status" aria-live="polite">
        {acknowledgment}
      </div>
    );
  }

  const forecastProb = outcome?.forecastProb;
  const forecastPrecip = outcome?.forecastPrecip;
  const observed = outcome?.observed;

  return (
    <div
      className="mt-3 rounded-lg bg-slate-900/60 px-3 py-2 space-y-2"
      role="group"
      aria-label={`Feedback for ${win.label}`}
    >
      <ComparisonLine
        forecastProb={forecastProb}
        forecastPrecip={forecastPrecip}
        observed={observed}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-300">
          Did the recommendation make sense for your situation?
        </span>
        <div className="flex gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => respond('yes')}
            className="px-2.5 py-1 rounded-md text-xs text-slate-200 bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-200 ring-1 ring-slate-700 hover:ring-emerald-400 transition min-h-[32px]"
          >
            Yes, felt right
          </button>
          <button
            type="button"
            onClick={() => respond('no')}
            className="px-2.5 py-1 rounded-md text-xs text-slate-200 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-200 ring-1 ring-slate-700 hover:ring-rose-400 transition min-h-[32px]"
          >
            Not quite
          </button>
        </div>
      </div>
    </div>
  );
}

function ComparisonLine({ forecastProb, forecastPrecip, observed }) {
  const forecastPart =
    forecastProb != null
      ? `Forecast: ${Math.round(forecastProb)}% rain${
          forecastPrecip != null && forecastPrecip > 0
            ? `, ${forecastPrecip.toFixed(1)} mm/hr`
            : ''
        }`
      : 'Forecast: —';
  const actualPart = observed ? `What happened: ${observed.intensity}` : 'Actual: —';
  return (
    <p className="text-[11px] text-slate-500 leading-snug">
      {forecastPart} · {actualPart}
    </p>
  );
}
