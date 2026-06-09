import { useEffect } from 'react';
import { useRoutine } from './hooks/useRoutine.js';
import { bootClimatology } from './core/thresholds.js';
import Onboarding from './components/Onboarding/Onboarding.jsx';
import Dashboard from './components/Dashboard/Dashboard.jsx';
import WidgetView from './components/Widget/WidgetView.jsx';

function isWidgetRoute() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('view') === 'widget';
}

export default function App() {
  const { routine } = useRoutine();

  // Reboot climatology whenever the saved location changes (e.g. after a
  // fresh onboarding or a 'Start over'). Main.jsx already did the initial
  // boot from stored localStorage; this handles in-session changes.
  useEffect(() => {
    if (!routine.location) return;
    bootClimatology({
      latitude: routine.location.latitude,
      longitude: routine.location.longitude,
    });
  }, [routine.location?.latitude, routine.location?.longitude]);

  if (!routine.onboardingComplete || !routine.location) return <Onboarding />;
  if (isWidgetRoute()) return <WidgetView />;
  return <Dashboard />;
}
