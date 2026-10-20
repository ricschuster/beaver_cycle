# Host and guest on two tablet emulators

Plays the multiplayer path through the real socket without the real tablets (session 162, #41). The host is the live shell on one
emulator, the guest is the live shell on a second one, and node scripts drive both over the WebView debug port. Needs the Android
SDK, two tablet AVDs (copy `~/.android/avd/tablet.avd` and its `.ini` to `tablet2`), the live shell APK with the HostServer
plugin (`tools/tablet-live/README.md`, `tools/host-server/README.md`), the local tiles, and Node 22.

```sh
emulator -avd tablet  -port 5554 -no-snapshot -no-audio -gpu host &   # -gpu host: 60 fps; swiftshader gives 2 fps
emulator -avd tablet2 -port 5556 -no-snapshot -no-audio -gpu host &
npm run dev -- --host --port 5199 --strictPort &
for s in emulator-5554 emulator-5556; do adb -s $s reverse tcp:5199 tcp:5199; done
adb -s emulator-5554 forward tcp:8765 tcp:8765            # the guest reaches the host at 10.0.2.2:8765
tools/emulator-pair/boot.sh emulator-5554 9301 "http://localhost:5199/?host=1"
tools/emulator-pair/boot.sh emulator-5556 9302 "http://localhost:5199/?join=10.0.2.2"
```

Always pass `-s`, since real tablets may be attached. `boot.sh` clicks Go on the look card; a host with a saved game shows the
start screen instead, so tick "Let friends join this game" and Continue there (as a player does) and boot the guest after.

- `cdp.mjs PORT navigate URL` or `eval EXPR` - one call on the page of an emulator (`window.__game` is there in a dev build).
- `walk.mjs PORT X Z [STOP]` - walks that beaver to a point with the W key, steering by the camera yaw.
- `guest-dam.mjs 9302` - at a dam spot: fell a tree, grab the log, put it on the spot with Do.
- `guest-load.mjs 9302` - at the spot: take a rock and mud and put each on the dam.

The host streams tiles only around its own beaver, so a guest far from the host cannot gnaw (the host finds no trees there).
Put the host at the same spot first: leave the lodge by its hole, then `__game.goToSpot('core:-772:1107')` on the host.
A killed script can leave W held; send a keyUp.
