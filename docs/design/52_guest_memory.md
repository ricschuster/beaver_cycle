# A guest that comes back picks up where it left off

Status: proposal, built in the same change (session 194). Related: note 42 (multiplayer), note 48 (partner lodge and kits), ADR 0014,
and the look a guest joins with, which is kept on its tablet (#822).

## The problem

A guest who leaves a game and joins it again is a newcomer. The host seats it as a new grown beaver in a free lodge, and the guest picks
a look again (#822 fixed only that last part, on the guest's own tablet). What the guest was is gone: how old its baby had grown, which
family lodge it lived in, where it stood, and the coat of a kit it was reborn as. Only a pair lodge waits for it, found again by the
guest's key (#666).

The player expects the same beaver. It is the host's world they play in, and the world is the host's save, so that is where the memory
belongs.

## Decision

The host keeps a short record of every guest that has a key of its own, in the world it saves, and gives it back when the same key
joins again.

- **Where.** `WorldState.guestMemory`, a list of `SavedGuest`, kept in the host's save slot with the rest of the world. A save made
  before this has none, which is fine (fields added to `WorldState` take the new game's value, `save.ts`).
- **Who.** A guest whose hello carries a key (a tablet whose storage works, `guestKey`). The record is found by the guest's id,
  `g-<key>`. A guest with no key has no record and is a newcomer each time, as today.
- **What is kept.** The coat and look; `bornAt` and the coats of its parents (so a baby of a family lodge, or a kit of a pair lodge,
  goes on growing); the family it lived in; whether it was inside that lodge; the last place it stood outside; the clock it was last
  seen at.
- **What is not kept.** What it carried or hauled, a tree half gnawed, its breath, a question waiting, sleeping or dreaming, a game of
  hide and seek. These are moments, not a life. Partners need nothing new: a pair is rebuilt from the pair lodges (`restorePairs`).
- **When it is written.** About once a second from the guests seated, and at once when a guest leaves. It is in the world, so the
  host's normal autosave and save on hide carry it to the storage. At most `MAX_MEMORY` (12) records are kept, the longest unseen
  dropped first.

## Coming back

The host looks the id up when the hello arrives.

1. **Look.** The record's coat and look win over those in the hello. The guest changes them with the look card (the `look` message),
   which updates the record too. A tablet that never was here uses its hello as before.
2. **Age.** `bornAt` is the host's clock at its birth, so the baby went on growing with the host's clock while it was away. A baby that
   became a teenager while the host played on comes back a teenager. One that is grown now comes back an adult and is not housed.
3. **Home.** A guest still young goes back to the lodge of the same family if that family still lives there and the lodge still
   stands, as shared as the rules of #789 allow; else the usual rule gives it a free lodge or the one with the fewest guests. It is on
   its nest inside if it left from inside.
4. **Place.** A guest that was outside is put where it last stood outside (settled on the ground or the water there). A guest that was
   in a pair lodge comes back at that lodge's door, as when a pair is ended, and goes in with Do.
5. **Two tablets with one key** (a copied browser profile): the key is taken once, the second joins as a newcomer, as now.

A host that starts a new game has an empty memory, so everyone joins as a newcomer. A guest who joins another host is new there. Its
look still comes with the tablet (#822).

## Why not on the guest's tablet

The guest's own copy of the world is thrown away on every join: the host's world replaces it (note 42). Its age and home mean nothing
without that world, and a guest could not move to another host's save with it. The host's save is also the one thing that is already
backed up and restored.

## Checks

- A unit test per rule: remember and restore, the look winning, aging while away, the grown guest not housed, the same family lodge,
  the record cap, a guest without a key, a pair guest at the door.
- The two tablets: join, change the look, walk, leave, join again, and be the same beaver in the same place. Then a sleep on the host
  with the guest away, and join again as a teenager.

## Not decided

- Whether a long absence should end the record. For now it never does, up to the cap.
- Whether the host should show who is remembered. Nothing in the screen shows it yet.
