import { useRoutine, MAX_WINDOWS } from '../../hooks/useRoutine.js';
import WindowEditor from './WindowEditor.jsx';

const DEFAULT_WINDOW = {
  label: '',
  startTime: '08:00',
  endTime: '09:00',
  tripDurationMins: 20,
  transportMode: 'walking',
  riskTolerance: 'medium',
};

function toMinutes(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function isValid(w) {
  if (!w.label.trim()) return false;
  const span = toMinutes(w.endTime) - toMinutes(w.startTime);
  if (span <= 0) return false;
  if (!Number.isFinite(w.tripDurationMins) || w.tripDurationMins <= 0) return false;
  if (w.tripDurationMins > span) return false;
  return true;
}

export default function StepRoutine({ onPrev, onNext }) {
  const { routine, addWindow, updateWindow, deleteWindow } = useRoutine();

  const valid = routine.windows.length > 0 && routine.windows.every(isValid);
  const atMax = routine.windows.length >= MAX_WINDOWS;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-medium text-slate-100">When are you outside?</h2>
      <p className="text-slate-400 text-sm">
        Add the parts of your day when you're exposed to the weather. Up to {MAX_WINDOWS} windows.
      </p>

      <div className="space-y-4">
        {routine.windows.map((w) => (
          <WindowEditor
            key={w.id}
            window={w}
            onChange={(patch) => updateWindow(w.id, patch)}
            onDelete={() => deleteWindow(w.id)}
          />
        ))}
      </div>

      {!atMax && (
        <button
          type="button"
          onClick={() => addWindow(DEFAULT_WINDOW)}
          className="w-full border border-dashed border-slate-600 hover:border-sky-400 hover:bg-sky-400/10 text-slate-400 hover:text-sky-300 py-3 rounded-xl min-h-[44px] transition"
        >
          + Add window
        </button>
      )}

      {routine.windows.length === 0 && (
        <p className="text-slate-500 text-xs text-center">
          You need at least one window before continuing.
        </p>
      )}

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onPrev}
          className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-3 rounded-lg min-h-[44px] transition"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!valid}
          className="flex-1 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-3 rounded-lg min-h-[44px] transition"
        >
          Next
        </button>
      </div>
    </section>
  );
}
