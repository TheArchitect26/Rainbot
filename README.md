# BRAINROT RUN: Escape the Algorithm

Existing React/Three.js endless runner with local progression, skins, daily challenges, bosses and offline PWA support.

```sh
npm ci
npm run dev       # port 3000
npm test          # mechanics/persistence regression tests
npm run lint      # TypeScript
npm run build     # production web/PWA build
npm run test:browser
```

Use Node 22.12+ (Node 24 validated). Browser tests use system Chromium if available; otherwise run `npx playwright install chromium`. `CHROMIUM_PATH` can select a browser executable. The tests start their own development and production servers on ports 3100 and 3200.

No API credentials, backend or database are required. Game progress and diagnostics remain on the device. Settings provides tutorial replay, controls, quality and local diagnostics.

See [Phase 4 audit, changes, validation and limitations](docs/PHASE4.md) and [exact Android packaging steps](docs/ANDROID.md). A debug APK has now been generated and signature-verified. See [CI artifact download and device testing](docs/CI.md); physical-device checks remain outstanding.

See [Runner Studio and camera changes](docs/SKIN_STUDIO.md) and the [replayability assessment and device playtest plan](docs/ENGAGEMENT_REVIEW.md).
