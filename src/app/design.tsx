// The living catalog of the design system: every token and shared block on one scrolling page.
// Open it while developing: go to drrys://design on the phone (or /design on web). Release builds skip it.
// Before building a new screen, look here first; if a block you need is missing, add it to src/design.
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { COCO } from '@/art';
import {
  answerTile,
  Badge,
  Btn,
  Bubble,
  Choice,
  Coco,
  color,
  Divider,
  EmptyState,
  Feedback,
  Field,
  IconBtn,
  ListGroup,
  ListRow,
  palette,
  Progress,
  radius,
  Row,
  S,
  Screen,
  ScreenTitle,
  SectionLabel,
  Segmented,
  Sheet,
  Stack,
  StatTile,
  Surface,
  T,
  XpStars,
} from '@/design';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack gap={3}>
      <SectionLabel text={title} />
      {children}
    </Stack>
  );
}

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <View style={{ width: '31%', gap: S[1] }}>
      <View style={{ height: 44, borderRadius: radius.md, backgroundColor: value, borderWidth: 1, borderColor: color.border.subtle }} />
      <T v="micro">{name}</T>
      <T v="caption">{value}</T>
    </View>
  );
}

export default function DesignCatalog() {
  const [mode, setMode] = useState<'speak' | 'write'>('speak');
  const [pick, setPick] = useState(1);
  const [text, setText] = useState('الميتوكوندريا هي مصنع الطاقة في الخلية');
  const [sheet, setSheet] = useState(false);
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <Screen scroll style={{ gap: S[8] }}>
      <Row>
        <IconBtn name="close" onPress={() => router.back()} />
        <View style={{ flex: 1 }} />
      </Row>
      <ScreenTitle title="Drrys design system" sub="Every screen is built from these pieces. Nothing on a screen should need a color, size or corner that isn't here." />

      <Section title="Brand palette (raw: screens never use these directly)">
        <Row wrap gap={2}>
          {(['leaf500', 'leaf600', 'leaf800', 'pine50', 'pine600', 'neutral0', 'neutral50', 'neutral200', 'neutral600', 'neutral900', 'bark', 'sun400', 'berry500', 'sky300', 'sky500'] as const).map((k) => (
            <Swatch key={k} name={k} value={palette[k]} />
          ))}
        </Row>
      </Section>

      <Section title="Semantic colors (what screens use)">
        <Row wrap gap={2}>
          <Swatch name="bg.app" value={color.bg.app} />
          <Swatch name="surface.card" value={color.surface.card} />
          <Swatch name="text.brand" value={color.text.brand} />
          <Swatch name="text.primary" value={color.text.primary} />
          <Swatch name="action.primary" value={color.action.primary} />
          <Swatch name="border.bark" value={color.border.bark} />
          <Swatch name="game.xp" value={color.game.xp} />
          <Swatch name="game.water" value={color.game.water} />
          <Swatch name="bg.sky" value={color.bg.sky} />
        </Row>
      </Section>

      <Section title="Type scale">
        <T v="display">Grow your tree</T>
        <T v="h1">h1 · hero title</T>
        <T v="h2">h2 · page title</T>
        <T v="h3">h3 · card title</T>
        <T v="title">title · row and button text</T>
        <T v="subhead">subhead · small strong lines</T>
        <T v="bodyLg">bodyLg · Coco speaking, big answers</T>
        <T>body · paragraphs (the default)</T>
        <T v="bodySm">bodySm · secondary lines</T>
        <T v="caption">caption · hints and meta</T>
        <T v="label">label · section labels (sentence case)</T>
        <T v="micro">micro · badges</T>
        <T v="number">12:40 · 120 XP</T>
        <T v="bodyLg" auto>
          النص العربي يقرأ من اليمين لليسار تلقائياً مع auto
        </T>
      </Section>

      <Section title="Space (4-point) and corners">
        <Row wrap gap={2} align="flex-end">
          {([1, 2, 3, 4, 5, 6, 8, 10] as const).map((k) => (
            <Stack key={k} gap={1} align="center">
              <View style={{ width: S[k], height: S[k], backgroundColor: color.action.primary, borderRadius: 2 }} />
              <T v="micro">S[{k}]={S[k]}</T>
            </Stack>
          ))}
        </Row>
        <Row wrap gap={2}>
          {(['sm', 'md', 'lg', 'xl', 'xxl'] as const).map((k) => (
            <Stack key={k} gap={1} align="center">
              <View style={{ width: 52, height: 52, backgroundColor: color.surface.card, borderRadius: radius[k], borderWidth: 1, borderColor: color.border.default }} />
              <T v="micro">{k}</T>
            </Stack>
          ))}
        </Row>
      </Section>

      <Section title="Buttons (one green for every main button)">
        <Btn title="Start session" icon="arrow-forward" kind="green" />
        <Btn title="Next question" icon="arrow-forward" kind="teal" />
        <Btn title="Keep studying" kind="leaf" height={48} />
        <Btn title="Not now" kind="light" height={44} />
        <Row gap={3}>
          <Btn title="Pill" kind="white" pill height={40} style={{ flex: 1 }} />
          <Btn title="Loading" kind="teal" loading height={40} style={{ flex: 1 }} />
          <Btn title="Off" kind="green" disabled height={40} style={{ flex: 1 }} />
        </Row>
      </Section>

      <Section title="Surfaces">
        <Surface>
          <T v="title">card · the white clay card</T>
        </Surface>
        <Surface kind="bark">
          <T v="title">bark · game cards on the tree</T>
        </Surface>
        <Surface kind="sunken">
          <T>sunken · a well inside a card</T>
        </Surface>
        <Surface kind="raised">
          <T v="title">raised · dialogs and sheets</T>
        </Surface>
      </Section>

      <Section title="Answer feedback (same in every question format)">
        <Feedback tone="correct">Yes! That’s exactly the idea, in your own words.</Feedback>
        <Feedback tone="almost">You’re on the right track: say where it happens.</Feedback>
        <Feedback tone="wrong">Not quite. The chain needs oxygen at the end.</Feedback>
        <Row gap={2} wrap>
          {(['idle', 'picked', 'correct', 'almost', 'wrong'] as const).map((s) => (
            <View key={s} style={[{ paddingHorizontal: S[3], paddingVertical: S[2], borderRadius: radius.md, borderWidth: 2 }, answerTile(s)]}>
              <T v="caption" style={{ color: color.text.primary }}>
                {s}
              </T>
            </View>
          ))}
        </Row>
      </Section>

      <Section title="Badges">
        <Row wrap gap={2}>
          <Badge text="Full session" />
          <Badge text="Coco asks" tone="neutral" />
          <Badge text="Strong recall" tone="correct" icon="leaf" />
          <Badge text="Almost" tone="almost" />
          <Badge text="Missed" tone="wrong" />
          <Badge text="save 33%" tone="gold" />
          <Badge text="Pro" tone="dark" />
        </Row>
      </Section>

      <Section title="Toggles, fields and choices">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { key: 'speak', label: 'Speak (Recommended)', icon: 'mic' },
            { key: 'write', label: 'Write instead', icon: 'create-outline' },
          ]}
        />
        <Field label="Your recall" value={text} onChangeText={setText} multiline hint="Arabic or English: it turns the right way by itself." />
        <Row gap={3}>
          {['Biology', 'History'].map((l, i) => (
            <Choice key={l} label={l} selected={pick === i} onPress={() => setPick(i)} style={{ flex: 1 }} />
          ))}
        </Row>
        <Progress value={0.6} track={color.surface.track} />
      </Section>

      <Section title="Lists">
        <ListGroup label="Settings">
          <ListRow icon="notifications-outline" label="Reminders" value="8:00 PM" onPress={() => {}} />
          <ListRow icon="volume-high-outline" label="Sounds" sub="Right, wrong and watering" selected />
          <ListRow icon="log-out-outline" label="Sign out" danger onPress={() => {}} last />
        </ListGroup>
      </Section>

      <Section title="Game pieces">
        <Row gap={3}>
          <StatTile value={31} label="day streak" gold />
          <StatTile value="120" label="XP" icon={<XpStars size={18} />} />
          <StatTile value={4} label="cards due" />
        </Row>
      </Section>

      <Section title="Coco">
        <Bubble text="Tell me everything you remember!" />
        <Coco src={COCO.classic} size={120} />
        <Divider />
        <EmptyState coco={COCO.reading} title="No chapters yet" body="Add your first lecture and Coco will plant a branch for it." action="Add a lecture" onAction={() => setSheet(true)} />
      </Section>

      <Sheet visible={sheet} title="A bottom sheet" onClose={() => setSheet(false)}>
        <T>Tap outside to close.</T>
        <Btn title="Done" kind="leaf" height={48} onPress={() => setSheet(false)} />
      </Sheet>
    </Screen>
  );
}
