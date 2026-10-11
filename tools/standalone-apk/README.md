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
npx cap sync android               # after every game build
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The APK (about 24 MB) is `app/build/outputs/apk/debug/app-debug.apk`. It can
also be copied to a tablet and installed from there, if the tablet allows it.
Each game change needs a new build and install. For quick edit and reload
loops use `tools/tablet-live` instead.

## Release bundle for Google Play

Play takes an Android App Bundle (`.aab`), not the debug APK. `build_aab.sh` builds the release bundle and signs it with the
upload key, then prints its path (about 23 MB). Build the game, sync and set `local.properties` first, as above.

```sh
ANDROID_HOME=~/Android/Sdk JAVA_HOME=~/Android/jdk-21 ./build_aab.sh
```

- **The key stays out of the repo.** It is `~/.beaver-cycle-keys/upload.jks` (alias `upload`, password in `password.txt` beside it),
  made once with `keytool`. **Back both files up somewhere safe.** Play App Signing holds the real app signing key; the upload
  key can be reset through Play support if it is lost, but only after the app is enrolled.
- `versionCode` in `android/app/build.gradle` must rise with every upload to Play (it is 1 now). The generated `android/` folder
  is untracked, so raise it there after `cap add android`, or the next upload is refused.
- Checked on the first bundle: the only permission is `INTERNET` (no location, no advertising ID), the bundle has no native
  libraries (so the 16 KB page size rule has nothing to check), and the target is API 36.
- Check a bundle with `bundletool` (download `bundletool-all-*.jar` from <https://github.com/google/bundletool/releases>, run it with
  JDK 21): `java -jar bundletool-all-1.18.3.jar validate --bundle=BUNDLE.aab` and `dump manifest --bundle=BUNDLE.aab`. Checked
  on 1.0: valid, `minSdk 24`, `targetSdk 36`, signed with the upload key (valid to 2054), no `.so` files. `INTERNET` is
  the only permission of its own (the other is AndroidX's own receiver permission, which is normal).
- The bundle also carries `public/audio-candidates/` (328 files, 7 MB), the sounds waiting to be rated. They are not used by the
  game, so drop them from the release build once the rating is done.
