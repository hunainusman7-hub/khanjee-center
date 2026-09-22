#!/usr/bin/env python3
"""Take a flat folder of catalogue photographs named <design>+<n>.jpg and produce the
same web-ready set the PDF extractor produces: full-width WebP, a 4:5 card crop, and
one numbered contact sheet per design."""
import json, os, re, sys
from PIL import Image, ImageDraw

SRC = sys.argv[1]; OUT = sys.argv[2]; BRAND = sys.argv[3]
CARD_W, WEBP_Q, FULL_W = 1600, 82, 2000

def crop_ratio(im, ratio=4/5, anchor=0.38):
    w, h = im.size
    if w / h > ratio:
        nw = int(round(h * ratio)); x = (w - nw) // 2; im = im.crop((x, 0, x + nw, h))
    else:
        nh = int(round(w / ratio)); y = int(round((h - nh) * anchor)); im = im.crop((0, y, w, y + nh))
    if im.width > CARD_W:
        im = im.resize((CARD_W, int(round(CARD_W * im.height / im.width))), Image.LANCZOS)
    return im

def sheet(paths, labels, path, cols=4, cell=300):
    if not paths: return
    rows = (len(paths) + cols - 1) // cols
    s = Image.new("RGB", (cols * cell, rows * (cell + 26)), "white"); d = ImageDraw.Draw(s)
    for i, (p, lab) in enumerate(zip(paths, labels)):
        im = Image.open(p).convert("RGB"); im.thumbnail((cell, cell), Image.LANCZOS)
        x = (i % cols) * cell + (cell - im.width) // 2; y = (i // cols) * (cell + 26)
        s.paste(im, (x, y)); d.text(((i % cols) * cell + 6, y + cell + 6), lab, fill="black")
    s.save(path, quality=88)

groups = {}
for f in sorted(os.listdir(SRC)):
    if not f.lower().endswith((".jpg", ".jpeg", ".png")): continue
    m = re.match(r'(\d+)', f)
    if not m: continue
    groups.setdefault(m.group(1), []).append(f)

manifest = []
for design, files in sorted(groups.items()):
    sl = f"{BRAND.lower()}-{design}"
    dst = os.path.join(OUT, sl); os.makedirs(dst, exist_ok=True)
    entry = {"brand": BRAND, "design_no": design, "slug": sl, "panels": []}
    sp, sla = [], []
    for i, f in enumerate(files, 1):
        im = Image.open(os.path.join(SRC, f)).convert("RGB")
        base = f"{design}-{i}"
        full = im.copy()
        if full.width > FULL_W:
            full = full.resize((FULL_W, int(round(FULL_W * full.height / full.width))), Image.LANCZOS)
        fp = os.path.join(dst, base + ".webp")
        full.save(fp, "WEBP", quality=WEBP_Q, method=5)
        crop_ratio(im).save(os.path.join(dst, base + "@4x5.webp"), "WEBP", quality=WEBP_Q, method=5)
        entry["panels"].append({"id": base, "source": f, "full": f"{sl}/{base}.webp",
                                "card": f"{sl}/{base}@4x5.webp", "px": list(im.size)})
        sp.append(fp); sla.append(base)
    sheet(sp, sla, os.path.join(dst, "contact.jpg"))
    manifest.append(entry)
    print(f"{sl:16s} panels={len(entry['panels'])}")

json.dump(manifest, open(os.path.join(OUT, f"manifest-{BRAND.lower()}.json"), "w"), indent=2)
print(f"{len(manifest)} designs -> {OUT}")
