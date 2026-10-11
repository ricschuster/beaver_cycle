#!/usr/bin/env python3
"""Stage CC0 recordings as candidates for the one-shot effects, so the sound preview page can play them next to the synth.

usage: stage_candidates.py PACKS_DIR   (PACKS_DIR holds one folder per OpenGameArt page, each with its files unpacked in x/)
Writes mono OGG files and index.json to public/audio-candidates/ (untracked). Nothing here goes into the game until it is chosen.
"""
import json, re, subprocess, sys
from pathlib import Path

PACKS = Path(sys.argv[1])
OUT = Path(__file__).resolve().parents[2] / "public" / "audio-candidates"

BFH = "75-cc0-breaking-falling-hit-sfx/x/bfh1_"
RPG = "80-cc0-rpg-sfx/x/"
CRE = "80-cc0-creature-sfx/x/"
MUD = "25-cc0-mud-sfx/x/mud_"
SPL = "40-cc0-water-splash-slime-sfx/x/"
CRUNCH = "7-eating-crunches/x/crunch."
BSB = "bsb/"

# effect -> list of (file under PACKS, optional (start, length) in seconds)
C = {
    "chop": [("tree-chop-fall-thud/chop-tree-fall.ogg", (0, 0.6)), (BFH + "wood_hit_01.ogg",), (BFH + "wood_hit_02.ogg",), (RPG + "wood_01.ogg",), (RPG + "wood_02.ogg",),
             ("apple-bite/apple_bite_0.ogg",), (CRUNCH + "4.ogg",), ("rabbit-eating/RabbitEating.wav", (1.0, 1.2))],
    "fall": [("tree-chop-fall-thud/chop-tree-fall.ogg",), (BFH + "wood_falling_01.ogg",), (BFH + "wood_falling_02.ogg",), (BFH + "wood_breaking_03.ogg",), (BFH + "wood_breaking_01.ogg",)],
    "splash": [(SPL + f"splash_{n:02d}.ogg",) for n in (1, 2, 3, 4, 5, 8, 12)],
    "slap": [(f"thwack-sounds/x/PCM/thwack-{n:02d}.wav",) for n in (3, 5, 7, 9)] + [(SPL + "splash_10.ogg",), (SPL + "splash_09.ogg",)],
    "stroke": [(SPL + f"splash_{n:02d}.ogg",) for n in (6, 14, 15)] + [(SPL + f"bubble_0{n}.ogg",) for n in (1, 2, 3)],
    "eat": [(CRUNCH + f"{n}.ogg",) for n in (1, 3, 5, 6)] + [(CRE + f"eat_0{n}.ogg",) for n in (1, 2, 3)] + [("apple-bite/apple_bite_0.ogg",)],
    "pickup": [(RPG + f"item_wood_0{n}.ogg",) for n in (1, 2, 3)] + [(RPG + "wood_02.ogg",), (BFH + "misc_05.ogg",)],
    "setdown": [(BFH + f"wood_hit_0{n}.ogg",) for n in (1, 2, 3)] + [(RPG + "wood_03.ogg",), (RPG + "stones_04.ogg",)],
    "wood": [(RPG + f"wood_0{n}.ogg",) for n in (1, 3, 4, 5)] + [(BFH + "wood_falling_02.ogg",), (RPG + "item_wood_01.ogg",)],
    "mud": [(MUD + f"{n:02d}.ogg",) for n in (1, 5, 9, 13, 17, 21)] + [(SPL + f"slime_0{n}.ogg",) for n in (1, 4)],
    "rock": [(BFH + f"rock_falling_0{n}.ogg",) for n in (1, 4, 6, 8)] + [(BFH + "rock_hit_01.ogg",), (RPG + "stones_01.ogg",), (RPG + "item_stone_02.ogg",), ("moving-boulder/boulder_drop_0.ogg",)],
    "done": [(RPG + f"item_gem_0{n}.ogg",) for n in (1, 3, 4)] + [(RPG + "spell_01.ogg",), (RPG + "item_misc_06.ogg",)],
    "yap": [(CRE + "barking_01.ogg",), (CRE + "barking_02.ogg",), (CRE + "cute_03.ogg",)],
    "growl": [(CRE + f"roar_0{n}.ogg",) for n in (1, 2, 3)] + [(CRE + "grunt_01.ogg",), (CRE + "monster_03.ogg",)],
    "rumble": [("bear-growls/x/ogg/bear_01.ogg",), ("bear-growls/x/ogg/bear_02.ogg",)],
    "hurt": [(CRE + f"hurt_0{n}.ogg",) for n in (1, 2, 3, 4, 5)] + [(RPG + "creature_hurt_01.ogg",)],
    "giggle": [("group-giggling/group_giggling.ogg", (0, 2.2))] + [(CRE + f"cute_0{n}.ogg",) for n in (1, 5, 9)],
    "hoot": [(BSB + "tawny-owl-3-s3459.ogg",), (BSB + "tawny-owl-4-s3460.ogg",), (BSB + "tawny-owl-1-s1763.ogg", "auto", 3), (BSB + "long-eared-owl-1-s0936.ogg", "auto", 2)],
    "quack": [(BSB + "ducks-s0276.ogg", "auto", 5)],
}
# More for the effects above: the new finds go on the end of their lists.
C["chop"] += [("crunchy-bite/crunchybite_0.ogg",), ("tiny-vicious-creature/tiny-vicious-creature_0.ogg", "auto", 3)]
C["yap"] += [("wolf-monster-sound/wolf_monster_6.mp3",), ("crow-caw/crow_caw.wav",)]
C["growl"] = [(BSB + f"cat-roar-{n}-s188{n}.ogg",) for n in (1, 2, 3, 4)] + C["growl"]
C["hurt"] += [("kitten-mew/kitten_mew-1_0.ogg",), ("meow/Meow.ogg",)]
C["cheer"] = [("video-game-cheerful-ending/childrens_game_app_ending.mp3",), ("happy-halloween-group/happy_halloween.ogg",), ("group-giggling/group_giggling.ogg", (2.5, 2.5))]

# Ambient layers: (file, start s, length s). A loop is cut from the middle of a long recording and its end is cross faded into its
# start, so it joins without a click. The rest of the ambient layers is below.
L = {
    "layer:water": [(BSB + f, 40, 24) for f in ("mountain-stream-1-s2754.ogg", "mountain-stream-4-s3217.ogg", "mountain-stream-6-s3219.ogg", "forest-and-stream-1-s2713.ogg", "brooklet-s0864.ogg", "small-stream-1-s0213.ogg")] + [("park-ambiences/park_ambience_river.wav", 60, 24)],
    "layer:wind": [("wind1/wind1.wav", 10, 24), ("wind1/wind3.wav", 10, 24), (BSB + "countryside-s0097.ogg", 20, 24), (BSB + "fields-of-rapeseed-s1350.ogg", 40, 24)],
    "layer:birds": [(BSB + "awakening-birds-s0222.ogg", 20, 24), (BSB + "birds-waking-4-s1906.ogg", 60, 24), (BSB + "forest-3-s2715.ogg", 30, 24), (BSB + "forest-5-s3085.ogg", 20, 24), ("ambient-bird-sounds/birds-isaiah658_0.ogg", 2, 24), ("park-ambiences/park_ambience_birds.wav", 60, 24)],
    "layer:crickets": [(BSB + "field-cricket-s1020.ogg", 3, 20), (BSB + "insect-song-s1052.ogg", 1, 20), (BSB + "nocturnal-insect-3-s0426.ogg", 1, 20), (BSB + "singing-insect-1-s3089.ogg", 3, 22), ("crickets-ambient-noise-loopable/crickets_1.mp3", 0, 11)],
    "layer:owl": [(BSB + "barn-owl-s1400.ogg", 0, 19), (BSB + "tawny-owl-1-s1763.ogg", 0, 8.4), (BSB + "long-eared-owl-1-s0936.ogg", 0, 24)],
}

def bursts(src, n):
    """The first `n` stretches of sound (0.15 to 2 s) in a recording, found by its silences, as (start, length)."""
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", str(src), "-af", "silencedetect=n=-32dB:d=0.12", "-f", "null", "-"], capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r)]
    # Sound runs from a silence end to the next silence start.
    out = []
    for e, st in zip(ends, starts[1:] + [1e9]):
        if 0.15 <= st - e <= 2.5:
            out.append((max(0, e - 0.03), min(st - e + 0.1, 2.0)))
        if len(out) == n:
            break
    return out


OUT.mkdir(parents=True, exist_ok=True)
index = {}
for effect, items in C.items():
    expanded = []
    for item in items:
        if len(item) == 3 and item[1] == "auto" and (PACKS / item[0]).exists():
            expanded += [(item[0], b) for b in bursts(PACKS / item[0], item[2])]
        else:
            expanded.append(item)
    for item in expanded:
        src = PACKS / item[0]
        if not src.exists():
            print("missing", src)
            continue
        name = f"{effect}-{len(index.get(effect, [])) + 1}-{src.stem}.ogg"
        cmd = ["ffmpeg", "-v", "error", "-y"]
        if len(item) > 1:
            cmd += ["-ss", str(item[1][0]), "-t", str(item[1][1])]
        # Mono, 44.1 kHz, peak normalised to -3 dB so the candidates are comparable.
        cmd += ["-i", str(src), "-ac", "1", "-ar", "44100", "-af", "loudnorm=I=-20:TP=-3", "-c:a", "libvorbis", "-q:a", "4", str(OUT / name)]
        subprocess.run(cmd, check=True)
        index.setdefault(effect, []).append({"file": name, "source": item[0].split("/")[0] + "/" + src.name})
X = 1.5  # seconds of cross fade
for layer, items in L.items():
    for f, start, length in items:
        src = PACKS / f
        if not src.exists():
            print("missing", src)
            continue
        name = f"{layer.split(':')[1]}-{len(index.get(layer, [])) + 1}-{src.stem}.ogg"
        # mid + (tail cross faded into head): the end then carries on into the start.
        filt = (f"atrim=start={start}:duration={length},asetpts=PTS-STARTPTS,asplit=3[a][b][c];"
                f"[a]atrim=start={X}:end={length - X},asetpts=PTS-STARTPTS[mid];[b]atrim=start={length - X},asetpts=PTS-STARTPTS[tail];[c]atrim=end={X},asetpts=PTS-STARTPTS[head];"
                f"[tail][head]acrossfade=d={X}[x];[mid][x]concat=n=2:v=0:a=1,loudnorm=I=-24:TP=-3")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-filter_complex", filt, "-ac", "1", "-ar", "32000", "-c:a", "libvorbis", "-q:a", "2", str(OUT / name)], check=True)
        index.setdefault(layer, []).append({"file": name, "source": f.split("/")[0] + "/" + src.name, "loop": True})
(OUT / "index.json").write_text(json.dumps(index, indent=1))
print(sum(len(v) for v in index.values()), "files in", OUT)
