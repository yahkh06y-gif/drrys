# 🌳 Drrys — Grow what you know

**Drrys** turns studying into caring for a living tree. Every subject is a tree, every chapter is a branch, and your companion **Coco** makes sure you study the *right* way (active recall, self-explanation and spaced repetition) without you ever needing to know those words.

> Built for **RevenueCat Shipaton 2026 — Next Gen Award**.

## The problem

1. **Students study the wrong way.** Re-reading and highlighting feel productive but barely stick. The methods that work (retrieval practice, elaboration, spacing) are known to researchers, not to most students.
2. **Studying is boring.** Without a reason to come back tomorrow, habits die.

## The solution

| Science (hidden in the flow) | What the student experiences |
| --- | --- |
| **Retrieval practice** | *Brain Dump & Recall*: talk or write everything you remember, with the material hidden |
| **Feedback on errors** | Coco compares the recall with your own lecture PDF → *Nailed · Forgotten · Needs correction* |
| **Self-explanation / elaboration** | *One idea at a time*: Coco asks "why/how", grades your explanation, and uses your hobbies (football, gaming…) as analogies |
| **Spaced repetition (SM-2)** | *Lock in what matters*: AI-written flashcards come back exactly when you're about to forget them |
| **Gamification** | Your tree grows branch by branch, streaks, XP, Coco's closet |

## Session flow

```
Choose material (PDF + pages) → Brain dump → Coco analyzes (Claude reads the PDF)
→ Review: nailed / forgotten / corrections → 3 active questions → Flashcards (SM-2) → Tree grows 🌱
```

## Tech

- **Expo SDK 57 / React Native / TypeScript**, Expo Router (file-based navigation)
- **RevenueCat** (`react-native-purchases`): *Drrys Pro* subscription, `pro` entitlement, monthly + annual packages, restore purchases, live entitlement listener. Free tier: 1 tree / 5 chapters; Pro: 5 trees / 7 chapters.
- **Claude API** (Anthropic) with native PDF understanding for recall analysis, question generation, grading, flashcards and chat
- **Zustand + AsyncStorage** for offline-first persistent state
- **Reanimated 4** for the clay-like tactile motion; **expo-audio + expo-haptics** for sound and feel
- Art direction: every character and tree layer is **rendered in Blender** from a fixed camera and composited in code (trunk + 5 independent branch layers that grow with mastery)

```
src/
  app/                  # screens (Expo Router)
    onboarding/         # splash, intro, questionnaire, planting, sign in, reminder
    (tabs)/             # coco · tree · profile
    session/            # choose → recall → analyze → review → active → cards → done
    subject.tsx         # plant / edit a subject tree
    paywall.tsx         # Drrys Pro (RevenueCat)
  components/           # clay UI kit, KnowledgeTree, Motion (video/still)
  lib/ai.ts             # Coco's brain (Claude) + demo fallback
  lib/purchases.ts      # RevenueCat
  store.ts              # app state + SM-2 scheduler
  art.ts                # Blender renders registry
```

## Run it

```bash
npm install
cp .env.example .env      # optional: add Claude + RevenueCat keys
npx expo start            # scan the QR with Expo Go
```

- **No keys?** The app still runs end-to-end: Coco uses a built-in demo session and the paywall unlocks locally.
- **Real purchases** need a development build (Expo Go runs RevenueCat in preview mode):
  `npx eas-cli build --profile development --platform android`

## Roadmap

Cloud sync & accounts · server-side AI proxy · real-time voice transcription · shared forests with friends · teacher mode.

---

Made with 🌱 by Adam.
