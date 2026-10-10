// "Make a memory hook" — available on every flashcard and every question. The student makes their own hook
// (text or a drawing; Coco can only suggest ideas or say what he sees). A saved hook comes back as a hint on
// the card, and is listed when the student holds that chapter's branch.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colorName, SketchPad, type SketchHandle } from '@/components/SketchPad';
import { describeSketch, hookToScene, sketchToScene, suggestHooks } from '@/lib/ai';
import { haptic, play, tap } from '@/lib/feedback';
import { cardContext } from '@/lib/session';
import { saveSketch } from '@/lib/sketch';
import { makeHookPicture, savePicture, UploadError, youcamEnabled } from '@/lib/youcam';
import { useApp } from '@/store';
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
  // two parts: "write" (the hook in words, and a sketch if the student wants one) and "picture" (the clay picture)
  const [phase, setPhase] = useState<'write' | 'picture'>('write');
  const [draw, setDraw] = useState(false); // the drawing pad is open
  const [ink, setInk] = useState(false); // something is drawn
  const [drawing, setDrawing] = useState(false); // a stroke is in progress (the sheet must not scroll)
  const [used, setUsed] = useState<string[]>([]); // the colours on the board, in the order they were first used
  const [legend, setLegend] = useState<Record<string, string>>({}); // colour → what it is (the student's words)
  const [sketchImg, setSketchImg] = useState<string>(); // the board as a picture, taken when the student moves on
  const [look, setLook] = useState<{ saw: string; caption: string }>();
  const [looking, setLooking] = useState(false);
  // a clay-style picture made from the hook (YouCam). One picture costs 1 credit, so a hook gets 3 tries at most.
  const [pic, setPic] = useState<string>();
  const [making, setMaking] = useState(false);
  const [picErr, setPicErr] = useState<string>();
  const [withCoco, setWithCoco] = useState(false);
  const [tries, setTries] = useState(0);
  const pad = useRef<SketchHandle>(null);
  const scroll = useRef<ScrollView>(null);
  const tried = text.trim().split(/\s+/).filter(Boolean).length >= 3; // your own first try comes before Coco's ideas
  useEffect(() => {
    setText(card?.mnemonic ?? '');
    setIdeas([]);
    setBusy(false);
    setPhase('write');
    setDraw(false);
    setInk(false);
    setUsed([]);
    setLegend({});
    setSketchImg(undefined);
    setLook(undefined);
    setPic(undefined);
    setMaking(false);
    setPicErr(undefined);
    setWithCoco(false);
    setTries(0);
  }, [card?.id]);
  if (!card) return null;
  // what each colour of the sketch is, said by the student (colours left without words are not sent)
  const legendList = used.map((hex) => ({ color: colorName(hex), text: (legend[hex] ?? '').trim() })).filter((l) => l.text);
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
  const canPic = text.trim().length >= 3 || ink;
  // on to the picture: the board is photographed now (it is hidden while the picture is made, and kept for coming back)
  const goPicture = async () => {
    tap('select');
    setSketchImg(ink ? ((await pad.current?.capture()) ?? sketchImg) : undefined);
    setPicErr(undefined);
    setPhase('picture');
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  // The picture. With a sketch, the sketch is the reference and the colour words say what each colour is; with only
  // words, the hook alone does.
  const makePic = async () => {
    if (making || !canPic || tries >= 3) return;
    setMaking(true);
    setPicErr(undefined);
    setTries((n) => n + 1);
    try {
      const ctx = cardContext(card.subjectId);
      const req = { hook: text.trim(), q: card.q, a: card.a, withCoco, legend: legendList };
      let url: string | undefined;
      if (sketchImg) {
        try {
          url = await makeHookPicture({ ...req, sketch: sketchImg });
        } catch (e) {
          if (!(e instanceof UploadError)) throw e;
          // the sketch could not be uploaded: describe it in words instead
          const scene = await sketchToScene(ctx, card, req.hook, sketchImg, legendList).catch(() => look?.saw);
          url = await makeHookPicture({ ...req, scene });
        }
      } else {
        // words only: the AI turns the hook into a clear scene first, so the picture shows what the hook says
        const scene = req.hook ? await hookToScene(ctx, card, req.hook).catch(() => undefined) : undefined;
        url = await makeHookPicture({ ...req, scene });
      }
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
    if (!text.trim() && !ink && !pic) return;
    setBusy(true);
    // the drawing is only kept when there is no clay picture; in the picture part the board is hidden, so the photo taken then is used
    const img = ink && !pic ? (phase === 'write' ? ((await pad.current?.capture()) ?? sketchImg) : sketchImg) : undefined;
    const st = useApp.getState();
    // a question that has no flashcard yet becomes one (so the hook has somewhere to live and is reviewed later)
    const id = card.id ?? st.addCards([{ subjectId: card.subjectId, chapterId: card.chapterId, q: card.q, a: card.a }])[0];
    const uri = pic ? await savePicture(id, pic) : img ? await saveSketch(id, img) : undefined;
    st.saveHook(id, text.trim() || look?.caption || 'My drawing', uri);
    setBusy(false);
    play('grow');
    haptic('success');
    onClose();
  };
  const canSave = !!text.trim() || ink || !!pic;
  const chip = (on: boolean) => ({ flexDirection: 'row' as const, gap: 6, alignItems: 'center' as const, backgroundColor: on ? C.teal : C.sand, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8 });
  const inPic = phase === 'picture';
  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => (inPic ? setPhase('write') : onClose())}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24,36,28,0.35)' }}>
          <View style={{ backgroundColor: C.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 12, maxHeight: '92%' }}>
            {/* title */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              {inPic && (
                <Pressable hitSlop={12} onPress={() => (tap('select'), setPhase('write'))}>
                  <Ionicons name="arrow-back" size={22} color={C.teal} />
                </Pressable>
              )}
              <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 19, color: C.teal }}>{inPic ? 'Make a clay picture' : slipping ? 'This one keeps slipping' : card.mnemonic ? 'Your memory hook' : 'Make a memory hook'}</Text>
              <Pressable hitSlop={12} onPress={onClose}>
                <Ionicons name="close" size={22} color={C.muted} />
              </Pressable>
            </View>

            <ScrollView ref={scroll} contentContainerStyle={{ gap: 16, paddingBottom: 6 }} keyboardShouldPersistTaps="handled" scrollEnabled={!drawing} showsVerticalScrollIndicator={false}>
              {/* what it is for */}
              <View style={{ backgroundColor: '#F0F8E6', borderRadius: 14, borderWidth: 1, borderColor: C.mintBorder, padding: 12, gap: 4 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.ink }}>{card.q}</Text>
                <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.teal }}>{card.a}</Text>
              </View>

              {/* PART 1 · the hook in words, and a sketch if the student wants one. It stays mounted (only hidden) so the drawing is never lost. */}
              <View style={{ gap: 16, display: inPic ? 'none' : 'flex' }}>
                <View style={{ gap: 8 }}>
                  <Step n={1} title="Your hook" note="A rhyme, a silly sentence, a little story." />
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    multiline
                    placeholder="My hook is…"
                    placeholderTextColor="#A69A8A"
                    style={{ minHeight: 76, backgroundColor: C.white, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, fontFamily: F.medium, fontSize: 15, color: C.ink, textAlignVertical: 'top' }}
                  />
                  {ideas.length > 0 ? (
                    <View style={{ gap: 6 }}>
                      <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.muted }}>COCO’S IDEAS: TAP ONE, THEN MAKE IT YOURS</Text>
                      {ideas.map((h, k) => (
                        <Pressable key={k} onPress={() => (tap('select'), setText(h))} style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 10 }}>
                          <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: C.ink }}>{h}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Pressable onPress={getIdeas} disabled={busy || !tried} style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', opacity: tried ? 1 : 0.55 }}>
                      {busy ? <ActivityIndicator size="small" color={C.teal} /> : <Ionicons name="bulb-outline" size={14} color={C.goldInk} />}
                      <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.goldInk }}>{tried ? 'Need ideas? Ask Coco' : 'Try one yourself first, then Coco can add ideas'}</Text>
                    </Pressable>
                  )}
                </View>

                <View style={{ gap: 8 }}>
                  <Step n={2} title="Sketch it" note="Optional. Pick a colour for each thing, draw it (a stick figure, a circle…) and say what the colour is." />
                  {!!card.mnemonicImg && !pic && !ink && (
                    <View style={{ gap: 4 }}>
                      <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.muted }}>YOUR SAVED PICTURE</Text>
                      <Image source={{ uri: card.mnemonicImg }} style={{ width: '100%', aspectRatio: 1472 / 1104, borderRadius: 12, backgroundColor: C.sand }} contentFit="contain" />
                    </View>
                  )}
                  <Pressable onPress={async () => {
                      tap('select');
                      if (draw && ink) setSketchImg((await pad.current?.capture()) ?? sketchImg); // photographed before it is hidden
                      setDraw((v) => !v);
                    }}
                    style={{ ...chip(draw), alignSelf: 'flex-start' }}>
                    <Ionicons name="brush-outline" size={14} color={draw ? C.white : C.body} />
                    <Text style={{ fontFamily: F.bold, fontSize: 12, color: draw ? C.white : C.body }}>{draw ? 'Hide the drawing pad' : ink ? 'Show my sketch' : 'Draw a sketch'}</Text>
                  </Pressable>
                  {/* the pad stays mounted when hidden: the drawing is not lost */}
                  <View style={{ gap: 8, display: draw ? 'flex' : 'none' }}>
                    <SketchPad ref={pad} height={260} onInk={setInk} onDrawing={setDrawing} onColors={setUsed} />
                    {used.length > 0 && (
                      <View style={{ gap: 6 }}>
                        <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.muted }}>WHAT IS EACH COLOUR?</Text>
                        {used.map((hex) => (
                          <View key={hex} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: hex, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' }} />
                            <TextInput
                              value={legend[hex] ?? ''}
                              onChangeText={(t) => setLegend((l) => ({ ...l, [hex]: t }))}
                              placeholder={`The ${colorName(hex)} one is… (e.g. a fat man in a hat)`}
                              placeholderTextColor="#A69A8A"
                              style={{ flex: 1, backgroundColor: C.white, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, fontFamily: F.medium, fontSize: 13, color: C.ink }}
                            />
                          </View>
                        ))}
                      </View>
                    )}
                    <Pressable onPress={askLook} disabled={!ink || looking} style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', opacity: ink ? 1 : 0.5 }}>
                      {looking ? <ActivityIndicator size="small" color={C.teal} /> : <Ionicons name="eye-outline" size={14} color={C.teal} />}
                      <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.teal }}>Ask Coco what he sees</Text>
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
                </View>
              </View>

              {/* PART 2 · the clay picture, made from the sketch (if there is one) or from the hook */}
              {inPic && (
                <View style={{ gap: 12 }}>
                  <View style={{ backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 12, gap: 8 }}>
                    <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.muted }}>{sketchImg ? 'MADE FROM YOUR SKETCH' : 'MADE FROM YOUR HOOK'}</Text>
                    {!!text.trim() && <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: C.ink }}>{text.trim()}</Text>}
                    {!!sketchImg && <Image source={{ uri: `data:image/png;base64,${sketchImg}` }} style={{ width: '100%', height: 150, borderRadius: 10, backgroundColor: C.white, borderWidth: 1, borderColor: C.line }} contentFit="contain" />}
                    {legendList.map((l, k) => (
                      <Text key={k} style={{ fontFamily: F.medium, fontSize: 12, color: C.body }}>
                        {l.color} = {l.text}
                      </Text>
                    ))}
                    {!sketchImg && <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>Want to control the layout? Go back and draw a sketch.</Text>}
                  </View>
                  {youcamEnabled ? (
                    <View style={{ backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 12, gap: 10 }}>
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Pressable onPress={makePic} disabled={making || !canPic || tries >= 3} style={{ ...chip(true), opacity: !canPic || tries >= 3 ? 0.5 : 1 }}>
                          {making ? <ActivityIndicator size="small" color={C.white} /> : <Ionicons name="image-outline" size={15} color={C.white} />}
                          <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.white }}>{making ? 'Shaping it in clay…' : pic ? 'Try another' : sketchImg ? 'Make it from my sketch' : 'Make it from my hook'}</Text>
                        </Pressable>
                        <Pressable onPress={() => (tap('select'), setWithCoco((v) => !v))} style={{ ...chip(false), backgroundColor: withCoco ? C.leaf : C.sand }}>
                          <Ionicons name={withCoco ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={withCoco ? C.white : C.body} />
                          <Text style={{ fontFamily: F.bold, fontSize: 12, color: withCoco ? C.white : C.body }}>Coco in it</Text>
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
                            <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.muted }}>Remove picture</Text>
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
                <Pressable onPress={goPicture} style={{ height: 46, borderRadius: 23, borderWidth: 2, borderColor: C.teal, backgroundColor: C.white, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.teal }}>Continue: make a clay picture</Text>
                  <Ionicons name="arrow-forward" size={18} color={C.teal} />
                </Pressable>
              )}
              <Pressable onPress={plant} disabled={!canSave || busy} style={{ height: 52, borderRadius: 26, backgroundColor: canSave ? C.teal : C.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
                {busy ? <ActivityIndicator color={C.white} /> : <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.white }}>{card.mnemonic ? 'Update my hook' : 'Save my hook'}</Text>}
              </Pressable>
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
        <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.white }}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.teal }}>{title}</Text>
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
