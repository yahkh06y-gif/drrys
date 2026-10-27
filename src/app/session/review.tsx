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
import { missedIdeas, ORGANIZE_MIN } from '@/lib/session';
import { useApp } from '@/store';
import { autoDir } from '@/design/rtl';
import { color } from '@/design/tokens';
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
    if (last) router.replace(missedIdeas(a).length >= ORGANIZE_MIN ? '/session/group' : '/session/active');
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
      <SessionHeader step={3} title="Analyze" onBack={() => (router.canGoBack() ? router.back() : router.replace('/session/recall'))} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 10 }}>
        {pages.map((_, k) => (
          <View key={k} style={{ width: k === i ? 22 : 12, height: 5, borderRadius: 3, backgroundColor: k === i ? C.leaf : C.track }} />
        ))}
      </View>
      <ScrollView key={page} contentContainerStyle={{ padding: 20, gap: 14 }}>
        <Enter>
          <View style={{ backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.line, overflow: 'hidden', paddingBottom: 16, alignItems: 'center', gap: 6 }}>
            <Image source={HERO[page === 'nailed' ? 'celebrate' : page === 'forgotten' ? 'magnifier' : 'trash']} style={{ width: '100%', aspectRatio: 1.62, marginBottom: 6 }} contentFit="cover" transition={250} />
            {page === 'nailed' && (
              <>
                <Pill icon="leaf" text={`${a.nailed.length} key ${a.nailed.length === 1 ? 'idea' : 'ideas'}`} bg={color.feedback.correct.picked} border={color.feedback.correct.picked} />
                <T v="h3" style={{ textAlign: 'center' }}>
                  You nailed these
                </T>
                <T v="small" style={{ textAlign: 'center' }}>
                  {a.summary}
                </T>
              </>
            )}
            {page === 'forgotten' && (
              <>
                <Pill icon="search" text={`${a.forgotten.length} forgotten`} bg={color.feedback.almost.picked} border={color.feedback.almost.picked} fg={color.feedback.almost.text} />
                <T v="h3" style={{ textAlign: 'center' }}>
                  Slipped your mind
                </T>
              </>
            )}
            {page === 'corrections' && (
              <>
                <Pill icon="build" text={`${a.corrections.length} to fix`} bg={color.feedback.wrong.picked} border={color.feedback.wrong.picked} fg={color.feedback.wrong.text} />
                <T v="h3" style={{ textAlign: 'center' }}>
                  Mix-ups to fix
                </T>
              </>
            )}
          </View>
        </Enter>

        {page === 'nailed' &&
          a.nailed.map((c, k) => (
            <Enter key={k} delay={100 + k * 80}>
              <Row icon={<Ionicons name="checkmark-circle" size={22} color={C.leaf} />} title={c.title} tag={c.tag} tagColor={color.feedback.correct.picked} body={c.detail} />
            </Enter>
          ))}
        {page === 'forgotten' &&
          a.forgotten.map((c, k) => (
            <Enter key={k} delay={100 + k * 80}>
              <Row icon={<View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.amber }} />} title={c.title} tag={c.page ? `Missed · ${c.page}` : 'Missed'} tagColor={color.feedback.almost.picked} body={c.detail} why={c.why} />
            </Enter>
          ))}
        {page === 'corrections' &&
          a.corrections.map((c, k) => (
            <Enter key={k} delay={100 + k * 80}>
              <View style={{ backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 14, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: color.feedback.wrong.icon }} />
                  <Text style={[{ flex: 1, fontFamily: F.semi, fontSize: 15, color: C.ink }, autoDir(c.concept)]}>{c.concept}</Text>
                  <Pill text="Misconception" bg={color.feedback.wrong.picked} border={color.feedback.wrong.picked} fg={color.feedback.wrong.text} />
                </View>
                <View style={{ backgroundColor: color.bg.sunken, borderRadius: 12, padding: 10 }}>
                  <Text style={{ fontFamily: F.medium, fontSize: 12, color: color.feedback.wrong.text }}>What you recalled</Text>
                  <Text style={[{ fontFamily: F.regular, fontSize: 14, lineHeight: 21, color: C.body, textDecorationLine: 'line-through', marginTop: 4 }, autoDir(c.youSaid)]}>“{c.youSaid}”</Text>
                </View>
                <Ionicons name="arrow-down" size={16} color={C.muted} style={{ alignSelf: 'center' }} />
                <View style={{ backgroundColor: color.feedback.correct.bg, borderRadius: 12, padding: 10 }}>
                  <Text style={{ fontFamily: F.medium, fontSize: 12, color: color.feedback.correct.text }}>What really happens</Text>
                  <Text style={[{ fontFamily: F.regular, fontSize: 14, color: C.ink, marginTop: 4, lineHeight: 21 }, autoDir(c.truth)]}>{c.truth}</Text>
                  {c.formula && <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.teal, marginTop: 8, writingDirection: 'ltr' }}>{c.formula}</Text>}
                </View>
              </View>
            </Enter>
          ))}
      </ScrollView>
      <View style={{ padding: 20, gap: 8 }}>
        <Btn title={nextLabel} icon="arrow-forward" kind="green" onPress={next} />
        {i > 0 && (
          <Pressable onPress={() => (tap(), setI(i - 1))} style={{ alignSelf: 'center' }}>
            <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.muted, padding: 6 }}>Back</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function Row({ icon, title, tag, tagColor, body, why }: { icon: React.ReactNode; title: string; tag: string; tagColor: string; body: string; why?: string }) {
  return (
    <View style={{ backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 14, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon}
        <Text style={[{ flex: 1, fontFamily: F.semi, fontSize: 15, color: C.ink }, autoDir(title)]}>{title}</Text>
        <Pill text={tag} bg={tagColor} border="transparent" fg={C.ink} />
      </View>
      <Text style={[{ fontFamily: F.regular, fontSize: 14, lineHeight: 21, color: C.body, paddingStart: 30 }, autoDir(body)]}>{body}</Text>
      {!!why && (
        <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: C.muted, paddingStart: 30 }}>
          So what? <Text style={{ fontFamily: F.regular, color: C.body }}>{why}</Text>
        </Text>
      )}
    </View>
  );
}
