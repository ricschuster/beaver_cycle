# Host server plugin

The host tablet's WebSocket server (ADR 0014, #662). `HostServerPlugin.java` is the Capacitor plugin and `apply.sh` copies it into a
generated Capacitor Android project, registers it in `MainActivity`, and adds the Java-WebSocket dependency. The Android folders
are untracked, so run it after `npx cap add android`:

```sh
tools/host-server/apply.sh tools/tablet-live/android
cd tools/tablet-live/android && ./gradlew assembleDebug
```

From the page: `Capacitor.Plugins.HostServer` with `start({ port })` (gives the IP), `send({ text, to? })`, `stop()`, `getIp()`, and
the events `open`, `close`, `message` (`{ id, text }`), and `error`. The spike page `tools/net-spike/` uses all of them:
`npx vite tools/net-spike --host --port 5199 --strictPort` with the tablet live shell on `adb reverse tcp:5199 tcp:5199`, tap Host
on one tablet, and type its IP on the other (or `?join=IP` in a browser).
