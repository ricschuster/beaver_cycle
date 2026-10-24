# Host bridge

Lets a laptop browser host for tablets on the WLAN (ADR 0014, amended). A page cannot listen on a socket, so this small Node program
does it: tablets open `ws://<laptop-ip>:8765` as they do to a tablet host, and the game page on the laptop talks to the bridge on
`ws://localhost:8766` through `src/net/browserHost.ts`, which gives it the same calls and events as the app's HostServer plugin.
For testing only: it needs the dev server (`__DEV_TOOLS__`), the release build and the Play bundle never use it.

```sh
npm run host-bridge          # prints the address the tablets type
npm run dev                  # then open http://localhost:5173/?hostbridge=1 and use Host in the slot card
```

- The tablets can run the normal release APK built with `--host`; they only join. Laptop and tablets should run the same version.
- Allow port 8765 in the laptop firewall. `GUEST_PORT` and `HOST_PORT` change the ports, but the game joins on 8765.
- The host's save is the laptop browser's local storage, apart from the tablets' saves.
- An `adb forward tcp:8765` left from the emulator tests holds the port; remove it with `adb -s emulator-5554 forward --remove tcp:8765` (`adb forward --list` shows which device holds it).
