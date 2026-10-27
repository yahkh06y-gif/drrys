// Coco settings — the one page for everything about Coco, opened from the ⚙ on the Coco tab and Profile → Look & style.
// Layout: preview → Look (closet, paid with XP) → How Coco talks (style, answer length, examples). Changes save right away.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { Coco, IconBtn, XpStars } from '@/components/ui';
import { haptic, play, tap } from '@/lib/feedback';
import { useApp, type CocoStyle, type Depth, type Outfit } from '@/store';
import { color, shadow } from '@/design/tokens';
import { C, F } from '@/theme';

const CLOSET: { id: Outfit; name: string; cost: number }[] = [
  { id: 'classic', name: 'Classic', cost: 0 },
  { id: 'scarf', name: 'Forest scarf', cost: 0 },
  { id: 'birthday', name: 'Happy Birthday', cost: 180 },
  { id: 'ninja', name: 'Ninja', cost: 260 },
];
const STYLES: { id: CocoStyle; label: string; sub: string }[] = [
  { id: 'friendly', label: 'Friendly coach', sub: 'Warm and encouraging' },
  { id: 'calm', label: 'Calm tutor', sub: 'Patient, one small step at a time' },
  { id: 'direct', label: 'Direct & focused', sub: 'Straight to the point' },
  { id: 'playful', label: 'Playful buddy', sub: 'Jokes, games and fun facts' },
];
const DEPTHS: { id: Depth; label: string; sub: string }[] = [
  { id: 'quick', label: 'Short', sub: 'A sentence or two: the key idea only.' },
  { id: 'balanced', label: 'Balanced', sub: 'The idea plus one example.' },
  { id: 'deep', label: 'Detailed', sub: 'The full why, with steps and examples.' },
];

export default function Customize() {
  const coco = useApp((s) => s.coco);
  const xp = useApp((s) => s.stats.xp);
  const interests = useApp((s) => s.profile.interests);
  const buyOutfit = useApp((s) => s.buyOutfit);
  const set = useApp((s) => s.set);
  const setC = (p: Partial<typeof coco>) => set({ coco: { ...coco, ...p } });
  const [short, setShort] = useState<{ name: string; need: number } | null>(null); // tapped an outfit you can't afford yet

  const pick = (o: (typeof CLOSET)[number]) => {
    const owned = coco.owned.includes(o.id);
    if (!owned && xp < o.cost) {
      haptic('error');
      setShort({ name: o.name, need: o.cost - xp });
      return;
    }
    setShort(null);
    if (coco.outfit === o.id) return;
    if (buyOutfit(o.id, o.cost)) play(owned ? 'select' : 'celebrate');
  };

  const wearing = CLOSET.find((o) => o.id === coco.outfit)?.name ?? 'Classic';
  const depth = DEPTHS.find((d) => d.id === coco.depth) ?? DEPTHS[1];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }}>
        <IconBtn name="arrow-back" onPress={() => router.back()} />
        <Text accessibilityRole="header" style={{ flex: 1, textAlign: 'center', fontFamily: F.semi, fontSize: 17, color: C.ink, marginRight: 40 }}>
          Coco settings
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48, gap: 28 }} showsVerticalScrollIndicator={false}>
        {/* preview: what Coco looks like right now */}
        <View style={{ backgroundColor: C.mint, borderRadius: 24, paddingTop: 12, paddingBottom: 14, alignItems: 'center', gap: 4 }}>
          <Coco src={COCO[coco.outfit] ?? COCO.classic} size={110} />
          <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.moss }}>Wearing {wearing}</Text>
        </View>

        {/* Look: outfits cost XP, so the balance sits right above them */}
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
            <Text accessibilityRole="header" style={{ flex: 1, fontFamily: F.medium, fontSize: 14, color: C.muted }}>
              Look
            </Text>
            <View accessible accessibilityLabel={`You have ${xp} XP`} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <XpStars size={15} />
              <Text style={{ fontFamily: F.semi, fontSize: 14, color: C.ink, fontVariant: ['tabular-nums'] }}>{xp} XP</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {CLOSET.map((o) => {
              const on = coco.outfit === o.id;
              const owned = coco.owned.includes(o.id);
              return (
                <Pressable
                  key={o.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${o.name}, ${on ? 'wearing' : owned ? 'owned' : `${o.cost} XP`}`}
                  onPress={() => (tap('select'), pick(o))}
                  style={({ pressed }) => [card, { width: '48%', flexGrow: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 12, gap: 4 }, { borderWidth: 1.5, borderBottomWidth: 4, borderColor: on ? color.selected.border : C.lineStrong }, on && { backgroundColor: color.selected.bg }, pressed && { backgroundColor: C.sand }]}>
                  <Image source={COCO[o.id]} style={{ width: 64, height: 76, opacity: owned || xp >= o.cost ? 1 : 0.55 }} contentFit="contain" />
                  <Text numberOfLines={1} style={{ fontFamily: F.medium, fontSize: 15, color: C.ink }}>
                    {o.name}
                  </Text>
                  {on ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="checkmark-circle" size={14} color={C.teal} />
                      <Text style={{ fontFamily: F.semi, fontSize: 12, color: C.teal }}>Wearing</Text>
                    </View>
                  ) : owned ? (
                    <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>Owned</Text>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="lock-closed" size={11} color={C.muted} />
                      <Text style={{ fontFamily: F.semi, fontSize: 12, color: C.leaf }}>{o.cost} XP</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
          {short && (
            <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 18, color: C.orange, paddingHorizontal: 4 }}>
              {short.name} needs {short.need} more XP. Finish a study session to earn some.
            </Text>
          )}
        </View>

        {/* How Coco talks: one choice per list, each option says what it does */}
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={{ fontFamily: F.medium, fontSize: 14, color: C.muted, paddingHorizontal: 4 }}>
            How Coco talks
          </Text>
          <View style={[card, { overflow: 'hidden' }]}>
            {STYLES.map((s, i) => {
              const on = coco.style === s.id;
              return (
                <Pressable
                  key={s.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => (tap('select'), setC({ style: s.id }))}
                  style={({ pressed }) => [{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 }, pressed && { backgroundColor: C.sand }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: F.medium, fontSize: 16, color: C.ink }}>{s.label}</Text>
                    <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.muted }}>{s.sub}</Text>
                  </View>
                  {on ? <Ionicons name="checkmark" size={22} color={C.teal} /> : <View style={{ width: 22 }} />}
                  {i < STYLES.length - 1 && <View style={{ position: 'absolute', bottom: 0, left: 16, right: 0, height: 1, backgroundColor: color.border.subtle }} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={{ fontFamily: F.medium, fontSize: 14, color: C.muted, paddingHorizontal: 4 }}>
            Answer length
          </Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: C.sand, borderRadius: 16, padding: 4 }}>
            {DEPTHS.map((d) => {
              const on = coco.depth === d.id;
              return (
                <Pressable
                  key={d.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => (tap('select'), setC({ depth: d.id }))}
                  style={{ flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.white : 'transparent', ...(on ? shadow.lift : null) }}>
                  <Text style={{ fontFamily: F.medium, fontSize: 14, color: on ? C.ink : C.muted }}>{d.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.muted, paddingHorizontal: 4 }}>{depth.sub}</Text>
        </View>

        <View style={[card, { overflow: 'hidden' }]}>
          <View style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: F.medium, fontSize: 16, color: C.ink }}>Examples from my interests</Text>
              <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 18, color: C.muted }}>When something is hard, Coco explains it with things you love.</Text>
            </View>
            <Switch value={coco.memory} onValueChange={(v) => (tap(), setC({ memory: v }))} trackColor={{ true: C.leaf, false: C.track }} thumbColor={C.white} />
          </View>
          {coco.memory && (
            <Pressable
              accessibilityRole="button"
              onPress={() => (tap(), router.push({ pathname: '/about/[step]', params: { step: 'world' } }))}
              style={({ pressed }) => [{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderTopWidth: 1, borderColor: C.line }, pressed && { backgroundColor: C.sand }]}>
              <Text style={{ fontFamily: F.medium, fontSize: 16, color: C.ink }}>Interests</Text>
              <Text numberOfLines={1} style={{ flex: 1, textAlign: 'right', fontFamily: F.medium, fontSize: 14, color: C.muted }}>
                {interests.length ? interests.slice(0, 2).join(', ') + (interests.length > 2 ? ` +${interests.length - 2}` : '') : 'Add'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={C.mutedLight} />
            </Pressable>
          )}
        </View>

        <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.mutedLight, textAlign: 'center' }}>Changes save right away.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// same card as Profile: quiet border, a soft clay edge underneath
const card: ViewStyle = { backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.line };
