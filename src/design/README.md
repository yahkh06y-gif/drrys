# Drrys design system (version 2)

One place for how Drrys looks and feels. Every screen is built from it. Open the living catalog on the phone
at `drrys://design` (dev builds only).

```ts
import { T, Btn, Surface, Stack, Row, Feedback, Badge, Field, ListGroup, ListRow, Sheet, color, S, radius } from '@/design';
```

## The idea

Drrys is a garden. The tree and Coco carry the personality; the interface around them stays calm, so the
student's attention goes to what they're learning. Three rules every screen follows:

1. **Depth means "you can press it".** Buttons, choices and the tree's game cards have a bottom edge that
   sinks when pressed. A card you only read is flat: white, one hairline (`color.border.default`), no edge,
   no shadow. Things above the page (sheets, dialogs) float on a soft wide shadow (`shadow.float`, `shadow.sheet`).
2. **One green for "go".** The main button is always leaf green (`color.action.primary`, white text 4.7:1).
   There is one per screen. Everything else is the secondary button (white, hairline, pine text) or a text link.
   Pine (`color.text.brand`) is for titles, links and Coco's words; "picked, not checked yet" is pine too
   (`color.selected`). Gold is XP. Berry red appears only for a mistake, always with a kinder word.
3. **Coco speaks, the screen stays quiet.** No CAPS labels, no emoji in the interface (Coco may use them when
   he talks), one font family. Sound, confetti and big motion are kept for the moments that matter.

## Layers

| Layer | File | Who uses it |
| --- | --- | --- |
| Palette (six ramps, 50 → 900: `leaf`, `pine`, `neutral`, `sun`, `berry`, `sky`) | `tokens.ts` → `palette` | only the tokens themselves |
| Semantic tokens (`color.text.brand`, `color.feedback.wrong.bg`, `S[4]`, `radius.lg`, `type.title`, `motion.press`…) | `tokens.ts` | every screen |
| Components (`T`, `Btn`, `Surface`, `Feedback`, `ListRow`…) | `components.tsx`, `components/ui.tsx` | every screen |

Changing a value in `tokens.ts` changes it everywhere. A screen never says *what green*; it says *what for*.
Every text color passes WCAG AA on the surface it's meant for.

## Type

One family: **Readex Pro** (Arabic and Latin, built on Lexend for reading ease). Weights 400, 500 and 600;
`F.bold` / `font.bold` in old code resolves to 600. Numbers that change (timers, XP, counts) use
`fontVariant: ['tabular-nums']` so they don't jump.

`<T v="…">` variants: `h1` / `display` (hero, 32) · `h2` (brand title, 24) · `h3` (heading, 19) · `title`
(strong line, 16) · `bodyLg` (16) · `body` (15, the default) · `bodySm` / `subhead` (14) · `caption` (12) ·
`label` (section label, 14, sentence case) · `micro` (badges, 11) · `number`.

## Rules for a new screen

1. Start from `Screen` (or `SessionHeader` inside a session). Side gutters are `layout.gutter` (20).
2. Text is always `<T v="…">`, never a raw `<Text>` with a `fontSize`.
3. Spacing comes from `S` (4-point grid): `S[1]=4, S[2]=8, S[3]=12, S[4]=16, S[5]=20, S[6]=24, S[8]=32`.
4. Corners come from `radius`: `sm` 8 chips · `md` 12 tiles · `lg` 16 buttons, inputs, choices · `xl` 20 cards ·
   `xxl` 24 dialogs · `sheet` 28 · `pill`.
5. Colors come from `color.*`. No hex and no `rgba()` in `src/app` or `src/components` (ESLint warns).
   Missing a color? Add it to `tokens.ts` with a name that says what it's for.
6. Blocks: `Surface` (card / bark / sunken / raised / flat / a tone), `Btn` (one main button per screen),
   `Feedback` + `answerTile()` for every answer state, `Badge` for small status pills, `Segmented` for two to
   four options, `Field` for text, `ListGroup` + `ListRow` for settings-style lists, `Sheet` for bottom sheets,
   `Confirm` for "are you sure?", `StatTile` for numbers, `EmptyState` for empty lists, `Figure` for a picture
   from the student's lecture (tap to open it full screen, pinch to zoom). Inside an answer card: `FeedbackPart`
   for each short labeled part ("What's missing", "The answer"; never a paragraph of AI text) and `FixedSentence`
   for a fill-the-gaps sentence written out with the right words in green. `RecallCard` shows what a memory hook
   is for. A sheet with a text box sits on the keyboard with `useKeyboardLift()`, not KeyboardAvoidingView.
7. Answers use the four tones only: `correct · almost · wrong · info`, with the words "Nailed it!",
   "Almost there", "Not yet". A tone is a tint and a word, never color alone (always an icon too).
8. Disabled is grey (`color.action.disabled`), not see-through.
9. Something you need isn't here? Build it in `src/design/components.tsx` from tokens, add it to the
   catalog (`src/app/design.tsx`), then use it. Never build a one-off copy inside a screen.

## Arabic and right-to-left

- Lay out with `start`/`end` (`marginStart`, `paddingEnd`, `start: 0`), never `left`/`right`.
  `flexDirection: 'row'` already follows the app's direction.
- Text the student or the AI wrote (recalls, cards, Coco's answers, lecture titles) gets `<T auto>`, or
  `autoDir(text)` in the style of a raw `Text` / `TextInput`: it reads in its own direction, so Arabic reads
  right-to-left inside an English screen. `Field` does it already.
- Arrows and chevrons that mean "forward" / "back" go through `dirIcon('chevron-forward')`.

## Motion and feel

First ask how often the student sees it. Tabs (tens of times a day) switch with no animation. Presses take
`motion.press` (100ms) with `ease.out`; selections `motion.fast` (120); results `motion.result` (280);
entrances `motion.enter` (260, an 8px rise); progress bars `motion.progress` (400). Sheets open on
`ease.drawer` over `motion.sheet` (420) and close faster. Buttons sink by `depth.press`; choices shrink to
`motion.pressScale` (0.98). Everything checks `useReducedMotion()` and falls back to a fade.
Every tap gets a light haptic through `tap()`; sounds are for answers and rewards only.

## Accessibility

Tap targets are at least `layout.tapMin` (44). Icon-only buttons get an `accessibilityLabel`. Toggles use
`accessibilityRole="tab"` with `accessibilityState={{ selected }}`.
