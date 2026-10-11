# Sound

Design note for #340. Status: decided by the author in session 84. Issues #405 to #410 are the slices. The game has no sound yet. The author wants rushing water, animal sounds such as birds, and music (round 2, Q36),
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

## Slice 2, as built

- Wind, birds, crickets and an owl are **all made in code** (`src/audio/synth.ts` and looped noise), so slice 2 adds no file, no
  licence line and no size. Files can still replace any of them later if one sounds thin on the tablet.
- Gains are plain functions of `Hearing` in `mix.ts`: wind always, a little more in autumn; birds by day (most in spring, few in
  winter); crickets at night (none in winter); an owl at night in every season. A lodge keeps 20% of each, and the head
  under water hears none of the four (water itself is dulled, as in slice 1).
- The test menu has a switch for each layer.

## Slice 3, the beaver's group, as built

- The sim has no event stream, so `watchBeaver` (`src/audio/effects.ts`) compares each frame's world with the last and gives
  cues: a gnaw every half second of chopping, the fall of the tree, a tail slap, a splash going into the water (softer coming
  out), a stroke now and then while swimming, a crunch when something is eaten, and a pickup or set down for a piece, mud, a rock or
  a log. The first frame gives none, so a loaded game starts silent.
- All eight are **made in code** (`src/audio/effectsSynth.ts`), so no file and no licence line. They load on first use.
- At most **4 one-shots** play at once (`MAX_ONE_SHOTS`), the ambient layers taking the rest of the 8. A new sound with no free
  voice takes the place of the quietest if it is louder, and is dropped if not. The test menu has a **One-shots** switch.
- The gnaw is four quick bites (a chattering rasp and a small knock each), 0.5 s long, since the first single click sounded like
  a knock on a door.
- Not yet: the sounds are untuned (see the next section).

## Slice 3, the building and animal group, as built

- `watchWorld` (`src/audio/effects.ts`) is the same idea for what is built and for the animals. It gives: a **wood** knock for
  a log on a dam or the lodge, a wet **mud** squelch, a **rock** clack, and a **done** flourish (two rising notes) when a dam
  goes up a level, the lodge is whole, or a piece is mended back to new.
- Each predator gives its call once, when it first notices the beaver, louder when closer and not heard beyond 60 m: **hoot**
  (owl), **yap** (fox), **growl** (lynx), **rumble** (bear). The toast stays. The beaver being hurt gives a **hurt** squeal.
- A **quack** for a duck within 30 m, about every 9 seconds at most.
- All ten are made in code like the rest. They are first drafts: **add first, tune on the tablet after** (author, session 88).

## Slices 4 and 5, talk and the dream, as built

- **Babble.** `babbleCue` (`src/audio/talkDream.ts`) gives one babble for each line a beaver says, played when its bubble opens.
  The pitch follows the speaker (kit 560 Hz, partner 400, mama 320, papa 190, each nudged up to 10% by its id so two papas differ),
  and the length follows the line (0.5 to 2.4 s). It is a string of short tone syllables with a falling last one, from a seed made
  of the speaker and the text. Not words.
- **Calls.** A partner who starts to follow, or a lone beaver who starts to lead, gives a two-peep **chirp**.
- **Dream.** `dreamCues` turns the dream's events into sounds: a bell chime for each sweet (higher for a swirl, a three note
  one for a star and the shower), a **giggle** for a greeting, a catch, a find and the hide and seek giggles, a **cheer** when a game ends, and a splash.
- All made in code, first drafts, to tune on the tablet. Music (slice 6, #410) is still open and optional.

## Checking sound

Sounds made in code cannot be judged by a test, so the check has two halves.

- **Measured (a test, no ears).** `src/audio/analyze.ts` measures the samples: peak, clipping, loudness, silence at the ends, DC
  offset and the spectral centroid. `analyze.test.ts` guards every one-shot effect (no clipping, loudness between -32 and -14 dB)
  and every ambient loop (no click at the join). `SOUND_REPORT=dir npx vitest run src/audio/analyze.test.ts` also writes a WAV of
  each sound and a table of the measurements to `dir`.
- **Heard (the author).** `/tools/sound-preview/` plays every effect and layer through the game's own Web Audio code, with the
  measurements beside it. Each sound is rated ok, thin, harsh or wrong with a note, kept in the browser, and exported as markdown
  with the worst first. Do it on the tablet over the dev server, then play the game for the mix.
- **Then decide per sound:** leave it, tune the synth, or after one round of tuning replace it with a CC0 file.

## Recordings (session 90)

The author heard the code made sounds and rated nearly all of them wrong (`tools/sound-preview/ratings-round1.md`), so recordings
replace them. Only `done` and the three chimes stay in code. Chirp and babble have recordings since session 93.

- **The player** (`webAudio.ts`, `samples.ts`): on the first touch it reads `public/audio/manifest.json`, starts each ambient
  layer from one recording picked at random for the session, and decodes the effect files in the background. A play picks a random
  clip of the effect (not the one played last), with the pitch varied by up to 7% and the gain by up to 15%. An effect or layer the
  manifest does not list is made in code, as before. If the manifest is missing the whole game is made in code. Until the files are
  decoded (a second or two) an effect with recordings stays silent rather than play the synth.
- **Choosing is data, not code.** `python3 tools/sound-preview/pick_from_ratings.py RATINGS.md ...` copies every clip rated ok from
  `public/audio-candidates/` to `public/audio/` and writes the manifest. Several ok clips for one effect form its pool.
- **Candidates in two rounds.** `stage_candidates.py` (round 1) and `stage_gaps.py` (round 2: water slap, setdown, hurt, stroke,
  fall, cheer, more splashes) both write into `public/audio-candidates/`; `fetch_packs.sh` downloads the sources.
- **Water slap.** The tail slap on land (`slap`) and in water (`slapwater`, when the beaver is swimming or diving) are two effects.
  The sim has no depth for a splash, so all splash clips, shallow or deep, share one pool.
- **Credits.** `public/audio/CREDITS.md` lists source, author and licence. Sources and licences were re-checked on each
  page in session 91. One clip (the cheer) is CC-BY 4.0 and needs the credit; the rest are CC0. The manual (the ? button) ends with a
  sounds credit line. `pick_from_ratings.py` clears only the old `.ogg` files, so `CREDITS.md` survives a rebuild.
- **Round 2 (session 91).** The author rated the gap clips (`tools/sound-preview/ratings-round2.md`, which includes the round 1 oks).
  104 clips, 3.8 MB, inside the 5 MB budget. `fall` has no ok clip yet and plays the code sound.
- **Round 3 (session 92) and settled (session 93).** `fall` (9 clips), `slap` (7) and `pickup` (7) are settled and in `public/audio/`
  (`tools/sound-preview/ratings-round3.md`). `stroke` and `quack` are settled too: the oks are enough. `done` and the three chimes stay
  in code and are settled: the author rated them ok in rounds 1 and 2. Fox (`yap`, 2 clips) and lynx (`growl`) have recordings, and the
  bear (`rumble`, 2 clips) is thin.
- **Chirp (session 93).** Round 4 staged 22 chirp clips (chicks, young birds, nestlings, kitten mews, BigSoundBank CC0). The author rated
  nine ok (`tools/sound-preview/ratings-round4.md`) and the synth chirp wrong, so `chirp` plays those nine.
- **Babble (session 93).** Round 4 tried baby babbles, all wrong. Round 5 (a cockatiel, hens, cats) gave 14 ok cockatiel clips
  (`ratings-round4.md`); the hens, cats and aviary were wrong. A babble cue carries a voice (pitch and length of the line), and the player
  now uses a recording for it too (`webAudio.ts`): half way to the speaker's pitch (`sqrt(pitch / 320)` as the playback rate, so a kit is
  higher and a papa lower), looped to the length of the line and faded out in the last 0.1 s. The synth babble stays as the fallback
  when the manifest has none. 4.3 MB in `public/audio/`.
- **Nothing is open.** `/tools/sound-preview2/` hides rounds 1 to 5 (`SETTLED` in its `main.ts`) and lists code-made sounds still to rate
  (`SYNTH_GAPS`, empty now) and clips staged after round 5.

## Slices

Each slice is its own pull request, and each can stay silent in tests.

1. The engine, the unlock on first touch, the two volumes with the mute button, and one water loop.
2. The rest of the ambient layers.
3. One-shot effects, in groups (beaver, building, animals).
4. Dialog babble.
5. The dream sounds.
6. Music, if the author still wants it.

## Also decided (author, session 84)

- **A mute button is on the screen at all times**, not only in the settings.
- **The partner and the lone beaver get their own calls**, for example a follow-me chirp (slice 4, #408).
- **Every sound that warns also has a toast**, so a muted player is not left out. The predators already work this way.
