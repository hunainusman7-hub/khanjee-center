#!/usr/bin/env python3
"""Rewrite the logo_map in brand-marquee.liquid and brand-directory.liquid.

The two sections each carry a `logo_map` of handle:filename pairs, and the
comment in both says to keep them in step — so this writes both from one
source and then asserts they match, rather than trusting anyone to
remember.

Usage: update_logo_map.py kept.json
"""
import json
import pathlib
import re
import sys

THEME = pathlib.Path(__file__).resolve().parent.parent / 'theme'
FILES = [THEME / 'sections/brand-marquee.liquid',
         THEME / 'sections/brand-directory.liquid']


def main(kept_path):
    kept = json.loads(pathlib.Path(kept_path).read_text())
    new_pairs = {k['handle']: k['file'] for k in kept}

    maps = []
    for f in FILES:
        s = f.read_text()
        m = re.search(r"assign logo_map\s*=\s*'([^']*)'", s)
        assert m, f'no logo_map in {f.name}'
        existing = dict(p.split(':') for p in m.group(1).split(',') if ':' in p)
        merged = {**existing, **new_pairs}
        added = sorted(set(new_pairs) - set(existing))
        joined = ','.join(f'{h}:{merged[h]}' for h in sorted(merged))
        s = s[:m.start(1)] + joined + s[m.end(1):]
        f.write_text(s)
        maps.append(joined)
        print(f'{f.name}: {len(existing)} -> {len(merged)} logos (+{len(added)})')
        if added:
            print('   added:', ', '.join(added))

    assert maps[0] == maps[1], 'the two logo_maps came out different'
    print(f'\nboth maps identical, {len(maps[0].split(","))} entries')


if __name__ == '__main__':
    main(sys.argv[1])
