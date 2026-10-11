# Sound

Design note for #340. Status: proposal, decided by the author in session 84 where marked **Decided**; the rest waits for the
author. The game has no sound yet. The author wants rushing water, animal sounds such as birds, and music (round 2, Q36),
a sound per line of dialog (`27_families_and_dialog.md`), and giggles and a cheer in the dream (`29_dream_candy_land.md`).

## Decided (author, session 84)

- **Sources: a mix.** Short free recordings (CC0 or equal) where they sound right, and sounds made in code where that is
  simpler or smaller.
- **Music comes last.** It is the hardest to get right and the easiest to find annoying.
- **Dialog sound is a babble or chirp per line**, not voices.

## Engine

- The plain Web Audio API, no library. One `AudioContext` for the whole game.
- Browsers block audio until the first touch. The context is created at start and resumed on the first pointer or key event.
  The same applies in the Capacitor web view, so this is tested on the tablet.
- When the app goes to the background (`visibilitychange`), the context is suspended, and resumed when it comes back.
- Volume goes through two gain nodes, **effects** (everything but music) and **music**, into one master gain.

## Where the code lives

A new `src/audio/` folder. The rules are the same as for `render/`:

- `sim/` stays silent. It does not import `audio/`. Things that make a sound are already visible in sim state (a tail slap, a
  chopped tree, a predator's warning, a line spoken). Where a one-off moment is not visible in state, the sim records a plain
  event in a small queue that `audio/` drains each frame.
- `audio/` reads state and events and plays sounds. It never changes the sim.
- The mapping from state or event to a sound (which sound, how loud, what pitch) is plain data in its own module, so it has
  unit tests without any audio device.
- Playing is behind a small `SoundOut` interface. The tests use a fake, the game uses Web Audio.

## Layers, in the order they are built

1. **Ambient loops.** Rushing water, louder near streams and the lake, and quiet in a lodge or under water. Wind. Birds by day,
   crickets and an owl at night, with the season changing the mix (no crickets in winter, a quieter valley under snow). Each
   loop crossfades by the gain from distance and time of day.
2. **One-shot effects.** Chop, a tree falling, splash, tail slap, swimming, eating, carrying, a log or branch set down, a dam
   or lodge piece placed, repair, a predator's warning (fox bark, owl hoot, lynx, bear), animal calls near the player.
3. **Dialog.** A short babble or chirp per line. The pitch follows the role (a kit high, a papa low) and the length follows the
   line, so no two families sound alike. Made in code (a few tone sweeps), with no files.
4. **Dream.** Giggles, a cheer, and a soft chime for the sparkles.
5. **Music.** A quiet loop for the valley and a separate calm one for the dream. Last, and the author may drop it.

## Files and licence

- Format OGG (Vorbis) with an MP3 fallback only if the tablet web view needs it. Mono for effects and ambient loops, as
  they are placed by gain and not by stereo.
- Loops are 10 to 30 s and join without a click. Effects are under 2 s.
- A budget of about **5 MB** of files in all, kept in `public/audio/`.
- Sounds made in code (dialog babble, giggles, chimes, probably the splash and the tail slap) cost no file size and have no
  licence.
- Only files that are CC0, or equally free for any use without credit, go in the repo. Every file gets a line in
  `public/audio/CREDITS.md`: name, source link, author, licence. The author checks that list before a release, in the same way
  as the OpenStreetMap question.

## Tablet budget

- At most 8 sounds play at once. The quietest or oldest goes first, and ambient loops count as 1 each, up to 4.
- Decoded audio is held in memory, so the ambient loops (about 4) load at start and the effects load when the game first
  needs them. A loop is decoded once.
- The per-frame work is a handful of gain changes, and it runs only while the game is not paused.
- If the frame rate drops, music goes first, then the ambient layers, then the one-shots. Nothing is on by a timer.
- To check on the tablet: the frame time with and without sound, and memory.

## Settings and the manual

- Two sliders, **Effects** and **Music**, and a mute button, kept with the other saved settings (`26_saving.md`). The default
  is a middle volume, so a tablet in a quiet room is not a surprise.
- The mute button is easy to reach, as the game is for children and may be played where sound is not welcome.
- `public/manual.html` gets a short section with a picture when the sliders exist, and the test menu gets a switch for
  each layer.

## Slices

Each slice is its own pull request, and each can stay silent in tests.

1. The engine, the unlock on first touch, the two volumes with the mute button, and one water loop.
2. The rest of the ambient layers.
3. One-shot effects, in groups (beaver, building, animals).
4. Dialog babble.
5. The dream sounds.
6. Music, if the author still wants it.

## Open questions for the author

- Is a mute button on the screen at all times right, or only in the settings?
- Should the lone beaver and the partner have their own calls (a partner "follow me" chirp)?
- Should a sound that is out of sight, such as a fox, show a hint on screen (a direction), so a deaf or muted player is not
  left out? The proposal is that every sound which warns also has a toast, as the predators already do.
