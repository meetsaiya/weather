import { useState } from 'react';
import { useFeedback } from '../../hooks/useFeedback.js';

export default function FeedbackPrompt({ windowId, date, label }) {
  const { submitFeedback, hasAnswered } = useFeedback();
  const [hidden, setHidden] = useState(false);

  if (hidden || hasAnswered(windowId, date)) return null;

  const respond = (helpful) => {
    submitFeedback(windowId, helpful, date);
    setHidden(true);
  };

  return (
    <div
      className="mt-3 flex items-center justify-between gap-3 bg-slate-900/60 rounded-lg px-3 py-2"
      role="group"
      aria-label={`Feedback for ${label}`}
    >
      <span className="text-xs text-slate-400">Was this helpful?</span>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => respond(true)}
          aria-label="Helpful"
          className="px-3 py-1 rounded-md text-lg text-slate-300 hover:text-emerald-400 hover:bg-emerald-400/10 transition min-h-[36px] min-w-[44px]"
        >
          👍
        </button>
        <button
          type="button"
          onClick={() => respond(false)}
          aria-label="Not helpful"
          className="px-3 py-1 rounded-md text-lg text-slate-300 hover:text-rose-400 hover:bg-rose-400/10 transition min-h-[36px] min-w-[44px]"
        >
          👎
        </button>
      </div>
    </div>
  );
}
