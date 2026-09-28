// Session step 3b — Recall Review: Nailed → Forgotten → Needs Correction (Figma "Recall Review" frames).
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Image } from 'expo-image';

import { HERO } from '@/art';
import { Btn, Enter, Pill, SessionHeader, T } from '@/components/ui';
import { play, tap } from '@/lib/feedback';
import { useApp } from '@/store';
import { C, F } from '@/theme';

export default function Review() {
  const a = useApp((s) => s.session?.analysis);
  const pages = [
    a?.nailed.length ? 'nailed' : null,
    a?.forgotten.length ? 'forgotten' : null,
    a?.corrections.length ? 'corrections' : null,
  ].filter(Boolean) as ('nailed' | 'forgotten' | 'corrections')[];
  const [i, setI] = useState(0);
  if (!a) return null;
  const page = pages[i] ?? 'nailed';
  const last = i >= pages.length - 1;

  const next = () => {
    if (last) router.replace('/session/active');
    else {
      play('flip');
      setI(i + 1);
    }
  };

  const nextLabel = last
    ? 'Complete review'
    : pages[i + 1] === 'forgotten'
      ? `See what you missed (${a.forgotten.length})`
      : `See points needing correction (${a.corrections.length})`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <SessionHeader step={3} title="Analyze" />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 10 }}>
        {pages.map((_, k) => (
          <View key={k} style={{ width: k === i ? 22 : 12, height: 5, borderRadius: 3, backgroundColor: k === i ? C.leaf : C.track }} />
        ))}
      </View>
      <ScrollView key={page} contentContainerStyle={{ padding: 20, gap: 14 }}>
        <Enter>
          <View style={{ backgroundColor: C.white, borderRadius: 24, borderWidth: 1, borderColor: C.lineStrong, borderBottomWidth: 4, overflow: 'hidden', paddingBottom: 16, alignItems: 'center', gap: 6 }}>
            <Image source={HERO[page === 'nailed' ? 'celebrate' : page === 'forgotten' ? 'magnifier' : 'trash']} style={{ width: '100%', aspectRatio: 1.62, marginBottom: 6 }} contentFit="cover" transition={250} />
            {page === 'nailed' && (
              <>
                <Pill icon="leaf" text={`${a.nailed.length} Key Concepts Rooted Firmly`} bg="#BEF37F" border="#8EB563" />
                <T v="h3" style={{ color: C.teal, textAlign: 'center' }}>
                  Spot on! You nailed these
                </T>
                <T v="small" style={{ textAlign: 'center' }}>
                  {a.summary}
                </T>
              </>
            )}
            {page === 'forgotten' && (
              <>
                <Pill icon="search" text={`${a.forgotten.length} Forgotten Concepts`} bg="#FDE7C8" border={C.amber} fg="#8A4B0F" />
                <T v="h3" style={{ color: C.teal, textAlign: 'center' }}>
                  Slipped your mind (and that’s okay!)
                </T>
                <T v="small" style={{ textAlign: 'center' }}>
                  Active recall reveals exactly where to focus.
                </T>
              </>
            )}
            {page === 'corrections' && (
              <>
                <Pill icon="build" text={`${a.corrections.length} Needs Correction`} bg="#FDDCDC" border="#F29B9B" fg="#9B2C2C" />
                <T v="h3" style={{ color: C.teal, textAlign: 'center' }}>
                  Let’s adjust these concepts
                </T>
                <T v="small" style={{ textAlign: 'center' }}>
                  A quick tweak here turns a common mix-up into long-term mastery.
                </T>
              </>
            )}
          </View>
        </Enter>

        {page === 'nailed' &&
          a.nailed.map((c, k) => (
            <Enter key={k} delay={100 + k * 80}>
              <Row icon={<Ionicons name="checkmark-circle" size={22} color={C.leaf} />} title={c.title} tag={c.tag} tagColor="#BEF37F" body={c.detail} />
            </Enter>
          ))}
        {page === 'forgotten' &&
          a.forgotten.map((c, k) => (
            <Enter key={k} delay={100 + k * 80}>
              <Row icon={<View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.amber }} />} title={c.title} tag={c.page ? `Missed · ${c.page}` : 'Missed'} tagColor="#FDE7C8" body={c.detail} />
            </Enter>
          ))}
        {page === 'corrections' &&
          a.corrections.map((c, k) => (
            <Enter key={k} delay={100 + k * 80}>
              <View style={{ backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.lineStrong, borderBottomWidth: 4, padding: 14, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: '#E56B6B' }} />
                  <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 14, color: C.ink }}>{c.concept}</Text>
                  <Pill text="Misconception" bg="#FDDCDC" border="#F29B9B" fg="#9B2C2C" />
                </View>
                <View style={{ backgroundColor: '#F6F3EB', borderRadius: 12, padding: 10 }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.red }}>⊘ WHAT YOU RECALLED</Text>
                  <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.body, textDecorationLine: 'line-through', marginTop: 4 }}>“{c.youSaid}”</Text>
                </View>
                <Ionicons name="arrow-down" size={16} color={C.muted} style={{ alignSelf: 'center' }} />
                <View style={{ backgroundColor: '#F0F8E6', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: C.mintBorder }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.leaf }}>✓ WHAT REALLY HAPPENS</Text>
                  <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.ink, marginTop: 4, lineHeight: 19 }}>{c.truth}</Text>
                  {c.formula && <Text style={{ fontFamily: F.monoRegular, fontSize: 13, color: C.teal, marginTop: 8 }}>⚗ {c.formula}</Text>}
                </View>
              </View>
            </Enter>
          ))}
      </ScrollView>
      <View style={{ padding: 20, gap: 8 }}>
        <Btn title={nextLabel} icon="arrow-forward" kind="teal" pill onPress={next} />
        {i > 0 && (
          <Pressable onPress={() => (tap(), setI(i - 1))} style={{ alignSelf: 'center' }}>
            <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>← Back</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function Row({ icon, title, tag, tagColor, body }: { icon: React.ReactNode; title: string; tag: string; tagColor: string; body: string }) {
  return (
    <View style={{ backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.lineStrong, borderBottomWidth: 4, padding: 14, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon}
        <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 14, color: C.teal }}>{title}</Text>
        <Pill text={tag} bg={tagColor} border="transparent" fg={C.ink} />
      </View>
      <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: C.body, paddingLeft: 30 }}>{body}</Text>
    </View>
  );
}
