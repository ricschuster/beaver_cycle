# Saving the game

The game saves by itself and offers to continue it. The author's answers (session 69): `localStorage` first, one slot with
"New game" at the start for now (named slots later), autosave every 30 seconds, ask at the start, a version number on the save,
the coach inside the save, no export for now.

## What is saved

One key, `beaver-cycle.save`, holding `{ version, savedAt, world, coach }` as JSON (`src/persist/save.ts`).

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

With a saved game the player sees "Welcome back ... Last played 2 hours ago" with Continue and New game. New game asks a
second time, since it throws the saved game away. Without one the game starts as before.

A run does not read or write the save in an automated browser (the tests expect a fresh game) unless `?save=1`, and never when
the address sets up a world by hand (`?day`, `?time`, `?age`, `?stage`, `?lodge`, `?fly`) or with `?save=0`.

## Versions

`SAVE_VERSION` is bumped when the saved shape changes in a way a default cannot cover (a renamed field, a changed unit), and
`migrate` brings an old save up one version at a time. A field added to `WorldState` needs no bump: a save without it takes the
new game's value. A save that cannot be read, or is from a newer game, is copied to `beaver-cycle.save.unreadable` and the game
starts new, with a word about it.

## Later

Named slots, and copying a save out for a new tablet. Both fit the same envelope. Browser storage can be cleared by the
device (Android clearing app data), so a file in the app's own folder through Capacitor is the next step if that happens.
