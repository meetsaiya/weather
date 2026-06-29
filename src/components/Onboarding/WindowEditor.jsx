import { CONSEQUENCE_OPTIONS, CONSEQUENCE_LEVELS } from '../../utils/consequence.js';

const MODES = [
  { value: 'walking', label: 'Walking' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'driving', label: 'Driving' },
  { value: 'transit', label: 'Transit' },
];

function toMinutes(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export default function WindowEditor({ window: win, onChange, onDelete }) {
  const set = (k, v) => onChange({ ...win, [k]: v });

  const span = toMinutes(win.endTime) - toMinutes(win.startTime);
  const orderErr = span <= 0 ? 'End must be after start.' : null;
  const tripErr =
    !orderErr && win.tripDurationMins > span
      ? `Time outside (${win.tripDurationMins}m) can't exceed the window (${span}m).`
      : null;

  return (
    <div className="bg-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={win.label}
          onChange={(e) => set('label', e.target.value)}
          placeholder="Label (e.g. Morning commute)"
          aria-label="Window label"
          className="flex-1 bg-slate-900 text-slate-100 px-3 py-2 rounded-lg min-h-[44px] focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete window"
          className="px-3 py-2 text-2xl text-slate-400 hover:text-red-400 min-h-[44px] min-w-[44px] leading-none"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-slate-400">
          Earliest start
          <input
            type="time"
            value={win.startTime}
            onChange={(e) => set('startTime', e.target.value)}
            className="mt-1 w-full bg-slate-900 text-slate-100 px-3 py-2 rounded-lg min-h-[44px] focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </label>
        <label className="block text-xs text-slate-400">
          Latest end
          <input
            type="time"
            value={win.endTime}
            onChange={(e) => set('endTime', e.target.value)}
            className="mt-1 w-full bg-slate-900 text-slate-100 px-3 py-2 rounded-lg min-h-[44px] focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </label>
      </div>
      {orderErr && <p className="text-red-400 text-xs">{orderErr}</p>}

      <label className="block text-xs text-slate-400">
        Time outside (minutes)
        <input
          type="number"
          min="1"
          max="240"
          value={win.tripDurationMins}
          onChange={(e) => set('tripDurationMins', Math.max(1, parseInt(e.target.value, 10) || 1))}
          className="mt-1 w-full bg-slate-900 text-slate-100 px-3 py-2 rounded-lg min-h-[44px] focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
      </label>
      {tripErr && <p className="text-red-400 text-xs">{tripErr}</p>}

      <label className="block text-xs text-slate-400">
        Transport
        <select
          value={win.transportMode}
          onChange={(e) => set('transportMode', e.target.value)}
          className="mt-1 w-full bg-slate-900 text-slate-100 px-3 py-2 rounded-lg min-h-[44px] focus:outline-none focus:ring-2 focus:ring-sky-400"
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="text-xs text-slate-400 mb-2">If you get caught in rain…</legend>
        <div
          className="space-y-2"
          role="radiogroup"
          aria-label="Consequence of getting wet"
        >
          {CONSEQUENCE_LEVELS.map((level) => {
            const opt = CONSEQUENCE_OPTIONS[level];
            const selected = win.consequenceLevel === level;
            return (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => set('consequenceLevel', level)}
                className={`block w-full text-left p-3 rounded-lg cursor-pointer min-h-[44px] transition ${
                  selected
                    ? 'bg-sky-500/15 ring-2 ring-sky-400'
                    : 'bg-slate-900 hover:bg-slate-700 ring-1 ring-transparent'
                }`}
              >
                <p className="text-slate-100 text-sm font-medium">{opt.title}</p>
                <p className="text-slate-300 text-xs mt-1 leading-snug">{opt.description}</p>
                <p className="text-slate-500 text-[11px] mt-2 leading-snug italic">{opt.note}</p>
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

