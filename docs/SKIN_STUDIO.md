# Skin studio and camera update

## Changes

- Runner Studio replaces color-only closet swatches with a live preview of the actual 3D character.
- Create up to eight named, free custom runners with suit, trim and glow colors and satin, chrome or matte finish. Save/equip, edit/cancel and confirmed deletion are supported.
- Custom definitions use the separate `brainrot_custom_skins_v1` key. Invalid definitions, reserved IDs, duplicates and excess slots are rejected. Existing built-in IDs, wallet, purchases and level rewards remain in their original keys.
- Curated gold/prism skins use chrome; phantom/samurai use matte. Colors update existing shared materials rather than rebuilding the character.
- The runner camera is higher and follows from a stable relative distance, with a farther look target and limited lateral follow. Jumping and sliding do not move the horizon. Subtle motion and impact feedback respect reduced-motion preferences.
- Keyboard focus trapping now includes form fields, so the creator works without touch.

## Limits

The original robot palettes remain editable. The studio now also includes an original street runner, clothing and skin/hair/shoe colors; see [AVATAR_CHALLENGES.md](AVATAR_CHALLENGES.md). It is not a mesh editor or image uploader. All runners retain the same hitbox and abilities. Saves are local to this browser/app; blocked or full storage falls back to the current session and cannot guarantee persistence after closing. The existing storage-warning UI remains active.

A small secondary WebGL context renders the studio preview at DPR 1 / 240×180 / up to 30fps. The hidden menu scene stops rendering while the studio is open. Palette updates reuse the model; closing disposes its geometries, materials, texture and renderer. The game does not gain any network service or paid feature.

## Validation and device testing

Run `npm run lint`, `npm test`, `npm run test:browser` and `npm run build`. Added tests cover custom-save normalization/recovery, slot limits, camera bounds and projection in portrait/landscape, complete creator persistence/edit/delete, preservation of old purchases and material reuse.

The existing PR CI builds the Android debug APK after web checks. Build/install steps and signing caveats remain in [ANDROID.md](ANDROID.md) and [CI.md](CI.md). Follow the device checklist in [ENGAGEMENT_REVIEW.md](ENGAGEMENT_REVIEW.md); automated coverage does not replace a real-phone playtest.
