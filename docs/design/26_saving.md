# Saving the game

The game saves by itself and offers to continue it. The author's answers (session 69): `localStorage` first, one slot with
"New game" at the start for now (named slots came later, see Slots), autosave every 30 seconds, ask at the start, a version number on the save,
the coach inside the save, no export for now.

## Slots

Eight slots (issue #562, raised from four in #772). Slot 1 is the old key `beaver-cycle.save`, so a game saved before the slots is slot 1 with no migration;
slots 2 to 8 are `beaver-cycle.save.2` to `.8`. A game has an optional name (up to 24 characters, `name` in the save, no version
bump since an old save simply has none); the start screen shows the name or "Game N", the life stage, the generation, and when it
was last played. Each slot keeps its own unreadable copy (`<key>.unreadable`).

The start screen (`src/ui/slotCard.ts`) shows all eight slots when any holds a game. A used slot has Continue, Rename and Delete
(Delete asks twice); an empty one has New game, with an optional name. With no game saved at all the game starts in slot 1 without
the screen, as before. `?slot=N` goes straight to that slot (a new game if it is empty): the Settings shadows restart uses it.
Settings has a Start screen button that saves and goes back to the screen without `?slot`.

## What is saved

One key for each slot, holding `{ version, savedAt, name?, world, coach }` as JSON (`src/persist/save.ts`).

- `world` is the whole `WorldState`. It is plain data, so it goes in as it is. The ponds' grids are typed arrays and go in as
  base64, so a pond comes back exactly as flooded and needs no terrain tile to be loaded to rebuild it.
- Left out, since they only matter for a moment: the test speed, an open stash screen, a meeting with a predator or a guide, a
  tree being gnawed, and what is carried or dragged.
- `coach` is whether the coach is on, the life stage whose run it was on, and the step it showed, so it carries on where it was.
  A coach the player closed stays off.
- Not saved, because they follow from the world: the ambient animals (from the clock and the place), the camera, the toasts.

## When it saves

Every 30 real seconds while playing, at once when a life stage, a season or a generation changes, when the page is hidden or
closed (`visibilitychange`, `pagehide`, which is what a tablet gives us when the game is put away), and when a game starts.
Storage that is full or blocked is ignored: the game goes on and tries again.

## Starting

With a saved game the player sees the slots (see Slots). Without one the game starts as before.

A run does not read or write the save in an automated browser (the tests expect a fresh game) unless `?save=1`, and never when
the address sets up a world by hand (`?day`, `?time`, `?age`, `?stage`, `?lodge`, `?fly`) or with `?save=0`.

## Versions

`SAVE_VERSION` is bumped when the saved shape changes in a way a default cannot cover (a renamed field, a changed unit), and
`migrate` brings an old save up one version at a time. A field added to `WorldState` needs no bump: a save without it takes the
new game's value. A save that cannot be read, or is from a newer game, is copied to that slot's unreadable key (`beaver-cycle.save.unreadable` for slot 1) and the slot starts empty, with a word about it.

## Later

Copying a save out for a new tablet. Both fit the same envelope. Browser storage can be cleared by the
device (Android clearing app data), so a file in the app's own folder through Capacitor is the next step if that happens.
