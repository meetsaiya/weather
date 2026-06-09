import { useState } from 'react';
import { useRoutine } from '../../hooks/useRoutine.js';

export default function StepNotifications({ onPrev, onFinish }) {
  const { routine, saveRoutine } = useRoutine();
  const [enabled, setEnabled] = useState(routine.notificationsEnabled);
  const [time, setTime] = useState(routine.notificationTime || '07:00');
  const [permState, setPermState] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const result = await Notification.requestPermission();
      setPermState(result);
    } catch {
      // Some browsers throw if called outside a user gesture; ignore.
    }
  };

  const toggle = async (e) => {
    const newVal = e.target.checked;
    setEnabled(newVal);
    if (newVal && permState === 'default') await requestPermission();
  };

  const finish = () => {
    saveRoutine({
      notificationsEnabled: enabled,
      notificationTime: time,
      onboardingComplete: true,
    });
    onFinish?.();
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-medium text-slate-100">Morning briefing?</h2>
      <p className="text-slate-400 text-sm">
        A short notification each morning with the day's recommendations. Optional.
      </p>

      <label className="flex items-center justify-between bg-slate-800 p-4 rounded-xl min-h-[44px] cursor-pointer">
        <span className="text-slate-100">Enable briefing</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={toggle}
          className="h-6 w-6 accent-sky-400"
        />
      </label>

      {enabled && (
        <label className="block">
          <span className="text-sm text-slate-400">Notification time</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1 w-full bg-slate-800 text-slate-100 px-3 py-2 rounded-lg min-h-[44px] focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </label>
      )}

      {enabled && permState === 'denied' && (
        <p className="text-amber-400 text-xs">
          Notifications are blocked. Re-allow them in your browser settings to receive briefings.
        </p>
      )}
      {enabled && permState === 'unsupported' && (
        <p className="text-amber-400 text-xs">
          Notifications aren't supported here. We'll fall back to an in-app banner.
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
          onClick={finish}
          className="flex-1 bg-sky-500 hover:bg-sky-400 text-white font-medium py-3 rounded-lg min-h-[44px] transition"
        >
          Finish setup
        </button>
      </div>
    </section>
  );
}
