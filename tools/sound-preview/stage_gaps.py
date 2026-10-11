#!/usr/bin/env python3
"""Stage later rounds of CC0 candidates (BigSoundBank only) for the effects the first round left without a good clip. The current round is ROUND below.

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

ROUND = 5
# effect -> list of (file, ("hits", n, length) or ("cut", start, length)). Round 5 (earlier rounds are staged already, see git history): `babble`,
# a murmur per line of dialog, second try (round 4 baby babbles all rated wrong): a cockatiel chattering, hens clucking, a cat's mews. 1 s cuts,
# the game plays 0.5 to 2.4 s. BigSoundBank, see GAP5_BSB in fetch_packs.sh. Round 4 was `chirp`, now settled.
G = {
    "babble": [(BSB + f, ("hits", n, 1.0)) for f, n in ((f"cockatiel-parakeet-{k}-s{2768 + k}.ogg", 2) for k in range(1, 9))]
              + [(BSB + f, ("hits", n, 1.0)) for f, n in (("hens-worried-s1039.ogg", 3), ("hen-lays-1-s0975.ogg", 2), ("hen-lays-3-s0977.ogg", 2), ("hens-lays-s0978.ogg", 2),
                                                           ("hen-imitated-to-the-mouth-1-s2203.ogg", 3), ("hen-imitated-to-the-mouth-2-s2204.ogg", 3),
                                                           ("cat-complaining-s0658.ogg", 3), ("cat-meow-made-with-mouth-s0926.ogg", 3), ("australian-aviary-of-thoiry-zoo-1-s1164.ogg", 3))],
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
            if any(c.get("source") == f and c.get("at") == round(start, 2) for c in index.get(effect, [])):
                continue
            name = f"{effect}-{len(index.get(effect, [])) + 1}-{src.stem}.ogg"
            if any(c["file"] == name for c in index.get(effect, [])):
                continue
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.3f}", "-t", f"{length:.3f}", "-i", str(src), "-ac", "1", "-ar", "44100",
                            "-af", f"afade=t=out:st={max(0, length - 0.06):.3f}:d=0.06,loudnorm=I=-20:TP=-3", "-c:a", "libvorbis", "-q:a", "4", str(OUT / name)], check=True)
            index.setdefault(effect, []).append({"file": name, "source": f, "at": round(start, 2), "round": ROUND})
(OUT / "index.json").write_text(json.dumps(index, indent=1))
print(sum(len(v) for v in index.values()), "files in", OUT)
