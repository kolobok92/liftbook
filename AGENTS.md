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

## Liftbook workflow

Keep questioning the dev loop itself: if a check is slow, flaky or needs manual steps, find the cause and fix it proactively (e.g. E2E runs against a production build in parallel because the dev bundle made each test ~14s).

Private Boostcamp-style lifting tracker. Local-only data (zustand + AsyncStorage), Expo Router screens in `src/app/`, logic in `src/lib/`.

- `npm run check` — typecheck + lint + unit tests (`src/**/*.test.ts`, vitest) + component tests (`src/**/*.test.tsx`, jest-expo + React Native Testing Library, `npm run test:components`) + Playwright E2E (`e2e/*.spec.ts`) against the web build. Run before calling anything done.
- Component tests render real components/screens against the store (mocks in `test/setup.ts`) in seconds: put behavior checks there (what a set logs, hints, summaries, popups, record values), not in Maestro. Keep test files out of `src/app/` (every file there is a route): use `src/__tests__/` for screens.
- `npm run screens` — captures every main screen to `e2e-screens/` for visual review.
- `npm run flows` — filmstrips of real flows (one labelled image per flow in `e2e-flows/`). Review every frame after UI changes; each frame is also checked for text/buttons clipped by or crowding the screen edge.
- Visual regression (`e2e/visual.spec.ts`, part of `check`): approved baselines of key screens with a frozen clock. After an intended UI change, review the diff in `e2e-report`, then `npm run visual:update` and look at every new baseline before keeping it — a stable blank or mis-scrolled frame will happily "pass".
- Layout guards: `expectIconAligned` (icon centered on first text line) for icon+text rows; use `IconLine`/`NoteField` rather than hand-tuned margins. Set-number labels come only from `setLabels()`.
- Assert the exact numbers users read (`toContainText('22.5 lb')`, best set, PR values), not just that labels appear, and seed data that breaks naive code: fractional plates, a heavier-but-fewer-reps set, heavy warm-ups (see `e2e/displayed-values.spec.ts`). Only estimates (e1RM, rep-max estimates) may be rounded; logged weights never.
- E2E tests use the `test` export from `e2e/helpers.ts`, which fails on any console error; seed state with `openWith(page, { history: [workout(...)] })`.
- Hints and the circle copy Boostcamp as seen in a screen recording of it (not guessed): fields start blank (no grey hints from history; the Previous column shows last time). A set's grey hint is whatever the set above holds this session (`hintFor`), even numbers taken from last session. One tap on a circle logs the hint, or with no hint (set 1) last session's matching set (`suggestFor`). No target-derived suggestions. Tapping a field fills nothing in. The current set (first unchecked of the first unfinished exercise) gets an orange pill + circle and its card an orange border; a finished exercise folds to "✓ name".
- The exercise you're on is `currentRow()` (tracking.ts): the one last worked on (`currentRowId`; a field opened = stay, a set checked = move on), so going out of order keeps the lock screen and the orange marker right. A superset alternates A1, B1, A2… and is drawn as one card with a tab per exercise that follows the set you're due (`SupersetCard` in WorkoutEditor.tsx); "Superset with…" pairs any exercise and moves it next to its partner.
- Set numbers are typed on the in-app keypad (`Keypad.tsx`, Boostcamp-style), never the system keyboard: set fields are tap targets (`SetField`). Checking a set closes the pad and moves nothing (no focus jump, no auto-scroll). The workout screen has no keyboard avoidance on purpose; the pad overlays the list and scrolls only when the edited field would be hidden. Tests: `typeSet()` on web, `key-N` taps in Maestro.
- After installing a library with a Babel plugin (e.g. reanimated), restart Metro with `--clear`.
- Navigating "home" from a modal or pushed screen: use `goHome()` (`src/lib/nav.ts`), never `router.navigate('/')`, which stacks a second copy of the tabs.
- Sheets are `Sheet` in `src/components/ui.tsx` (RN Modal). @gorhom/bottom-sheet didn't render on web and was removed.

## Native checks (Maestro)

Loop: component tests first, then ONE targeted flow on Android; the full flow suite only as the
pre-commit gate; iOS once as the final gate. Never debug through CI.

Measured costs here (software-GPU emulator, one emulator, flows run sequentially — the user
doesn't want parallel emulators or the host GPU): component tests ≈ 5 s; JS-only APK swap ≈ 25 s;
full Gradle build + install ≈ 2 min; one flow ≈ 0.5–3 min; full suite ≈ 15 min. So don't run
the full suite per iteration.

- **Local (free):** `node scripts/maestro-android.mjs .maestro/<flow>.yaml` (no argument = all
  flows) boots the `liftbook` emulator (headless, software GPU, cold boot ~25 s), installs the app
  and runs the flows (`ios-only` tag skipped). Output in `.cache/maestro/<run>/` (screenshots +
  screen hierarchy).
  - Build step is automatic: if the native key (Expo fingerprint + asset file list) matches the
    last Gradle build, only the JS is re-bundled (Metro + hermesc) and swapped into that APK
    (`.cache/android-base.apk`); otherwise Gradle builds and saves a new base. `FULL_BUILD=1`
    forces Gradle. The first native build ≈ 13 min.
  - Only YAML changed? `SKIP_BUILD=1` (reuses the installed APK). Don't rebuild for flow edits.
  - `.cache/` is scratch. Worth keeping: `android-base.apk`/`.key` (the JS-swap base) and
    `free-exercise-db`/`fedb-images` (importer sources); everything else regenerates. The build
    mirror `C:\lb` and CMake staging `C:\x` are needed for builds (deleting them = 13 min rebuild).
  - Flows start from a seeded state, not setup taps: `- clearState` then
    `- openLink: liftbook://e2e-seed?scenario=<name>` (scenarios in `src/lib/e2eScenarios.ts`).
    The route only works in bundles built with `EXPO_PUBLIC_E2E=1` (this runner and
    ios-simulator.yml); never set it for the phone build (ios-unsigned.yml).
  - Flows hold only what needs a real device: native typing/keyboard/caret, gestures, navigation,
    persistence across relaunch, and the `el-*` visual crops. Behavior belongs in component tests.
  - Builds run from a mirror at `C:\lb` (Windows 260-char path limit; long paths are off and
    can't be enabled without a restart). It syncs `src`, `assets`, `plugins` and root configs;
    anything else app.json or the bundle reads must be added to `MIRROR` in the script.
  - **Visual baselines:** `takeScreenshot: {path: el-…, cropOn: {id: …}}` crops are diffed against
    `.maestro/baselines/android/` (≤250 differing px; software rendering gives 0 px noise). New
    crops become baselines: review them. After an intended UI change: `UPDATE_BASELINES=1`.
  - Toolchain: `C:\dev\android-sdk` (JDK, SDK, AVD), `source /c/dev/android-sdk/env.sh`;
    Maestro CLI in `~/.maestro`. Emulator log: `.cache/emulator.log`.
- **iOS gate (GitHub Actions, manual):** `gh workflow run ios-simulator.yml`. macOS minutes are
  scarce (10x on a private repo): run it only when Android passes. JS-only changes reuse the
  cached native app (Expo fingerprint, ~10 min); native changes rebuild (~30 min). Anything in
  package.json `scripts` or app.json changes the fingerprint, so don't touch them casually.
- Maestro text matchers are full-match regexes over accessibility labels: escape `( )`. iOS
  merges a pressable's texts (`"1, Bench Press (Barbell)"`) and `accessibilityLabel` replaces
  visible text. A button nested in a pressable is unreachable (VoiceOver too); the web guard
  in layout.spec.ts catches that. Read the failing step's `screen-hierarchy/*.json` first.
- Maestro taps coordinates: a button under the keyboard "succeeds" by typing a key. In iOS modal
  sheets KeyboardAvoidingView/measureInWindow are sheet-relative; prefer dismissing the keyboard.
