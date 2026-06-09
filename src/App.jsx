import { useRoutine } from './hooks/useRoutine.js';
import Onboarding from './components/Onboarding/Onboarding.jsx';
import SetupComplete from './components/Setup/SetupComplete.jsx';

export default function App() {
  const { routine } = useRoutine();
  return routine.onboardingComplete ? <SetupComplete /> : <Onboarding />;
}
