# Drrys: Grow what you know

Drrys turns studying into a small daily mission. Every subject is a tree, every chapter is a branch, and you keep your trees alive by watering them every day. The watering is a short study session with Coco, a little clay character who makes you study the way learning research says works, without you having to know any of the method names.

Made by Yahya Al-Khayyat and Abdelhafeez Shaarawy for the RevenueCat Shipaton 2026 (Next Gen).

![Drrys screens](docs/screens.jpg)

## Try it (for judges)

1. Download the APK from [Releases](https://github.com/yahkh06y-gif/drrys/releases/latest) and install it on an Android phone.
2. Create an account (email + password, no confirmation email) or tap "Not now".
3. **All purchases are test purchases.** This build runs on RevenueCat's Test Store, so buying Pro is free and no real money is charged. Pro: Profile → View plans → buy.
4. Study Squad and invites: Profile → Study together (needs an account; a squad unlocks at 4 accounts).

## Why we built it

Most students (us included) study by re-reading and highlighting. These methods are easy because they ask very little of your brain, and that's exactly the problem: without real mental effort, learning is slow, so you need many more hours to get a result. That's also what makes studying feel so boring and long.

Research says the opposite: to learn, your brain has to work. Recalling from memory, explaining ideas in your own words and spacing out your reviews are harder in the moment, but they make things stick much faster. Most students never hear about them, and they're hard to do alone.

Drrys puts these methods inside a short daily routine that feels like looking after a garden.

## A day with Drrys

After a lecture, the student opens the app. Their lecture files, syllabus and past exams are already there, so Coco knows the course.

**Lecture day: a full session (about 15 minutes)**

1. **Recall.** Tell Coco everything you remember from the lecture, by voice (Arabic, English and many other languages) or by typing. No notes.
2. **Gaps.** Coco compares what you said with the lecture file and shows what you nailed, what you forgot and what you got wrong.
3. **Explain.** Coco asks "why" and "how" questions on the parts you missed. You answer in your own words, Coco grades it, and you can argue back.
4. **Flashcards.** Cards are made from the lecture and from the exact things you got wrong in step 3.
5. Coco waters the tree.

**Other days: flashcards only**

The cards come back on a spaced repetition schedule (SM-2): forgotten cards come back the same day, easy ones after days or weeks.

Around that: a week view per subject, streaks, stats per tree, and daily reminders that know if you have a lecture session or cards waiting (and stay quiet on days you already studied).

## Pricing and RevenueCat

| | Free | Pro ($9.99/month or $79.99/year) |
| --- | --- | --- |
| Trees (subjects) | 1 | 5 |
| Branches (chapters) per tree | 1, or 2 after inviting a friend | 5 |
| Lecture files | up to 40 pages | up to 150 pages |

- **Entitlement:** `drrys_pro`. **Offerings:** `default`, `streak25`, `streak30`, `bonus50`.
- **Streak reward.** Study 30 days in a row and Pro is 25% off (`streak25`), 60 days and it's 30% off (`streak30`). Miss a day and the regular price comes back.
- **Study Squad.** You and 3 friends join with one code. When the squad is full, each of you gets 25% off while the squad stays together. A squad and a streak stack, up to 50% off (`bonus50`).
- **Invite a friend.** On the free plan, when a friend joins with your code and finishes their first session, your trees get a second branch.
- The discounted prices are real products in RevenueCat. The app only decides which offering to show (`currentDiscount()` in `src/lib/purchases.ts`).
- Pro is linked to the student's account with `Purchases.logIn`, so it follows them to a new phone. You have to sign in before buying. Restore purchases is on the paywall and in Profile.
- If Pro ends, nothing is deleted. Extra trees and branches "rest": their flashcards still work, and new full sessions ask to renew.
- Squad and invite codes are checked on the server (Supabase functions): you can't use your own code, each student can be invited once, two friends can't swap codes, one squad per student, 4 people per squad.

## Built with

- Expo SDK 57, React Native, TypeScript, Expo Router
- RevenueCat (`react-native-purchases`)
- Gemini API for reading lecture PDFs, questions, grading, flashcards, chat and voice transcription. Only the pages you studied are sent (`pdf-lib`).
- Supabase for accounts, cloud backup and the squad/invite functions
- Zustand + AsyncStorage (works offline), Reanimated, expo-video, expo-audio, expo-notifications
- Coco, the trees, the world and the icons were modelled in Blender. Some animations were made with Flow from those renders, to save rendering time.
- Screens were designed in Figma with help from Stitch, and turned into the real app with Claude Opus 5.5.

## Run it

```bash
npm install
cp .env.example .env   # add a Gemini key and the RevenueCat Test Store key
npx expo start
```

- Without an AI key, Coco runs a built-in demo session so every screen can still be tried.
- Android APK: `npx eas-cli build -p android --profile preview`. This build uses RevenueCat's Test Store, so purchases are free (`plugins/withTestStoreRelease.js` allows the test key in this build only).

## Project layout

```
src/
  app/
    onboarding/     intro, questions, first tree, sign in, reminder
    (tabs)/         Coco, the forest, profile
    session/        choose file, recall, analyze, review, explain, flashcards, done
    subject.tsx     plant or edit a tree (chapters, files, syllabus, past exams)
    paywall.tsx     plans and rewards
    together.tsx    Study Squad and invites
  components/       UI kit, tree, video, voice
  lib/
    ai.ts           Coco (Gemini, with fallback models)
    purchases.ts    RevenueCat, limits and discounts
    together.ts     squads and invites
    cloud.ts        accounts and backup
    notify.ts       daily reminders
  store.ts          app state and the flashcard scheduler
```

## Known limits

- The Gemini key ships inside this competition build. For a real release the AI calls will move behind a server (a Supabase Edge Function).
- The app's screens are in English for now. Voice recall and Coco's chat already understand many languages, including Arabic.
- Android only so far.
- Payments use RevenueCat's Test Store for the competition (no real charges). The products and offerings are ready to connect to Google Play and the App Store for launch.

## What's next

Mnemonics, AI-made videos and audio podcasts from your lectures, live AI chat with Coco, and a lot more.

## License

Copyright (C) 2026 Yahya Al-Khayyat and Abdelhafeez Shaarawy.

The code is open source under the [GNU AGPL v3.0](LICENSE): you can read, use and change it, but if you share, sell or run a changed version as a service, you have to publish your full source code under the same license.

The name "Drrys", the character Coco and the Drrys logo are our trademarks and are not covered by this license.
