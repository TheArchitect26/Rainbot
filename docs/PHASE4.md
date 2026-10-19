# Phase 4 audit and change log

Baseline: `origin/main` at `cd6290674cf99633654a1588e1b8619ec45baab7`.
Work continues the existing game; no replacement scaffold, backend, payments, or new game modes.

## Existing implementation audited

The audit covered every source module: App, all 11 components, all seven game subsystems, sound synthesis, skins, PWA install hook, mechanics/progression/mission types, PRNG and local analytics. It also checked Vite/TypeScript configuration, both original dependency declarations/lock data, HTML/CSS, icon-generation script, metadata, environment example, Git ignore rules, and the existing SVG/PNG PWA assets. There were no repository setup docs, agent rules, CI workflows, or automated tests at baseline.

| Area | Baseline finding | Result |
| --- | --- | --- |
| Tutorial | Engine/overlay/settings props existed but App never connected them; distance alone completed training | First endless play launches training; Settings replays it; accepted actions and actual obstacle clearance/coin pickup gate stages; missed hazards retry safely; skip and completion persist |
| Rewards | Overlay advertised rewards without integration | 100 tutorial coins + 150 XP once; the existing level-2 milestone also awards 100 coins. Replays cannot farm the bonus; tutorial pickups do not credit the wallet or missions |
| React/XP | Engine effect depended on skin/progression callbacks; XP result was read outside a queued state updater; multi-level gains rewarded only the final milestone | One engine per mount, live callback ref, synchronous progression transaction, all crossed milestones rewarded; engine cleanup releases canvas/GPU resources |
| Saves | Unprotected storage access, invalid numeric/progression data, malformed skin lists | Preserve original keys and owned skins; validate numeric/progression/mission data; recover from corrupt values; memory fallback plus warning for denied/full storage |
| Missions | Dodge progress credited during play and again at death; survival estimated from distance | Credit once at run end; use active simulation duration; refresh at UTC rollover; validate claims against current date and progress; synchronous claim guard |
| Diagnostics | Run start/end never called; capped FPS denominator caused unbounded averages; rounded running distance lost precision; shared nested reset data | Wire normal/daily start/death; idempotent death; abandoned runs count only as starts; precise running averages; frames/time FPS, all slow frames included, paused/background samples excluded; detached snapshots/resets; live modal/export errors |
| Daily challenge | Only encounter selection was seeded; drones and boss fell back to Math.random; previous chaos state leaked into restart | Separate seeded encounter/drone/boss streams, reset simulation/IDs/timers, fixed 120 Hz simulation independent of rendering cadence; cosmetic randomness stays independent |
| Collision/input | Thin Z window could miss barriers; dodge marking preceded collision; arrays mutated during forward collection | Swept Z collision before dodge credit; physical X clearance; jump/slide/drone vertical checks; reverse collection iteration; accepted input cooldown uses simulation time |
| Boss fairness | Regular hazards/chaos could block advertised safe lanes; fixed 36m warning shrank at boosted speed | Clear normal hazards on boss arrival, suspend normal generation/chaos during encounter, retain at least one safe lane and at least two seconds of hazard lead time; resume generation ahead of runner |
| Performance | Obstacle/collectible shared resources and pools already existed; particles/colors allocated every emission; environment allocated colors and uploaded billboards each frame | Preserve and prewarm existing mesh pools; preallocate/recycle particles and colors; cache theme colors; billboard uploads at 10 Hz; UI snapshots at 10 Hz; adaptive DPR/shadow reduction after sustained low FPS; no paused/background renders |
| Mobile/a11y | Inaccessible toggles, non-keyboard skin cards, modal swipes reached gameplay, no focus containment | Named switches/dialogs/controls, keyboard skin choices, focus trap and restoration, Escape close/resume, native menu scroll gestures, reduced motion CSS, zoom allowed, safe-area layout preserved |
| Error/PWA handling | WebGL failure could blank app; context loss paused engine without UI; auto-update could reload active play | Visible initialization error, context/background pause reflected in UI with explicit resume, install/export errors handled, PWA updates offered at menu/game-over rather than auto-reloading runs |
| Android | No Capacitor project | Capacitor 8 config, generated Android project, native lifecycle pause, branded launcher icons; native build omits service worker while web keeps PWA |

## Save compatibility

Existing high score, wallet, selected/owned skins, progression v3, daily missions v3, and dated daily-best keys remain in use. No save reset or destructive migration runs on mount. Missing/invalid fields receive defaults and XP thresholds are recomputed from level. New tutorial keys are `brainrot_tutorial_seen_v1`, `brainrot_tutorial_completed_v1`, and `brainrot_tutorial_rewarded_v1`. Skipping marks seen without granting completion/rewards; replay remains available. Diagnostics retain valid legacy lifetime counters, but discard the mathematically invalid legacy FPS aggregates and clearly label new FPS samples as this-session active rendering. Clearing diagnostics does not clear game progress or tutorial rewards.

Browser storage is scoped to its origin. Android's packaged origin and an existing website do **not** automatically share saves. Memory fallback cannot persist after the page/process closes. Cross-tab simultaneous wallet transactions are not synchronized; play in one tab per save.

## Validation

Use `npm ci` for repeatable installation from `package-lock.json`; Bun's lockfile is also refreshed for compatibility. The initial requested `npm install` exposed an existing esbuild 0.25/Vite 8 peer conflict, fixed by declaring compatible esbuild 0.28.2. No force/legacy-peer-deps flags were used.

Automated checks:

- `npm test`: pure mechanics, XP/progression, date seeds, mission save validation, seeded obstacle motion, mesh/geometry reuse, >3,000 FPS samples including severe drops, run/death/restart counting, snapshot/reset isolation and denied storage.
- `npm run test:browser`: mobile viewport tutorial (including safe retry, completion, reload, replay/skip/rewards), corrupt/denied saves, 60 simulated seconds of identical daily runs across resets including boss behavior, background pause/resume and disposal; 320px menus, DOM swipe gestures, keyboard focus and short-landscape scrolling; production service-worker cache and offline startup preserving wallet data.
- `npm run lint`: repository TypeScript check, including tests/configs.
- `npm run build`: production web bundle and PWA precache.
- `npm run android:sync`: native bundle and Capacitor copy/plugin sync.

Browser tests disable HMR and use software WebGL when real GPU acceleration is unavailable. The tutorial test advances rendering in 100ms increments while exercising the real fixed-step simulation; it deliberately covers dropped frames. These are functional regression tests, **not** mobile FPS benchmarks. No assertions are skipped for headless execution.

Android compilation was attempted. Gradle 8.14.3 downloaded through the platform proxy and configured AGP. Compilation stopped because the installed Java 21 runtime lacks `javac`/the `JAVA_COMPILER` capability. No Android SDK is present either. No APK/AAB, emulator run, signing, or store submission has been produced. See [ANDROID.md](ANDROID.md).

## Remaining launch checks and limits

- Real Android/iOS devices still need the manual playtest matrix below. Software Chromium cannot certify touch latency, heat/battery behavior, WebView audio/haptics, native lifecycle, or 30/60 FPS sustained performance.
- The compressed main JS remains about 256KB (about 960KB uncompressed), with Vite's existing >500KB chunk warning. Dynamic game loading/code splitting remains a follow-up; this is a warning, not a build failure.
- Fixed-step catch-up is capped at 250ms per rendered frame to prevent a spiral of work after a long stall. Under sustained extreme stalls, simulation slows rather than fast-forwarding into hazards. Daily generation is deterministic for the same game version, seed and input history; scores/routes across different versions or different player power-up pickups need not match.
- Adaptive quality only reduces DPR (floor 0.75) and disables shadows when active FPS remains below 40 over three seconds. It preserves the user's saved quality preference; selecting a quality level reapplies the desired ceiling. Test on real low-end devices before tuning thresholds.
- Remote Google Fonts are optional; system fonts support offline play. The game has no required AI credentials or network API calls.
- Reduced-motion CSS covers interface animation; the 3D game still moves. Screen-reader-only gameplay is not certified.
- Dependencies are pinned by lockfiles; no broad dependency-upgrade/security-remediation project was attempted.

## Manual mobile acceptance matrix

On at least one low-end Android phone, one recent Android phone, and iPhone Safari/PWA:

1. Fresh save: endless Play opens tutorial; wait without input, miss each hazard, then complete each gesture. Try skip, reload, and replay. Confirm the training bonus only once and no run/death/mission pollution.
2. Repeat horizontal swipes, full two-lane transitions, jump/slide cancellation, buffered landing jump, short/long swipes and on-screen buttons. Check collision wireframes in diagnostics at low/medium/high quality.
3. Play through all zones, each chaos event, shield/boost hits and all boss phases. Confirm advertised safe lanes, two-second warnings, and no overlapping normal hazards.
4. Run the same UTC daily challenge twice with the same choices; compare initial layout, drones and boss attacks. Check UTC midnight reset and run-date best attribution.
5. Pause/resume, lock screen, background/foreground, rotate, interrupt audio and restore WebGL. The game must remain paused until explicitly resumed, with no phantom swipe or accumulated movement.
6. Earn/buy/equip skins, cross multiple levels, claim missions, then reload. Open every modal at 320px portrait and short landscape sizes; scroll with touch, tab through controls, close with Escape and verify focus returns.
7. Inspect local run/death/restart/tutorial counters, export JSON, reset diagnostics, confirm wallet/skins/XP remain. Test storage blocked/full without losing the ability to play.
8. Install web PWA, reload offline, and apply an update from the menu. On Android perform the native steps in ANDROID.md, including process death/relaunch and upgrade install with existing saves.
