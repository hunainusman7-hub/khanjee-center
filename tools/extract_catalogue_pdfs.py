#!/usr/bin/env python3
"""
Turn the brands' catalogue PDFs into one folder of web-ready photographs per design.

Each catalogue is one design. Page 1 is a portrait cover carrying the design
name, the design number and the fabric spec. Every page after it is a landscape
spread holding two portrait panels side by side — the same colourway shot twice,
with a white gutter between them and a white margin round the outside.

So: split each spread down the middle, trim the white off each half, and what is
left is a photograph. Some halves also carry printed advertising copy across the
top; this script cannot see that, so it writes a contact sheet for a human (or a
vision pass) to mark those.

Outputs, per design, under out/<slug>/:
    cover.webp          the cover page, untouched but converted
    p<N><L|R>.webp      every panel at full width, trimmed
    p<N><L|R>@4x5.webp  the same panel cropped to the 4:5 the theme's cards use
    contact.jpg         all panels in one numbered grid
and out/manifest.json describing the lot.
"""
import json, os, re, sys
import pymupdf
from PIL import Image, ImageDraw, ImageChops

SRC  = sys.argv[1] if len(sys.argv) > 1 else "/Users/hunainsmac/Downloads/IZZA"
OUT  = sys.argv[2] if len(sys.argv) > 2 else "/private/tmp/claude-501/-Users-hunainsmac-Desktop-Khanjee/ba76f6d6-34db-4ad4-992a-fea63c2cda09/scratchpad/catalogue"
DPI       = 200      # 200dpi off an A4 panel is ~1650px wide, past what the CDN is asked for
CARD_W    = 1600     # long edge of the 4:5 crop
WEBP_Q    = 82
TRIM_TOL  = 14       # how far off pure white a pixel may be and still count as margin

def slug(s):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s.lower())).strip('-')

def trim_white(im, tol=TRIM_TOL):
    """Crop the white paper margin off a scanned panel."""
    g = im.convert("L")
    bg = Image.new("L", g.size, 255)
    diff = ImageChops.difference(g, bg).point(lambda p: 255 if p > tol else 0)
    box = diff.getbbox()
    if not box:
        return im
    # never trim more than a third off any edge: that would mean the panel is
    # mostly pale and the bbox has locked onto the model rather than the paper.
    w, h = im.size
    l, t, r, b = box
    if (r - l) < w * 0.66 or (b - t) < h * 0.66:
        return im
    return im.crop(box)

def crop_ratio(im, ratio=4/5, anchor=0.38):
    """Crop to `ratio` (w/h). Vertically, keep more of the top than the bottom:
    heads sit near the top of a fashion frame and feet are the cheaper loss."""
    w, h = im.size
    if w / h > ratio:                      # too wide, trim the sides evenly
        nw = int(round(h * ratio)); x = (w - nw) // 2
        im = im.crop((x, 0, x + nw, h))
    else:                                  # too tall, trim top and bottom
        nh = int(round(w / ratio)); over = h - nh
        y = int(round(over * anchor))
        im = im.crop((0, y, w, y + nh))
    if im.width > CARD_W:
        im = im.resize((CARD_W, int(round(CARD_W * im.height / im.width))), Image.LANCZOS)
    return im

def contact_sheet(paths, labels, path, cols=4, cell=300):
    if not paths: return
    rows = (len(paths) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 26)), "white")
    d = ImageDraw.Draw(sheet)
    for i, (p, lab) in enumerate(zip(paths, labels)):
        im = Image.open(p).convert("RGB")
        im.thumbnail((cell, cell), Image.LANCZOS)
        x = (i % cols) * cell + (cell - im.width) // 2
        y = (i // cols) * (cell + 26)
        sheet.paste(im, (x, y))
        d.text(((i % cols) * cell + 6, y + cell + 6), lab, fill="black")
    sheet.save(path, quality=88)

def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = []
    for f in sorted(os.listdir(SRC)):
        if not f.lower().endswith(".pdf"):
            continue
        stem = os.path.splitext(f)[0]
        sl = slug(stem)
        dst = os.path.join(OUT, sl)
        os.makedirs(dst, exist_ok=True)
        doc = pymupdf.open(os.path.join(SRC, f))
        entry = {"pdf": f, "slug": sl, "pages": len(doc), "cover": None, "panels": []}
        sheet_paths, sheet_labels = [], []

        for pi, page in enumerate(doc):
            pix = page.get_pixmap(dpi=DPI)
            im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            landscape = pix.width > pix.height

            if pi == 0 and not landscape:
                im.save(os.path.join(dst, "cover.webp"), "WEBP", quality=90)
                entry["cover"] = f"{sl}/cover.webp"
                continue

            halves = ([("L", im.crop((0, 0, im.width // 2, im.height))),
                       ("R", im.crop((im.width // 2, 0, im.width, im.height)))]
                      if landscape else [("", im)])

            for side, half in halves:
                half = trim_white(half)
                if half.width < 400 or half.height < 400:
                    continue
                base = f"p{pi+1}{side}"
                full = os.path.join(dst, base + ".webp")
                half.save(full, "WEBP", quality=WEBP_Q, method=5)
                card = crop_ratio(half)
                card.save(os.path.join(dst, base + "@4x5.webp"), "WEBP", quality=WEBP_Q, method=5)
                entry["panels"].append({
                    "id": base,
                    "full": f"{sl}/{base}.webp",
                    "card": f"{sl}/{base}@4x5.webp",
                    "px": [half.width, half.height],
                    "spread": pi + 1, "side": side,
                })
                sheet_paths.append(full); sheet_labels.append(base)

        contact_sheet(sheet_paths, sheet_labels, os.path.join(dst, "contact.jpg"))
        manifest.append(entry)
        print(f"{sl:34s} cover={'y' if entry['cover'] else 'n'} panels={len(entry['panels'])}")

    json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=2)
    print(f"\n{len(manifest)} designs -> {OUT}")

main()
