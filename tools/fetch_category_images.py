#!/usr/bin/env python3
"""Download vetted category photographs, crop them to the tile ratio,
and build a contact sheet that shows them the way the site will.

The point of the sheet is that it renders each candidate inside the
site's actual card treatment — the real 4:5 tile, the real ground, the
real label overlay — rather than as a gallery of pretty pictures. A
photograph can be correct in isolation and still fail once a white
caption lands on the bright part of it.

Usage: fetch_category_images.py candidates.json outdir
       candidates.json: [{file, url, source, licence, page, describes}]
"""
import json
import subprocess
import sys
import pathlib
import re

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

TILE_W, TILE_H = 1000, 1250          # 4:5, the ratio .cat/.ccard uses
MIN_LONG_EDGE = 1200


def sips(*args):
    return subprocess.run(['sips', *args], capture_output=True, text=True).stdout


def dims(p):
    out = sips('-g', 'pixelWidth', '-g', 'pixelHeight', str(p))
    w = re.search(r'pixelWidth:\s*(\d+)', out)
    h = re.search(r'pixelHeight:\s*(\d+)', out)
    return (int(w.group(1)), int(h.group(1))) if w and h else (None, None)


def main(spec, outdir):
    cands = json.loads(pathlib.Path(spec).read_text())
    out = pathlib.Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    kept, dropped = [], []

    for c in cands:
        name, url = c['file'], (c.get('url') or '').strip()
        if not url:
            dropped.append((name, 'no url')); continue
        raw = out / f"_raw_{name}"
        r = subprocess.run(['curl', '-sL', '--max-time', '60', '-A', UA,
                            '-o', str(raw), '-w', '%{http_code}|%{content_type}|%{size_download}',
                            url], capture_output=True, text=True)
        parts = (r.stdout or '||').split('|')
        code, ctype, size = parts[0], parts[1] if len(parts) > 1 else '', parts[2] if len(parts) > 2 else '0'
        if code != '200':
            dropped.append((name, f'HTTP {code}')); raw.unlink(missing_ok=True); continue
        if 'image' not in ctype:
            dropped.append((name, f'not an image: {ctype}')); raw.unlink(missing_ok=True); continue
        if int(size or 0) < 20000:
            dropped.append((name, f'only {size} bytes — probably a thumbnail'))
            raw.unlink(missing_ok=True); continue

        w, h = dims(raw)
        if not w:
            dropped.append((name, 'unreadable')); raw.unlink(missing_ok=True); continue
        if max(w, h) < MIN_LONG_EDGE:
            dropped.append((name, f'{w}x{h} — under {MIN_LONG_EDGE}px on the long edge'))
            raw.unlink(missing_ok=True); continue

        # centre-crop to 4:5, then resample to the tile size. sips crops
        # from the centre, which is the same thing object-fit:cover does,
        # so the sheet shows the crop the browser will actually apply.
        dest = out / name
        target_ratio = TILE_W / TILE_H
        if w / h > target_ratio:
            crop_w, crop_h = int(h * target_ratio), h
        else:
            crop_w, crop_h = w, int(w / target_ratio)
        sips('-c', str(crop_h), str(crop_w), str(raw), '--out', str(dest))
        sips('-z', str(TILE_H), str(TILE_W), str(dest), '--out', str(dest))
        sips('-s', 'format', 'jpeg', '-s', 'formatOptions', '78', str(dest), '--out', str(dest))
        raw.unlink(missing_ok=True)
        fw, fh = dims(dest)
        kept.append({**c, 'orig': f'{w}x{h}', 'final': f'{fw}x{fh}',
                     'bytes': dest.stat().st_size})

    print(f'KEPT {len(kept)}:')
    for k in kept:
        print(f"  {k['file']:24} {k['orig']:>11} -> {k['final']:>9} "
              f"{k['bytes']//1024:>4} KB  {k.get('source','')}")
    if dropped:
        print(f'\nDROPPED {len(dropped)}:')
        for n, why in dropped:
            print(f'  {n:24} {why}')

    (out / 'kept.json').write_text(json.dumps(kept, indent=1))

    # the sheet: each photo inside the site's real tile
    LABELS = {'lada-waistcoats.jpg': 'Lada by Khan Jee',
              'men-unstitched.jpg': 'Gents Unstitched',
              'women-unstitched.jpg': 'Ladies Unstitched',
              'bridal.jpg': 'Bridal &amp; Formal',
              'men-shawls.jpg': 'Gents Shawls',
              'women-shawls.jpg': 'Ladies Shawls'}
    cards = []
    for k in kept:
        label = LABELS.get(k['file'], k['file'])
        cards.append(f'''<figure>
  <div class="tile"><img src="{k['file']}" alt=""><span class="cap">{label}</span></div>
  <figcaption>
    <b>{k['file']}</b><br>
    <span class="meta">{k['orig']} &rarr; {k['final']} &middot; {k['bytes']//1024} KB &middot;
      {k.get('source','?')} &middot; {k.get('licence','?')}</span><br>
    <span class="desc">{k.get('describes','')}</span>
    {'<br><a href="' + k['page'] + '" target="_blank">source page</a>' if k.get('page') else ''}
  </figcaption>
</figure>''')

    (out / 'sheet.html').write_text(f'''<!doctype html><meta charset="utf-8">
<title>Khan Jee — category photographs</title>
<style>
 body{{margin:0;padding:20px;background:#fff;color:#14100E;
   font:13px/1.55 Montserrat,-apple-system,system-ui,sans-serif}}
 h1{{font:500 20px/1.2 Montserrat,sans-serif;margin:0 0 4px}}
 p.k{{margin:0 0 18px;color:#6B615A}}
 .g{{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:18px}}
 figure{{margin:0}}
 /* the site's real tile: 4:5, cover, label bottom-left over the photo */
 .tile{{position:relative;aspect-ratio:4/5;overflow:hidden;background:#FAF8F6;
   border-radius:10px}}
 .tile img{{width:100%;height:100%;object-fit:cover;display:block}}
 .cap{{position:absolute;left:14px;bottom:12px;color:#fff;
   font:600 11px/1 Montserrat,sans-serif;letter-spacing:.18em;text-transform:uppercase;
   text-shadow:0 1px 12px rgba(0,0,0,.7)}}
 figcaption{{padding:8px 2px 0}}
 .meta{{color:#6B615A;font-size:11px}}
 .desc{{color:#4A423C;font-size:12px}}
 a{{color:#9A1B2F}}
</style>
<h1>Category photographs &mdash; {len(kept)} of 6</h1>
<p class="k">Each one shown inside the site's real 4:5 tile, centre-cropped exactly as
object-fit:cover will crop it, with the real label overlay. If a caption is hard to read
here it will be hard to read on the site.</p>
<div class="g">
{chr(10).join(cards)}
</div>
''')
    print(f"\ncontact sheet: {out}/sheet.html")


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
