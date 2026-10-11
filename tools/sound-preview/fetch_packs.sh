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
