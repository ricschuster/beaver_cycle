# Camera and platform

Written after the camera demo (`prototypes/camera-demo/`) and round 2.

## Camera

Third person, following behind the beaver (ADR 0005). The demo compared four
options on real terrain.

| Camera | For | Against |
| --- | --- | --- |
| Third person | Feels like being the beaver. Good for swimming and exploring. | Camera needs care around trees and water. |
| Top down | Whole pond, dam, and lodge in view. Easy to share. | Little sense of being the animal. Trees hide things. |
| Side view | Diving and the breath meter read clearly. | Moves left and right only. Does not suit a big map. |
| Mix | Best view for each activity. | Camera moves on its own, controls change meaning, twice the testing. |

Third person was the author's favorite. The mix was explained as optional
polish that can be added later.

## Platform

The target device is a tablet. This is a direction, not yet an ADR, and it
affects several later choices:

- **Controls:** touch only. A virtual stick to move and a drag to turn the
  view. Tail slap, dive, bum oil, and comb feet are on-screen buttons, which
  matches the round 2 answers (all of them are buttons). Buttons need to be
  big for small hands.
- **Delivery:** a web app that runs in the tablet browser avoids app stores
  and installs on both iPad and Android tablets. A native app is the other
  route and would need a game engine or a wrapper.
- **Performance:** a stylized 3D world is fine on a recent tablet if the
  triangle count and draw distance stay modest. The demo's 14,000 trees are
  about 400,000 triangles, which is near what a tablet browser should draw at
  once, so far views must be simpler than near ones.
- **Terrain size:** the height data for the whole play area is small. The
  limit is how much of the world is drawn and held in memory at once, so the
  world is loaded in chunks around the beaver.
- **Multiplayer:** each friend most likely has their own tablet, so it is an
  online game and needs a server or a peer to peer link. Not decided.
- **Offline:** whether the game must work without a network is open. It
  matters for the size of the data that is downloaded.

## Still open

- Whether the platform is tablet only or also a computer with a keyboard.
- Web app or native app, and the engine. Recorded in a later ADR.
- How multiplayer connects.
