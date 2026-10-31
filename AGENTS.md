This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Design system (read before building or changing any screen)

Drrys has one design system in `src/design/` (rules: `src/design/README.md`, live catalog: `src/app/design.tsx`, open `drrys://design` in a dev build).

- Import UI from `@/design`: tokens (`color`, `S`, `radius`, `depth`, `type`, `motion`, `size`, `layout`) and blocks (`T`, `Btn`, `Surface`, `Stack`, `Row`, `Feedback`, `FeedbackPart`, `FixedSentence`, `RecallCard`, `answerTile`, `Badge`, `Segmented`, `Field`, `ListGroup`, `ListRow`, `Sheet`, `Confirm`, `StatTile`, `EmptyState`, `Figure`, `useKeyboardLift`, `Screen`, `SessionHeader`, `Coco`, `Bubble`).
- No hex or `rgba()` literals and no raw `<Text fontSize>` in screens: use `color.*` and `<T v="…">`. Need something new? Add the token or block to `src/design` and to the catalog first, then use it.
- Layout with `start`/`end`, not `left`/`right`; text written by the student or the AI gets `<T auto>` (or `autoDir(text)` on a raw `Text`) so Arabic reads right-to-left.
- Version 2 rules, in short: one family (Readex Pro, 600 at most), one main button color (leaf green `color.action.primary`; secondary is white with a hairline), a bottom edge only on things you press (cards you read are flat: white + `color.border.default`), "picked" is pine (`color.selected`), no CAPS labels and no emoji in the interface, tabs switch without animation, motion from `motion`/`ease` (presses 100ms, entrances 260ms, nothing UI over 300ms except sheets).
- `src/theme.ts` (`C`, `F`, `R`) is the old name set, kept for existing screens. Don't use it in new code; move a screen to `@/design` when you touch it.
