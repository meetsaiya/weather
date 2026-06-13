export default function BriefBanner({ brief, onDismiss }) {
  if (!brief) return null;
  return (
    <div
      className="mb-4 bg-sky-500/10 border border-sky-500/30 rounded-xl p-4"
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-sky-300 mb-1">
            Today's briefing
          </p>
          <p className="text-slate-100 text-sm leading-snug">{brief.body}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-slate-400 hover:text-slate-200 text-xl leading-none min-h-[32px] min-w-[32px]"
        >
          ×
        </button>
      </div>
    </div>
  );
}
