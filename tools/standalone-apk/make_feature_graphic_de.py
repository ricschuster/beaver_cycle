"""German feature graphic for the Play listing (#600).

Takes store/feature-graphic.png, paints the English title and tagline out of the water with the
water beside them (row by row), and sets the German ones in the same place. Needs Pillow and Noto Sans.

    python3 tools/standalone-apk/make_feature_graphic_de.py
"""
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

STORE = Path(__file__).parent / "store"
TITLE = "Biber-Kreislauf"
TAGLINE = "Ein Biberleben im Almtal"
BOLD = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"
CREAM = (253, 246, 227)
BOX = (10, 330, 690, 495)   # x0, y0, x1, y1 around the English text
DONOR = (672, 735)          # clean water columns at the same rows

img = Image.open(STORE / "feature-graphic.png").convert("RGB")
orig = np.array(img).astype(float)
a = orig.copy()
x0, y0, x1, y1 = BOX
rng = np.random.default_rng(1)
for y in range(y0, y1):
    row = orig[y, DONOR[0]:DONOR[1]]
    a[y, x0:x1] = np.median(row, axis=0) + rng.normal(0, 1.2, (x1 - x0, 3))
mask = Image.new("L", img.size, 0)
ImageDraw.Draw(mask).rectangle((x0 + 14, y0 + 10, x1 - 14, y1 - 10), fill=255)
m = np.array(mask.filter(ImageFilter.GaussianBlur(5))).astype(float)[..., None] / 255
img = Image.fromarray(np.clip(orig * (1 - m) + a * m, 0, 255).astype("uint8"))

shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
title_font = ImageFont.truetype(BOLD, 74)
tag_font = ImageFont.truetype(REG, 29)
for d in (sd,):
    d.text((50, 363), TITLE, font=title_font, fill=(0, 0, 0, 150))
    d.text((50, 447), TAGLINE, font=tag_font, fill=(0, 0, 0, 150))
shadow = shadow.filter(ImageFilter.GaussianBlur(3))
img = Image.alpha_composite(img.convert("RGBA"), shadow)
d = ImageDraw.Draw(img)
d.text((48, 361), TITLE, font=title_font, fill=CREAM)
d.text((48, 445), TAGLINE, font=tag_font, fill=CREAM)
(STORE / "de").mkdir(exist_ok=True)
img.convert("RGB").save(STORE / "de" / "feature-graphic.png", optimize=True)
