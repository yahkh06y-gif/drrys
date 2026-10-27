// "What do you study?" — field and speciality on one screen: the specialities slide in under the field
// that was picked, and "continue" shows up once both are chosen. Profile → About you → Studying opens this same
// screen (`editing`): it saves and goes back instead of going on.
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OPTION_ICONS } from '@/art';
import { Btn, Choice, Enter, OnbBar, T } from '@/components/ui';
import { FIELDS, progressOf, SUBFIELDS } from '@/lib/onboarding';
import { useApp } from '@/store';
import { C } from '@/theme';

export default function Study() {
  return <StudyView />;
}

export function StudyView({ editing = false }: { editing?: boolean }) {
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);
  const [field, setField] = useState(profile.field);
  const [sub, setSub] = useState(profile.subfield);
  const scroller = useRef<ScrollView>(null);
  const subs = field ? (SUBFIELDS[field] ?? SUBFIELDS.Other) : [];

  const pickField = (f: string) => {
    if (f !== field) setSub(undefined);
    setField(f);
    // bring the specialities into view
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 120);
  };

  const next = () => {
    setProfile({ field, subfield: sub });
    if (editing) return router.back();
    router.push('/onboarding/world');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        <OnbBar value={editing ? 1 : progressOf('study')} />
      </View>
      <ScrollView ref={scroller} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Enter>
          <T v="h1" style={{ marginBottom: 8 }}>
            What do you study?
          </T>
          <T v="bodySm" style={{ color: C.muted, marginBottom: 22 }}>
            So Coco understands what you study.
          </T>
        </Enter>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {FIELDS.map((f, k) => (
            <Enter key={f} delay={k * 40} style={{ width: '47%' }}>
              <Choice label={f} icon={OPTION_ICONS[`field:${f}`]} selected={field === f} onPress={() => pickField(f)} />
            </Enter>
          ))}
        </View>
        {!!field && (
          <Enter key={field} style={{ marginTop: 26 }}>
            <T v="h3" style={{ marginBottom: 14 }}>
              Which one?
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
              {subs.map((o) => (
                <View key={o.label} style={{ width: '47%' }}>
                  <Choice label={o.label} sub={o.sub} icon={OPTION_ICONS[`subfield:${o.label}`]} selected={sub === o.label} onPress={() => setSub(o.label)} />
                </View>
              ))}
            </View>
          </Enter>
        )}
      </ScrollView>
      {!!field && !!sub && (
        <Enter key="go" style={{ paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8 }}>
          <Btn title={editing ? 'Save' : 'Continue'} mono onPress={next} />
        </Enter>
      )}
    </SafeAreaView>
  );
}
