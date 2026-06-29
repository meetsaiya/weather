import { useRoutine, MAX_WINDOWS } from '../../hooks/useRoutine.js';
import WindowEditor from '../Onboarding/WindowEditor.jsx';

const DEFAULT_WINDOW = {
  label: '',
  startTime: '08:00',
  endTime: '09:00',
  tripDurationMins: 20,
  transportMode: 'walking',
  consequenceLevel: 'medium',
};

export default function RoutineEditor({ open, onClose }) {
  const { routine, addWindow, updateWindow, deleteWindow } = useRoutine();
  if (!open) return null;

  const atMax = routine.windows.length >= MAX_WINDOWS;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="routine-editor-title"
      className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <header className="flex items-center justify-between mb-2">
          <h2 id="routine-editor-title" className="text-lg font-semibold text-slate-100">
            Your routine
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl text-slate-400 hover:text-slate-200 min-h-[44px] min-w-[44px] leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <p className="text-slate-400 text-sm mb-4">
          Up to {MAX_WINDOWS} windows. Changes save automatically.
        </p>

        {routine.windows.length === 0 && (
          <p className="bg-slate-800 rounded-lg p-3 text-slate-400 text-sm mb-4">
            No windows yet. Tap below to add one.
          </p>
        )}

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
            className="mt-4 w-full border border-dashed border-slate-600 hover:border-sky-400 hover:bg-sky-400/10 text-slate-400 hover:text-sky-300 py-3 rounded-xl min-h-[44px] transition"
          >
            + Add window
          </button>
        )}

        {atMax && (
          <p className="mt-4 text-slate-500 text-xs text-center">
            Maximum of {MAX_WINDOWS} windows reached. Delete one to add another.
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-6 bg-sky-500 hover:bg-sky-400 text-white py-3 rounded-lg min-h-[44px] font-medium transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}
