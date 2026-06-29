# WeatherWise

A personal weather PWA that turns hourly forecasts into plain-English recommendations tied to *when* you're actually outside. Not "60% chance of rain at 5pm" but "carry an umbrella for your evening commute; you're fine for the morning."

## What it does

- You define your daily routine (windows like "morning commute, 08:00–09:00, 20 min outside, walking").
- It fetches an hourly forecast for your location (Open-Meteo, free, no key).
- It slices the forecast to your actual exposure windows, picks worst-hour or weighted-average depending on your risk tolerance, and runs a threshold-based recommendation engine (umbrella / raincoat / windcheater / scarf / hat / sunscreen / light clothing).
- Thresholds for rain and wind are tuned to your local climate using ten years of seasonal Open-Meteo archive data (~31 days centered on today, per location). Temperature and UV use absolute human-comfort thresholds.
- A morning briefing — either a system notification while the app is open, or an in-app banner on first open — surfaces the day's most-critical recommendations.

Everything runs client-side. No backend, no accounts, no paid APIs.

## Install as a PWA

Chrome and Safari surface an "Add to Home Screen" prompt. The manifest declares a `?view=widget` shortcut that renders a compressed 3-line view (most-critical recommendation for the next window) — visible from the home-screen icon's long-press menu on Android.

## How recommendations work

1. **Risk tolerance** drives the probability bar. "I need to stay dry" triggers at 20% rain probability; "Prefer to stay dry" at 50%; "Light rain is fine" at 70%.
2. **Climatology calibration**: for each location, ten years of hourly archive data centered on today's date give you region-tuned wind and rain thresholds (p90 wind, p25/p75/p95 rain over wet hours). London's "high wind" is ~28 km/h; Reykjavik's is ~37 km/h.
3. **Climate context**: monsoon regions (lat 0–25, in season) dampen rain probability by 0.7× so the algorithm doesn't shout about umbrellas every day of the rainy season.
4. **Conflict resolution**: rain + high wind suppresses umbrella in favor of raincoat. Cold + rain replaces umbrella with a waterproof layer. UV + rain keeps umbrella but annotates "doubles as sun cover."
5. **Honest uncertainty**: confidence labels are "likely / possible / unlikely" tied to probability bands. Suppressed items show *why* (e.g. "high winds make an umbrella impractical").

## Feedback personalisation

Every past window in the dashboard shows a thumbs up/down. Once you've given five or more responses, the engine tunes its probability bar:

- `positiveRate > 0.80` → bar relaxes (nudge += 0.05), surfaces more recommendations
- `positiveRate < 0.40` → bar tightens (nudge −= 0.05), surfaces fewer
- Clamped to [−0.15, +0.15] so feedback can never disable or spam recommendations entirely
- Applied as a multiplier on probability thresholds only (not on mm/hr or km/h thresholds)
- Each window+date is recorded once, so you can't double-vote and skew the average

State lives in `localStorage` under `ww_feedback`; clear that key to reset.

## Known limitations

- **Hourly granularity**: Open-Meteo's smallest unit. Sub-hourly downpours aren't captured.
- **Grid-based forecast**: ~1–10 km cells. Microclimates within a city aren't modelled.
- **Shelter unknown**: the algorithm doesn't know if your route is covered. Walking under a canopy and walking exposed look identical.
- **Activity speed approximated**: cycling vs walking changes exposure but isn't yet applied; transport mode is stored for future use.
- **Notifications are tab-scoped**: morning briefings fire reliably only if the tab is open at the configured time. Closed-tab delivery would need Web Push with a server (out of scope for an MVP with no backend). The in-app banner is the fallback when you open the app after the notification time.
- **Single location**: stored in `localStorage`, swappable via the dashboard's location chooser but only one at a time.

## Stack

- React 18 + Vite + Tailwind CSS
- `vite-plugin-pwa` with `injectManifest` mode for a custom service worker
- Workbox runtime caching: network-first for API calls, cache-first for static assets
- Open-Meteo forecast + archive APIs (free, keyless)
- BigDataCloud reverse-geocode (free, keyless)
- `localStorage` for routine, feedback, weather cache, climatology cache

## File layout

```
src/
├── core/                       # pure algorithm
│   ├── weatherEngine.js        # Open-Meteo fetch + parsing
│   ├── exposureEngine.js       # window → aggregated weather
│   ├── recommendEngine.js      # aggregated → item recommendations
│   ├── conflictResolver.js     # resolution rules
│   ├── plainEnglish.js         # sentence templates
│   └── thresholds.js           # static + climatology-derived thresholds
├── hooks/                      # React state + side-effects
│   ├── useRoutine.js
│   ├── useWeather.js
│   ├── useFeedback.js
│   └── useNotifications.js
├── components/
│   ├── Onboarding/
│   ├── Dashboard/
│   ├── Widget/
│   ├── Deviation/
│   ├── Location/
│   ├── Routine/
│   └── Feedback/
├── utils/
│   ├── geocoding.js
│   ├── deviceLocation.js
│   ├── deviations.js / deviationStore.js
│   ├── weatherCondition.js     # WMO code → label + icon
│   ├── climateContext.js       # tropical-monsoon sensitivity
│   └── dailyBrief.js
└── sw.js                       # service worker (Workbox + push handler)
```

## Dev console helpers

In dev mode (`npm run dev`), open the browser console and try:

- `testThresholdsFor('london')` — load climatology for one region
- `testThresholdsCompare()` — side-by-side rain/wind percentiles across cities
- `testRecommendationsLive('london')` — full pipeline against a region's live forecast
- `testRecommendations()` — canonical mock-data scenario
- `devResetOnboarding()` — wipe routine + feedback + deviations and reload
