import { useEffect, useState } from 'react';
import FeedbackPrompt from '../Feedback/FeedbackPrompt.jsx';
import { CONSEQUENCE_OPTIONS } from '../../utils/consequence.js';
import { useRoutine } from '../../hooks/useRoutine.js';
import { useFeedback } from '../../hooks/useFeedback.js';
import { useOutcomes, ensureOutcome } from '../../hooks/useOutcomes.js';

const ITEM_ICONS = {
  umbrella: '☂️',
  raincoat: '🧥',
  waterproof_layer: '🧥',
  windcheater: '🧥',
  hat: '🧢',
  scarf: '🧣',
  sunscreen: '🧴',
  light_clothing: '👕',
};

const CONFIDENCE_TONE = {
  likely: 'text-sky-300',
  possible: 'text-slate-400',
  unlikely: 'text-slate-500',
};

const CONFIDENCE_TOOLTIP = {
  likely: 'Based on a 60%+ chance of rain during this window.',
  possible: 'Based on a 30–60% chance of rain during this window.',
  unlikely:
    "Based on a <30% chance — included because you'd rather stay dry.",
};

const FEEDBACK_EXPIRY_MS = 6 * 60 * 60 * 1000;

function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toMinutes(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function windowStatus(window, now = new Date()) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = toMinutes(window.startTime);
  const endMin = toMinutes(window.endTime);
  if (nowMin >= endMin) return 'past';
  if (nowMin >= startMin) return 'active';
  return 'upcoming';
}

function pickPrimaryItem(recs) {
  const PRIORITY = [
    'raincoat',
    'waterproof_layer',
    'umbrella',
    'scarf',
    'windcheater',
    'sunscreen',
    'hat',
    'light_clothing',
  ];
  const carrying = recs.filter((r) => r.carry);
  if (carrying.length === 0) return null;
  return [...carrying].sort(
    (a, b) =>
      (PRIORITY.indexOf(a.item) === -1 ? 99 : PRIORITY.indexOf(a.item)) -
      (PRIORITY.indexOf(b.item) === -1 ? 99 : PRIORITY.indexOf(b.item))
  )[0].item;
}

export default function WindowCard({
  window: win,
  recs,
  english,
  status,
  aggregated,
  targetDate,
}) {
  const actualStatus = status ?? windowStatus(win);
  const active = recs.filter((r) => r.carry);
  const today = todayISO();
  const date = targetDate ?? today;
  const isToday = date === today;

  const { routine } = useRoutine();
  const { upsert, find } = useOutcomes();
  const { hasAnswered } = useFeedback();

  // Outcome recording + feedback flow are only meaningful for past windows
  // on today's calendar. Tomorrow's windows haven't happened yet; previous
  // days are out of view for the dashboard.
  useEffect(() => {
    if (!isToday || actualStatus !== 'past' || !aggregated) return;
    ensureOutcome({
      window: win,
      date,
      location: routine?.location,
      forecast: {
        precipitation_probability: aggregated.precipitation_probability,
        precipitation: aggregated.precipitation,
      },
      recommended: {
        primaryItem: pickPrimaryItem(recs),
        summary: english?.summary ?? '',
        carry: active.length > 0,
      },
      upsert,
      find,
    });
    // Only re-fire if the window flips to 'past' or its identifier changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualStatus, win.id, date, aggregated?.precipitation_probability]);

  const outcome = isToday ? find(win.id, date) : null;
  const answered = isToday ? hasAnswered(win.id, date) : false;
  const feedbackExpired =
    isToday && actualStatus === 'past' && isExpiredAt(win, date) && !answered;
  const showStrip = isToday && actualStatus === 'past' && (answered || feedbackExpired);
  const showFeedback = isToday && actualStatus === 'past' && !showStrip;

  return (
    <article className={`bg-slate-800 rounded-xl p-4 ${actualStatus === 'past' ? 'opacity-70' : ''}`}>
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-slate-100 font-medium">
          {win.label}
          {win.deviated && (
            <span className="ml-2 text-xs text-amber-400 font-normal">(today only)</span>
          )}
        </h3>
        <span className="text-xs text-slate-500">
          {win.startTime}–{win.endTime}
        </span>
      </header>
      <p className="text-xs text-slate-500 mt-0.5">
        {win.tripDurationMins} min outside ·{' '}
        <span className="text-slate-400">
          {CONSEQUENCE_OPTIONS[win.consequenceLevel]?.tag ?? win.consequenceLevel}
        </span>
        {actualStatus === 'past' && ' · already happened'}
        {actualStatus === 'active' && ' · happening now'}
      </p>

      {active.length === 0 ? (
        <p className="mt-3 text-slate-300 text-sm">{english.summary}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {active.slice(0, 4).map((r, i) => {
            const sentence = english.sentences[i] ?? r.reason;
            return (
              <li key={r.item + i} className="flex items-start gap-2">
                <span className="text-lg" aria-hidden>
                  {ITEM_ICONS[r.item] ?? '•'}
                </span>
                <div className="flex-1">
                  <p className="text-slate-100 text-sm leading-snug">{sentence}</p>
                  {r.item === 'umbrella' && r.confidence && (
                    <ConfidenceChip confidence={r.confidence} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showStrip && <OutcomeStrip outcome={outcome} primaryItem={pickPrimaryItem(recs)} />}

      {showFeedback && <FeedbackPrompt window={win} date={date} />}
    </article>
  );
}

function isExpiredAt(window, date, now = new Date()) {
  if (!window?.endTime || !date) return false;
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return false;
  const endMin = toMinutes(window.endTime);
  const windowEnd = new Date(y, m - 1, d, Math.floor(endMin / 60), endMin % 60, 0, 0);
  return now.getTime() - windowEnd.getTime() > FEEDBACK_EXPIRY_MS;
}

function ConfidenceChip({ confidence }) {
  const [open, setOpen] = useState(false);
  const tone = CONFIDENCE_TONE[confidence] ?? 'text-slate-500';
  const tooltip = CONFIDENCE_TOOLTIP[confidence];
  return (
    <span className="block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={tooltip}
        aria-expanded={open}
        className={`text-[11px] uppercase tracking-wide ${tone} hover:text-slate-200 transition`}
      >
        {confidence}
      </button>
      {open && tooltip && (
        <span className="block text-[11px] text-slate-500 italic mt-0.5">{tooltip}</span>
      )}
    </span>
  );
}

function OutcomeStrip({ outcome, primaryItem }) {
  const forecast =
    outcome?.forecastProb != null
      ? `Forecast: ${Math.round(outcome.forecastProb)}% rain`
      : 'Forecast: —';
  const actual = outcome?.observed
    ? `Actual: ${outcome.observed.intensity}`
    : 'Actual: —';

  let userCall = null;
  if (outcome?.recommended) {
    if (outcome.recommended.carry && outcome.recommended.primaryItem) {
      userCall = `${humaniseItem(outcome.recommended.primaryItem)} suggested`;
    } else {
      userCall = 'Nothing needed';
    }
    if (outcome.observed) {
      const matched = outcome.recommended.carry === outcome.observed.didRain;
      userCall += matched ? ' ✓' : ' ⚬';
    }
  } else if (primaryItem) {
    userCall = `${humaniseItem(primaryItem)} suggested`;
  }

  return (
    <p className="mt-3 text-[11px] text-slate-500 border-t border-slate-700/50 pt-2">
      {forecast} · {actual}
      {userCall ? ` · ${userCall}` : ''}
    </p>
  );
}

function humaniseItem(item) {
  return (
    {
      umbrella: 'Umbrella',
      raincoat: 'Raincoat',
      waterproof_layer: 'Waterproof layer',
      windcheater: 'Windcheater',
      scarf: 'Scarf',
      hat: 'Hat',
      sunscreen: 'Sunscreen',
      light_clothing: 'Light clothing',
    }[item] || item
  );
}

export { windowStatus };
