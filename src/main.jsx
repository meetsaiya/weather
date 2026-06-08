import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { testWeatherSlice, testThresholds } from './devTest.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

if (import.meta.env.DEV) {
  window.testWeatherSlice = testWeatherSlice;
  window.testThresholds = testThresholds;

  console.info(
    '[WeatherWise] dev mode — try window.testWeatherSlice() or window.testThresholds() in the console.'
  );
}
