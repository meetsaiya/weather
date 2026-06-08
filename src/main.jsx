import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { testWeatherSlice } from './devTest.js';

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

  console.info('[WeatherWise] dev mode — call window.testWeatherSlice() in the console.');
}
