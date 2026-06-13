// Loading skeleton shown while the first forecast fetch is in flight and we
// have no cached data to display.
export default function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-label="Loading forecast" role="status">
      <div className="bg-slate-800 rounded-xl p-4 h-20" />
      <div className="bg-slate-800 rounded-xl p-4 h-28" />
      <div className="bg-slate-800 rounded-xl p-4 h-28" />
    </div>
  );
}
