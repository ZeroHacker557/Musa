"""
Oq fonli mahsulot rasmidan shaffof PNG (Instagram postlari uchun).

    python scripts/cutout.py public/insta/322842.png ...  →  public/insta/cut/322842.png

Chetga tutashgan oq/och kulrang hudud fon deb olinadi (ichki oq joylar
saqlanadi), chegarasi yumshatiladi. Ortiqcha bo'sh joy qirqiladi.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

THRESH = 228  # shundan och piksel — fon nomzodi


def cutout(src: Path, dst: Path) -> None:
    img = Image.open(src).convert('RGB')
    a = np.asarray(img).astype(np.int16)
    light = (a.min(axis=2) > THRESH) & ((a.max(axis=2) - a.min(axis=2)) < 22)
    mask = Image.fromarray(np.where(light, 255, 0).astype(np.uint8), 'L')
    # Chetga 1 px ramka — hamma chetdagi oq hudud bitta to'ldirish bilan topiladi
    pad = Image.new('L', (mask.width + 2, mask.height + 2), 255)
    pad.paste(mask, (1, 1))
    ImageDraw.floodfill(pad, (0, 0), 128)
    bg = np.asarray(pad)[1:-1, 1:-1] == 128
    alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8), 'L')
    # Chegarani 1 px ichkariga olib, yumshatamiz (oq hoshiya qolmasin)
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.1))
    out = img.convert('RGBA')
    out.putalpha(alpha)
    box = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
    if box:
        out = out.crop(box)
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst, optimize=True)
    print(src.name, '->', dst.name, out.size)


for arg in sys.argv[1:]:
    p = Path(arg)
    cutout(p, p.parent / 'cut' / (p.stem + '.png'))
