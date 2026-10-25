// Profile → About you: the same screens onboarding uses, in edit mode (save goes back).
// "study": field + speciality (onboarding/study); "world": interests (onboarding/world).
// The old numbered steps still land on the right screen.
import { useLocalSearchParams } from 'expo-router';

import { StudyView } from '../onboarding/study';
import { WorldView } from '../onboarding/world';

export default function About() {
  const { step } = useLocalSearchParams<{ step: string }>();
  if (step === 'world' || step === '3') return <WorldView editing />;
  return <StudyView editing />;
}
