// "Make a memory hook" — available on every flashcard and every question. The student makes their own hook
// (text or a drawing; Coco can only suggest ideas or say what he sees). A saved hook comes back as a hint on
// the card, and is listed when the student holds that chapter's branch.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SketchPad, type SketchHandle } from '@/components/SketchPad';
import { describeSketch, suggestHooks } from '@/lib/ai';
import { haptic, play, tap } from '@/lib/feedback';
import { cardContext } from '@/lib/session';
import { saveSketch } from '@/lib/sketch';
import { makeHookPicture, savePicture, youcamEnabled } from '@/lib/youcam';
import { useApp } from '@/store';
import { C, F } from '@/theme';

export type HookTarget = { id?: string; subjectId: string; chapterId: string; q: string; a: string; mnemonic?: string; mnemonicImg?: string };

export function HookSheet({ card, onClose, slipping }: { card?: HookTarget; onClose: () => void; slipping?: boolean }) {
  const [text, setText] = useState('');
  const [ideas, setIdeas] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [draw, setDraw] = useState(false); // the drawing pad is open
  const [ink, setInk] = useState(false); // something is drawn
  const [drawing, setDrawing] = useState(false); // a stroke is in progress (the sheet must not scroll)
  const [look, setLook] = useState<{ saw: string; caption: string }>();
  const [looking, setLooking] = useState(false);
  // a clay-style picture made from the hook (YouCam). One picture costs 1 credit, so a hook gets 3 tries at most.
  const [pic, setPic] = useState<string>();
  const [making, setMaking] = useState(false);
  const [picErr, setPicErr] = useState(false);
  const [withCoco, setWithCoco] = useState(false);
  const [tries, setTries] = useState(0);
  const pad = useRef<SketchHandle>(null);
  const tried = text.trim().split(/\s+/).filter(Boolean).length >= 3; // your own first try comes before Coco's ideas
  useEffect(() => {
    setText(card?.mnemonic ?? '');
    setIdeas([]);
    setBusy(false);
    setDraw(false);
    setInk(false);
    setLook(undefined);
    setPic(undefined);
    setMaking(false);
    setPicErr(false);
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
  const askLook = async () => {
    setLooking(true);
    try {
      const img = await pad.current?.capture();
      setLook(img ? await describeSketch(cardContext(card.subjectId), card, img) : { saw: 'I couldn’t read the drawing this time, but you can still save it.', caption: '' });
    } catch {
      setLook({ saw: 'I couldn’t look just now — you can still save your drawing.', caption: '' });
    }
    setLooking(false);
  };
  const makePic = async () => {
    if (making || text.trim().length < 3) return;
    setMaking(true);
    setPicErr(false);
    setTries((n) => n + 1);
    try {
      setPic(await makeHookPicture({ hook: text.trim(), q: card.q, a: card.a, withCoco }));
      play('success');
      haptic('success');
    } catch {
      setPicErr(true);
    }
    setMaking(false);
  };
  const plant = async () => {
    if (!text.trim() && !ink) return;
    setBusy(true);
    const img = ink && !pic ? await pad.current?.capture() : undefined;
    const st = useApp.getState();
    // a question that has no flashcard yet becomes one (so the hook has somewhere to live and is reviewed later)
    const id = card.id ?? st.addCards([{ subjectId: card.subjectId, chapterId: card.chapterId, q: card.q, a: card.a }])[0];
    // the made picture wins over a drawing (the drawing is only kept when there is no picture)
    const uri = pic ? await savePicture(id, pic) : img ? await saveSketch(id, img) : undefined;
    st.saveHook(id, text.trim() || look?.caption || 'My drawing', uri);
    setBusy(false);
    play('grow');
    haptic('success');
    onClose();
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24,36,28,0.35)' }}>
        <View style={{ backgroundColor: C.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 10, maxHeight: '90%' }}>
          <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled" scrollEnabled={!drawing}>
            <Text style={{ fontFamily: F.bold, fontSize: 18, color: C.teal }}>{slipping ? 'This one keeps slipping' : card.mnemonic ? 'Your memory hook' : 'Make a memory hook'}</Text>
            <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: C.body }}>
              A picture, a rhyme, a silly sentence: whatever helps you remember. It’s saved with this branch and comes back as a hint on the card.
            </Text>
            <View style={{ backgroundColor: '#F0F8E6', borderRadius: 14, borderWidth: 1, borderColor: C.mintBorder, padding: 12 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.ink }}>{card.q}</Text>
              <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.teal, marginTop: 4 }}>{card.a}</Text>
            </View>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              placeholder="My hook is…"
              placeholderTextColor="#A69A8A"
              style={{ minHeight: 70, backgroundColor: C.white, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, fontFamily: F.medium, fontSize: 15, color: C.ink, textAlignVertical: 'top' }}
            />
            {youcamEnabled && (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Pressable
                    onPress={makePic}
                    disabled={making || text.trim().length < 3 || tries >= 3}
                    style={{ flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: C.teal, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, opacity: text.trim().length < 3 || tries >= 3 ? 0.5 : 1 }}>
                    {making ? <ActivityIndicator size="small" color={C.white} /> : <Ionicons name="image-outline" size={15} color={C.white} />}
                    <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.white }}>{making ? 'Shaping it in clay…' : pic ? 'Try another picture' : 'Make a picture'}</Text>
                  </Pressable>
                  <Pressable onPress={() => (tap('select'), setWithCoco((v) => !v))} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: withCoco ? C.leaf : C.sand, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 }}>
                    <Ionicons name={withCoco ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={withCoco ? C.white : C.body} />
                    <Text style={{ fontFamily: F.bold, fontSize: 12, color: withCoco ? C.white : C.body }}>Coco in it</Text>
                  </Pressable>
                </View>
                {text.trim().length < 3 && !pic && <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>Write your hook first, then Drrys can turn it into a picture.</Text>}
                {making && <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>This takes about half a minute.</Text>}
                {picErr && <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.orange }}>Couldn’t make the picture right now. Your hook is still fine: you can save it as it is.</Text>}
                {tries >= 3 && <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>That’s the most pictures for one hook.</Text>}
                {!!pic && (
                  <View style={{ backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 6, gap: 6 }}>
                    <Image source={{ uri: pic }} style={{ width: '100%', aspectRatio: 1664 / 928, borderRadius: 10 }} contentFit="cover" />
                    <Pressable onPress={() => (tap('select'), setPic(undefined))} style={{ alignSelf: 'flex-end', paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.muted }}>Remove picture</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
            <Pressable onPress={() => (tap('select'), setDraw((v) => !v))} style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: draw ? C.teal : C.sand, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7 }}>
              <Ionicons name="brush-outline" size={14} color={draw ? C.white : C.body} />
              <Text style={{ fontFamily: F.bold, fontSize: 12, color: draw ? C.white : C.body }}>{draw ? 'Hide the drawing pad' : 'Draw it instead (or as well)'}</Text>
            </Pressable>
            {draw && (
              <View style={{ gap: 8 }}>
                <SketchPad ref={pad} height={220} onInk={setInk} onDrawing={setDrawing} />
                <Pressable
                  onPress={askLook}
                  disabled={!ink || looking}
                  style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: C.sand, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7, opacity: ink ? 1 : 0.6 }}>
                  {looking ? <ActivityIndicator size="small" color={C.teal} /> : <Ionicons name="eye-outline" size={14} color={C.body} />}
                  <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.body }}>Ask Coco what he sees</Text>
                </Pressable>
                {look && (
                  <View style={{ backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 10, gap: 6 }}>
                    <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: C.ink }}>{look.saw}</Text>
                    {!!look.caption && (
                      <Pressable onPress={() => (tap('select'), setText((t) => t || look.caption))}>
                        <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.leaf }}>Use as caption: “{look.caption}”</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            )}
            {ideas.length > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.muted }}>COCO’S IDEAS — TAP ONE, THEN MAKE IT YOURS</Text>
                {ideas.map((h, k) => (
                  <Pressable key={k} onPress={() => (tap('select'), setText(h))} style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 10 }}>
                    <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: C.ink }}>{h}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {!ideas.length && (
              <Pressable onPress={getIdeas} disabled={busy || !tried} style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: C.sand, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7, opacity: tried ? 1 : 0.6 }}>
                {busy ? <ActivityIndicator size="small" color={C.teal} /> : <Ionicons name="bulb-outline" size={14} color={C.body} />}
                <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.body }}>{tried ? 'Give me ideas' : 'Try one yourself first, then Coco can add ideas'}</Text>
              </Pressable>
            )}
          </ScrollView>
          <Pressable
            onPress={plant}
            disabled={(!text.trim() && !ink) || busy}
            style={{ height: 52, borderRadius: 26, backgroundColor: text.trim() || ink ? C.teal : C.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.white }}>Save my hook</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={10} style={{ alignSelf: 'center' }}>
            <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>Not now</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

