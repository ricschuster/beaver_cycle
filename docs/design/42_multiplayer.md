# Multiplayer: friends in one valley

Design note, session 157. Status: the author's answers are in ([44_round6_answers.md](44_round6_answers.md)), the rest is open (round 7
questions, [45_game_questions_round7.md](45_game_questions_round7.md)). Nothing is built. The transport (embedded server, Nearby
Connections, or WebRTC) gets its own spike and ADR after this note ([#41](https://github.com/ricschuster/beaver_cycle/issues/41),
[ADR 0007](../decisions/0007-web-stack.md)).

## What the author has said

- Same valley, each player with their own family and lodge.
- Players build and chop in the shared valley.
- Up to four players at once.
- Mostly in the same room, always in the same house, on one WLAN with no internet service.
- Night passes fast only when everyone sleeps.
- Friends help to mend each other's dams and lodges. Nothing is damaged by a friend (wear comes from the clock only, see
  [20_dams_and_ponds.md](20_dams_and_ponds.md), so there is nothing to take away).
- Anyone can host, one tablet at a time; the others join with the host's IP, as in Stardew Valley. One tablet hosts, the others are guests. When the host quits, the world stays as it was, on the host's tablet. Saves must stay
  simple.
- Everyone starts in the same valley, close to each other, so they find each other.
- The game starts with five lodges close to each other, so a late friend spawns into a free lodge of their own. Up to four join,
  five lodges in all.
- All the sim rules stay per beaver. Trees cut by one friend are gone for all and do not grow back faster.
- A friend can carry wood, mud, or rocks to a dam or lodge and place it, and the owner gets a chime and a heart.
- Each player chooses how their beaver looks when the game starts. A friend can talk to a friend in the game.
- Partners across families are wanted, the mechanics are open. A baby stays with its own family, but can share food.
- Wanted later: dreams played together, games in the main game (hide and seek), and trade of food ([46_round7_answers.md](46_round7_answers.md)).
- Games are independent: a friend who plays in another friend's game is a new family with a new lodge there. A laptop browser can
  join as a player.
- The five lodges each hold a family (Mama and Papa and a baby), until a player takes the baby. The lodges nobody plays hold
  families like the other families in the game now, and go on with their day while their player is away, ageing with the clock.
- A player chooses fur colour, hat and scarf, tail colour, and a name at the start.
- Partners are adults who both say yes with a button or in a dialog, and they build a new lodge together. Each player gets their
  own kit.

## Model

- The host tablet runs the world: the clock, trees, logs, dams, ponds, lodges, food, animals, and other families. A guest sends
  what the player wants (the plain `Intent` data in `src/actions/`) and gets the world state back. The host is the only one that
  changes the world. The sim has no DOM, no three.js, and no input, so it can run on the host without a screen change.
- Every player is one beaver in that world, with a family. There is one game per save, and the save is on the host's tablet. A
  guest's family, lodge, dams, and chopped trees are all part of the host's world (Q97). A guest's own tablet keeps only settings
  and the look of the beaver. A guest who joins another host's game gets a family and a lodge there, in that world.
- The dream is its own small world and touches nothing in the waking game ([29_dream_candy_land.md](29_dream_candy_land.md)). Today
  it is one player's. The author wants to dream together, which makes the dream a shared room that the host runs for the players
  who sleep, and it is the natural place for games with friends (round 7).
- Terrain tiles are on every tablet already. Only state goes over the WLAN, for at most four beavers and a few hundred objects.

## Time, sleep, and skipping

The clock is the world's, so it is shared and run by the host. Wear, seasons, and the other families are functions of it
(`24_npcs_and_animals.md`).

- **Night.** It passes fast only while every player is asleep in a lodge (or in a dream). One awake player keeps it normal, and the
  others see "waiting for N". A sleeper can wake at any time.
- **Skipping to the next stage.** A stage is a year, 5.3 hours of play ([22_life_stages.md](22_life_stages.md)), so skipping decides
  whether a generation is playable. With a shared clock one player cannot skip alone. Options:
  1. **Ready check, recommended.** "Sleep until teenager" asks the others on their screens ("Pip wants to sleep until the next
     season. Come along?"). The skip runs when all say yes or are asleep. A no cancels it and the sleeper stays asleep until
     morning only. In one room this is as simple as asking each other.
  2. **Own age.** A beaver's stage follows its own age, and sleeping adds age at a fast rate while the world clock runs on. It
     never blocks anyone, but a kit born "on the first day of spring" would no longer line up with the seasons, and the lodge, the
     dams, and the other families would not move along with the sleeper's age.
  3. **Host decides.** Only the host can skip, for everyone. Simple, but the guests have no say.
  Answered in Q91 and Q92: option 1, and one no stops the skip.
- A baby and an adult can play at the same time. Only the skip is shared.

## Joining and leaving

- The host taps Host, a guest taps Join and types the host's IP, which the host's screen shows. This needs no discovery on the
  WLAN, so it is the simplest thing that can work, and the tablet remembers the last host. The spike checks it on the real tablets.
- A guest starts at a free lodge of the five, or at their own lodge when they have one in this world.
- The game is a web app, so a browser on a laptop could join as a guest too. A browser cannot be a host, because it cannot listen
  for connections. Open for the spike.
- A guest who loses the connection (a tablet sleeps, the WLAN drops) leaves the beaver standing in its lodge or on the spot,
  where it cannot be hurt, and rejoins later where it was. The calm rule holds: no death, no losing.
- When the host quits, the world is saved on the host's tablet as it is now. Guests go back to the title screen with their own
  tablet's data intact. To go on, a guest joins that host again. The family's home lives in the world where it was built.

## Features that come with it

These are their own pieces of work, and each can be built and played alone before the network exists.

- **Beaver looks.** A start screen for fur colour, hat, scarf, tail colour, and a name, saved with the family. It also makes sense
  in single player. The model has `coat` today (`?coat=2` in the model preview).
  Built (#659): `src/sim/look.ts`, `src/ui/lookCard.ts`, `setLook` in `beaverModel.ts`. The fur is one of 25 (the five browns in five
  shade steps), then nine hats, eleven scarf colours, nine tail colours and a name. The card opens on a new game and at every birth,
  with the kit's inherited fur first, so a tap on Go keeps it (the kit's fur is the player's choice from then on, not Q59's chance).
  The name is not drawn over the head yet; that waits for the other players. `?look=1` opens the card in an automated browser.
- **Five starting families.** The start of a game places five lodges with a family each, and the player takes a baby. Today the
  player starts as a baby in a lodge, so this is the same start with four more families beside it.
  Built (#660): `startFamilies` in `src/sim/neighbours.ts` puts up to four families on rings of 90 to 210 m round the home lodge, at
  least 50 m from it and from each other, the same every time. They are ordinary neighbour families (`family:start:N`), so they age
  with the clock and have litters. On the network a guest now appears beside the first free start lodge (`Room.receive` takes the `homes`; the lodge goes free again when the guest leaves, and with none left the guest stands by the host). The guest plays the first baby of that family's spring litter: the family leaves that kit out (`neighboursAt` takes the `played` families, the snapshot carries them so every tablet agrees). The guest keeps its own look, and does not yet age as a baby (guests are grown beavers). Automated
  browsers leave them out unless `?families=1`.
- **Sleep outside a lodge.** The author wants it, maybe, for the early adult who cannot build a dam and a lodge in one day. Today
  only a beaver on the nest in a lodge can sleep (`canRest`, `canSleep` in `src/sim/state.ts`). Open: where it is safe, whether it
  ends skips, and how the dream and a night skip work from there.
- **Dream together.** The dream room is run by the host for the players who are asleep. A popup tells the others when a beaver
  goes to sleep.
- **Hide and seek.** The dream mechanics, behind trees, in the waking game. A beaver can send a note to friends who are near, they
  walk over, and the game starts.
- **Gifts.** A beaver can put food on the ground for a friend, or hand it over to a friend whose mouth is empty.
  Built (#663) for the families first: with food in the mouth and a family beaver with an empty mouth within 4 m, Do reads Give
  (`takerNear`, `giveFamily` in `src/sim/familyMoods.ts`), and the family trusts more, as for a gift put down. A wary family keeps
  12 m away, so it needs a gift on the ground first. A friend's tablet will use the same rule.
- **Talk.** The dialog with beavers of other families ([27_families_and_dialog.md](27_families_and_dialog.md)), with a friend's
  answer coming back. Open.

## What stays unchanged

The rules of the waking game stay the same for each beaver: chopping, building, food, wear, and life stages. Only what is shared
changes. A dam only floods the ground upstream of itself (`pond.ts`, a flood fill, no flow), so a friend's dam above your pond does not
drain it. A friend's dam below your pond only raises it. A pond runs low only when its own dam wears (Q99), and the lodge
walk-in over the mud (#647) means nobody gets stuck.

## Built so far (#662, #678)

The transport is an embedded WebSocket server on the host tablet ([ADR 0014](../decisions/0014-multiplayer-transport.md)). Code:
`src/sim/guests.ts` (a guest beaver that walks, swims, dives, and gnaws, stepped on the host), `src/net/protocol.ts` (the messages,
checked on arrival), `src/net/room.ts` (the host's room of guests, no socket), `src/net/view.ts` (what a guest shows),
`src/net/session.ts` (the two ends of the socket), wired in `main.ts`. the start screen (the saved games) has a Play together box under the slots: a tick, Let friends join this game (the app only), which
hosts the game picked above and shows the address in a toast; and an address to join, remembered as `lastHost` in the prefs. Join
starts the game again as a guest (the address waits in the session storage, `src/net/pending.ts`) and the guest picks its look on the
look card. The Play bundle has no networking, so it hides the box (`canPlayTogether`). Settings shows how hosting or joining goes, and Leave for a guest. With no saved game the start screen is skipped, so a
fresh tablet cannot host or join until it has a game. The dev parameters `?host=1` and `?join=IP` still work in a dev build. A guest
shows the host's clock, felled trees, and logs, and never saves. The snapshot also carries the host's dams and lodge, and a guest works the ponds out from the dams (`pondsAt`), so a guest sees them. A guest also drags logs, scoops mud, takes rocks and puts them on a dam spot with Do (the host steps it in `stepGuest`, the intent carries `do` and `take`, the snapshot carries what each beaver holds, the rocks taken and the pieces put down). Missing: the owner's chime and heart, the lodge and the store (a guest mends nothing there), and a guest's own pond view of new spots. Not yet shared: lodges of guests, food, carrying, other
families, and the look of a guest's lodge. The host's own beaver is drawn to guests without leg movement. Hosting cannot be stopped
short of closing the app.

A guest and a host were played on two tablet emulators through the real socket (`tools/emulator-pair/`, session 162): the guest
felled a tree, dragged the log, took a rock and mud, and built a dam in the host's world, and both showed the same dam. It found one
gap: the host streams terrain and trees only around its own beaver, so a guest far from the host cannot gnaw, since the host finds no
trees there (#696; not decided whether the host also streams around each guest or guests stay near it).

The same setup then built a whole level 2 dam by a guest (17 logs, mud and rocks, through Take and Do), held a pond on both tablets,
and a guest mended the worn dam with Mend. A second guest joined with the first still in; both got snapshots of all three beavers.
The First dam achievement came to the host only (a guest's achievements are not shared; settled for the host's save). A guest that
sleeps for 40 seconds loses its socket and never rejoins, and shows no message (#697). Not tried: the real tablets.

## Open

Sleep outside a lodge, how a friend answers a dialog, how hide and seek invites work, and what a first spike should prove. The
spike comes next: the host runs the sim, a guest joins by IP on two real tablets and a laptop browser, and the guest's beaver
moves and chops in the host's world.
