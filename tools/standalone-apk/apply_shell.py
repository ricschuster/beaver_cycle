#!/usr/bin/env python3
"""Copy our own MainActivity into the generated Android project.

The generated `android/` folder is untracked, so `npx cap add android` brings back the stock MainActivity. Run this after it, like
`apply_icon.py`:

    python3 tools/standalone-apk/apply_shell.py

`shell/MainActivity.java` hides the status bar and the navigation bar, so the game fills the screen. No dependencies beyond Python 3.
"""
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TARGET = HERE / "android" / "app" / "src" / "main" / "java" / "com" / "beavercycle" / "game"


def main() -> int:
    if not TARGET.exists():
        print("no android/ project yet (run npx cap add android first)")
        return 1
    shutil.copy2(HERE / "shell" / "MainActivity.java", TARGET / "MainActivity.java")
    print(f"copied MainActivity.java to {TARGET}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
