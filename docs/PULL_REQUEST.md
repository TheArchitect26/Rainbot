Finish Phase 4 mobile tutorial, diagnostics and Android packaging

The existing Phase 4 tutorial and diagnostics were present but disconnected from App. First endless play now enters action-verified, retryable training; Settings supports replay and diagnostics; training rewards persist once. Existing game/save keys, skins, bosses and web PWA remain intact.

Fixes include stable React engine ownership and synchronous XP/mission claims, validated saves with a session-only fallback, accurate run/death/FPS counters, swept collisions, seeded drone/boss randomness, reset isolation, fixed-step simulation, isolated boss safe lanes and warning lead time, prewarmed mesh and particle reuse, reduced canvas/UI upload rates, adaptive DPR, and explicit background resume. Menus gain named controls, focus handling, responsive scrolling and reduced-motion styles. PWA updates wait for menu/game-over confirmation.

Adds a generated Capacitor Android project (`com.thearchitect26.brainrotrun`, BRAINROT RUN) and native lifecycle handling. Native assets exclude service workers; normal builds retain offline PWA support. Updates esbuild to satisfy Vite's existing peer dependency and supplies npm plus refreshed Bun lockfiles.

Validation: npm installation, TypeScript, production web build, focused Node regression tests, Chromium mobile/seeded/offline-PWA tests, and Android web build/Capacitor sync. Detailed audit, test evidence, known limitations and manual device matrix: docs/PHASE4.md. Exact Android prerequisites/build/install/signing steps: docs/ANDROID.md.

Android debug compilation now succeeds with a full JDK 21 and SDK 36; APK signature, ZIP integrity, manifest and packaged assets were verified. Physical-device verification, release signing and store publication are not claimed. Existing large JS chunk warning remains. Do not merge or publish automatically.


Follow-up: fixes the audited stalled-frame swipe regression by using a monotonic input debounce clock. The new regression fails before the fix and passes after it, covering duplicate suppression, separated input without frames, tutorial advancement, pause/resume and restart. Current local validation: 10 unit tests, 6 browser tests, TypeScript, production PWA build and Android debug compilation pass.

Adds pinned-action web/Android CI with an APK signature check and retained debug APK/checksum/provenance artifacts after web tests succeed. Download/install guidance and CI debug-key limitations are in docs/CI.md. A local debug APK has been generated for device testing; no automatic merge, release or deployment is included.
