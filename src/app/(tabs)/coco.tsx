// Coco tab — talk to your learning companion.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { Coco, Enter, T } from '@/components/ui';
import { MicButton, useVoice } from '@/components/Voice';
import { chatCoco } from '@/lib/ai';
import { play, tap } from '@/lib/feedback';
import { activeSubject, useApp } from '@/store';
import { C, F } from '@/theme';

type Msg = { role: 'user' | 'assistant'; text: string };
const STYLE_LABEL = { friendly: 'Friendly coach', calm: 'Calm tutor', direct: 'Direct & focused', playful: 'Playful buddy' };

export default function CocoTab() {
  const coco = useApp((s) => s.coco);
  const xp = useApp((s) => s.stats.xp);
  const interests = useApp((s) => (s.coco.memory ? s.profile.interests : []));
  const subject = useApp(activeSubject);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'assistant', text: 'Hey! What should we explore today?' }]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const input = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);
  // say it instead of typing: the words land in the box, you check them and send
  const voice = useVoice(
    useCallback((t: string) => setText((x) => (x.trim() ? `${x.trim()} ${t}` : t)), []),
    () => input.current?.focus(),
  );

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    tap('select');
    const next: Msg[] = [...msgs, { role: 'user', text: t }];
    setMsgs(next);
    setText('');
    setTyping(true);
    try {
      const reply = await chatCoco(
        {
          subject: subject?.name ?? 'General',
          chapter: subject?.chapters[0]?.title ?? '',
          interests,
          style: STYLE_LABEL[coco.style],
          depth: coco.depth,
        },
        next,
      );
      setMsgs((m) => [...m, { role: 'assistant', text: reply.trim() }]);
      play('select');
    } catch (e) {
      // while developing, show the real reason (bad key, model name, region, rate limit…)
      const why = __DEV__ ? `\n\n(${String((e as Error)?.message ?? e).slice(0, 220)})` : '';
      setMsgs((m) => [...m, { role: 'assistant', text: `Hmm, I can’t reach the cloud right now. Try again in a moment?${why}` }]);
    }
    setTyping(false);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <LinearGradient colors={['#F7EFE2', '#F2E3CF']} style={{ flex: 1 }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8 }}>
            <View style={{ flex: 1 }}>
              <T v="h2" style={{ fontSize: 30 }}>
                Coco
              </T>
              <T v="small" style={{ color: C.teal }}>
                Your learning companion
              </T>
            </View>
            <View style={{ backgroundColor: C.white, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, marginRight: 10, marginTop: 6, borderWidth: 1, borderColor: C.line }}>
              <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.ink }}>✨ {xp} XP</Text>
            </View>
            <Pressable onPress={() => (tap(), router.push('/customize'))} style={{ alignItems: 'center' }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line }}>
                <Ionicons name="shirt-outline" size={20} color={C.teal} />
              </View>
              <Text style={{ fontFamily: F.medium, fontSize: 10, color: C.teal, marginTop: 2 }}>Customize</Text>
            </Pressable>
          </View>

          <ScrollView ref={scroll} contentContainerStyle={{ padding: 20, gap: 10 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
            <Coco src={COCO[coco.outfit] ?? COCO.classic} size={170} />
            {msgs.map((m, i) => (
              <Enter key={i}>
                <View
                  style={{
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    backgroundColor: m.role === 'user' ? C.teal : C.white,
                    borderRadius: 18,
                    borderBottomRightRadius: m.role === 'user' ? 4 : 18,
                    borderBottomLeftRadius: m.role === 'user' ? 18 : 4,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderWidth: m.role === 'user' ? 0 : 1,
                    borderColor: C.line,
                  }}>
                  <Text style={{ fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: m.role === 'user' ? C.white : C.teal }}>{m.text}</Text>
                </View>
              </Enter>
            ))}
            {typing && <Text style={{ fontFamily: F.bold, color: C.leaf, fontSize: 18 }}>•••</Text>}
          </ScrollView>

          <View style={{ paddingHorizontal: 16, paddingBottom: 10, gap: 8 }}>
            <View style={{ backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 9, color: C.goldInk, letterSpacing: 0.5 }}>PERSONALIZED FOR YOU</Text>
                <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.teal }}>
                  {STYLE_LABEL[coco.style]}
                  {interests[0] ? ` • ${interests[0]} examples` : ''}
                </Text>
              </View>
              <Pressable onPress={() => (tap(), router.push('/customize'))}>
                <Ionicons name="menu" size={22} color={C.teal} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                ref={input}
                value={text}
                onChangeText={setText}
                onSubmitEditing={send}
                returnKeyType="send"
                placeholder={voice.state === 'recording' ? 'Listening… tap ■ when done' : voice.state === 'writing' ? 'Writing it down…' : 'Ask Coco anything…'}
                placeholderTextColor="#A69A8A"
                style={{ flex: 1, backgroundColor: C.white, borderRadius: 99, borderWidth: 1, borderColor: C.lineStrong, paddingHorizontal: 16, paddingVertical: 12, fontFamily: F.medium, fontSize: 14, color: C.ink }}
              />
              {text.trim() && voice.state === 'idle' ? (
                <Pressable
                  accessibilityLabel="Send"
                  onPress={send}
                  style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderColor: C.shadow }}>
                  <Ionicons name="arrow-up" size={22} color={C.white} />
                </Pressable>
              ) : (
                <MicButton voice={voice} size={50} />
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
