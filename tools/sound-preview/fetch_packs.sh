#!/bin/bash
# Download the CC0 packs that stage_candidates.py cuts candidates from. usage: fetch_packs.sh PACKS_DIR (needs curl and unzip).
# OpenGameArt pages go to PACKS_DIR/<slug>/ (zips unpacked in x/), BigSoundBank recordings to PACKS_DIR/bsb/. Every page is checked
# for CC0 by eye on the page: the licence line of each source goes into public/audio/CREDITS.md when a sound is chosen.
set -u
D=${1:?packs dir}
OGA="tree-chop-fall-thud chipper-chopper-upper 35-wooden-crackshitsdestructions 25-cc0-mud-sfx 40-cc0-water-splash-slime-sfx 75-cc0-breaking-falling-hit-sfx stone-rock-or-wood-moved-sound moving-boulder 7-eating-crunches apple-bite rabbit-eating thwack-sounds bear-growls 80-cc0-creature-sfx group-giggling female-warrior-cheer 80-cc0-rpg-sfx birdcricketfrog-and-mosquito-sounds crunchy-bite tiny-vicious-creature dog-snarl-grunt-grumble wolf-monster-sound crow-caw meow cat-purr-meow kitten-mew ambient-bird-sounds bird-chirping-sounds park-ambiences water-waves wind wind1 crickets-ambient-noise-loopable swamp-environment-audio happy-halloween-group video-game-cheerful-ending applause-in-a-large-hall-or-church"
BSB="ducks-s0276 tawny-owl-1-s1763 tawny-owl-3-s3459 tawny-owl-4-s3460 barn-owl-s1400 long-eared-owl-1-s0936 cat-roar-1-s1881 cat-roar-2-s1882 cat-roar-3-s1883 cat-roar-4-s1884 mountain-stream-1-s2754 mountain-stream-4-s3217 mountain-stream-6-s3219 forest-and-stream-1-s2713 brooklet-s0864 small-stream-1-s0213 countryside-s0097 fields-of-rapeseed-s1350 awakening-birds-s0222 birds-waking-4-s1906 forest-3-s2715 forest-5-s3085 field-cricket-s1020 insect-song-s1052 nocturnal-insect-3-s0426 singing-insect-1-s3089"
for slug in $OGA; do
  d=$D/$slug; mkdir -p "$d"
  curl -sL -m 30 "https://opengameart.org/content/$slug" -o "$d/page.html"
  grep -o 'https://opengameart.org/sites/default/files/[^"]*' "$d/page.html" | grep -iv '\.css\|\.js\|\.png\|\.jpg\|\.jpeg\|\.gif\|/styles/\|/css/\|/js/' | sort -u | while read -r u; do curl -sL -m 300 -O --output-dir "$d" "$u"; done
  for z in "$d"/*.zip; do [ -f "$z" ] && unzip -qo "$z" -d "$d/x"; done
done
mkdir -p "$D/bsb"
for p in $BSB; do curl -sL -m 120 "https://bigsoundbank.com/UPLOAD/ogg/${p##*-s}.ogg" -o "$D/bsb/$p.ogg"; done
# Round 2 (stage_gaps.py): more BigSoundBank recordings for the effects round 1 left without a good clip.
GAP_BSB="splash-small-1-s1529 splash-small-2-s1530 splash-small-3-s1531 splash-small-4-s1532 splash-small-5-s1533 splash-small-6-s1534 splash-big-1-s1519 splash-big-2-s1520 splash-big-3-s1521 rowing-slowly-s1514 rowing-quickly-s1513 shoes-in-the-water-s0690 water-bubble-2-s0183 chainsaw-and-falling-tree-s2750 broken-twigs-1-s1299 broken-twigs-2-s1300 unloading-logs-s1441 steps-on-the-twigs-s1301 mouse-screams-s0459 chick-that-chirp-s0672 applause-about-25-50-people-1-s0812 shouts-and-applauses-of-teens-1-s0236 shouts-and-applauses-of-teens-2-s0237 laughter-of-children-s1660 parisian-park-children-games-s1082"
for p in $GAP_BSB; do curl -sL -m 120 "https://bigsoundbank.com/UPLOAD/ogg/${p##*-s}.ogg" -o "$D/bsb/$p.ogg"; done
# Round 3 (stage_gaps.py): pickup (suction), land slap (punch thuds) and fall gaps. Also by hand: PACKS/user/tree-falling-user.wav (the author's file),
# PACKS/oga/tree_falling.flac (Yo Frankie!, CC-BY 3.0), tree_creak.ogg (CC0, node 132362) and wood100/ (100-CC0-wood-metal-SFX.zip, CC0).
GAP3_BSB="punch-s2459 punch-s2460 punch-s2461 punch-s2463 punch-s2465 pop-s648 pop-s211 pop-s462 pop-s1074 pop-s137"
for p in $GAP3_BSB; do curl -sL -m 120 "https://bigsoundbank.com/UPLOAD/ogg/${p##*-s}.ogg" -o "$D/bsb/$p.ogg"; done
mkdir -p "$D/oga"
curl -sL -m 120 -o "$D/oga/tree_falling.flac" https://opengameart.org/sites/default/files/tree_falling.flac
curl -sL -m 120 -o "$D/oga/tree_creak.ogg" https://opengameart.org/sites/default/files/tree_creak.ogg
curl -sL -m 300 -o "$D/oga/wood100.zip" https://opengameart.org/sites/default/files/100-CC0-wood-metal-SFX.zip && unzip -qo "$D/oga/wood100.zip" -d "$D/oga/wood100"
# Freesound CC0 tree falls (the -hq.mp3 preview URL is on each page; the page shows CC0): people/Kinoton/sounds/494071, people/matt_beer/sounds/515313, people/ecfike/sounds/139952.
mkdir -p "$D/fs"
for pair in Kinoton/494071 matt_beer/515313 ecfike/139952; do
  id=${pair##*/}; curl -sL -m 30 -A "Mozilla/5.0" "https://freesound.org/people/${pair%/*}/sounds/$id/" -o "$D/fs/$id.html"
  curl -sL -m 60 -o "$D/fs/fs-$id.mp3" "$(grep -o 'https://cdn.freesound.org/previews/[^"]*-hq\.mp3' "$D/fs/$id.html" | head -1)"
done
