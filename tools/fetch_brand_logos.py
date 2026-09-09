#!/usr/bin/env python3
"""Download and vet brand logo files.

Takes a JSON list of {name, url} and, for each one:
  - fetches it through curl (this machine's Python has no working CA bundle)
  - refuses anything that is not actually an image
  - refuses favicon-sized files and absurd aspect ratios, which is how a
    product photograph or a page banner gives itself away
  - normalises to 96px tall, which is 2.5x the 38px the marquee draws at

Nothing is written into the theme until it has passed all of that, and a
contact sheet is emitted so the whole set can be eyeballed at once — the
last check, that each mark is the right company, can only be done by
looking.

Usage: fetch_brand_logos.py candidates.json outdir
"""
import json
import subprocess
import sys
import pathlib
import re

MIN_W, MIN_H = 40, 20          # below this it is a favicon, not a wordmark
MAX_RATIO = 12.0               # wider than this is a banner, not a logo
MIN_RATIO = 0.25               # taller than this is a poster or a product shot
TARGET_H = 96


def handleize(s):
    s = s.lower().replace('&', '').replace('.', '')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def sips(path, *args):
    r = subprocess.run(['sips', *args, str(path)], capture_output=True, text=True)
    return r.stdout


def dims(path):
    out = sips(path, '-g', 'pixelWidth', '-g', 'pixelHeight')
    w = re.search(r'pixelWidth:\s*(\d+)', out)
    h = re.search(r'pixelHeight:\s*(\d+)', out)
    return (int(w.group(1)), int(h.group(1))) if w and h else (None, None)


def main(spec_path, outdir):
    cands = json.loads(pathlib.Path(spec_path).read_text())
    out = pathlib.Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    kept, dropped = [], []

    for c in cands:
        name, url = c['name'], (c.get('url') or '').strip()
        h = handleize(name)
        if not url:
            dropped.append((name, 'no url offered')); continue

        tmp = out / f'_tmp_{h}'
        r = subprocess.run(
            ['curl', '-sL', '--max-time', '30', '-A',
             'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
             '-o', str(tmp), '-w', '%{http_code}|%{content_type}|%{size_download}', url],
            capture_output=True, text=True)
        parts = (r.stdout or '||').split('|')
        code, ctype, size = parts[0], parts[1] if len(parts) > 1 else '', parts[2] if len(parts) > 2 else '0'

        if code != '200':
            dropped.append((name, f'HTTP {code}')); tmp.unlink(missing_ok=True); continue
        if 'image' not in ctype and 'svg' not in ctype:
            dropped.append((name, f'not an image: {ctype}')); tmp.unlink(missing_ok=True); continue
        if int(size or 0) < 400:
            dropped.append((name, f'only {size} bytes')); tmp.unlink(missing_ok=True); continue

        # SVG: keep as-is, it is already resolution independent
        if 'svg' in ctype or url.lower().split('?')[0].endswith('.svg'):
            body = tmp.read_text(errors='ignore')
            if '<svg' not in body.lower():
                dropped.append((name, 'claims svg but has no <svg>')); tmp.unlink(missing_ok=True); continue
            dest = out / f'{h}.svg'
            tmp.rename(dest)
            kept.append({'name': name, 'handle': h, 'file': dest.name,
                         'bytes': dest.stat().st_size, 'dims': 'vector', 'url': url})
            continue

        ext = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
               'image/gif': 'gif'}.get(ctype.split(';')[0].strip(), 'png')
        dest = out / f'{h}.{ext}'
        tmp.rename(dest)

        w, hh = dims(dest)
        if not w:
            dropped.append((name, 'unreadable image')); dest.unlink(missing_ok=True); continue
        if w < MIN_W or hh < MIN_H:
            dropped.append((name, f'{w}x{hh} — favicon-sized')); dest.unlink(missing_ok=True); continue
        ratio = w / hh
        if ratio > MAX_RATIO or ratio < MIN_RATIO:
            dropped.append((name, f'{w}x{hh} — aspect {ratio:.1f}, not a logo shape'))
            dest.unlink(missing_ok=True); continue

        if hh > TARGET_H:
            sips(dest, '--resampleHeight', str(TARGET_H), '--out', str(dest))
            w, hh = dims(dest)
        kept.append({'name': name, 'handle': h, 'file': dest.name,
                     'bytes': dest.stat().st_size, 'dims': f'{w}x{hh}', 'url': url})

    print(f'KEPT {len(kept)}:')
    for k in kept:
        print(f"  {k['handle']:22} {k['file']:28} {k['dims']:>10}  {k['bytes']:>7}b")
    print(f'\nDROPPED {len(dropped)}:')
    for n, why in dropped:
        print(f'  {n:22} {why}')

    (out / 'kept.json').write_text(json.dumps(kept, indent=1))

    # contact sheet, on both grounds the marquee actually uses
    cards = '\n'.join(
        f'<figure><div class="on-white"><img src="{k["file"]}" alt="{k["name"]}"></div>'
        f'<div class="on-dark"><img src="{k["file"]}" alt=""></div>'
        f'<figcaption>{k["name"]}<br><small>{k["dims"]} · {k["bytes"]}b</small></figcaption></figure>'
        for k in kept)
    (out / 'sheet.html').write_text(
        '<!doctype html><meta charset="utf-8"><title>brand logo contact sheet</title>'
        '<style>body{margin:0;padding:20px;background:#EFEFEF;'
        'font:12px/1.4 -apple-system,system-ui,sans-serif}'
        '.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}'
        'figure{margin:0;background:#fff;border:1px solid #ccc}'
        '.on-white,.on-dark{height:74px;display:grid;place-items:center;padding:8px}'
        '.on-dark{background:#14100E}'
        'img{max-height:38px;max-width:100%;width:auto;object-fit:contain}'
        'figcaption{padding:6px 8px;border-top:1px solid #eee;text-align:center}'
        'small{color:#777}</style>'
        f'<h2>{len(kept)} logos — each shown at the 38px the strip draws them at</h2>'
        f'<div class="g">{cards}</div>')
    print(f'\ncontact sheet: {out}/sheet.html')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
