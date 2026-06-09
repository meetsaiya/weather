import { useState } from 'react';
import { useRoutine } from '../../hooks/useRoutine.js';
import DeviationModal from '../Deviation/DeviationModal.jsx';
import { TOLERANCE_LABELS } from '../Onboarding/WindowEditor.jsx';

export default function SetupComplete() {
  const { routine, resetRoutine } = useRoutine();
  const [deviationOpen, setDeviationOpen] = useState(false);

  return (
    <div className="min-h-screen p-6 max-w-md mx-auto">
      <div className="flex flex-col items-center text-center pt-10">
        <div className="text-5xl text-sky-400" aria-hidden>
          ✓
        </div>
        <h1 className="text-2xl font-semibold text-slate-100 mt-3">Setup complete</h1>
        <p className="text-slate-400 text-sm mt-2">
          You're all set. The dashboard arrives in the next build.
        </p>
      </div>

      <div className="mt-8 bg-slate-800 rounded-xl p-4 space-y-3 text-sm">
        <Section label="Location">
          <p className="text-slate-100">{routine.location?.label ?? '—'}</p>
        </Section>

        <Section label={`Windows (${routine.windows.length})`}>
          <ul className="space-y-1.5">
            {routine.windows.map((w) => (
              <li key={w.id}>
                <p className="text-slate-100">{w.label}</p>
                <p className="text-xs text-slate-500">
                  {w.startTime}–{w.endTime} · {w.tripDurationMins} min outside · {w.transportMode} ·{' '}
                  {TOLERANCE_LABELS[w.riskTolerance] ?? w.riskTolerance}
                </p>
              </li>
            ))}
          </ul>
        </Section>

        <Section label="Morning briefing">
          <p className="text-slate-100">
            {routine.notificationsEnabled ? `Enabled at ${routine.notificationTime}` : 'Off'}
          </p>
        </Section>
      </div>

      <button
        type="button"
        onClick={() => setDeviationOpen(true)}
        className="mt-6 w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-3 rounded-lg min-h-[44px] transition"
      >
        Today I'm doing something different
      </button>

      <button
        type="button"
        onClick={() => {
          if (confirm('Reset everything and start onboarding from scratch?')) resetRoutine();
        }}
        className="mt-4 w-full text-sm text-slate-500 hover:text-sky-400 transition"
      >
        Start over
      </button>

      <DeviationModal open={deviationOpen} onClose={() => setDeviationOpen(false)} />
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
