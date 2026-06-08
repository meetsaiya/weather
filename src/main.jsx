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
  CITY_PRESETS,
} from './devTest.js';
import { bootClimatology } from './core/thresholds.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

// Boot climatology off the critical path. Applies any cached values
// immediately; refreshes in the background if the cache is missing or stale.
// TODO: replace hardcoded Mumbai with the user's detected location (Session 3).
const bootResult = bootClimatology({ latitude: 19.076, longitude: 72.877 });

if (import.meta.env.DEV) {
  window.testWeatherSlice = testWeatherSlice;
  window.testThresholds = testThresholds;
  window.testThresholdsFor = testThresholdsFor;
  window.testThresholdsCompare = testThresholdsCompare;
  window.testBootThresholds = testBootThresholds;
  window.testRecommendations = testRecommendations;
  window.testRecommendationsLive = testRecommendationsLive;
  window.CITY_PRESETS = CITY_PRESETS;

  console.info(
    '[WeatherWise] dev mode. Try:\n' +
      "  testThresholdsFor('london')          // climatology for one region\n" +
      "  testThresholdsCompare()              // side-by-side comparison\n" +
      "  testRecommendationsLive()            // full pipeline on Mumbai forecast\n" +
      '  testWeatherSlice() / testThresholds() / testBootThresholds() / testRecommendations()'
  );
  console.info('[WeatherWise] climatology boot:', bootResult);
  console.info('[WeatherWise] available city presets:', Object.keys(CITY_PRESETS));
}
