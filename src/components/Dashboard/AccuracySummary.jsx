import { useState } from 'react';
import { useOutcomes } from '../../hooks/useOutcomes.js';

const MIN_OUTCOMES = 10;
const LIKELY_BAR = 60; // forecastProb >= this counts as "likely"
const UNLIKELY_BAR = 30; // forecastProb < this counts as "unlikely"

/**
 * Long-run accuracy summary. Hidden until we have at least MIN_OUTCOMES
 * windows with observed actuals; before that, returns null (no placeholder,
 * no "coming soon" — just doesn't exist in the UI yet).
 *
 * Shows raw frequencies, no editorialising:
 *   Forecast said likely to rain   → it rained X% of the time
 *   Forecast said unlikely to rain → it rained Y% of the time
 *
 * Users absorb on their own that "likely" doesn't mean "certain" and
 * occasional misses are not system failures.
 */
export default function AccuracySummary() {
  const { outcomes } = useOutcomes();
  const [open, setOpen] = useState(false);

  const usable = outcomes.filter((o) => o.observed && o.forecastProb != null);
  if (usable.length < MIN_OUTCOMES) return null;

  const likely = usable.filter((o) => o.forecastProb >= LIKELY_BAR);
  const unlikely = usable.filter((o) => o.forecastProb < UNLIKELY_BAR);

  const pctRained = (group) =>
    group.length === 0
      ? null
      : Math.round((group.filter((o) => o.observed.didRain).length / group.length) * 100);

  const likelyPct = pctRained(likely);
  const unlikelyPct = pctRained(unlikely);

  return (
    <section className="mt-6 rounded-xl bg-slate-800/60 border border-slate-700/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-slate-300 hover:text-slate-100 transition min-h-[44px]"
      >
        <span className="text-sm">About your forecasts</span>
        <span className="text-slate-500 text-xs">
          {open ? 'Hide' : `${usable.length} trips ▾`}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 text-sm text-slate-300">
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            Over your last {usable.length} trips
          </p>
          <Row
            label="Forecast said likely to rain"
            count={likely.length}
            pct={likelyPct}
            fallback="not enough likely-rain trips yet"
          />
          <Row
            label="Forecast said unlikely to rain"
            count={unlikely.length}
            pct={unlikelyPct}
            fallback="not enough unlikely-rain trips yet"
          />
          <p className="text-[11px] text-slate-500 italic pt-1">
            Raw outcomes from your observed windows. No averages, no curation.
          </p>
        </div>
      )}
    </section>
  );
}

function Row({ label, count, pct, fallback }) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-slate-300">{label}</span>
      <span className="text-slate-100 text-right text-sm">
        {pct == null ? (
          <span className="text-slate-500 italic">{fallback}</span>
        ) : (
          <>
            → it rained <span className="font-medium">{pct}%</span> of the time
            <span className="text-slate-500 ml-1">({count})</span>
          </>
        )}
      </span>
    </div>
  );
}
