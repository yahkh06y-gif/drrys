// Fill in the blanks (like Duolingo): a sentence from the lecture with gaps, and a bank of words under it.
// Tap a word and it goes into the next empty gap (or into the gap you tapped first). Tap a filled gap to take the word back.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { haptic, tap } from '@/lib/feedback';
import { color } from '@/design';
import { C, F } from '@/theme';

/** "The [[mitochondrion]] makes [[ATP]]." → pieces: text, gap, text, gap, text. */
export function parseBlanks(text: string): { parts: { t: string; gap?: number }[]; answers: string[] } {
  const parts: { t: string; gap?: number }[] = [];
  const answers: string[] = [];
  let last = 0;
  for (const m of text.matchAll(/\[\[(.+?)\]\]/g)) {
    if (m.index! > last) parts.push({ t: text.slice(last, m.index) });
    parts.push({ t: m[1].trim(), gap: answers.length });
    answers.push(m[1].trim());
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ t: text.slice(last) });
  return { parts, answers };
}

export function BlankQ({ text, extras, locked, marks, onChange }: { text: string; extras?: string[]; locked: boolean; marks?: boolean[]; onChange: (filled: string[], complete: boolean) => void }) {
  const { parts, answers } = useMemo(() => parseBlanks(text), [text]);
  const rtl = /[\u0590-\u08FF]/.test(text); // Arabic / Hebrew: the sentence reads from the right
  // the word bank: every answer plus the extra (wrong) words, in a shuffled order that stays the same
  const bank = useMemo(() => {
    const all = [...answers, ...(extras ?? [])].map((w, id) => ({ id, w }));
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
  }, [answers, extras]);
  const [slot, setSlot] = useState<(number | undefined)[]>(() => answers.map(() => undefined)); // gap → id of the word in it
  const [pick, setPick] = useState<number>(); // the gap the student tapped to fill next
  useEffect(() => {
    setSlot(answers.map(() => undefined));
    setPick(undefined);
  }, [answers]);
  useEffect(() => {
    onChange(
      slot.map((id) => (id === undefined ? '' : (bank.find((b) => b.id === id)?.w ?? ''))),
      slot.length > 0 && slot.every((s) => s !== undefined),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot]);

  const used = new Set(slot.filter((s) => s !== undefined));
  const put = (id: number) => {
    if (locked) return;
    const at = pick !== undefined && slot[pick] === undefined ? pick : slot.findIndex((s) => s === undefined);
    if (at < 0) return;
    haptic('light');
    setSlot((s) => s.map((x, i) => (i === at ? id : x)));
    setPick(undefined);
  };
  const take = (g: number) => {
    if (locked) return;
    tap('select');
    if (slot[g] !== undefined) setSlot((s) => s.map((x, i) => (i === g ? undefined : x)));
    else setPick((p) => (p === g ? undefined : g));
  };

  return (
    <View style={{ gap: 16 }}>
      {/* the sentence */}
      <View style={{ backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.lineStrong, borderBottomWidth: 4, padding: 16, flexDirection: rtl ? 'row-reverse' : 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 10 }}>
        {parts.map((p, i) => {
          if (p.gap === undefined) return p.t.split(/(\s+)/).filter(Boolean).map((w, k) => (
            <Text key={`${i}-${k}`} style={{ fontFamily: F.medium, fontSize: 17, lineHeight: 28, color: C.ink }}>
              {w}
            </Text>
          ));
          const g = p.gap;
          const id = slot[g];
          const m = locked ? marks?.[g] : undefined;
          const word = id === undefined ? '' : bank.find((b) => b.id === id)?.w;
          return (
            <Pressable
              key={`${i}`}
              disabled={locked}
              onPress={() => take(g)}
              style={{
                minWidth: 78,
                marginHorizontal: 3,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 10,
                borderWidth: 1.5,
                borderStyle: id === undefined ? 'dashed' : 'solid',
                borderColor: m === undefined ? (pick === g ? C.leaf : id === undefined ? C.lineStrong : C.teal) : m ? C.mintBorder : color.feedback.wrong.border,
                backgroundColor: m === undefined ? (pick === g ? color.feedback.correct.picked : id === undefined ? color.bg.sunken : '#E6F2EF') : m ? color.feedback.correct.bg : color.feedback.wrong.bg,
              }}>
              <Text style={{ fontFamily: F.bold, fontSize: 16, lineHeight: 24, textAlign: 'center', color: C.ink }}>
                {m === undefined ? '' : m ? '✓ ' : '✗ '}
                {word || ' '}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* the word bank */}
      {!locked && (
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>Tap a word to put it in the next gap. {extras?.length ? 'Not every word is used.' : ''}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, minHeight: 44 }}>
            {bank.map((b) => {
              const on = used.has(b.id);
              return (
                <Pressable
                  key={b.id}
                  disabled={on}
                  onPress={() => put(b.id)}
                  style={{ backgroundColor: on ? C.sand : C.white, borderWidth: 1.5, borderColor: C.lineStrong, borderBottomWidth: on ? 1.5 : 3, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9, opacity: on ? 0.35 : 1 }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink }}>{b.w}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
