# Camera demo

A throwaway page for comparing four camera styles on the real south end of the
Almsee. It is not the game and does not decide the stack. It uses three.js,
real BEV terrain and OpenStreetMap water and land cover (see ADR 0003).

## Run

```sh
python3 tools/area-editor/build_data.py      # once, if data/raw is missing
python3 prototypes/camera-demo/export_scene.py
cd prototypes/camera-demo && npm install
python3 -m http.server 8765
```

Open `http://localhost:8765/`. Add `?cam=3` to start in another view.

## Controls

- WASD or arrows: move. Shift: dive (breath meter, 20 s here). Space: tail slap.
- 1 to 4: third person, top down, side view, mix of views.
- Mouse drag turns the view (third person and mix), the wheel zooms, R resets.

## What is rough on purpose

- The beaver is drawn larger in far views so it can be found.
- The lake bed is made up (the terrain model has a flat lake), and so are the
  dam and lodge positions.
- No sound, no seasons, no other beavers, no collision with trees.
