#!/usr/bin/env python3
"""Turn the research JSON into a Shopify product-import CSV.

Enforces the white-label rule: every product is a Khan Jee piece with a
KJC-LU-##### SKU; the supplier brand never appears in title, vendor, tags,
body, alt text or image filename. The SKU -> supplier map is written to
private/kjc_master_additions.csv, which is gitignored and confidential.

Usage: build_inventory.py research.json [images.json] [start_sku=10015]
"""
import json, csv, sys, os, re, html
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
inv = json.load(open(sys.argv[1]))
images = json.load(open(sys.argv[2])) if len(sys.argv) > 2 and os.path.exists(sys.argv[2]) else {}
n = int(sys.argv[3]) if len(sys.argv) > 3 else 10015

FABRICS = ['Lawn','Cambric','Chiffon','Karandi','Khaddar','Jacquard','Organza','Velvet','Net','Viscose','Silk','Satin','Linen','Cotton','Dobby','Slub']
def norm_fabric(s):
    s = (s or '').lower()
    for f in FABRICS:
        if f.lower() in s: return f
    return ''
def norm_pieces(s):
    m = re.search(r'([123])\s*-?\s*p', (s or '').lower()); return f'{m.group(1)} Piece' if m else ''
def norm_type(s):
    s = (s or '').lower()
    return 'Embroidered' if 'embroid' in s else 'Printed' if 'print' in s else 'Plain' if any(k in s for k in ('plain','solid','dyed')) else ''
def season(fabric):
    return 'Winter' if fabric in ('Karandi','Khaddar','Velvet','Linen') else 'Summer' if fabric in ('Lawn','Cambric') else 'All Season'

cols = ['Handle','Title','Body (HTML)','Vendor','Product Category','Type','Tags','Published',
        'Option1 Name','Option1 Value','Variant SKU','Variant Grams','Variant Inventory Tracker','Variant Inventory Qty',
        'Variant Inventory Policy','Variant Fulfillment Service','Variant Price','Variant Compare At Price',
        'Variant Requires Shipping','Variant Taxable','Image Src','Image Position','Image Alt Text','Status',
        'Fabric (product.metafields.custom.by_fabric)','Pieces (product.metafields.custom.by_pieces)',
        'Type (product.metafields.custom.by_type)','Season (product.metafields.custom.by_season)',
        'Colour (product.metafields.custom.by_color)']
os.makedirs(os.path.join(ROOT,'private'), exist_ok=True)
pub = open(os.path.join(ROOT,'data','inventory-ladies-unstitched.csv'),'w',newline='')
prv = open(os.path.join(ROOT,'private','kjc_master_additions.csv'),'w',newline='')
W = csv.DictWriter(pub, fieldnames=cols); W.writeheader()
P = csv.writer(prv); P.writerow(['sku','supplier_brand','supplier_collection','source_url','source_price_pkr'])
made = skipped = 0
for b in inv['brands']:
    if b.get('sells_unstitched') != 'yes': continue
    for p in b['products']:
        fabric = norm_fabric(p.get('fabric')) or norm_fabric(p.get('title')); pieces = norm_pieces(p.get('pieces')) or norm_pieces(p.get('title'))
        typ = norm_type(p.get('type')) or norm_type(p.get('title')); colour = (p.get('colour') or '').strip().title()
        price = p.get('price_pkr') or 0
        if not fabric or not price: skipped += 1; continue
        sku = f'KJC-LU-{n}'; n += 1
        title = f"Khan Jee Ladies {fabric}{(' ' + pieces) if pieces else ''}{(' — ' + colour) if colour and colour.lower() != 'unknown' else ''}"
        body = ('<p>Unstitched ' + fabric.lower() + (', ' + pieces.lower() if pieces else '') + '. '
                'Cut to your measurement or supplied as a full suit length.</p>'
                + (f'<p>Meterage: {html.escape(p["meterage"])}</p>' if p.get('meterage') and p['meterage'] != 'unknown' else ''))
        tags = ','.join(t for t in ['ladies','unstitched',fabric.lower(),pieces.lower().replace(' ','-') if pieces else '',typ.lower(),season(fabric).lower().replace(' ','-')] if t)
        imgs = images.get(p.get('source_url',''),{}).get('images',[]) or ['']
        for i, src in enumerate(imgs, 1):
            row = {c: '' for c in cols}
            if i == 1:
                row.update({'Handle': sku.lower(), 'Title': title, 'Body (HTML)': body, 'Vendor': 'Khan Jee',
                    'Product Category': 'Apparel & Accessories > Clothing Fabric', 'Type': 'Unstitched', 'Tags': tags, 'Published': 'FALSE',
                    'Option1 Name': 'Title', 'Option1 Value': 'Default Title', 'Variant SKU': sku, 'Variant Grams': '900',
                    'Variant Inventory Tracker': 'shopify', 'Variant Inventory Qty': '10', 'Variant Inventory Policy': 'deny',
                    'Variant Fulfillment Service': 'manual', 'Variant Price': f'{price:.2f}',
                    'Variant Compare At Price': f'{p["compare_at_pkr"]:.2f}' if p.get('compare_at_pkr') else '',
                    'Variant Requires Shipping': 'TRUE', 'Variant Taxable': 'FALSE', 'Status': 'draft',
                    'Fabric (product.metafields.custom.by_fabric)': fabric, 'Pieces (product.metafields.custom.by_pieces)': pieces,
                    'Type (product.metafields.custom.by_type)': typ, 'Season (product.metafields.custom.by_season)': season(fabric),
                    'Colour (product.metafields.custom.by_color)': colour})
            else:
                row['Handle'] = sku.lower()
            if src:
                row.update({'Image Src': src, 'Image Position': str(i), 'Image Alt Text': title})  # alt = our title, never the supplier
            W.writerow(row)
        P.writerow([sku, b.get('canonical_name') or b['brand'], p.get('collection',''), p.get('source_url',''), price]); made += 1
print(f'{made} products written (next SKU {n}), {skipped} skipped for missing fabric/price')
print(' public :', os.path.relpath(pub.name, ROOT)); print(' private:', os.path.relpath(prv.name, ROOT), '(gitignored — supplier map, confidential)')
