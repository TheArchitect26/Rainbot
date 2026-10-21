# Difficulty, movement and graphics update — 22 October 2026

Phone feedback: normal runs were too easy to sustain. The course now demands actions early and reaches higher pressure sooner, while keeping readable routes and a separate retryable tutorial.

## What changed

- Challenge tiers advance every 150m; tier 12 begins at 1650m. Base speed rises from 18 to 36m/s. Progression rank does not alter the starting difficulty.
- Every third normal encounter alternates a compulsory jump or slide gate. Random hazards between gates still use the daily seed. Standing in a safe lane no longer bypasses the entire course.
- Compound gates reserve 1.25 seconds at forecast stacked boost/turbo speed; adjacent slalom rows reserve 0.72 seconds. Landing recovery is included rather than added twice. Boss warning lead and recovery sections remain.
- Power-ups arrive every 220–300m after the first opportunity and accompany an obstacle pattern. Speed boost increases speed without absorbing hits. A shield still absorbs one collision and briefly protects against the rest of that row.
- Critically damped lane motion accelerates and settles without overshoot. Jump height is about 1.44m normally and 2.30m in low gravity; descent is firmer than ascent. Gravity is fixed on takeoff so event transitions cannot alter a jump mid-air. Slides last 0.55s, and pause clears buffered jumps.
- Jump animation tucks on ascent and extends toward landing; running blends out of the slide pose. Crash-only rotations recover on restart. The contact shadow stays on the road while jumping, leaning and landing.
- The directional light and shadow target follow long runs. A cool rim light, themed horizon gradient, tiled asphalt, neon road spill and instanced city windows add depth without an external texture download, extra shadow-casting lights or a bloom pass. Existing quality controls and adaptive resolution remain.
- Ranking rules advance to `challenge-3` so scores on the older, easier course do not compete with this course. Wallet, XP, skins and tutorial saves are preserved.

## Validation

Passed locally: TypeScript; 25 unit/HTTP tests; production web/PWA build; native web build and Capacitor Android sync; all 14 browser tests. After the final atmosphere/glow adjustment, the physics/render and production offline-PWA browser tests were rerun and passed. Portrait rendering was inspected in Chromium with software WebGL. The new browser regression checks idle losses in all three lanes across four daily seeds, boost collisions, shield consumption, airborne ground-shadow placement, long-run lighting and pause-buffer clearing. It also rejects shader compilation errors.

The local browser run used an external Chromium 153 binary and a temporary config that binds Vite to loopback; this workspace cannot enumerate network interfaces. No project dependency or committed browser configuration was changed for that workaround.

No new local APK was compiled in this workspace: JDK/Android SDK tools are absent. The PR's existing Android CI job builds and verifies the debug APK after web checks pass. See [CI.md](CI.md) for its artifact and [ANDROID.md](ANDROID.md) for same-key upgrade testing. The large JS chunk warning persists.

## Focused phone retest

1. Use the debug APK from this PR's exact successful CI commit. Preserve the existing save when installing; different CI debug keys can require a separate test profile/device.
2. Replay training, then play five normal runs. Record distance, cause of death and whether the hazard was readable. Standing still should lose early; skilled movement should remain survivable. This pass establishes mechanical bounds, not a promised average run duration.
3. Test rapid lane reversals, well-timed jumps, late jumps, landing-buffered jumps, slides and jump-to-slide cancellation. Check that shortened timing feels responsive on the actual touch screen.
4. Collect a speed boost and continue dodging; deliberately test a shield hit separately. Check gate recovery during low gravity, stacked speed modifiers and tier changes.
5. Play through a boss and into the recovery section; check advertised safe lanes and warning visibility. Background/lock during a jump and resume explicitly.
6. Compare low/medium/high quality for ten minutes, recording stutter, FPS, heat and battery drain. Check road glow, character visibility, grounded shadows and lighting after a long run. Record phone model, Android/WebView version, quality, commit, reproduction steps, video and exported diagnostics for any issue.

Real-phone balance, touch latency, thermals and sustained FPS still need retesting. Release signing, release-mode verification and store publication remain separate.
