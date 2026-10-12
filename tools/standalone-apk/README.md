# Standalone APK

A Capacitor app (`com.beavercycle.game`) with the built game bundled inside, so
a tablet plays with no computer, cable, or WLAN. It is the first form of the
sideloaded APK in [ADR 0007](../../docs/decisions/0007-web-stack.md). It is a
debug build for the author and friends, for local testing only: the tiles come
from OpenStreetMap data, which is ODbL and needs its credit (ADR 0003, `NOTICE.md`).

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
python3 apply_icon.py              # the beaver icon, after every cap add
npx cap sync android               # after every game build
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The APK (about 24 MB) is `app/build/outputs/apk/debug/app-debug.apk`. It can
also be copied to a tablet and installed from there, if the tablet allows it.
Each game change needs a new build and install. For quick edit and reload
loops use `tools/tablet-live` instead.

The app icon (a beaver face with its chin in the water) is copied into the generated project by `apply_icon.py`, because the
`android/` folder is untracked and `cap add android` brings back the stock Capacitor icon. The PNGs in `icon/mipmap-*` are the
originals of the first standalone build, taken from an installed APK (the script that drew them was never committed), so they are
the only source: keep them. The adaptive background is the flat colour #7EC4D6 in the script. Without this step the tablet shows the
default symbol. The Play Store listing needs a 512 px icon: build it from `ic_launcher_foreground.png` (432 px) on that colour.

## Release bundle for Google Play

Play takes an Android App Bundle (`.aab`), not the debug APK. `build_aab.sh` builds the release bundle and signs it with the
upload key, then prints its path (about 16 MB). Build the game, sync and set `local.properties` first, as above.

```sh
ANDROID_HOME=~/Android/Sdk JAVA_HOME=~/Android/jdk-21 ./build_aab.sh
```

- **The key stays out of the repo.** It is `~/.beaver-cycle-keys/upload.jks` (alias `upload`, password in `password.txt` beside it),
  made once with `keytool`. **Back both files up somewhere safe.** Play App Signing holds the real app signing key; the upload
  key can be reset through Play support if it is lost, but only after the app is enrolled.
- `versionCode` in `android/app/build.gradle` must rise with every upload to Play (it is 1 now). The generated `android/` folder
  is untracked, so raise it there after `cap add android`, or the next upload is refused.
- The script also drops `audio-candidates/` (sounds waiting to be rated, not used by the game, 7 MB) and the `INTERNET`
  permission from the synced copy before it builds, since Capacitor serves the app from the device. The bundle then has no
  permission of its own (checked with `dump manifest`: only AndroidX's own receiver permission, which is normal), no native
  libraries (so the 16 KB page size rule has nothing to check), and the target is API 36. Played in an Android 16 tablet emulator without `INTERNET`: it starts offline, the tiles load, a save survives a restart, the
  OSM credit opens the browser, and sound plays. **Not yet played on a real tablet** (frame time, touch feel): do that before any
  upload. For an emulator test, a plain `.aab` cannot be installed; use `bundletool build-apks --connected-device` (or
  `--mode=universal`) with the debug keystore, then `install-apks`, and check that the game's sound button is on.
- Check a bundle with `bundletool` (download `bundletool-all-*.jar` from <https://github.com/google/bundletool/releases>, run it with
  JDK 21): `java -jar bundletool-all-1.18.3.jar validate --bundle=BUNDLE.aab` and `dump manifest --bundle=BUNDLE.aab`. Checked
  on 1.0: valid, `minSdk 24`, `targetSdk 36`, signed with the upload key (valid to 2054), no `.so` files. `INTERNET` is
  the only permission of its own (the other is AndroidX's own receiver permission, which is normal).
