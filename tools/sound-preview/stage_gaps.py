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

# effect -> list of (file, ("hits", n, length) or ("cut", start, length)). Round 3 (round 2 is staged already, see git history); stroke, cheer, quack and slapwater have enough oks, so none.
G = {
    # `fall`: the author's own tree fall (PACKS/user/tree-falling-user.wav, a video's sound, ffmpeg -vn -ac 1 -ar 44100; fall-17 is the lean, 0.1 s,
    # the sound they want), Yo Frankie! tree_falling.flac (CC-BY 3.0: the lean from 0.5 s, the crown touches down near 3 s, the trunk lands at 8.8 s),
    # Freesound CC0 previews (494071 Kinoton, 515313 matt_beer, 139952 ecfike; mp3 previews in PACKS/fs/), the CC0 tree creak, and CC0 wood falling sounds.
    "fall": [("user/tree-falling-user.wav", ("cut", 0.1, 1.5)),
             ("oga/tree_falling.flac", ("cut", 0.5, 3.2)), ("oga/tree_falling.flac", ("cut", 2.4, 1.6)), ("oga/tree_falling.flac", ("cut", 8.5, 1.5)),
             ("oga/tree_creak.ogg", ("cut", 0, 2.0)), ("oga/tree_creak.ogg", ("cut", 2.0, 2.0))]
            + [("fs/fs-494071.mp3", ("cut", st, ln)) for st, ln in ((2.8, 2.6), (4.3, 1.3))]
            + [("fs/fs-515313.mp3", ("cut", st, ln)) for st, ln in ((1.3, 2.6), (2.8, 1.6))]
            + [("fs/fs-139952.mp3", ("cut", 0.6, 1.6))]
            + [(f"oga/wood100/wood_falling_0{k}.ogg", ("cut", 0, 1.2)) for k in (1, 2, 3)],
    # `pickup` (suction did not work): a pop (cork, bubbles), a paw on twigs or leaves, and a rising "bloop" made here with ffmpeg (see BLOOPS).
    "pickup": [(BSB + "pop-s648.ogg", ("hits", 1, 0.4)), (BSB + "pop-s211.ogg", ("hits", 1, 0.4)), (BSB + "pop-s462.ogg", ("hits", 3, 0.3)),
               (BSB + "pop-s1074.ogg", ("hits", 3, 0.3)), (BSB + "steps-on-the-twigs-s1301.ogg", ("hits", 3, 0.3)), (BSB + "pop-s137.ogg", ("hits", 3, 0.3))],
    # A tail slap on land: a short thud.
    "slap": [(BSB + f"punch-s{n}.ogg", ("hits", 1, 0.5)) for n in (2459, 2460, 2461, 2463, 2465)],
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


# Rising bloops, a sine that sweeps up with a fast fade: (start Hz, end Hz, seconds). Made here, so no source file.
BLOOPS = [(300, 700, 0.12), (400, 900, 0.15), (250, 550, 0.18)]
for f0, f1, sec in BLOOPS:
    name = f"pickup-bloop-{f0}-{f1}.ogg"
    if not (OUT / name).exists():
        k = (f1 - f0) / sec
        expr = f"sin(2*PI*({f0}*t+{k}*t*t/2))*exp(-t*{4 / sec})*0.8"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"aevalsrc={expr}:d={sec}:s=44100", "-af", "loudnorm=I=-20:TP=-3", "-c:a", "libvorbis", "-q:a", "4", str(OUT / name)], check=True)
        json.loads((OUT / "index.json").read_text())
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
            index.setdefault(effect, []).append({"file": name, "source": f, "at": round(start, 2), "round": 3})
for f0, f1, sec in BLOOPS:
    name = f"pickup-bloop-{f0}-{f1}.ogg"
    if not any(c["file"] == name for c in index.get("pickup", [])):
        index.setdefault("pickup", []).append({"file": name, "source": "made with ffmpeg", "round": 3})
(OUT / "index.json").write_text(json.dumps(index, indent=1))
print(sum(len(v) for v in index.values()), "files in", OUT)
