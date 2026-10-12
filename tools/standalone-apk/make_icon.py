#!/usr/bin/env python3
"""Draw the app icon (a beaver face with its chin in the water) and put it into the generated Android project.

The generated `android/` folder is untracked, so `npx cap add android` brings back the stock Capacitor icon. Run this after it:

    python3 tools/standalone-apk/make_icon.py            # writes icon/ and the mipmaps of android/
    python3 tools/standalone-apk/make_icon.py --no-apply # writes icon/ only

Needs Pillow. `icon/foreground.png` (the adaptive icon layer, 1080 px) and `icon/icon.png` (the whole icon, 1024 px) are kept in
the repo, so the icon survives a rebuilt `android/`, and also serve the Play Store listing (512 px icon: resize `icon/icon.png`).
"""
import argparse
import math
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
RES = HERE / "android" / "app" / "src" / "main" / "res"

SKY = (214, 238, 247)
FUR = (192, 112, 56)
FUR_DARK = (150, 82, 36)
FACE = (236, 200, 154)
WATER = (44, 172, 220)
WATER_LIGHT = (120, 210, 238)
EYE = (30, 24, 24)
TOOTH = (255, 255, 252)
TOOTH_EDGE = (200, 160, 130)

SIZE = 1080  # the adaptive icon layer is 108 dp; the safe zone is the middle 66 percent
SCALE = 3  # supersampling


def foreground() -> Image.Image:
    """The beaver face and the water, on a transparent layer."""
    s = SIZE * SCALE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def px(v: float) -> float:
        return v * SCALE

    def ellipse(cx: float, cy: float, rx: float, ry: float, fill, outline=None, width=0) -> None:
        d.ellipse([px(cx - rx), px(cy - ry), px(cx + rx), px(cy + ry)], fill=fill, outline=outline, width=int(px(width)))

    cx, cy = 540, 500
    # Ears, round, with a darker inside.
    for sign in (-1, 1):
        ellipse(cx + sign * 190, cy - 190, 82, 82, FUR)
        ellipse(cx + sign * 190, cy - 190, 46, 46, FUR_DARK)
    # Head.
    ellipse(cx, cy, 262, 238, FUR)
    # Muzzle.
    ellipse(cx, cy + 90, 148, 118, FACE)
    # Eyes, with a small glint.
    for sign in (-1, 1):
        ellipse(cx + sign * 108, cy - 18, 30, 34, EYE)
        ellipse(cx + sign * 108 + 9, cy - 30, 10, 10, (255, 255, 255))
    # Nose.
    ellipse(cx, cy + 52, 36, 26, EYE)
    # The two front teeth.
    for sign in (-1, 1):
        x0 = cx - 44 if sign < 0 else cx + 4
        d.rounded_rectangle([px(x0), px(cy + 92), px(x0 + 40), px(cy + 178)], radius=px(10), fill=TOOTH, outline=TOOTH_EDGE, width=int(px(4)))
    # Water over the chin: a band with a wavy top edge, and light wave lines.
    top = 760
    pts = [(px(x), px(top + 14 * math.sin(x / 70.0))) for x in range(-20, SIZE + 40, 10)]
    d.polygon(pts + [(px(SIZE + 40), px(SIZE + 40)), (px(-20), px(SIZE + 40))], fill=WATER)
    for k, y in enumerate((835, 905, 975)):
        line = [(px(x), px(y + 8 * math.sin(x / 55.0 + k))) for x in range(-20, SIZE + 40, 10)]
        d.line(line, fill=WATER_LIGHT, width=int(px(9)), joint="curve")
    return img.resize((SIZE, SIZE), Image.LANCZOS)


def composite(fg: Image.Image) -> Image.Image:
    bg = Image.new("RGBA", fg.size, SKY + (255,))
    return Image.alpha_composite(bg, fg)


def legacy(fg: Image.Image, px_size: int, round_: bool) -> Image.Image:
    """The icon of Android before 8: the middle 72 dp of the 108 dp layer, in a rounded square or a circle."""
    full = composite(fg)
    margin = int(SIZE * 18 / 108)
    crop = full.crop((margin, margin, SIZE - margin, SIZE - margin)).resize((px_size, px_size), Image.LANCZOS)
    mask = Image.new("L", (px_size * 4, px_size * 4), 0)
    md = ImageDraw.Draw(mask)
    box = [0, 0, px_size * 4 - 1, px_size * 4 - 1]
    if round_:
        md.ellipse(box, fill=255)
    else:
        md.rounded_rectangle(box, radius=int(px_size * 4 * 0.22), fill=255)
    out = crop.copy()
    out.putalpha(mask.resize((px_size, px_size), Image.LANCZOS))
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-apply", action="store_true", help="write icon/ only, leave android/ alone")
    args = parser.parse_args()

    fg = foreground()
    out = HERE / "icon"
    out.mkdir(exist_ok=True)
    fg.save(out / "foreground.png")
    legacy(fg, 1024, False).save(out / "icon.png")
    print("wrote", out)
    if args.no_apply:
        return
    if not RES.exists():
        print("no android/ project yet (npx cap add android), only icon/ was written")
        return
    # Density: legacy icon px, adaptive layer px (48 dp and 108 dp).
    for name, legacy_px, layer_px in (("mdpi", 48, 108), ("hdpi", 72, 162), ("xhdpi", 96, 216), ("xxhdpi", 144, 324), ("xxxhdpi", 192, 432)):
        folder = RES / f"mipmap-{name}"
        folder.mkdir(exist_ok=True)
        legacy(fg, legacy_px, False).save(folder / "ic_launcher.png")
        legacy(fg, legacy_px, True).save(folder / "ic_launcher_round.png")
        fg.resize((layer_px, layer_px), Image.LANCZOS).save(folder / "ic_launcher_foreground.png")
    color = RES / "values" / "ic_launcher_background.xml"
    color.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#%02X%02X%02X</color>\n</resources>\n' % SKY
    )
    print("applied to", RES)


if __name__ == "__main__":
    main()
