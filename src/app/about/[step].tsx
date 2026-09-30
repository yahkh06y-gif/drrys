// Profile → About you: the onboarding questions (studying, goal, interests) in edit mode.
import { useLocalSearchParams } from 'expo-router';

import { QuestionView } from '../onboarding/q/[step]';

export default function About() {
  const { step } = useLocalSearchParams<{ step: string }>();
  return <QuestionView n={Number(step ?? 3)} editing />;
}
