# Android packaging

Application ID: `com.thearchitect26.brainrotrun`  
Display name: **BRAINROT RUN**  
Capacitor: **8.5.3**  
Minimum Android API: **24**; compile/target API: **36**  
Android Gradle Plugin: **8.13.0**; wrapper: **8.14.3** (official SHA-256 pinned).

The generated project is committed under `android/`. Copied web assets, Gradle outputs, machine SDK paths and signing keys are ignored. The web game and PWA retain their existing origins and saves; native saves start separately on the packaged origin. App ID changes after release create a different app/save namespace.

## Requirements

- Node.js 22.12+ (Node 24 used here), npm, and dependencies installed with `npm ci`.
- A **full JDK 21**, including `javac`, selected by `JAVA_HOME`. `java -version` alone is insufficient.
- Android Studio supporting AGP 8.13, or Android SDK command-line tools, platform-tools/adb, Android **SDK Platform 36**, and **Build-Tools 35.0.0** (AGP default) and **36.0.0**. Accept SDK licenses locally.
- Set `ANDROID_HOME` to the SDK directory (or let Android Studio create ignored `android/local.properties`). Add `$ANDROID_HOME/platform-tools` to PATH.
- Network access to npm, Gradle distributions, Google Maven (`dl.google.com`/`maven.google.com`) and Maven Central. Keep HTTPS verification and configured CA trust enabled. On managed networks Java/Gradle may require the provided HTTP/HTTPS proxy explicitly; do not bypass it.

For command-line SDK installs, once `sdkmanager` is installed:

```sh
sdkmanager 'platform-tools' 'platforms;android-36' 'build-tools;35.0.0' 'build-tools;36.0.0'
sdkmanager --licenses
java -version
javac -version
```

## Build and run a debug APK

From the repository root:

```sh
npm ci
npm test
npm run lint
npm run build
npm run android:sync
cd android
./gradlew assembleDebug
# Windows: gradlew.bat assembleDebug
adb devices
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.thearchitect26.brainrotrun/.MainActivity
```

Alternatively, `npm run android:open` opens Android Studio. Select an API 24+ device/emulator with an up-to-date Android System WebView, then Run. Prefer a physical device for Three.js performance measurements.

`npm run android:sync` builds using `CAPACITOR_BUILD=true` and copies the native assets into Android. That build disables PWA service-worker registration so WebView upgrades use the packaged assets. After changing JS/CSS or plugins, run sync again **before** building/installing. Do not copy a regular PWA build into Android manually. `npm run build` always restores a regular PWA bundle for web deployment; it does not overwrite Android's already copied assets.

Optional launcher icon regeneration: `node scripts/generate-android-icons.mjs`. It reuses the existing public artwork. On this cloud filesystem run it with a writable font cache: `XDG_CACHE_HOME=/workspace/.cache node scripts/generate-android-icons.mjs`.

## Device checks

1. Launch offline; verify menus, WebGL, tutorial, controls, audio and optional vibration. Existing web users start a separate native save.
2. Complete or skip tutorial; earn coins/XP, buy/equip a skin, play a daily challenge, then force-stop/relaunch. Verify progress and one-time reward behavior.
3. Background and lock the phone during a run. Foreground must show Pause and require explicit Resume; active duration/FPS must exclude the interruption.
4. Test at low/medium/high quality, background audio, system navigation/back, short landscape screens, safe areas, and reduced-motion settings. Profile thermals and FPS over a ten-minute real play session.
5. Install an updated debug APK with the same signing key and `adb install -r`; confirm retained local progress. Uninstalling/clearing app data removes local saves.
6. Inspect logs with `adb logcat` and Chrome's Android WebView inspector. Debug WebView inspection is available in debug builds; do not enable it for release solely for testing.

## Release

Choose a monotonically increasing `versionCode` and intentional `versionName` in `android/app/build.gradle`. In Android Studio use **Generate Signed Bundle / APK** with a securely managed release/upload key, or configure signing outside tracked files and run `./gradlew bundleRelease`. No signing configuration or keys are included. Verify the signed artifact, release-mode offline/lifecycle behavior, Play target API requirements, store metadata/privacy declarations and device testing before any submission. Do not publish a debug APK.

## Initial result and follow-up

During initial onboarding: generated project: **yes**. Native web build and Capacitor sync: **passed**. Gradle wrapper download and AGP configuration: **passed** after using the managed proxy and a writable `ANDROID_USER_HOME`/`GRADLE_USER_HOME`. Java compilation: **blocked** because this machine supplies a JRE 21 without `javac`; SDK tooling/platforms are also absent. APK/AAB: **not generated**, and native device/emulator tests **not run**.


The follow-up CI workflow and APK download/install instructions are documented in [CI.md](CI.md). Debug APKs are for testing; a release signing key and store publication remain separate work.


## Verified follow-up: 20 October 2026

Installed a full checksum-verified Temurin JDK 21.0.12.1 and checksum-verified official Android command-line tools, then SDK Platform 36 / Build-Tools 35.0.0 and 36.0.0. The local `assembleDebug` build completed successfully (123 tasks). The APK's v2 signature, ZIP integrity, app ID `com.thearchitect26.brainrotrun`, API 24 minimum / API 36 target, and packaged native assets were verified. The APK omits the web PWA service worker. A device/emulator installation has **not** been performed.

In this prepared cloud workspace, select the installed tools before rebuilding:

```sh
export JAVA_HOME=/workspace/.tools/jdk-21
export ANDROID_HOME=/workspace/android-sdk
export ANDROID_USER_HOME=/workspace/.android
export GRADLE_USER_HOME=/workspace/.gradle-cache
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
# The managed Java connection uses the session proxy and the trusted system CA store.
export JAVA_TOOL_OPTIONS='-Dhttps.proxyHost=proxy -Dhttps.proxyPort=8080 -Dhttp.proxyHost=proxy -Dhttp.proxyPort=8080 -Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts'
cd /workspace/Rainbot
npm run android:sync
./android/gradlew -p android --no-daemon --max-workers=2 assembleDebug
```

These proxy/CA paths are specific to this managed environment. Normal local Android Studio and hosted GitHub runners use their configured networking/trust. The CI workflow installs its own prerequisites and publishes a debug APK artifact; no cloud-specific paths are committed into the Android Gradle project.
