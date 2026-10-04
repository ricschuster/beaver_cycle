# Tablet live shell

A Capacitor app (`com.beavercycle.live`) that loads the game from the dev
server on the computer, so a tablet run needs no APK rebuild after a code
change. It is for development only. The bundled, standalone APK comes later
(ADR 0007). It sits beside the M0 app `com.beavercycle.tablettest`.

## Build and install

Needs the Android SDK (`ANDROID_HOME`) and a JDK 21 (`JAVA_HOME`). Gradle does
not accept JDK 25. The tablet needs USB debugging on.

```sh
cd tools/tablet-live
npm install
npx cap add android               # once
npx cap sync android
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Run

```sh
python3 tools/tiles/build_tiles.py    # once, tiles are untracked
npm run dev -- --host --port 5199 --strictPort
adb reverse tcp:5199 tcp:5199
adb shell am start -n com.beavercycle.live/.MainActivity
```

Unlock the tablet first, since a locked screen pauses the app. Reload the app
(or reopen it) after a code change. The tiles come from OpenStreetMap data
(ADR 0003), so the app is for local testing only.

To read frame statistics from the computer, forward the WebView debug socket
and use `window.__game.stats()`:

```sh
adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof com.beavercycle.live)
```
