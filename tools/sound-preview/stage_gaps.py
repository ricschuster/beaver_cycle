#!/usr/bin/env python3
"""Stage a second round of CC0 candidates (BigSoundBank only) for the effects the first round left without a good clip.

usage: stage_gaps.py PACKS_DIR   (PACKS_DIR/bsb/ holds the recordings, see GAP_BSB in fetch_packs.sh)
Adds to public/audio-candidates/index.json (run stage_candidates.py first); files already staged are kept, so earlier ratings stay valid.
Each clip is cut around a loud hit found in the recording: `hits(file, n, length)` gives the n loudest, spaced at least `length` apart.
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np

PACKS = Path(sys.argv[1])
OUT = Path(__file__).resolve().parents[2] / "public" / "audio-candidates"
BSB = "bsb/"
RATE = 16000

# effect -> list of (file, ("hits", n, length) or ("cut", start, length))
G = {
    "slapwater": [(BSB + f"splash-small-{k}-s{1528 + k}.ogg", ("hits", 1, 0.8)) for k in (1, 2, 3, 4, 5, 6)],
    "splash": [(BSB + f"splash-big-{k}-s{1518 + k}.ogg", ("hits", 1, 1.4)) for k in (1, 2, 3)],
    "stroke": [(BSB + "rowing-slowly-s1514.ogg", ("hits", 4, 0.6)), (BSB + "shoes-in-the-water-s0690.ogg", ("hits", 3, 0.5)), (BSB + "water-bubble-2-s0183.ogg", ("hits", 2, 0.4))],
    "fall": [(BSB + "chainsaw-and-falling-tree-s2750.ogg", ("cut", 20.6, 1.9)), (BSB + "broken-twigs-2-s1300.ogg", ("cut", 0, 1.2)), (BSB + "broken-twigs-1-s1299.ogg", ("hits", 2, 1.0))],
    "setdown": [(BSB + "unloading-logs-s1441.ogg", ("hits", 6, 0.5)), (BSB + "steps-on-the-twigs-s1301.ogg", ("hits", 2, 0.4))],
    "hurt": [(BSB + "mouse-screams-s0459.ogg", ("hits", 6, 0.5)), (BSB + "chick-that-chirp-s0672.ogg", ("hits", 2, 0.4))],
    "cheer": [(BSB + "shouts-and-applauses-of-teens-1-s0236.ogg", ("hits", 1, 1.8)), (BSB + "shouts-and-applauses-of-teens-2-s0237.ogg", ("hits", 1, 1.8)),
              (BSB + "laughter-of-children-s1660.ogg", ("hits", 1, 1.5)), (BSB + "parisian-park-children-games-s1082.ogg", ("hits", 3, 1.5)),
              (BSB + "applause-about-25-50-people-1-s0812.ogg", ("cut", 0, 2.0))],
}


def hits(src, n, length, pre=0.05):
    """(start, length) of the n loudest hits, found on a 20 ms RMS curve and spaced at least `length` seconds apart."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(src), "-ac", "1", "-ar", str(RATE), "-f", "f32le", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    step = RATE // 50
    rms = np.sqrt(np.convolve(x * x, np.ones(step) / step, "same"))[::step]
    out = []
    order = np.argsort(rms)[::-1]
    for i in order:
        t = i * 0.02
        if all(abs(t - s) >= length for s, _ in out):
            out.append((t, 0))
        if len(out) == n:
            break
    cuts = []
    for t, _ in sorted(out):
        # Walk back to where the hit starts: the last frame below a quarter of its peak.
        j = int(t / 0.02)
        while j > 0 and rms[j] > rms[int(t / 0.02)] * 0.25:
            j -= 1
        cuts.append((max(0.0, j * 0.02 - pre), length))
    return [c for k, c in enumerate(cuts) if all(abs(c[0] - d[0]) > 0.1 for d in cuts[:k])]


index = json.loads((OUT / "index.json").read_text())
for effect, items in G.items():
    for f, how in items:
        src = PACKS / f
        if not src.exists():
            print("missing", src)
            continue
        cuts = hits(src, how[1], how[2]) if how[0] == "hits" else [(how[1], how[2])]
        for start, length in cuts:
            name = f"{effect}-{len(index.get(effect, [])) + 1}-{src.stem}.ogg"
            if any(c["file"] == name for c in index.get(effect, [])):
                continue
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.3f}", "-t", f"{length:.3f}", "-i", str(src), "-ac", "1", "-ar", "44100",
                            "-af", f"afade=t=out:st={max(0, length - 0.06):.3f}:d=0.06,loudnorm=I=-20:TP=-3", "-c:a", "libvorbis", "-q:a", "4", str(OUT / name)], check=True)
            index.setdefault(effect, []).append({"file": name, "source": "bsb/" + src.name, "at": round(start, 2)})
(OUT / "index.json").write_text(json.dumps(index, indent=1))
print(sum(len(v) for v in index.values()), "files in", OUT)
