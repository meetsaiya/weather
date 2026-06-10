import { useEffect, useState } from 'react';
import { useRoutine } from '../../hooks/useRoutine.js';
import { getDeviceLocation } from '../../utils/deviceLocation.js';
import { searchCity, reverseGeocode } from '../../utils/geocoding.js';

export default function LocationPicker({ open, onClose }) {
  const { routine, saveRoutine } = useRoutine();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setError(null);
      setQuery('');
      setResults([]);
    }
  }, [open]);

  if (!open) return null;

  const commit = (next) => {
    saveRoutine({ location: next });
    onClose?.();
  };

  const detectLocation = async () => {
    setBusy(true);
    setError(null);
    try {
      const { latitude, longitude } = await getDeviceLocation();
      const reverse = await reverseGeocode({ latitude, longitude });
      const label = reverse?.label ?? `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
      commit({ latitude, longitude, label });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const search = async () => {
    setBusy(true);
    setError(null);
    setResults([]);
    try {
      const r = await searchCity(query);
      setResults(r);
      if (r.length === 0) setError('No cities found. Try another name.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const choose = (r) => commit({ latitude: r.latitude, longitude: r.longitude, label: r.label });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-picker-title"
      className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[85vh] overflow-y-auto">
        <header className="flex items-center justify-between mb-4">
          <h2 id="location-picker-title" className="text-lg font-semibold text-slate-100">
            Change location
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

        {routine.location && (
          <div className="bg-slate-800 rounded-lg p-3 mb-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Current</p>
            <p className="text-slate-100 font-medium">{routine.location.label}</p>
          </div>
        )}

        <button
          type="button"
          onClick={detectLocation}
          disabled={busy}
          className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-3 rounded-lg min-h-[44px] transition"
        >
          {busy ? 'Working…' : 'Use my current location'}
        </button>

        <div className="mt-5">
          <p className="text-slate-400 text-sm">Or search for a city:</p>
          <div className="flex gap-2 mt-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="e.g. London"
              className="flex-1 bg-slate-800 text-slate-100 px-3 py-2 rounded-lg min-h-[44px] focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <button
              type="button"
              onClick={search}
              disabled={busy || query.trim().length < 2}
              className="px-4 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-100 rounded-lg min-h-[44px] transition"
            >
              Search
            </button>
          </div>
          {results.length > 0 && (
            <ul className="mt-3 space-y-1">
              {results.map((r, i) => (
                <li key={`${r.latitude},${r.longitude},${i}`}>
                  <button
                    type="button"
                    onClick={() => choose(r)}
                    className="w-full text-left bg-slate-800 hover:bg-slate-700 p-3 rounded-lg text-slate-100 transition min-h-[44px]"
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p className="text-red-400 text-sm mt-3" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
