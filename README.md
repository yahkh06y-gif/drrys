# 🌳 Drrys — Grow what you know

**Drrys** turns studying into caring for a living tree. Every subject is a tree, every chapter is a branch, and the companion **Coco** walks you through the study methods that actually work (active recall, self-explanation, spaced repetition) without you needing to know their names.

> Built for **RevenueCat Shipaton 2026 — Next Gen Award** by Yahya and Abdelhafeez.

## The problem

1. **Students study the wrong way.** Re-reading and highlighting feel productive but are among the least effective techniques in learning research. Retrieval practice, elaboration and spacing work, but most students never hear of them.
2. **Studying is boring**, so the habit dies after a few days.

Information is everywhere now. The hard part isn't finding it, it's making it stay.

## How Drrys works

| Learning science (built into the flow) | What the student does |
| --- | --- |
| **Retrieval practice** | *Brain dump*: after a lecture, tell Coco everything you remember, by voice (Arabic or English) or text, with the material hidden |
| **Feedback on errors** | Coco reads the lecture PDF (only the pages you studied) and sorts your recall into *nailed · forgotten · needs correction* |
| **Self-explanation (Feynman)** | Coco asks "why / how" questions about what you missed, grades your explanation, and you can argue back in a short chat. Analogies use your own interests |
| **Spaced repetition (SM-2)** | Flashcards written from the lecture and your mistakes come back right before you'd forget them. Stuck on a card? Ask Coco about it |
| **Habit** | A daily 15-minute "watering": a full session on lecture days, a few flashcards on the other days. Coco waters the tree when you finish. Streaks, XP and insights per subject |

## Monetization (RevenueCat)

- **Drrys Pro**: `drrys_pro` entitlement, `default` offering with monthly ($9.99) and annual ($79.99) packages.
- **Free**: 1 tree with 1 chapter. **Pro**: 5 trees with 5 chapters each. The paywall appears when you reach for a second tree or chapter.
- **Streak rewards: the more consistently you study, the cheaper Pro gets.** A 30-day study streak switches the paywall to the `streak25` offering (25% off), 60 days to `streak30` (30% off). Discounted products live in RevenueCat; the app only picks the offering (`src/lib/purchases.ts`). Break the streak and the regular offering comes back.
- **Study Squad: studying together makes it cheaper.** Up to 4 friends share a squad code; when the squad is full, each of them gets 25% off (the `streak25` products). Squad + streak reward stack, capped at 50% off (the `bonus50` offering). The app only picks the offering (`currentDiscount()` in `src/lib/purchases.ts`).
- **Invite a friend → a free 2nd branch.** When a friend joins with your code and finishes their first session, a free student's trees get a 2nd chapter. Codes, squads and every anti-cheat rule (not your own code, one referral per student, no swapping, 4 per squad) live in Supabase functions (`src/lib/together.ts`).
- The subscription is tied to the student's account (`Purchases.logIn(uid)`), so Pro follows them to a new phone. Restore purchases is in Profile and on the paywall.

## Tech

- **Expo SDK 57 · React Native 0.86 · TypeScript · Expo Router**
- **RevenueCat** (`react-native-purchases`) — offerings, entitlement listener, account linking
- **Supabase** — email/password accounts and a cloud backup of the forest (one JSON row per user, protected by row-level security)
- **Gemini API** — lecture analysis with native PDF input, question generation, grading, flashcards, chat and voice transcription (a Claude key can be used instead). PDFs are trimmed to the studied pages with `pdf-lib`
- **Zustand + AsyncStorage** — offline-first state
- **Reanimated 4, expo-video, expo-image, expo-audio, expo-haptics** — the clay look and feel
- **Art**: Coco, the trees and every animation were modelled and rendered in Blender; tree stages and branches are composited in code

```
src/
  app/
    onboarding/     intro, questions, planting, sign-in, reminder
    (tabs)/         coco · tree (the forest) · profile
    session/        choose → recall → analyze → review → active → cards → done
    subject.tsx     plant / edit a tree (chapters, PDFs, syllabus, past papers)
    paywall.tsx     Drrys Pro + streak / squad rewards
    together.tsx    Study Squad + invite a friend
  components/       UI kit, KnowledgeTree, Motion (video), Voice (record → transcribe)
  lib/
    ai.ts           Coco's brain (Gemini / Claude, model fallback chain)
    purchases.ts    RevenueCat
    cloud.ts        Supabase accounts + backup / restore
    session.ts      lecture context, PDF page slicing
  store.ts          app state + SM-2 scheduler
```

## Run it

```bash
npm install
cp .env.example .env     # add a Gemini (or Claude) key and the RevenueCat Test Store key
npx expo start           # open in Expo Go
```

- **No AI key?** Coco runs a built-in demo session, so every screen can still be explored.
- **Android APK** (real RevenueCat purchase sheet): `npx eas-cli build -p android --profile preview`. The preview profile allows RevenueCat's Test Store key in this internal build only (`plugins/withTestStoreRelease.js`).

## Known limits (honest notes)

- The AI key is called from the app, which is fine for a competition build. Production would route it through a small server (e.g. a Supabase Edge Function).
- The UI is English-only for now; voice input already understands Arabic.

## Roadmap

Mnemonics and memory palaces · AI-generated podcast and concept videos from your lectures · gift a month of Pro to a classmate · Arabic UI · shared forests with friends.

---

MIT License · Made with 🌱 in Jordan.
