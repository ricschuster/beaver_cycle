# Standalone APK

A Capacitor app (`com.beavercycle.game`) with the built game bundled inside, so
a tablet plays with no computer, cable, or WLAN. It is the first form of the
sideloaded APK in [ADR 0007](../../docs/decisions/0007-web-stack.md). It is a
debug build for the author and friends, for local testing only: the tiles come
from OpenStreetMap data, whose licence is not settled (ADR 0003).

## Build and install

Needs the Android SDK with platform 36 and build-tools 36 (`ANDROID_HOME`), a JDK 21
(`JAVA_HOME`), and Node 22 or newer, as in `tools/tablet-live`. The shell uses Capacitor 8,
which targets Android 16 (API 36) as Google Play requires for new apps since 31 August 2026,
and needs Android 7 (API 24) or newer. The tiles must exist in `public/tiles/`
(`python3 tools/tiles/build_tiles.py`), since they go into the APK (about 29 MB).

```sh
npm run build                      # from the repo root, writes dist/
cd tools/standalone-apk
npm install
npx cap add android                # once
npx cap sync android               # after every game build
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The APK (about 24 MB) is `app/build/outputs/apk/debug/app-debug.apk`. It can
also be copied to a tablet and installed from there, if the tablet allows it.
Each game change needs a new build and install. For quick edit and reload
loops use `tools/tablet-live` instead.
