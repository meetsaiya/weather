import { useState } from 'react';
import StepLocation from './StepLocation.jsx';
import StepRoutine from './StepRoutine.jsx';
import StepNotifications from './StepNotifications.jsx';
import { useRoutine } from '../../hooks/useRoutine.js';

const STEPS = ['Location', 'Routine', 'Notifications'];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const { routine, saveRoutine } = useRoutine();

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));
  const finish = () => saveRoutine({ onboardingComplete: true });

  // Allow jumping back to a previous step via the dots, but never forward —
  // forward navigation gates on validation.
  const jump = (i) => i < step && setStep(i);

  return (
    <div className="min-h-screen flex flex-col p-6 max-w-md mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-sky-400">WeatherWise</h1>
        <p className="text-sm text-slate-400 mt-1">Quick setup — three steps.</p>
        <StepDots count={STEPS.length} current={step} onJump={jump} />
      </header>
      <main className="flex-1">
        {step === 0 && (
          <StepLocation routine={routine} onSave={saveRoutine} onNext={next} />
        )}
        {step === 1 && <StepRoutine onPrev={prev} onNext={next} />}
        {step === 2 && <StepNotifications onPrev={prev} onFinish={finish} />}
      </main>
    </div>
  );
}

function StepDots({ count, current, onJump }) {
  return (
    <div className="flex gap-2 mt-4" role="tablist" aria-label="Onboarding progress">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Step ${i + 1}`}
          aria-current={i === current ? 'step' : undefined}
          onClick={() => onJump?.(i)}
          className={`h-2 rounded-full transition-all ${
            i === current ? 'w-8 bg-sky-400' : 'w-2 bg-slate-700 hover:bg-slate-600'
          }`}
        />
      ))}
    </div>
  );
}
