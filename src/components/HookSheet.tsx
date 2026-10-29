// "Make a memory hook" — available on every flashcard and every question. The student makes their own hook
// (text or a drawing; Coco can only suggest ideas or say what he sees). A saved hook comes back as a hint on
// the card, and is listed when the student holds that chapter's branch.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hookToScene, suggestHooks } from '@/lib/ai';
import { haptic, play, tap } from '@/lib/feedback';
import { cardContext } from '@/lib/session';
import { makeHookPicture, savePicture, youcamEnabled } from '@/lib/youcam';
import { Squeeze } from '@/components/SessionMotion';
import { Btn, Enter } from '@/components/ui';
import { useApp } from '@/store';
import { Feedback, Field, RecallCard, Surface, T } from '@/design';
import { useKeyboardLift } from '@/design/keyboard';
import { autoDir } from '@/design/rtl';
import { color, palette, radius, S, size } from '@/design/tokens';
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
  const [tries, setTries] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const { ref: kbRef, onLayout: kbLayout, lift: kbLift, room: kbRoom, open: kbOpen } = useKeyboardLift();
  const insets = useSafeAreaInsets();
  const tried = text.trim().split(/\s+/).filter(Boolean).length >= 3; // your own first try comes before Coco's ideas
  useEffect(() => {
    setText(card?.mnemonic ?? '');
    setIdeas([]);
    setBusy(false);
    setPhase('write');
    setPic(undefined);
    setMaking(false);
    setPicErr(undefined);
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
  const MAX_TRIES = 3;
  const left = MAX_TRIES - tries;
  const makePic = async () => {
    if (making || !canPic || left <= 0) return;
    setMaking(true);
    setPicErr(undefined);
    setTries((n) => n + 1);
    try {
      const hook = text.trim();
      const scene = await hookToScene(cardContext(card.subjectId), card, hook).catch(() => undefined);
      const url = await makeHookPicture({ hook, q: card.q, a: card.a, scene });
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
  const inPic = phase === 'picture';
  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={() => (inPic ? setPhase('write') : onClose())}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* the sheet sits on the keyboard (useKeyboardLift), and is never taller than the room above it */}
        <View ref={kbRef} onLayout={kbLayout} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: color.overlay.scrim, paddingBottom: kbLift }}>
          <View style={{ backgroundColor: C.paper, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: 18, paddingTop: 10, paddingBottom: kbOpen ? 10 : Math.max(insets.bottom, 18), gap: 12, maxHeight: kbRoom ? kbRoom - insets.top - 8 : '92%' }}>
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

            {/* what it is for: the answer to remember (just the answer while typing, so the writing has the room) */}
            <RecallCard q={card.q} a={card.a} compact={kbOpen || inPic} />

            <ScrollView ref={scroll} style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 16, paddingBottom: 6 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

              {/* PART 1 · the hook, in the student's own words (kept mounted, only hidden, so nothing typed is lost) */}
              <View style={{ gap: 16, display: inPic ? 'none' : 'flex' }}>
                <View style={{ gap: 8 }}>
                  <Field
                    label="Your hook"
                    value={text}
                    onChangeText={setText}
                    multiline
                    scrollEnabled
                    placeholder="A rhyme, a silly sentence, a little story…"
                    style={{ minHeight: 96, maxHeight: 168 }}
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

              {/* PART 2 · the clay picture, made from the hook. One thing to press at a time: the big green button under
                  the sheet always says what happens next, and the frame shows where the picture will appear. */}
              {inPic && (
                <View style={{ gap: S[3] }}>
                  <Surface kind="flat" pad={3} gap={1}>
                    <T v="caption">Made from your hook</T>
                    <T v="subhead" auto style={{ color: color.text.primary }}>
                      {text.trim()}
                    </T>
                    <Pressable hitSlop={10} disabled={making} onPress={() => (tap('select'), setPhase('write'))} accessibilityRole="button" style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: S[1], paddingTop: S[1] }}>
                      <Ionicons name="create-outline" size={size.icon.sm} color={color.text.brand} />
                      <T v="caption" style={{ color: color.text.brand }}>
                        Change the words
                      </T>
                    </Pressable>
                  </Surface>

                  {youcamEnabled ? (
                    <>
                      {/* the frame: empty → shaping → the picture */}
                      <Surface kind="sunken" pad={0} style={{ width: '100%', aspectRatio: 1472 / 1104, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                        {pic ? (
                          <Image source={{ uri: pic }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                        ) : making ? (
                          <View style={{ alignItems: 'center', gap: S[2], padding: S[4] }}>
                            <ActivityIndicator size="large" color={color.action.primary} />
                            <T v="title">Shaping it in clay…</T>
                            <T v="caption">This takes about 20 seconds.</T>
                          </View>
                        ) : (
                          <View style={{ alignItems: 'center', gap: S[2], padding: S[4] }}>
                            <Ionicons name="image-outline" size={40} color={color.text.muted} />
                            <T v="caption" style={{ textAlign: 'center' }}>
                              {left > 0 ? 'Your picture will appear here.\nTap “Make my picture” below.' : 'That’s the most pictures for one hook.'}
                            </T>
                          </View>
                        )}
                      </Surface>

                      {!!picErr && !making && (
                        <Feedback tone="almost" title="Couldn’t make the picture">
                          <T v="bodySm">Your hook is fine. Try again, or save it without a picture.</T>
                          <T v="micro" selectable style={{ color: color.text.muted }}>
                            {picErr}
                          </T>
                        </Feedback>
                      )}

                      {tries > 0 && left > 0 && !making && (
                        <T v="caption" style={{ textAlign: 'center' }}>
                          {left === 1 ? '1 more try for this hook' : `${left} more tries for this hook`}
                        </T>
                      )}
                    </>
                  ) : (
                    <T v="caption">Clay pictures are not switched on in this build.</T>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={{ gap: S[2] }}>
              {!inPic ? (
                <>
                  {!kbOpen && youcamEnabled && canPic && (
                    <Btn title="Add a clay picture" iconLeft="image-outline" kind="light" height={48} sfx={false} onPress={goPicture} />
                  )}
                  <Btn title={card.mnemonic ? 'Update my hook' : 'Save my hook'} iconLeft="bulb" kind="green" sfx={false} disabled={!canSave} loading={busy} onPress={plant} />
                </>
              ) : pic ? (
                <>
                  {/* a picture is ready: keeping it is the main step, another try is the second */}
                  <Btn title="Save hook with this picture" iconLeft="checkmark" kind="green" sfx={false} loading={busy} disabled={making} onPress={plant} />
                  {left > 0 && <Btn title="Make a different one" iconLeft="refresh" kind="light" height={48} sfx={false} disabled={busy} loading={making} onPress={makePic} />}
                </>
              ) : youcamEnabled && left > 0 ? (
                <>
                  <Btn title={making ? 'Shaping it in clay…' : picErr ? 'Try again' : 'Make my picture'} iconLeft={picErr ? 'refresh' : 'image'} kind="green" sfx={false} loading={making} disabled={!canPic} onPress={makePic} />
                  {!making && (
                    <Pressable onPress={plant} disabled={busy || !canSave} hitSlop={10} accessibilityRole="button" style={{ alignSelf: 'center', minHeight: 32, justifyContent: 'center' }}>
                      <T v="caption" style={{ color: color.text.brand }}>
                        Save without a picture
                      </T>
                    </Pressable>
                  )}
                </>
              ) : (
                <Btn title={card.mnemonic ? 'Update my hook' : 'Save my hook'} iconLeft="bulb" kind="green" sfx={false} disabled={!canSave} loading={busy} onPress={plant} />
              )}
              {!kbOpen && !making && (
                <Pressable onPress={() => (inPic ? setPhase('write') : onClose())} hitSlop={10} style={{ alignSelf: 'center' }}>
                  <T v="caption">{inPic ? '← Back to my hook' : 'Not now'}</T>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

