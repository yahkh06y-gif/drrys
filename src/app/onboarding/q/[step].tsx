// The onboarding questionnaire (Figma: onboard \ study 1–5). One component drives every question.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Btn, Choice, Enter, Progress, Screen, T } from '@/components/ui';
import { useApp, type Profile } from '@/store';

type Opt = { label: string; sub?: string };
type Q = { key: keyof Profile; title: string; subtitle?: string; layout: 'grid' | 'rows'; multi?: boolean; options: (p: Profile) => Opt[] };

const SUBFIELDS: Record<string, Opt[]> = {
  IT: [
    { label: 'CS', sub: 'Computer Science' },
    { label: 'AI', sub: 'Artificial Intelligence' },
    { label: 'SE', sub: 'Software Engineering' },
    { label: 'CYS', sub: 'Cyber Security' },
  ],
  Science: [{ label: 'Biology' }, { label: 'Chemistry' }, { label: 'Physics' }, { label: 'Math' }],
  Business: [{ label: 'Finance' }, { label: 'Marketing' }, { label: 'Accounting' }, { label: 'Management' }],
  Medicine: [{ label: 'MD' }, { label: 'Nursing' }, { label: 'Pharmacy' }, { label: 'Dentistry' }],
  Art: [{ label: 'Design' }, { label: 'Music' }, { label: 'Film' }, { label: 'Fine Arts' }],
  Engineering: [{ label: 'Civil' }, { label: 'Mechanical' }, { label: 'Electrical' }, { label: 'Chemical' }],
  Law: [{ label: 'Civil Law' }, { label: 'Criminal' }, { label: 'Business' }, { label: 'International' }],
  Other: [{ label: 'School' }, { label: 'Languages' }, { label: 'Exams' }, { label: 'Other' }],
};

const QUESTIONS: Q[] = [
  {
    key: 'field',
    title: 'I Study .....',
    layout: 'grid',
    options: () => ['IT', 'Science', 'Business', 'Medicine', 'Art', 'Engineering', 'Law', 'Other'].map((label) => ({ label })),
  },
  { key: 'subfield', title: 'I Study .....', layout: 'grid', options: (p) => SUBFIELDS[p.field ?? 'Other'] ?? SUBFIELDS.Other },
  {
    key: 'source',
    title: 'How did you hear about us?',
    layout: 'grid',
    options: () => ['YouTube', 'Facebook', 'TV', 'Friend', 'TikTok', 'Google', 'News', 'Other...'].map((label) => ({ label })),
  },
  {
    key: 'goal',
    title: 'What would you like us to help you with?',
    layout: 'rows',
    options: () => ['Prepare for an exam', 'Study during semester', 'Keep knowledge for long', 'Learn a skill / certificate', 'I am not sure yet'].map((label) => ({ label })),
  },
  {
    key: 'interests',
    title: 'What are you into?',
    subtitle: 'That helps Coco connect tricky ideas to things you already enjoy.',
    layout: 'grid',
    multi: true,
    options: () => ['Gaming', 'Football', 'Cars', 'UFC', 'Tech', 'Anime', 'Basketball', 'Music'].map((label) => ({ label })),
  },
];

export default function Question() {
  const n = Number(useLocalSearchParams<{ step: string }>().step ?? 0);
  const q = QUESTIONS[n];
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);
  const current = profile[q.key];
  const [picked, setPicked] = useState<string[]>(Array.isArray(current) ? current : current ? [String(current)] : []);

  const toggle = (label: string) => {
    if (q.multi) setPicked((p) => (p.includes(label) ? p.filter((x) => x !== label) : [...p, label]));
    else setPicked([label]);
  };

  const next = () => {
    setProfile({ [q.key]: q.multi ? picked : picked[0] } as Partial<Profile>);
    if (n + 1 < QUESTIONS.length) router.push(`/onboarding/q/${n + 1}`);
    else router.push('/onboarding/plant');
  };

  const opts = q.options(profile);
  return (
    <Screen scroll footer={<Btn title="continue" mono disabled={!picked.length} onPress={next} />}>
      <View style={{ paddingHorizontal: 10, marginBottom: 28 }}>
        <Progress value={(n + 1) / 6} />
      </View>
      <Enter>
        <T v="h1" style={{ marginBottom: q.subtitle ? 8 : 26 }}>
          {q.title}
        </T>
        {q.subtitle && (
          <T v="small" style={{ color: C_TITLE, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 22 }}>
            {q.subtitle}
          </T>
        )}
      </Enter>
      {q.layout === 'grid' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {opts.map((o, k) => (
            <Enter key={o.label} delay={k * 40} style={{ width: '47%' }}>
              <Choice label={o.label} sub={o.sub} selected={picked.includes(o.label)} onPress={() => toggle(o.label)} />
            </Enter>
          ))}
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {opts.map((o, k) => (
            <Enter key={o.label} delay={k * 50}>
              <Choice row label={o.label} selected={picked.includes(o.label)} onPress={() => toggle(o.label)} />
            </Enter>
          ))}
        </View>
      )}
    </Screen>
  );
}

const C_TITLE = '#7A9C3E';
