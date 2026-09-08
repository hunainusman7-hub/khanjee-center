#!/usr/bin/env python3
"""Fetch product image URLs for the inventory records, per brand, from each
brand's own Shopify product feed (/products/<handle>.json).

Only run for brands whose distributor clearance covers imagery. Output is
private/images.json — keyed by source_url — and never enters the theme.
Uses curl (this Mac's Python has a broken certificate store)."""
import json, subprocess, sys, re, os
from urllib.parse import urlparse
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
inv = json.load(open(sys.argv[1]))
skip = set(x.strip().lower() for x in (sys.argv[2].split(',') if len(sys.argv) > 2 else []) if x)
out_p = os.path.join(ROOT, 'private', 'images.json'); os.makedirs(os.path.dirname(out_p), exist_ok=True)
out = json.load(open(out_p)) if os.path.exists(out_p) else {}
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'
def get(url):
    r = subprocess.run(['curl', '-sL', '--max-time', '25', '-A', UA, url], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else ''
n = 0
for b in inv['brands']:
    if b['brand'].lower() in skip or b.get('canonical_name', '').lower() in skip:
        print('skip (no clearance):', b['brand']); continue
    for p in b['products']:
        u = p.get('source_url', '')
        if not u or u in out: continue
        m = re.search(r'/products/([a-z0-9\-_%]+)', u)
        if not m: continue
        pu = urlparse(u); j = get(f'{pu.scheme}://{pu.netloc}/products/{m.group(1)}.json')
        try: imgs = [i['src'].split('?')[0] for i in json.loads(j)['product']['images']][:4]
        except Exception: imgs = []
        out[u] = {'brand': b['brand'], 'images': imgs}; n += 1
        print(f"{'ok ' if imgs else 'NONE'} {len(imgs)} {b['brand'][:14]:14} {m.group(1)[:50]}")
json.dump(out, open(out_p, 'w'), indent=1)
print(f'\n{n} products fetched -> {out_p}')
