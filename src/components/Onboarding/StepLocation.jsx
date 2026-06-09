import { useState } from 'react';
import { getDeviceLocation } from '../../utils/deviceLocation.js';
import { searchCity, reverseGeocode } from '../../utils/geocoding.js';

export default function StepLocation({ routine, onSave, onNext }) {
  const [loc, setLoc] = useState(routine.location ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const detectLocation = async () => {
    setBusy(true);
    setError(null);
    try {
      const { latitude, longitude } = await getDeviceLocation();
      const reverse = await reverseGeocode({ latitude, longitude });
      const label = reverse?.label ?? `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
      const next = { latitude, longitude, label };
      setLoc(next);
      onSave({ location: next });
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

  const choose = (r) => {
    const next = { latitude: r.latitude, longitude: r.longitude, label: r.label };
    setLoc(next);
    onSave({ location: next });
    setResults([]);
    setQuery('');
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-medium text-slate-100">Where are you?</h2>
      <p className="text-slate-400 text-sm">
        Used for weather and to calibrate thresholds. Your location stays on this device.
      </p>

      <button
        type="button"
        onClick={detectLocation}
        disabled={busy}
        className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-3 rounded-lg min-h-[44px] transition"
      >
        {busy ? 'Detecting…' : 'Allow location'}
      </button>

      <div className="pt-2">
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
        <p className="text-red-400 text-sm" role="alert">
          {error}
        </p>
      )}

      {loc && (
        <div className="p-3 bg-slate-800 rounded-lg">
          <p className="text-xs text-slate-400">Selected:</p>
          <p className="text-slate-100 font-medium">{loc.label}</p>
          <p className="text-xs text-slate-500 mt-1">
            {loc.latitude.toFixed(3)}, {loc.longitude.toFixed(3)}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onNext}
        disabled={!loc}
        className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-3 rounded-lg min-h-[44px] transition"
      >
        Next
      </button>
    </section>
  );
}
