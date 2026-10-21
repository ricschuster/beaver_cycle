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
- `guest-fulldam.mjs 9302` - builds the whole dam by logs, mud and rocks until the carry line stops saying it needs more.
- `guest-mend.mjs 9302` - after the host's clock has moved on (`__game.skipYears(0.3)` on the host; the clock does not speed up
  while hosting), cycles log, mud and rock until the worn dam is mended.

- `gift.mjs 9301 9302` - the host (an adult, standing on a lily pad, the test menu has Adult) takes a pad and hands it to the guest
  beside it with Do, the guest hands it back (#663). Keys: E is Do, G is Take.
- `partner.mjs 9301 9302` - the host and a guest within 4 m, both adults with empty mouths, no tree or log in reach: the host presses Do (Talk) and taps Be partners? on the card, the guest presses Do and taps Yes, partners!, and the script prints the Do label and the toast of each tablet (#666, #667). The toasts queue, so the last one shows a few seconds later.
- `talk.mjs 9301 9302` - the same pair: the host asks a question from the card, the guest answers Yes!, then the guest asks and the host answers Not now; prints each card and toast (#667).
- `hide.mjs 9301 9302` - the pair within 4 m, the first port's tablet reading Talk (a tablet that carries food reads Give, so swap the ports): it taps Hide and seek? and I seek, the other says Yes!, and the script prints the cards, the count line and the toasts of both, and shows that the seeker holding W stays put during the count (#664).
- A code change reloads both pages through Vite, which ends the pairing: tick "Let friends join this game" and Continue on the host, then boot the guest again. The host emulator can die under the load (GL context errors in its log); restart it with `emulator -avd tablet ...` and `adb -s emulator-5554 reverse`/`forward` again.
- `pair-lodge.mjs 9301 9302` - after `partner.mjs`, with a lodge site ahead of the host (`__game.siteAhead()`): puts a log at the feet of host and guest in turn (a dev build can edit the world), each takes it with Take and builds with Do, until the lodge of the pair is whole (#666). A guest that stands more than 5 m from the lodge, or is blocked by its dome, does not place. Wear it with `__game.world().pairLodges[0].wear = {level: 0.4, since: clock, mend: 0}` and a log from the guest mends it. The pair and its lodge are in the host's save, and a restarted host and a guest with the same key are paired again.
- `guest-door.mjs 9302 LODGEX LODGEZ DOOR` - a guest swims to 5 m out along the door of a whole pair lodge, then dives in toward the centre (W and Space held) until `inLodge` is true. The host's tablet goes in the same way with port 9301. `space-tap.mjs PORT` taps Space (Dive).

- A guest at the host's store presses Do: a piece in its mouth goes into the first free place, an empty mouth takes the first piece (no stash screen on a guest). In the round room of a pair lodge Do eats the piece (session 169, #663). Take reads Drop while the mouth is full, as for the host, so a guest with a branch drops it before it drags a log (`pair-lodge.mjs` does).
- Part outside works on a pair: each press says it, the second ends the pair. Stand away from the store, Do reads Store there first. A wiped host emulator needs the APK reinstalled (`adb -s emulator-5554 install -r tools/tablet-live/android/app/build/outputs/apk/debug/app-debug.apk`), then the test menu Adult.

A guest is a thin client, so `__game.goToSpot` does nothing on it (the host steps its beaver); walk it with `walk.mjs`.
Food put down in the water cannot be picked up again by a swimming beaver (Take reads item only on land).

A second guest is a third AVD (copy `tablet2` to `tablet3`) on port 5558 with `boot.sh emulator-5558 9303 ...?join=10.0.2.2`. To test
sleep and wake: `adb -s emulator-5556 shell input keyevent KEYCODE_SLEEP`, then `KEYCODE_WAKEUP`.

The host streams tiles only around its own beaver, so a guest far from the host cannot gnaw (the host finds no trees there).
Put the host at the same spot first: leave the lodge by its hole, then `__game.goToSpot('core:-772:1107')` on the host.
A killed script can leave W held; send a keyUp.
