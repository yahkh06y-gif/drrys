// Home — the subject's Knowledge Tree, today's session card and learning insights underground.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { KnowledgeTree } from '@/components/Tree';
import { Btn, Coco, Enter, Pill, T } from '@/components/ui';
import { tap } from '@/lib/feedback';
import { LIMITS } from '@/lib/purchases';
import { activeSubject, streak, today, useApp } from '@/store';
import { C, F } from '@/theme';

const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function TreeScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const subject = useApp(activeSubject);
  const subjects = useApp((s) => s.subjects);
  const cards = useApp((s) => s.cards);
  const stats = useApp((s) => s.stats);
  const isPro = useApp((s) => s.isPro);
  const set = useApp((s) => s.set);
  const startSession = useApp((s) => s.startSession);
  const [sel, setSel] = useState<string>();
  const [switcher, setSwitcher] = useState(false);

  const chapter = subject?.chapters.find((c) => c.id === sel) ?? subject?.chapters.find((c) => c.mastery < 1) ?? subject?.chapters[0];
  const due = useMemo(() => cards.filter((c) => c.subjectId === subject?.id && c.due <= Date.now()), [cards, subject?.id]);
  const isLectureDay = subject?.days.includes(new Date().getDay());

  if (!subject) return <EmptyForest />;

  const subjectCards = cards.filter((c) => c.subjectId === subject.id);
  const mastered = subjectCards.filter((c) => c.reps >= 2).length;
  const acc = stats.quizTotal ? Math.round((stats.quizCorrect / stats.quizTotal) * 1000) / 10 : 0;
  const st = streak(stats.studyDays);

  const newTree = () => {
    setSwitcher(false);
    if (!isPro && subjects.length >= LIMITS.freeTrees) router.push('/paywall');
    else router.push('/subject');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#241911' }}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        <KnowledgeTree width={width} chapters={subject.chapters} selected={chapter?.id} onSelect={(id) => (tap('select'), setSel(id))}>
          {/* header */}
          <View style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
            <Pressable hitSlop={10} onPress={() => (tap(), router.push({ pathname: '/subject', params: { id: subject.id } }))} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="create-outline" size={24} color={C.ink} />
            </Pressable>
            <Pressable onPress={() => (tap('select'), setSwitcher((v) => !v))} style={{ flex: 1, alignItems: 'center', marginRight: 40 }}>
              <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 22, letterSpacing: 1.4, color: C.ink, textTransform: 'uppercase' }}>
                {'<'}
                {subject.name}
                {'>'}
              </Text>
            </Pressable>
          </View>
          {switcher && (
            <Enter style={{ position: 'absolute', top: insets.top + 56, alignSelf: 'center', left: 40, right: 40 }}>
              <View style={{ backgroundColor: C.paper, borderRadius: 16, borderWidth: 2, borderColor: C.barkSoft, padding: 8, gap: 4 }}>
                {subjects.map((s) => (
                  <Pressable key={s.id} onPress={() => (tap('select'), set({ activeSubjectId: s.id }), setSel(undefined), setSwitcher(false))} style={{ padding: 10, borderRadius: 10, backgroundColor: s.id === subject.id ? C.mint : 'transparent' }}>
                    <Text style={{ fontFamily: F.bold, color: C.ink }}>🌳 {s.name}</Text>
                  </Pressable>
                ))}
                <Pressable onPress={newTree} style={{ padding: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="add-circle" size={18} color={C.leaf} />
                  <Text style={{ fontFamily: F.bold, color: C.leaf }}>Plant a new tree {!isPro && subjects.length >= LIMITS.freeTrees ? '· Pro' : ''}</Text>
                </Pressable>
              </View>
            </Enter>
          )}

          {/* session card on the lawn */}
          {chapter && (
            <Enter delay={200} style={{ position: 'absolute', bottom: 20, left: 24, right: 24 }}>
              <View style={{ backgroundColor: '#FBF9F4', borderWidth: 2, borderColor: '#5A3C20', borderRadius: 24, padding: 16, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.bold, fontSize: 16, color: C.ink }}>
                    <Text style={{ color: C.leaf }}>Ch {subject.chapters.indexOf(chapter) + 1} · </Text>
                    {chapter.title}
                  </Text>
                  <Pill text={chapter.sessions === 0 ? 'Full session' : 'Deepen'} />
                </View>
                <Text style={{ fontFamily: F.monoRegular, fontSize: 14, color: C.tealSoft }}>
                  {isLectureDay ? '.Lecture day  ' : ''}.{chapter.sessions === 0 ? 'full session' : `session ${chapter.sessions + 1}`}  .~15 min
                </Text>
                <Btn
                  title="Start session"
                  icon="arrow-forward"
                  kind="leaf"
                  height={46}
                  onPress={() => {
                    startSession(subject.id, chapter.id);
                    router.push('/session/choose');
                  }}
                />
                {due.length > 0 && (
                  <Pressable onPress={() => (tap(), router.push({ pathname: '/session/cards', params: { mode: 'review' } }))} style={{ alignSelf: 'center', flexDirection: 'row', gap: 6, alignItems: 'center', paddingTop: 2 }}>
                    <Ionicons name="albums-outline" size={14} color={C.teal} />
                    <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.teal }}>{due.length} cards ready to review</Text>
                  </Pressable>
                )}
              </View>
            </Enter>
          )}
        </KnowledgeTree>

        {/* underground: the lawn of the render fades into soil (Figma "under ground" gradient) */}
        <LinearGradient
          colors={['#BDEA83', '#A7C96A', '#8A6042', '#5A3C26', '#241911']}
          locations={[0, 0.05, 0.16, 0.34, 0.63]}
          style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 40, gap: 16 }}>
          <View style={{ alignItems: 'center', gap: 2, marginBottom: 18 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: C.sand, borderWidth: 2, borderColor: C.bark, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 }}>
              <Text style={{ fontSize: 12 }}>📊</Text>
              <Text style={{ fontFamily: F.bold, fontSize: 11, letterSpacing: 0.5, color: C.bark }}>SUBJECT INSIGHTS</Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={C.ink} />
          </View>
          <View style={{ alignItems: 'center' }}>
            <T v="h3" style={{ color: C.ink }}>
              {subject.name} Learning Progress
            </T>
            <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.white, textAlign: 'center', marginTop: 2 }}>
              Measurable learning activity, memory recall rates, and study completion metrics
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <Stat icon="🔥" label="Daily Study Streak" value={`${st} ${st === 1 ? 'Day' : 'Days'}`} note={stats.studyDays.includes(today()) ? 'Tree watered today ✓' : 'Study today to keep it'} noteColor={C.orange}>
              <WeekFlames days={stats.studyDays} />
            </Stat>
            <Stat icon="🗂️" label="Cards Mastered" value={`${mastered} / ${subjectCards.length}`} note={`${subjectCards.length - mastered} remaining in pool`}>
              <Segments value={subjectCards.length ? mastered / subjectCards.length : 0} />
            </Stat>
            <Stat icon="🎯" label="Quiz Accuracy" value={`${acc}%`} note={`${stats.quizTotal} review attempts`}>
              <Bar value={acc / 100} />
            </Stat>
            <Stat icon="⏱️" label="Time Studied" value={stats.minutes >= 60 ? `${(stats.minutes / 60).toFixed(1)} hrs` : `${stats.minutes} min`} note={`${stats.xp} XP earned`} noteColor={C.muted}>
              <Ticks days={stats.studyDays} />
            </Stat>
          </View>
          <Btn title="Talk it through with Coco" iconLeft="chatbubble-ellipses" kind="light" height={48} onPress={() => router.navigate('/(tabs)/coco')} />
        </LinearGradient>
      </ScrollView>
    </View>
  );
}

function EmptyForest() {
  return (
    <LinearGradient colors={['#8CC8EC', '#CFE9F4', '#B9DC7A']} style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <T v="h1" style={{ color: C.tealSoft, textAlign: 'center' }}>
        Your forest is waiting
      </T>
      <T style={{ textAlign: 'center', marginTop: 8 }}>Plant a subject and Coco will grow it with you, one branch per chapter.</T>
      <Coco src={COCO.shovel} size={220} />
      <Btn title="Plant my first tree" kind="leaf" icon="leaf" sfx="grow" onPress={() => router.push('/subject')} />
    </LinearGradient>
  );
}

function Stat({ icon, label, value, note, noteColor = C.moss, children }: { icon: string; label: string; value: string; note: string; noteColor?: string; children: React.ReactNode }) {
  return (
    <View style={{ width: '47.5%', backgroundColor: '#FBF9F4', borderWidth: 2, borderColor: C.bark, borderBottomWidth: 6, borderRadius: 16, padding: 14, gap: 4 }}>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Text style={{ fontSize: 14 }}>{icon}</Text>
        <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.muted }}>{label}</Text>
      </View>
      <Text style={{ fontFamily: F.bold, fontSize: 18, color: C.ink, letterSpacing: -0.4 }}>{value}</Text>
      <Text style={{ fontFamily: F.semi, fontSize: 10, color: noteColor }}>{note}</Text>
      <View style={{ borderTopWidth: 1, borderColor: '#ECE7DB', paddingTop: 7, marginTop: 4 }}>{children}</View>
    </View>
  );
}

function lastWeek() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
}

function WeekFlames({ days }: { days: string[] }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {lastWeek().map((d, i) => (
        <View key={i} style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: F.bold, fontSize: 9, color: C.muted }}>{DAY_NAMES[d.getDay()]}</Text>
          <Text style={{ fontSize: 10, opacity: days.includes(today(d)) ? 1 : 0.2 }}>🔥</Text>
        </View>
      ))}
    </View>
  );
}

function Segments({ value }: { value: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, height: 8 }}>
      {Array.from({ length: 5 }, (_, i) => {
        const f = Math.max(0, Math.min(1, value * 5 - i));
        return (
          <View key={i} style={{ flex: 1, backgroundColor: '#DED9CB', borderRadius: 2, overflow: 'hidden' }}>
            <View style={{ width: `${f * 100}%`, height: '100%', backgroundColor: C.moss }} />
          </View>
        );
      })}
    </View>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <View style={{ height: 8, backgroundColor: '#DED9CB', borderRadius: 99, overflow: 'hidden' }}>
      <View style={{ width: `${value * 100}%`, height: '100%', backgroundColor: C.moss, borderRadius: 99 }} />
    </View>
  );
}

function Ticks({ days }: { days: string[] }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 14, paddingHorizontal: 4 }}>
      {lastWeek().map((d, i) => (
        <View key={i} style={{ width: 4, height: days.includes(today(d)) ? 14 : 5, borderRadius: 9, backgroundColor: days.includes(today(d)) ? C.moss : '#6B5A4A' }} />
      ))}
    </View>
  );
}
