import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import {
  testWeatherSlice,
  testThresholds,
  testThresholdsFor,
  testThresholdsCompare,
  testBootThresholds,
  testRecommendations,
  testRecommendationsLive,
  testMonsoonBar,
  testWorstHourRanking,
  CITY_PRESETS,
} from './devTest.js';
import { bootClimatology } from './core/thresholds.js';
import { getStoredRoutine } from './hooks/useRoutine.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

// Boot climatology off the critical path for the user's saved location.
// Pre-onboarding (no location stored yet) we skip the fetch — there's nothing
// to calibrate against until the user picks a city, and the algorithm uses
// safe defaults until then.
const stored = getStoredRoutine();
const bootResult = stored.location
  ? bootClimatology({
      latitude: stored.location.latitude,
      longitude: stored.location.longitude,
    })
  : { source: 'pre-onboarding', refreshing: false };

if (import.meta.env.DEV) {
  window.testWeatherSlice = testWeatherSlice;
  window.testThresholds = testThresholds;
  window.testThresholdsFor = testThresholdsFor;
  window.testThresholdsCompare = testThresholdsCompare;
  window.testBootThresholds = testBootThresholds;
  window.testRecommendations = testRecommendations;
  window.testRecommendationsLive = testRecommendationsLive;
  window.testMonsoonBar = testMonsoonBar;
  window.testWorstHourRanking = testWorstHourRanking;
  window.CITY_PRESETS = CITY_PRESETS;
  window.devResetOnboarding = () => {
    localStorage.removeItem('ww_routine');
    localStorage.removeItem('ww_feedback');
    localStorage.removeItem('ww_deviation_today');
    location.reload();
  };

  console.info(
    '[WeatherWise] dev mode. Try:\n' +
      "  testThresholdsFor('london')          // climatology for one region\n" +
      '  testThresholdsCompare()              // side-by-side comparison\n' +
      "  testRecommendationsLive('london')    // full pipeline for a region\n" +
      '  devResetOnboarding()                 // wipe routine + restart\n' +
      '  testWeatherSlice() / testThresholds() / testBootThresholds() / testRecommendations()'
  );
  console.info('[WeatherWise] climatology boot:', bootResult, 'location:', stored.location);
  console.info('[WeatherWise] available city presets:', Object.keys(CITY_PRESETS));
}
