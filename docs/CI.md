# Web checks and Android debug APK CI

`.github/workflows/validate.yml` runs on pull requests, pushes to `main`, and manual dispatch. It does not merge, deploy, publish a release or upload anything to an app store.

The **Web checks** job installs the npm lockfile on Node 24, checks TypeScript, runs the mechanics/persistence tests, installs Playwright Chromium, runs the mobile/seeded/offline browser tests, and builds the production web/PWA bundle. Failed browser runs retain `test-results` for seven days.

Only after web checks succeed, **Android debug APK** selects a full Temurin JDK 21, installs SDK Platform 36 and Build-Tools 35.0.0 (AGP's default) plus 36.0.0, builds/syncs native assets and runs `assembleDebug`. It verifies the APK signature and uploads `app-debug.apk`, its SHA-256 file and commit/run provenance as `brainrot-run-debug-<run number>` for 14 days. Third-party Actions are pinned to verified commit SHAs; the workflow has read-only repository permissions.

## Download and test

1. Open this repository's **Actions** tab and select a successful **Validate web and Android** run for the desired PR commit.
2. Download `brainrot-run-debug-<run number>` under **Artifacts** and unzip it.
3. Verify the download and install on an API 24+ Android device with USB debugging enabled:

```sh
sha256sum -c app-debug.apk.sha256
adb devices
adb install -r app-debug.apk
adb shell am start -n com.thearchitect26.brainrotrun/.MainActivity
```

Artifacts are debug-signed and intended for device testing. Each hosted CI runner may generate a different debug signing key. For upgrade/persistence testing, build both versions locally using the same debug keystore. If Android reports `INSTALL_FAILED_UPDATE_INCOMPATIBLE` for a CI APK, do not uninstall blindly: uninstalling clears that app's local progress. Preserve the existing app or use a separate test device/profile for the new APK.

Check first-play tutorial completion, skip/replay, saved rewards and skins, touch controls, background/lock/resume, offline launch, and a sustained real-device run. APK generation and signature checks do not establish that these physical-device checks pass. See [ANDROID.md](ANDROID.md) for full packaging and test instructions.

To enforce these jobs before merge, repository administrators can require **Web checks** and **Android debug APK** in the branch's protection/ruleset settings. This workflow alone does not change repository merge policies.
