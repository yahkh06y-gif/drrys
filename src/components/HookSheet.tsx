// "Make a memory hook" — available on every flashcard and every question. The student makes their own hook
// (text or a drawing; Coco can only suggest ideas or say what he sees). A saved hook comes back as a hint on
// the card, and is listed when the student holds that chapter's branch.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { hookToScene, suggestHooks } from '@/lib/ai';
import { haptic, play, tap } from '@/lib/feedback';
import { cardContext } from '@/lib/session';
import { makeHookPicture, savePicture, youcamEnabled } from '@/lib/youcam';
import { Squeeze } from '@/components/SessionMotion';
import { Btn, Enter } from '@/components/ui';
import { useApp } from '@/store';
import { autoDir } from '@/design/rtl';
import { color, palette, radius } from '@/design/tokens';
import { C, F } from '@/theme';

export type HookTarget = {
  id?: string;
  subjectId: string;
  chapterId: string;
  q: string;
  a: string;
  mnemonic?: string;
  mnemonicImg?: string;
};

export function HookSheet({ card, onClose, slipping }: { card?: HookTarget; onClose: () => void; slipping?: boolean }) {
  const [text, setText] = useState('');
  const [ideas, setIdeas] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // two parts: "write" (the hook, in the student's words) and "picture" (a clay picture made from it, if they want one)
  const [phase, setPhase] = useState<'write' | 'picture'>('write');
  // a clay-style picture made from the hook (YouCam). One picture costs 1 credit, so a hook gets 3 tries at most.
  const [pic, setPic] = useState<string>();
  const [making, setMaking] = useState(false);
  const [picErr, setPicErr] = useState<string>();
  const [withCoco, setWithCoco] = useState(false);
  const [tries, setTries] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const tried = text.trim().split(/\s+/).filter(Boolean).length >= 3; // your own first try comes before Coco's ideas
  useEffect(() => {
    setText(card?.mnemonic ?? '');
    setIdeas([]);
    setBusy(false);
    setPhase('write');
    setPic(undefined);
    setMaking(false);
    setPicErr(undefined);
    setWithCoco(false);
    setTries(0);
  }, [card?.id]);
  if (!card) return null;
  const getIdeas = async () => {
    setBusy(true);
    try {
      setIdeas(await suggestHooks(cardContext(card.subjectId), card));
    } catch {
      setIdeas([]);
    }
    setBusy(false);
  };
  const canPic = text.trim().length >= 3;
  // on to the picture
  const goPicture = () => {
    tap('select');
    setPicErr(undefined);
    setPhase('picture');
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  // The picture: the AI turns the hook into a clear scene first, so the picture shows what the hook says.
  const makePic = async () => {
    if (making || !canPic || tries >= 3) return;
    setMaking(true);
    setPicErr(undefined);
    setTries((n) => n + 1);
    try {
      const hook = text.trim();
      const scene = await hookToScene(cardContext(card.subjectId), card, hook).catch(() => undefined);
      const url = await makeHookPicture({ hook, q: card.q, a: card.a, withCoco, scene });
      setPic(url);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 250); // bring the new picture into view
      play('success');
      haptic('success');
    } catch (e) {
      setPicErr(String((e as Error)?.message ?? e).replace(/Bearer\s+\S+/g, '').slice(0, 400));
    }
    setMaking(false);
  };
  const plant = async () => {
    if (!text.trim() && !pic) return;
    setBusy(true);
    const st = useApp.getState();
    // a question that has no flashcard yet becomes one (so the hook has somewhere to live and is reviewed later)
    const id = card.id ?? st.addCards([{ subjectId: card.subjectId, chapterId: card.chapterId, q: card.q, a: card.a }])[0];
    const uri = pic ? await savePicture(id, pic) : undefined;
    st.saveHook(id, text.trim() || 'My memory hook', uri);
    setBusy(false);
    play('grow');
    haptic('success');
    onClose();
  };
  const canSave = !!text.trim() || !!pic;
  const chip = (on: boolean) => ({ flexDirection: 'row' as const, gap: 6, alignItems: 'center' as const, backgroundColor: on ? color.action.primary : C.sand, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8 });
  const inPic = phase === 'picture';
  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => (inPic ? setPhase('write') : onClose())}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: color.overlay.scrim }}>
          <View style={{ backgroundColor: C.paper, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: 18, paddingTop: 10, gap: 12, maxHeight: '92%' }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.lineStrong }} />
            {/* title */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              {!inPic && (
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: palette.sun100, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={card.mnemonic ? 'bulb' : 'bulb-outline'} size={19} color={palette.sun700} />
                </View>
              )}
              {inPic && (
                <Pressable hitSlop={12} onPress={() => (tap('select'), setPhase('write'))}>
                  <Ionicons name="arrow-back" size={22} color={C.teal} />
                </Pressable>
              )}
              <Text style={{ flex: 1, fontFamily: F.semi, fontSize: 19, color: C.ink }}>{inPic ? 'Make a clay picture' : slipping ? 'This one keeps slipping' : card.mnemonic ? 'Your memory hook' : 'Make a memory hook'}</Text>
              <Pressable hitSlop={12} onPress={onClose}>
                <Ionicons name="close" size={22} color={C.muted} />
              </Pressable>
            </View>

            <ScrollView ref={scroll} contentContainerStyle={{ gap: 16, paddingBottom: 6 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* what it is for */}
              <View style={{ backgroundColor: color.feedback.correct.bg, borderRadius: 14, borderWidth: 1, borderColor: C.mintBorder, padding: 12, gap: 4 }}>
                <Text style={[{ fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: C.ink }, autoDir(card.q)]}>{card.q}</Text>
                <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.teal }}>{card.a}</Text>
              </View>

              {/* PART 1 · the hook, in the student's own words (kept mounted, only hidden, so nothing typed is lost) */}
              <View style={{ gap: 16, display: inPic ? 'none' : 'flex' }}>
                <View style={{ gap: 8 }}>
                  <Step n={1} title="Your hook" note="A rhyme, a silly sentence, a little story." />
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    multiline
                    placeholder="My hook is…"
                    placeholderTextColor={C.mutedLight}
                    style={{ minHeight: 76, backgroundColor: C.white, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, fontFamily: F.medium, fontSize: 15, color: C.ink, textAlignVertical: 'top' }}
                  />
                  {ideas.length > 0 ? (
                    <View style={{ gap: 6 }}>
                      <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.muted }}>Coco’s ideas</Text>
                      {ideas.map((h, k) => (
                        <Enter key={k} delay={k * 60}>
                          <Squeeze
                            onPress={() => (tap('select'), setText(h))}
                            style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: text === h ? color.selected.bg : C.white, borderWidth: 1, borderColor: text === h ? color.selected.border : C.line, borderRadius: radius.md, padding: 12 }}>
                            <Ionicons name={text === h ? 'checkmark-circle' : 'sparkles-outline'} size={15} color={text === h ? color.selected.text : palette.sun600} style={{ marginTop: 2 }} />
                            <Text style={[{ flex: 1, fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: C.ink }, autoDir(h)]}>{h}</Text>
                          </Squeeze>
                        </Enter>
                      ))}
                    </View>
                  ) : (
                    <Squeeze
                      onPress={getIdeas}
                      disabled={busy || !tried}
                      outer={{ alignSelf: 'flex-start' }}
                      style={{ flexDirection: 'row', gap: 6, alignItems: 'center', opacity: tried ? 1 : 0.6, backgroundColor: palette.sun50, borderWidth: 1, borderColor: palette.sun200, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 }}>
                      {busy ? <ActivityIndicator size="small" color={palette.sun700} /> : <Ionicons name="sparkles-outline" size={14} color={palette.sun700} />}
                      <Text style={{ fontFamily: F.medium, fontSize: 13, color: palette.sun800 }}>{tried ? 'Need ideas? Ask Coco' : 'Write one first, then ask Coco'}</Text>
                    </Squeeze>
                  )}
                </View>

                {!!card.mnemonicImg && !pic && (
                  <View style={{ gap: 4 }}>
                    <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.muted }}>Your saved picture</Text>
                    <Image source={{ uri: card.mnemonicImg }} style={{ width: '100%', aspectRatio: 1472 / 1104, borderRadius: 12, backgroundColor: C.sand }} contentFit="contain" />
                  </View>
                )}
              </View>

              {/* PART 2 · the clay picture, only if the student wants one: it is made from the hook */}
              {inPic && (
                <View style={{ gap: 12 }}>
                  <View style={{ backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 12, gap: 8 }}>
                    <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.muted }}>The picture is made from your hook</Text>
                    {!!text.trim() && <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: C.ink }}>{text.trim()}</Text>}
                    <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>Not what you meant? Go back and change your words.</Text>
                  </View>
                  {youcamEnabled ? (
                    <View style={{ backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 12, gap: 10 }}>
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Pressable onPress={makePic} disabled={making || !canPic || tries >= 3} style={{ ...chip(true), opacity: !canPic || tries >= 3 ? 0.5 : 1 }}>
                          {making ? <ActivityIndicator size="small" color={C.white} /> : <Ionicons name="image-outline" size={15} color={C.white} />}
                          <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.white }}>{making ? 'Shaping it in clay…' : pic ? 'Try another' : 'Make my picture'}</Text>
                        </Pressable>
                        <Pressable onPress={() => (tap('select'), setWithCoco((v) => !v))} style={{ ...chip(false), backgroundColor: withCoco ? C.leaf : C.sand }}>
                          <Ionicons name={withCoco ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={withCoco ? C.white : C.body} />
                          <Text style={{ fontFamily: F.medium, fontSize: 12, color: withCoco ? C.white : C.body }}>Coco in it</Text>
                        </Pressable>
                      </View>
                      {making && <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>This takes about 20 seconds.</Text>}
                      {tries >= 3 && <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>That’s the most pictures for one hook.</Text>}
                      {!!picErr && (
                        <View style={{ gap: 2 }}>
                          <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.orange }}>Couldn’t make the picture right now. Your hook is still fine: you can save it as it is.</Text>
                          <Text selectable style={{ fontFamily: F.medium, fontSize: 10, color: C.muted }}>
                            {picErr}
                          </Text>
                        </View>
                      )}
                      {!!pic && (
                        <View style={{ gap: 6 }}>
                          <Image source={{ uri: pic }} style={{ width: '100%', aspectRatio: 1472 / 1104, borderRadius: 12, backgroundColor: C.sand }} contentFit="cover" />
                          <Pressable onPress={() => (tap('select'), setPic(undefined))} style={{ alignSelf: 'flex-end', paddingHorizontal: 4, paddingVertical: 2 }}>
                            <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>Remove picture</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>Clay pictures are not switched on in this build.</Text>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={{ gap: 8 }}>
              {!inPic && youcamEnabled && canPic && (
                <Btn title="Want a picture of it? Continue" icon="arrow-forward" kind="light" height={48} sfx={false} onPress={goPicture} />
              )}
              <Btn title={card.mnemonic ? 'Update my hook' : 'Save my hook'} iconLeft="bulb" kind="green" sfx={false} disabled={!canSave} loading={busy} onPress={plant} />
              <Pressable onPress={() => (inPic ? setPhase('write') : onClose())} hitSlop={10} style={{ alignSelf: 'center' }}>
                <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>{inPic ? '← Back to my hook' : 'Not now'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

function Step({ n, title, note }: { n: number; title: string; note?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: C.teal,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.white }}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.semi, fontSize: 14, color: C.teal }}>{title}</Text>
        {!!note && (
          <Text
            style={{
              fontFamily: F.medium,
              fontSize: 11,
              lineHeight: 15,
              color: C.muted,
            }}
          >
            {note}
          </Text>
        )}
      </View>
    </View>
  );
}
