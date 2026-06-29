// Two-option pill toggle for the Today / Tomorrow dashboard view.
// Intentionally only two options — beyond tomorrow, Open-Meteo's hourly
// forecast accuracy degrades meaningfully, so we don't surface those days.

export default function DateToggle({ value, onChange }) {
  return (
    <div
      className="inline-flex bg-slate-800 rounded-full p-1 ring-1 ring-slate-700"
      role="tablist"
      aria-label="Forecast day"
    >
      <Pill active={value === 'today'} onClick={() => onChange('today')}>
        Today
      </Pill>
      <Pill active={value === 'tomorrow'} onClick={() => onChange('tomorrow')}>
        Tomorrow
      </Pill>
    </div>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-sm font-medium transition min-h-[36px] ${
        active
          ? 'bg-sky-500 text-white'
          : 'text-slate-300 hover:text-slate-100'
      }`}
    >
      {children}
    </button>
  );
}
