#!/usr/bin/env python3
"""Stage CC0 music candidates for the valley (#520): download from OpenGameArt, check each page says CC0, convert to Ogg Vorbis.

usage: stage_music.py WORK_DIR   (downloads land in WORK_DIR, outside the repo)
Writes public/audio-candidates/music/*.ogg and music/index.json (untracked, like the other candidates), which /tools/music-clips/ lists to rate.
The name found on the page is the submitter, who is not always the composer: read the composer from the page before it goes in CREDITS.md.
Pages are fetched again on every run, so a licence change on OpenGameArt shows up as a refusal here.
"""
import json, re, subprocess, sys, urllib.parse, urllib.request
from pathlib import Path

WORK = Path(sys.argv[1])
OUT = Path(__file__).resolve().parents[2] / "public" / "audio-candidates" / "music"
OGA = "https://opengameart.org"
MAX_SECONDS = 240
KBPS = 96

# The four the author rated ok (session 130): spring, summer, autumn, winter. The other nine were rated wrong.
# OpenGameArt page slug -> the file to take when the page offers several (None: the first audio file).
PAGES = {
    "sunset-plains": None, "summers": None, "another-august": None, "november-snow": None,
}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=120).read()


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    for slug, want in PAGES.items():
        html = get(f"{OGA}/content/{slug}").decode("utf8", "replace")
        if "creativecommons.org/publicdomain/zero/1.0" not in html:
            print("skip, not CC0:", slug)
            continue
        title = re.search(r"<title>([^<|]*)", html).group(1).strip()
        author = (re.search(r'class="username"[^>]*>([^<]+)<', html) or re.search(r"/users/[^\"]*\"[^>]*>([^<]+)<", html))
        files = re.findall(r'href="(https://opengameart.org/sites/default/files/[^"]*\.(?:ogg|mp3|wav|flac))"', html)
        files = list(dict.fromkeys(files))
        if want:
            files = [f for f in files if want in f] or files
        if not files:
            print("skip, no audio file:", slug)
            continue
        src = WORK / Path(urllib.parse.unquote(files[0])).name
        if not src.exists():
            src.write_bytes(get(files[0]))
        dst = OUT / f"{slug}.ogg"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-t", str(MAX_SECONDS), "-c:a", "libvorbis", "-b:a", f"{KBPS}k", str(dst)], check=True)
        secs = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(dst)], capture_output=True, text=True).stdout)
        index.append({"file": f"music/{slug}.ogg", "title": title, "submitter": author.group(1).strip() if author else "?", "page": f"{OGA}/content/{slug}",
                      "licence": "CC0 1.0", "seconds": round(secs), "kb": round(dst.stat().st_size / 1024)})
        print(f"{slug:24} {secs:5.0f} s {dst.stat().st_size // 1024:5} kB  {index[-1]["submitter"]}")
    (OUT / "index.json").write_text(json.dumps(index, indent=1))
    print("total kB", sum(i["kb"] for i in index))


main()
