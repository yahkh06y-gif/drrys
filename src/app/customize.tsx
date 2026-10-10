// Customize Coco — closet (spend XP), conversation style, depth.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { Btn, Coco, IconBtn, T, XpStars } from '@/components/ui';
import { haptic, play, tap } from '@/lib/feedback';
import { useApp, type CocoStyle, type Depth, type Outfit } from '@/store';
import { C, F } from '@/theme';

const CLOSET: { id: Outfit; name: string; cost: number }[] = [
  { id: 'classic', name: 'Classic', cost: 0 },
  { id: 'scarf', name: 'Forest scarf', cost: 0 },
  { id: 'birthday', name: 'Happy Birthday', cost: 180 },
  { id: 'ninja', name: 'Ninja', cost: 260 },
];
const STYLES: { id: CocoStyle; label: string }[] = [
  { id: 'friendly', label: 'Friendly coach' },
  { id: 'calm', label: 'Calm tutor' },
  { id: 'direct', label: 'Direct & focused' },
  { id: 'playful', label: 'Playful buddy' },
];
const DEPTHS: Depth[] = ['quick', 'balanced', 'deep'];

export default function Customize() {
  const coco = useApp((s) => s.coco);
  const xp = useApp((s) => s.stats.xp);
  const buyOutfit = useApp((s) => s.buyOutfit);
  const set = useApp((s) => s.set);
  const setC = (p: Partial<typeof coco>) => set({ coco: { ...coco, ...p } });

  const pick = (o: (typeof CLOSET)[number]) => {
    const owned = coco.owned.includes(o.id);
    if (!owned && xp < o.cost) {
      haptic('error');
      Alert.alert('Not enough XP yet', `You need ${o.cost - xp} more XP. Finish a study session to earn some!`);
      return;
    }
    if (buyOutfit(o.id, o.cost)) play(owned ? 'select' : 'celebrate');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
        <IconBtn name="arrow-back" onPress={() => router.back()} />
        <T v="h3" style={{ color: C.teal, flex: 1 }}>
          Customize Coco
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <XpStars size={18} />
          <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.ink }}>{xp} XP</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40 }}>
        <View style={{ backgroundColor: '#EFE7D6', borderRadius: 24, paddingVertical: 10 }}>
          <Coco src={COCO[coco.outfit]} size={170} />
        </View>

        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <T v="title" style={{ color: C.teal }}>
              Coco’s closet
            </T>
            <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.leaf }}>Use your XP</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {CLOSET.map((o) => {
              const on = coco.outfit === o.id;
              const owned = coco.owned.includes(o.id);
              return (
                <Pressable key={o.id} onPress={() => pick(o)} style={{ width: 92, alignItems: 'center', backgroundColor: on ? C.teal : C.white, borderRadius: 16, borderWidth: 1, borderColor: on ? C.teal : C.lineStrong, borderBottomWidth: 4, padding: 8 }}>
                  <Image source={COCO[o.id]} style={{ width: 60, height: 70 }} contentFit="contain" />
                  <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 11, color: on ? C.white : C.ink }}>
                    {o.name}
                  </Text>
                  <Text style={{ fontFamily: F.medium, fontSize: 10, color: on ? C.mint : owned ? C.muted : C.leaf }}>{owned ? 'Owned' : `${o.cost} XP`}</Text>
                  {!owned && <Ionicons name="lock-closed" size={11} color={C.muted} style={{ position: 'absolute', top: 6, right: 6 }} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ gap: 10 }}>
          <T v="title" style={{ color: C.teal }}>
            How Coco talks
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {STYLES.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => (tap('select'), setC({ style: s.id }))}
                style={{ width: '48.5%', paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: coco.style === s.id ? C.teal : C.sand, borderBottomWidth: 3, borderColor: 'rgba(90,66,37,0.2)' }}>
                <Text style={{ fontFamily: F.bold, fontSize: 12, color: coco.style === s.id ? C.white : C.ink }}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted, marginTop: 4 }}>Response depth</Text>
          <View style={{ flexDirection: 'row', backgroundColor: C.sand, borderRadius: 12, padding: 4 }}>
            {DEPTHS.map((d) => (
              <Pressable key={d} onPress={() => (tap('select'), setC({ depth: d }))} style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center', backgroundColor: coco.depth === d ? C.white : 'transparent' }}>
                <Text style={{ fontFamily: F.bold, fontSize: 12, color: coco.depth === d ? C.teal : C.muted, textTransform: 'capitalize' }}>{d}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 12 }}>
          <Ionicons name="football-outline" size={22} color={C.leaf} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.ink }}>Explain with my interests</Text>
            <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>Coco uses what you love for analogies. Edit them in Profile → About you.</Text>
          </View>
          <Switch value={coco.memory} onValueChange={(v) => (tap(), setC({ memory: v }))} trackColor={{ true: C.leaf }} />
        </View>

        <Btn title="Save changes" kind="leaf" onPress={() => (haptic('success'), router.back())} />
      </ScrollView>
    </SafeAreaView>
  );
}
