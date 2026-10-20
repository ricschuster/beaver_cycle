#!/usr/bin/env python3
"""Copy our own MainActivity into the generated Android project.

The generated `android/` folder is untracked, so `npx cap add android` brings back the stock MainActivity. Run this after it, like
`apply_icon.py`:

    python3 tools/standalone-apk/apply_shell.py [--host]

`shell/MainActivity.java` hides the status bar and the navigation bar, so the game fills the screen. With `--host` it also adds the
HostServer plugin (tools/host-server, ADR 0014) and the INTERNET permission, so this tablet can host a game for friends and the Host
button of Settings shows. The Play bundle is built without `--host`: it has no networking. No dependencies beyond Python 3.
"""
import re
import shutil
import subprocess
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
    if "--host" in sys.argv[1:]:
        android = HERE / "android"
        subprocess.run(["sh", str(HERE.parent / "host-server" / "apply.sh"), str(android)], check=True)
        manifest = android / "app" / "src" / "main" / "AndroidManifest.xml"
        text = manifest.read_text()
        if "android.permission.INTERNET" not in text:
            text = re.sub(r"(\s*)</manifest>", r'\1    <uses-permission android:name="android.permission.INTERNET" />\1</manifest>', text)
            manifest.write_text(text)
            print("added the INTERNET permission")
    return 0


if __name__ == "__main__":
    sys.exit(main())
