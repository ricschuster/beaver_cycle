# Tablet test

A throwaway Capacitor wrapper that runs the camera demo on an Android tablet
(milestone M0, ADR 0007). It adds an autopilot that walks the beaver, cycles
through the four camera views every 30 s, and logs frame statistics. It is not
the game.

## Build and run

Needs the Android SDK (`ANDROID_HOME`) and a JDK 21 (`JAVA_HOME`). Gradle does
not accept JDK 25. The tablet needs USB debugging on, and Auto Blocker off on a
Samsung.

```sh
python3 prototypes/camera-demo/export_scene.py
cd prototypes/camera-demo && npm install && cd ../tablet-test
npm install
node prepare.mjs                  # assemble www/ from the camera demo
npx cap add android               # once
npx cap sync android
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.beavercycle.tablettest/.MainActivity
adb logcat -d | grep -F 'BENCH {'
```

Unlock the tablet first. A locked screen pauses the app. `scene.json` is
derived from OpenStreetMap, so the APK is for local testing only (ADR 0003).
