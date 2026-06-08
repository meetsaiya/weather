import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import {
  testWeatherSlice,
  testThresholds,
  testBootThresholds,
  testRecommendations,
  testRecommendationsLive,
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
  window.testBootThresholds = testBootThresholds;
  window.testRecommendations = testRecommendations;
  window.testRecommendationsLive = testRecommendationsLive;

  console.info(
    '[WeatherWise] dev mode — try window.testRecommendations(), window.testRecommendationsLive(), window.testWeatherSlice(), window.testThresholds(), or window.testBootThresholds().'
  );
  console.info('[WeatherWise] climatology boot:', bootResult);
}
