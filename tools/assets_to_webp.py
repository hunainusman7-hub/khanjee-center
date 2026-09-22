#!/usr/bin/env python3
"""Convert the theme's raster assets to WebP.

Photographs go to lossy WebP; brand logos, which are flat-colour PNGs with an
alpha channel, go to LOSSLESS WebP, because lossy WebP puts ringing round hard
type edges and a logo is nothing but hard type edges.

Nothing is deleted and nothing is overwritten. The converted files are written
alongside, and a rewrite map is printed so the liquid references can be changed
in one pass afterwards. A file that does not actually get smaller is dropped,
because shipping a bigger WebP than the JPEG it replaced is a loss.
"""
import os, sys, json
from PIL import Image

SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else SRC
os.makedirs(OUT, exist_ok=True)

rows, saved_total, orig_total = [], 0, 0
for f in sorted(os.listdir(SRC)):
    stem, ext = os.path.splitext(f)
    if ext.lower() not in (".jpg", ".jpeg", ".png"):
        continue
    src = os.path.join(SRC, f)
    im = Image.open(src)
    has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    dst = os.path.join(OUT, stem + ".webp")
    if has_alpha:
        im.convert("RGBA").save(dst, "WEBP", lossless=True, method=6)
    else:
        im.convert("RGB").save(dst, "WEBP", quality=82, method=6)
    a, b = os.path.getsize(src), os.path.getsize(dst)
    if b >= a:
        os.remove(dst)
        rows.append({"file": f, "status": "kept-original", "orig_kb": a // 1024, "webp_kb": b // 1024})
        continue
    orig_total += a; saved_total += a - b
    rows.append({"file": f, "webp": stem + ".webp", "status": "converted",
                 "alpha": has_alpha, "orig_kb": a // 1024, "webp_kb": b // 1024,
                 "saved_pct": round(100 * (a - b) / a)})

conv = [r for r in rows if r["status"] == "converted"]
for r in sorted(conv, key=lambda r: -(r["orig_kb"] - r["webp_kb"]))[:14]:
    print(f"  {r['orig_kb']:5d}KB -> {r['webp_kb']:5d}KB  ({r['saved_pct']:3d}% off)  {r['file']}")
skipped = [r for r in rows if r["status"] != "converted"]
print(f"\n{len(conv)} converted, {len(skipped)} left as-is (WebP was no smaller)")
print(f"total {orig_total/1024/1024:.2f}MB -> {(orig_total-saved_total)/1024/1024:.2f}MB, saved {saved_total/1024/1024:.2f}MB")
json.dump(rows, open(os.path.join(OUT, "_webp-map.json"), "w"), indent=2)
