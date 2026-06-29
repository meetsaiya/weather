import { describeWeather, dominantWeatherCode, uvBand } from '../../utils/weatherCondition.js';

function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hoursForDate(weatherData, dateISO) {
  if (!Array.isArray(weatherData)) return [];
  return weatherData.filter((h) => typeof h.hour === 'string' && h.hour.startsWith(dateISO));
}

const TONE_CLASS = {
  emerald: 'text-emerald-400',
  yellow: 'text-yellow-400',
  amber: 'text-amber-400',
  rose: 'text-rose-400',
  slate: 'text-slate-400',
};

export default function DaySummary({ weatherData, targetDate }) {
  const dateISO = targetDate ?? todayISO();
  const hours = hoursForDate(weatherData, dateISO);
  if (hours.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl p-4 text-slate-400 text-sm">
        No forecast available for today.
      </div>
    );
  }

  const temps = hours.map((h) => h.temperature_2m).filter((v) => v != null);
  const tempMin = temps.length ? Math.round(Math.min(...temps)) : null;
  const tempMax = temps.length ? Math.round(Math.max(...temps)) : null;

  const uvs = hours.map((h) => h.uv_index).filter((v) => v != null);
  const uvMax = uvs.length ? Math.max(...uvs) : null;
  const uv = uvBand(uvMax);

  const condition = describeWeather(dominantWeatherCode(hours));

  return (
    <div className="bg-slate-800 rounded-xl p-4 grid grid-cols-3 gap-3 items-center">
      <div className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden>
          {condition.icon}
        </span>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            {dateISO === todayISO() ? 'Today' : 'Tomorrow'}
          </p>
          <p className="text-slate-100 font-medium">{condition.label}</p>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Temp</p>
        <p className="text-slate-100 font-medium">
          {tempMin != null && tempMax != null ? `${tempMin}° – ${tempMax}°` : '—'}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-slate-500 uppercase tracking-wide">UV</p>
        <p className={`font-medium ${TONE_CLASS[uv.tone]}`}>
          {uv.label}
          {uvMax != null ? <span className="text-slate-500 text-xs ml-1">({uvMax.toFixed(0)})</span> : null}
        </p>
      </div>
    </div>
  );
}
