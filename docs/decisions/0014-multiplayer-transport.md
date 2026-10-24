# Multiplayer transport: an embedded WebSocket server on the host tablet

## Status

Accepted (2026-10-20). Answers the transport question of #662, part of #41.

## Context

One tablet hosts, the others join by typing its IP (note 42, Q95, Q105). A browser, such as the laptop, may join but cannot host.
The game is a web app in an Android WebView (ADR 0007), and a WebView cannot listen on a socket. There is no internet, only the
house WLAN, and the host tablet's save must stay on the host.

## Decision

The host runs a WebSocket server inside the APK, in a small Capacitor plugin (`tools/host-server/HostServerPlugin.java`, the
Java-WebSocket library). The page starts it, gets the tablet's WLAN IP, receives every guest message as a plugin event, and sends
text to one guest or to all. A guest, tablet or browser, opens `ws://<host-ip>:8765` with the plain `WebSocket` of the page. The
messages are JSON. No discovery: the guest types the IP, and the tablet remembers the last one.

Two settings are needed in the shipping app's `capacitor.config.json`, and both keep the app's origin `https://localhost`, so the
saved games in its local storage stay where they are (checked on a tablet):

- `"server": { "cleartext": true }` lets the app talk plain `ws://` to a local address.
- `"android": { "allowMixedContent": true }` lets a page on `https://localhost` open `ws://`. Without it the `WebSocket`
  constructor throws a `SecurityError`, found on the first run of the spike. Changing the scheme to `http` instead would move
  the origin and lose every save, so that is not an option.

## Measured (spike `tools/net-spike/`, 2026-10-20)

Two SM-X210 tablets and a laptop on one router (192.168.1.x), no isolation between clients. The host sent a 3 dot state 20 times
a second and each guest sent its wish 30 times a second.

- Tablet host, laptop guest: 20 states per second, ping round trip median 28 ms, worst 57 ms.
- Tablet host, tablet guest: 33 to 40 states per second counted at the guest, round trip median 26 to 33 ms, worst 35 ms.
- The tablet app joined from its bundled `https://localhost` page only with the two settings above.
- A guest that stopped (app killed) was dropped by the server after its ping timeout, and the same IP joined again at once.

## Played in the real game (2026-10-20, #678)

The same two tablets ran the real game: the host (`?host=1`) and a guest (`?join=192.168.1.67`) in the tablet live shell, on the real
valley. The guest joined, swam off across the lake and walked ashore (the host drew it moving, with its fur and look), pressed
Gnaw by a tree, and the tree fell: both tablets showed "1 of 30 trees felled" and the log lay in both worlds. The guest's
tablet shows the host's clock, felled trees, and logs, and its own beaver where the host puts it.

## Why not the others

- **WebRTC.** Needs a signalling step. Without internet it would be copied by hand (a code or a QR), which is worse than typing an
  IP, and gives no gain on one WLAN.
- **Nearby Connections (Google).** Android only, so no laptop browser, and needs a native bridge as large as this one.

## Consequences

- The host needs the plugin, so a browser cannot host. A browser guest needs nothing.
- Amended for testing: a laptop browser can host through `tools/host-bridge`, a Node program that listens for the tablets and relays to the page on
  localhost (`?hostbridge=1`, dev tools only). The wire to the tablets is unchanged, and the release build never contains it.
- Guests need the host's IP typed. Router DHCP may change it between evenings, and the host screen shows it every time.
- The spike moved dots, not the game. The real sim has one beaver (`WorldState.beaver`), so the host needs a place for guest
  beavers before a guest can move and chop in the world. That is the next piece of #41.
- Not checked: more than one guest at a time on the tablet host (the laptop and a tablet joined one after the other), a guest tablet
  that sleeps and wakes, and the real release APK. `tools/standalone-apk/` needs the plugin and the two settings added.
