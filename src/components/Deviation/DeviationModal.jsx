import { useEffect, useState } from 'react';
import { useRoutine } from '../../hooks/useRoutine.js';

const DEVIATION_KEY = 'ww_deviation_today';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readDeviations() {
  try {
    const raw = globalThis.localStorage?.getItem(DEVIATION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed?.date !== todayISO()) {
      // Yesterday's overrides — clear them.
      globalThis.localStorage?.removeItem(DEVIATION_KEY);
      return {};
    }
    return parsed.overrides ?? {};
  } catch {
    return {};
  }
}

function writeDeviations(overrides) {
  try {
    globalThis.localStorage?.setItem(
      DEVIATION_KEY,
      JSON.stringify({ date: todayISO(), overrides })
    );
  } catch {
    // ignore
  }
}

export default function DeviationModal({ open, onClose }) {
  const { routine } = useRoutine();
  const [overrides, setOverrides] = useState(readDeviations);

  useEffect(() => {
    if (open) setOverrides(readDeviations());
  }, [open]);

  if (!open) return null;

  const set = (windowId, patch) => {
    const next = { ...overrides, [windowId]: { ...overrides[windowId], ...patch } };
    setOverrides(next);
    writeDeviations(next);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deviation-title"
      className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[85vh] overflow-y-auto">
        <header className="flex items-center justify-between mb-4">
          <h2 id="deviation-title" className="text-lg font-semibold text-slate-100">
            Today's plans changed?
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

        {routine.windows.length === 0 && (
          <p className="text-slate-400 text-sm">No windows set up yet.</p>
        )}

        <ul className="space-y-3">
          {routine.windows.map((w) => {
            const o = overrides[w.id] ?? {};
            const skip = o.skip ?? false;
            return (
              <li key={w.id} className="bg-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-100 font-medium">{w.label}</span>
                  <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skip}
                      onChange={(e) => set(w.id, { skip: e.target.checked })}
                      className="accent-sky-400 h-5 w-5"
                    />
                    Skip today
                  </label>
                </div>
                {!skip && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <label className="block text-xs text-slate-400">
                      Start
                      <input
                        type="time"
                        value={o.startTime ?? w.startTime}
                        onChange={(e) => set(w.id, { startTime: e.target.value })}
                        className="mt-1 w-full bg-slate-900 text-slate-100 px-2 py-2 rounded-lg min-h-[44px]"
                      />
                    </label>
                    <label className="block text-xs text-slate-400">
                      End
                      <input
                        type="time"
                        value={o.endTime ?? w.endTime}
                        onChange={(e) => set(w.id, { endTime: e.target.value })}
                        className="mt-1 w-full bg-slate-900 text-slate-100 px-2 py-2 rounded-lg min-h-[44px]"
                      />
                    </label>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

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

// Non-component accessor used by the Dashboard (Session 4) to merge overrides
// into the routine before running recommendations.
export function getTodayDeviations() {
  return readDeviations();
}
