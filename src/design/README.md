# Drrys design system

One place for how Drrys looks and feels. Every new screen is built from it, and older screens move onto it
whenever they're touched. Open the living catalog on the phone at `drrys://design` (dev builds only).

```ts
import { T, Btn, Surface, Stack, Row, Feedback, Badge, Field, ListGroup, ListRow, Sheet, color, S, radius } from '@/design';
```

## The idea

Drrys is a garden, made of warm clay. That gives three rules every screen follows:

1. **Paper and clay.** Pages are cream paper (`color.bg.app`). Things sit on it as clay blocks: a white card
   with a soft bottom edge, or a bark-edged game card. Anything you can press has a thicker bottom edge and
   sinks when pressed (`depth`).
2. **Green means grow.** Leaf green is the one "go" color (start, check, continue). Pine teal is for titles,
   Coco's voice and the main button inside a session. Gold is XP and rewards. Berry red appears only for a
   mistake, and always together with a kinder word ("Not yet", never "Wrong").
3. **Coco speaks, the screen stays quiet.** One job per screen, one main button, the rest calmer. Sound and
   confetti are kept for the moments that matter (right answer, watering, streak), the way Duolingo does it.

## Layers

| Layer | File | Who uses it |
| --- | --- | --- |
| Palette (raw garden colors: `leaf500`, `pine600`, `bark700`…) | `tokens.ts` → `palette` | only the tokens themselves |
| Semantic tokens (`color.text.brand`, `color.feedback.wrong.bg`, `S[4]`, `radius.xl`, `type.h2`, `motion.base`…) | `tokens.ts` | every screen |
| Components (`T`, `Btn`, `Surface`, `Feedback`, `ListRow`…) | `components.tsx`, `components/ui.tsx` | every screen |

Changing a value in `tokens.ts` changes it everywhere. A screen never says *what green*; it says *what for*.

## Rules for a new screen

1. Start from `Screen` (or `SessionHeader` inside a session). Side gutters are `layout.gutter` (20).
2. Text is always `<T v="…">`. Never a raw `<Text>` with a `fontSize`. The scale:
   `display · h1 · h2 · h3 · title · bodyLg · body · bodySm · caption · label · micro · number`.
   (`h1` is the big green hero title; `small` is the old name for `caption`.)
3. Spacing comes from `S` (4-point grid): `S[1]=4, S[2]=8, S[3]=12, S[4]=16, S[5]=20, S[6]=24, S[8]=32`.
   Prefer `<Stack gap={3}>` / `<Row gap={2}>` over hand-written `flexDirection` + `gap`.
4. Corners come from `radius`: `md` 12 tiles · `lg` 16 inputs and small cards · `xl` 20 · `xxl` 24 main cards · `pill`.
5. Colors come from `color.*`. No hex and no `rgba()` in `src/app` or `src/components` (ESLint warns).
   Missing a color? Add it to `tokens.ts` with a name that says what it's for.
6. Blocks: `Surface` (card / bark / sunken / raised / flat / a tone), `Btn` (one main button per screen),
   `Feedback` + `answerTile()` for every answer state, `Badge` for small status pills, `Segmented` for two to
   four options, `Field` for text, `ListGroup` + `ListRow` for settings-style lists, `Sheet` for bottom sheets,
   `Confirm` for "are you sure?", `StatTile` for numbers, `EmptyState` for empty lists.
7. Answers use the four tones only: `correct · almost · wrong · info`, with the words "Nailed it!",
   "Almost there", "Not yet".
8. Something you need isn't here? Build it in `src/design/components.tsx` from tokens, add it to the
   catalog (`src/app/design.tsx`), then use it. Never build a one-off copy inside a screen.

## Arabic and right-to-left

- Lay out with `start`/`end` (`marginStart`, `paddingEnd`, `start: 0`), never `left`/`right`.
  `flexDirection: 'row'` already follows the app's direction.
- Text the student or the AI wrote (recalls, cards, Coco's answers, lecture titles) gets `<T auto>`:
  it reads in its own direction, so Arabic reads right-to-left inside an English screen. `Field` does it already.
- Arrows and chevrons that mean "forward" / "back" go through `dirIcon('chevron-forward')`.
- Space Grotesk has no Arabic letters, so Arabic falls back to the phone's system font today. When the app
  gets an Arabic interface, add one Arabic family to `font` (see the note in the update's WHAT-CHANGED).

## Motion and feel

`motion.instant` 60 (a button sinking) · `fast` 120 · `base` 220 · `slow` 420 (entrances) · `progress` 600 ·
springs in `motion.spring`. Buttons sink by `depth.press`; choices shrink to `motion.pressScale`.
Every tap gets a light haptic through `tap()`; sounds are for answers and rewards only.

## Accessibility

Tap targets are at least `layout.tapMin` (44). Icon-only buttons get an `accessibilityLabel`. Feedback never
relies on color alone: it always has an icon and a word.
