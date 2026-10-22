# Rainbot audit fixes — 22 October 2026

Android version: **0.2.0**, versionCode **2**. Gameplay/ranking rules: **challenge-4**.

## Result

| Audit finding | Implemented change | Verification |
| --- | --- | --- |
| Moving solid walls could close every route | Non-drone chaos drift is bounded to 0.65 units around the authored lane, then eases home. An adjacent safe lane retains at least 1.75 units of centre clearance, above the 1.35 collision reach. | All three safe lanes, 12 seeds each, 480 fixed steps including event exit. |
| Invisible ground warnings and shortened boss lead at tier changes | Road-space red beams track the actual approaching attack row. Spawn distance forecasts tier changes and modifiers, reserving two seconds before the swept collision boundary. Beams clear on reset/victory; remaining boss hazards clear before the reward boost. | Warning visibility/height/reset browser checks; timing sweeps across tier boundaries and stacked multipliers. |
| Landscape HUD covered the road | A compact distance/header layout and one priority announcement: boss, chaos warning, active chaos, then zone. Buttons remain fully on-screen. | 568×320 browser checks enforce announcement bottom below 110px and full button visibility. |
| Visible slide pose did not fit overhead gates | A low, forward-facing tuck lowers torso, head and legs. Crouch collision height is now 0.95, with matching debug dimensions. Drones fly at 2.2 ± 0.25 so the revised pose can visibly slide underneath. | All 12 built-in skins stay below the 1.25 overhead collision threshold; measured maximum top is about 1.185. |
| Swipes waited for release | Direction commits as soon as the movement threshold is crossed. Release cannot duplicate that gesture; multi-touch/cancel clears it. | DOM touchmove/release test and directional/threshold unit checks. |
| Low quality kept most rendering work | Skyline bodies, strips and beacons are instanced; Low reduces tower/window counts, removes road spill/arches/traffic, lowers particle budget and billboard updates. High uses higher DPR for edge quality; MSAA is disabled consistently. Menu rendering is capped at 30fps. Adaptive quality applies the reduced detail budget as well as DPR/shadows. | Same-scene high/low render counters and switch checks. One controlled Chromium scene measured 163 versus 109 draw calls and 22,650 versus 12,794 triangles. This is not a phone FPS benchmark. |
| Builds were hard to identify | Version/commit/target in Settings, version/commit/rules in Diagnostics, build metadata in JSON exports, intentional Android version increment. | Settings browser assertion; native web build and packaged constants. |

## Graphics and encounter variety

The menu retains the front-facing runner; play faces the direction of travel. Slide, jump, lane lean and landing continue to use the same cosmetic-only rig and collision system.

Each zone now has an authored roadside silhouette: Shibuya storefronts/awnings/signs, angular sunset palms, Matrix circuit frames, and gold plinths/monoliths. Scenery stays outside the gameplay track, uses one instanced draw for the active zone, recycles and resets without new geometry allocations, and respects quality settings. Background lighting and existing atmosphere follow the run.

WEAVE adds three adjacent safe-lane decisions. GAUNTLET links a full-width jump gate, safe-lane choice and overhead slide gate with recovery gaps. Every third normal encounter still requires an action, but its jump/slide choice is seeded rather than a repeating alternation. Boss safe lanes change between attacks, phase two mixes jump and slide waves, and phase three combines solid walls with timed hazards while retaining an open lane. No increase to the 36m/s base speed cap is included in this follow-up.

## Validation and limits

Passed locally: TypeScript, 29 unit/HTTP tests, the 15 non-PWA browser checks, production web build, native web build and Capacitor sync. The production offline-PWA test passed when rerun serially; an earlier validation attempt overwrote the shared `dist/` folder with native assets while that test was running. Web and Android build outputs must be validated sequentially. The PR's CI runs all 16 browser checks before Android packaging.

Portrait zone rendering and the slide pose were inspected with Chromium/software WebGL. The new browser tests also cover all built-in skin poses, boss warning ground placement, actual attack arrival, quality differences, one action per swipe and short landscape layout. Existing tutorial/reward/save/seed/ranking/boss recovery tests remain enabled.

Physical phone FPS, thermals, native audio/back-navigation behaviour and perceived difficulty still require testing. The large JS chunk warning persists. Native release signing and store publication remain separate.

## Phone acceptance

1. Install the debug artifact for this PR's exact CI commit; check **Settings → v0.2.0 / commit**. Different CI debug keys may require a separate test device/profile; do not erase an existing save to work around a signature mismatch.
2. Replay training and play several runs using quick swipes, held fingers and on-screen buttons. Record distance, death cause and whether the obstacle was readable.
3. Test drifting barriers: the original open lane must stay clear. Test boss red lane warnings, speed-tier changes and post-boss recovery.
4. Slide under overhead gates and drones with both robot and street skins; jump then slide and resume from a background pause. Watch for visual clipping or delayed/duplicate gestures.
5. Rotate into short landscape during a boss with powers active. The warning and all controls must fit while the central road remains readable.
6. Compare Low/Medium/High through all zones for ten minutes. Export diagnostics with build information, phone/Android/WebView details, quality, reproduction steps and video for failures.
