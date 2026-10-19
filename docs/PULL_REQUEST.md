Finish Phase 4 mobile tutorial, diagnostics and Android packaging

The existing Phase 4 tutorial and diagnostics were present but disconnected from App. First endless play now enters action-verified, retryable training; Settings supports replay and diagnostics; training rewards persist once. Existing game/save keys, skins, bosses and web PWA remain intact.

Fixes include stable React engine ownership and synchronous XP/mission claims, validated saves with a session-only fallback, accurate run/death/FPS counters, swept collisions, seeded drone/boss randomness, reset isolation, fixed-step simulation, isolated boss safe lanes and warning lead time, prewarmed mesh and particle reuse, reduced canvas/UI upload rates, adaptive DPR, and explicit background resume. Menus gain named controls, focus handling, responsive scrolling and reduced-motion styles. PWA updates wait for menu/game-over confirmation.

Adds a generated Capacitor Android project (`com.thearchitect26.brainrotrun`, BRAINROT RUN) and native lifecycle handling. Native assets exclude service workers; normal builds retain offline PWA support. Updates esbuild to satisfy Vite's existing peer dependency and supplies npm plus refreshed Bun lockfiles.

Validation: npm installation, TypeScript, production web build, focused Node regression tests, Chromium mobile/seeded/offline-PWA tests, and Android web build/Capacitor sync. Detailed audit, test evidence, known limitations and manual device matrix: docs/PHASE4.md. Exact Android prerequisites/build/install/signing steps: docs/ANDROID.md.

Android Gradle/AGP setup succeeded through the managed proxy, but compilation is blocked by the available JRE lacking javac; no Android SDK is installed. No APK/AAB or physical-device verification is claimed. Existing large JS chunk warning remains. Do not merge or publish automatically.
