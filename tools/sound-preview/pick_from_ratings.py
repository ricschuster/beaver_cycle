#!/usr/bin/env python3
"""Turn the author's ratings into the game's recordings: copy every clip rated ok to public/audio/ and write public/audio/manifest.json.

usage: pick_from_ratings.py RATINGS.md [MORE.md ...]   (the markdown the sound preview page exports; later files win for the same clip)
An effect or layer with at least one ok clip plays those clips (one picked at random per play); the others stay made in code.
The staged candidates must be in public/audio-candidates/ (stage_candidates.py, stage_gaps.py). Prints the size, the budget is 5 MB.
"""
import json, re, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "public" / "audio-candidates"
OUT = ROOT / "public" / "audio"
LAYERS = {"water", "wind", "birds", "crickets", "owl"}

rating = {}
for f in sys.argv[1:]:
    for line in Path(f).read_text().splitlines():
        m = re.match(r"\|\s*cand:(\S+)\s*\|\s*(\w+)\s*\|", line)
        if m:
            rating[m.group(1)] = m.group(2)

chosen = sorted(f for f, r in rating.items() if r == "ok")
manifest = {"effects": {}, "layers": {}}
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)
for f in chosen:
    if not (SRC / f).exists():
        print("missing", f)
        continue
    group = f.split("-")[0]
    key = "layers" if group in LAYERS else "effects"
    manifest[key].setdefault(group, []).append(f)
    shutil.copy(SRC / f, OUT / f)
(OUT / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n")
size = sum(p.stat().st_size for p in OUT.iterdir())
print(f"{len(chosen)} clips, {size / 1e6:.1f} MB in {OUT}")
for key in manifest:
    for g, files in manifest[key].items():
        print(f"  {key[:-1]:6} {g}: {len(files)}")
