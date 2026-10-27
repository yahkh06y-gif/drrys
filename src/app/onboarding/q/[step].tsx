// The "About you" questions (Profile → About you). Onboarding asks field + speciality on its own screen
// (onboarding/study) and interests through Qloo (onboarding/world); here the answers can be changed later.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Btn, Choice, Enter, IconBtn, Screen, T } from '@/components/ui';
import { OPTION_ICONS } from '@/art';
import { FIELDS, SUBFIELDS, type Opt } from '@/lib/onboarding';
import { useApp, type Profile } from '@/store';
import { radius } from '@/design/tokens';
import { C, F } from '@/theme';

type Q = {
  key: keyof Profile;
  title: string;
  subtitle?: string;
  layout: 'grid' | 'rows';
  multi?: boolean;
  /** adds an "Other…" tile that opens a text box for the student's own answer */
  other?: string;
  options: (p: Profile) => Opt[];
};

const QUESTIONS: Q[] = [
  {
    key: 'field',
    title: 'I Study .....',
    layout: 'grid',
    options: () => FIELDS.map((label) => ({ label })),
  },
  { key: 'subfield', title: 'I Study .....', layout: 'grid', options: (p) => SUBFIELDS[p.field ?? 'Other'] ?? SUBFIELDS.Other },
  {
    key: 'goal',
    title: 'What would you like us to help you with?',
    subtitle: 'Pick as many as you like.',
    layout: 'rows',
    multi: true,
    options: () => ['Prepare for an exam', 'Study during semester', 'Keep knowledge for long', 'Learn a skill / certificate', 'I am not sure yet'].map((label) => ({ label })),
  },
  {
    key: 'interests',
    title: 'What are you into?',
    subtitle: 'That helps Coco connect tricky ideas to things you already enjoy.',
    layout: 'grid',
    multi: true,
    other: 'Something else? e.g. chess, cooking…',
    options: () => ['Gaming', 'Football', 'Cars', 'UFC', 'Tech', 'Anime', 'Basketball', 'Music'].map((label) => ({ label })),
  },
  // asked last, after the tree is planted and saved
  {
    key: 'source',
    title: 'One last thing: how did you hear about us?',
    layout: 'grid',
    options: () => ['YouTube', 'Facebook', 'TV', 'Friend', 'TikTok', 'Google', 'News', 'Other...'].map((label) => ({ label })),
  },
];

export default function Question() {
  const params = useLocalSearchParams<{ step: string; edit?: string }>();
  return <QuestionView n={Number(params.step ?? 0)} editing={params.edit === '1'} />;
}

/** One questionnaire screen. `editing`: opened later from Profile to change an answer. */
export function QuestionView({ n, editing }: { n: number; editing: boolean }) {
  const q = QUESTIONS[n];
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);
  const current = profile[q.key];
  const known = q.options(profile).map((o) => o.label);
  const saved = Array.isArray(current) ? current : current ? [String(current)] : [];
  // answers the student typed themselves (not one of the tiles) come back into the text box
  const [custom, setCustom] = useState(q.other ? saved.filter((x) => !known.includes(x)).join(', ') : '');
  const [picked, setPicked] = useState<string[]>(q.other ? [...saved.filter((x) => known.includes(x)), ...(custom ? [OTHER] : [])] : saved.filter((x) => known.includes(x)));
  const otherOn = !!q.other && picked.includes(OTHER);

  const toggle = (label: string) => {
    if (q.multi) setPicked((p) => (p.includes(label) ? p.filter((x) => x !== label) : [...p, label]));
    else setPicked([label]);
  };

  const next = () => {
    const typed = custom.split(',').map((t) => t.trim()).filter(Boolean);
    const answer = [...picked.filter((x) => x !== OTHER), ...(otherOn ? typed : [])];
    const changedField = q.key === 'field' && answer[0] !== profile.field;
    setProfile({ [q.key]: q.multi ? answer : answer[0], ...(changedField ? { subfield: undefined } : {}) } as Partial<Profile>);
    if (editing) {
      // a new field needs its speciality too
      if (n === 0) return router.replace({ pathname: '/about/[step]', params: { step: '1' } });
      return router.back();
    }
    router.back();
  };

  const opts = q.other ? [...q.options(profile), { label: OTHER }] : q.options(profile);
  const ready = picked.length > 0 && (!otherOn || custom.trim().length > 0 || picked.length > 1);
  return (
    <Screen
      scroll
      // the button shows up once there's an answer to continue with
      footer={
        ready ? (
          <Enter key="go">
            <Btn title={editing ? 'save' : 'continue'} mono onPress={next} />
          </Enter>
        ) : undefined
      }>
      <View style={{ marginBottom: 18 }}>
        <IconBtn name="arrow-back" onPress={() => router.back()} />
      </View>
      <Enter>
        <T v="h1" style={{ marginBottom: q.subtitle ? 8 : 26 }}>
          {q.title}
        </T>
        {q.subtitle && (
          <T v="bodySm" style={{ color: C.muted, marginBottom: 22 }}>
            {q.subtitle}
          </T>
        )}
      </Enter>
      {q.layout === 'grid' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {opts.map((o, k) => (
            <Enter key={o.label} delay={k * 40} style={{ width: '47%' }}>
              <Choice label={o.label} sub={o.sub} icon={OPTION_ICONS[`${q.key}:${o.label}`]} selected={picked.includes(o.label)} onPress={() => toggle(o.label)} />
            </Enter>
          ))}
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {opts.map((o, k) => (
            <Enter key={o.label} delay={k * 50}>
              <Choice row label={o.label} icon={OPTION_ICONS[`${q.key}:${o.label}`]} selected={picked.includes(o.label)} onPress={() => toggle(o.label)} />
            </Enter>
          ))}
        </View>
      )}
      {otherOn && (
        <Enter style={{ marginTop: 16 }}>
          <TextInput
            value={custom}
            onChangeText={setCustom}
            placeholder={q.other}
            placeholderTextColor={C.mutedLight}
            autoFocus
            style={{ fontFamily: F.regular, fontSize: 17, color: C.ink, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.lineStrong, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 14 }}
          />
        </Enter>
      )}
    </Screen>
  );
}

const OTHER = 'Other…';
