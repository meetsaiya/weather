import FeedbackPrompt from '../Feedback/FeedbackPrompt.jsx';
import { CONSEQUENCE_OPTIONS } from '../../utils/consequence.js';

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

export default function WindowCard({ window: win, recs, english, status }) {
  const actualStatus = status ?? windowStatus(win);
  const active = recs.filter((r) => r.carry);

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
                  {r.confidence && r.confidence !== 'likely' && (
                    <p className={`text-xs ${CONFIDENCE_TONE[r.confidence] ?? 'text-slate-500'}`}>
                      {r.confidence}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {actualStatus === 'past' && (
        <FeedbackPrompt windowId={win.id} date={todayISO()} label={win.label} />
      )}
    </article>
  );
}

export { windowStatus };
