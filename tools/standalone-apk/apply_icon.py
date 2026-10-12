#!/usr/bin/env python3
"""Copy the app icon into the generated Android project.

The generated `android/` folder is untracked, so `npx cap add android` brings back the stock Capacitor icon. Run this after it:

    python3 tools/standalone-apk/apply_icon.py

`icon/mipmap-*` holds the original beaver icon (the legacy, round, and adaptive foreground PNGs of the first standalone build,
taken from the APK installed on a tablet, as the script that drew it was never committed). The adaptive icon's background is the
flat colour below. No dependencies beyond Python 3.
"""
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
RES = HERE / "android" / "app" / "src" / "main" / "res"
BACKGROUND = "#7EC4D6"


def main() -> int:
    if not RES.exists():
        print("no android/ project yet (run npx cap add android first)")
        return 1
    folders = sorted((HERE / "icon").glob("mipmap-*"))
    for folder in folders:
        target = RES / folder.name
        target.mkdir(exist_ok=True)
        for png in folder.glob("*.png"):
            shutil.copy2(png, target / png.name)
    (RES / "values" / "ic_launcher_background.xml").write_text(
        f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{BACKGROUND}</color>\n</resources>\n'
    )
    print(f"copied {len(folders)} densities and the background colour to {RES}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
