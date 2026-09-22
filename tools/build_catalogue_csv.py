#!/usr/bin/env python3
"""
Turn the read catalogues into a Shopify product CSV and a matching upload list.

Input
  designs.json          what the vision pass read off each catalogue: the design
                        name and number, the fabric line transcribed off the cover,
                        and the colourways with the panel ids that show them.
  <catalogue dir>       the WebP panels the extractor produced.

Output
  ladies-unstitched-<stamp>.csv   one product per design, one variant per colourway
  upload/                          every image the CSV references, renamed to the
                                   filename the CSV expects, ready to be dropped
                                   into Shopify admin > Content > Files
  upload-manifest.json             source path -> final filename -> final CDN url

WHY THE URLS CAN BE WRITTEN BEFORE THE IMAGES ARE UPLOADED. A file on the Shopify
Files page is served from a fixed prefix for a given shop, so once the shop's
prefix is known every URL is a pure function of the filename. The prefix below was
read back off a real upload to this store, not guessed. The one rule this depends
on is that **the filename must not already exist in Files** — Shopify appends a
suffix to a clash, and the precomputed URL would then 404. Every name here is
prefixed `kjc-` and carries the brand and design number, so a clash would have to
be deliberate.

A price is NOT set. The supplier has not given one and a guessed retail price on a
live storefront is worse than no price at all, so every product lands as `draft`
with the price column empty for the client to fill.
"""
import csv, json, os, re, shutil, sys

CDN = "https://cdn.shopify.com/s/files/1/0786/5856/8365/files/"
BRAND_CODE = {"IZZA": "IZA", "Razab": "RAZ"}
SKU_START = 15001           # the planning CSV in data/ reserves up to 14565
PHOTOS_PER_COLOUR = 2       # the primary plus one alternate

COLS = [
    "Handle", "Title", "Body (HTML)", "Vendor", "Type", "Tags", "Published",
    "Option1 Name", "Option1 Value",
    "Variant SKU", "Variant Inventory Tracker", "Variant Inventory Qty",
    "Variant Inventory Policy", "Variant Fulfillment Service",
    "Variant Price", "Variant Compare At Price",
    "Variant Requires Shipping", "Variant Taxable",
    "Image Src", "Image Position", "Image Alt Text", "Variant Image",
    "Status",
    "Metafield: custom.by_fabric [single_line_text_field]",
    "Metafield: custom.by_pieces [single_line_text_field]",
    "Metafield: custom.by_type [single_line_text_field]",
    "Metafield: custom.by_color [single_line_text_field]",
    "_source_brand", "_design_no", "_fabric_spec_verbatim", "_source_panel",
]


def slug(s):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", (s or "").lower())).strip("-")


def body_html(d):
    """Plain sentences only. The client asked twice for no jargon and no padding,
    so this says what the cloth is and stops. Anything not known is left out
    rather than filled with a phrase that sounds like knowledge."""
    bits = []
    spec = (d.get("fabric_spec_verbatim") or "").strip()
    if spec:
        bits.append(f"<p>{spec}.</p>")
    facts = []
    if d.get("pieces"):
        facts.append(f"<li>{int(d['pieces'])} piece suit</li>")
    if d.get("shirt_fabric"):
        facts.append(f"<li>Shirt: {d['shirt_fabric']}</li>")
    if d.get("dupatta_fabric"):
        facts.append(f"<li>Dupatta: {d['dupatta_fabric']}</li>")
    if d.get("trouser_fabric"):
        facts.append(f"<li>Trouser: {d['trouser_fabric']}</li>")
    if d.get("design_no"):
        facts.append(f"<li>Design {d['design_no']}</li>")
    if facts:
        bits.append("<ul>" + "".join(facts) + "</ul>")
    bits.append("<p>Unstitched. Sold as a full suit length.</p>")
    return "".join(bits)


def main():
    designs_path, cat_dir, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
    designs = json.load(open(designs_path))
    if isinstance(designs, dict):
        designs = designs.get("designs", [])

    up_dir = os.path.join(out_dir, "upload")
    os.makedirs(up_dir, exist_ok=True)
    rows, uploads, warnings = [], [], []
    sku_n = SKU_START

    for d in sorted(designs, key=lambda x: (x.get("brand", ""), x.get("design_no", ""))):
        brand = d.get("brand") or "Khan Jee"
        name = (d.get("design_name") or "").strip()
        no = re.sub(r'^[A-Za-z]{1,3}[-# ]*', '', (d.get("design_no") or "").strip())
        colourways = d.get("colourways") or []
        if not colourways:
            warnings.append(f"{d.get('slug')}: no colourways read, skipped")
            continue

        label = name if name else f"Design {no}"
        title = f"{label} - {brand}"
        # The slug carries the name and the number once each. Without the dedup a
        # catalogue with no design name produces "design-8533-8533", and one with
        # no number produces a bare "x" placeholder; both end up baked into
        # permanent image filenames and a permanent collection URL.
        parts = [slug(brand)] + ([slug(name)] if name else []) + ([slug(no)] if no else [])
        stub = "-".join(p for p in parts if p)
        handle = stub
        code = BRAND_CODE.get(brand, "KJC")
        fabric = d.get("shirt_fabric") or ""
        pieces = int(d["pieces"]) if d.get("pieces") else 0

        tags = [f"brand:{brand}", "gender:ladies", "unstitched", "ladies-unstitched"]
        if pieces:
            tags.append(f"pieces:{pieces}")
        if fabric:
            tags.append(f"fabric:{fabric}")
        if d.get("season"):
            tags.append(f"season:{d['season']}")
        if d.get("embroidered"):
            tags.append("embroidered")

        pos = 0
        first_row_written = False

        for c in colourways:
            colour = (c.get("colour") or "").strip().title()
            best = c.get("best_panel")
            panels = [p for p in (c.get("panels") or []) if p]
            # primary first, then the rest of this colourway's panels
            # A panel the reader marked unusable carries printed advertising copy
            # across the photograph. Those must never reach a product page, so they
            # are dropped here even though they show the right colourway.
            bad = {u.get("panel") for u in (d.get("unusable_panels") or [])}
            panels = [p for p in panels if p not in bad]
            if best in bad:
                best = panels[0] if panels else None
            ordered = ([best] if best in panels else []) + [p for p in panels if p != best]
            ordered = ordered[:PHOTOS_PER_COLOUR]
            if not ordered:
                warnings.append(f"{handle}/{colour}: no usable panel")
                continue

            urls = []
            for i, panel in enumerate(ordered, 1):
                src = os.path.join(cat_dir, d["slug"], f"{panel}@4x5.webp")
                if not os.path.exists(src):
                    src = os.path.join(cat_dir, d["slug"], f"{panel}.webp")
                if not os.path.exists(src):
                    warnings.append(f"{handle}: panel {panel} missing on disk")
                    continue
                fn = f"kjc-{stub}-{slug(colour)}-{i}.webp"
                shutil.copyfile(src, os.path.join(up_dir, fn))
                uploads.append({"source": src, "filename": fn, "url": CDN + fn})
                urls.append(CDN + fn)
            if not urls:
                continue

            sku = f"KJC-LU-{code}-{sku_n}"
            sku_n += 1
            alt = f"{label} by {brand}, {colour}" if colour else f"{label} by {brand}"

            for i, u in enumerate(urls):
                pos += 1
                r = {k: "" for k in COLS}
                r["Handle"] = handle
                r["Image Src"] = u
                r["Image Position"] = pos
                r["Image Alt Text"] = alt
                if i == 0:
                    # the variant's own row: every variant field goes here
                    r["Option1 Name"] = "Colour"
                    r["Option1 Value"] = colour or "As shown"
                    r["Variant SKU"] = sku
                    r["Variant Inventory Tracker"] = "shopify"
                    r["Variant Inventory Qty"] = 0
                    r["Variant Inventory Policy"] = "deny"
                    r["Variant Fulfillment Service"] = "manual"
                    r["Variant Price"] = ""          # deliberately blank, see docstring
                    r["Variant Requires Shipping"] = "TRUE"
                    r["Variant Taxable"] = "TRUE"
                    r["Variant Image"] = u
                    r["Metafield: custom.by_color [single_line_text_field]"] = colour
                    r["_source_panel"] = ordered[0]
                    if not first_row_written:
                        # product-level fields belong on the first row only
                        r["Title"] = title
                        r["Body (HTML)"] = body_html(d)
                        r["Vendor"] = brand
                        r["Type"] = "Ladies Unstitched"
                        r["Tags"] = ", ".join(tags)
                        r["Published"] = "FALSE"
                        r["Status"] = "draft"
                        r["Metafield: custom.by_fabric [single_line_text_field]"] = fabric
                        r["Metafield: custom.by_pieces [single_line_text_field]"] = f"{pieces} piece" if pieces else ""
                        r["Metafield: custom.by_type [single_line_text_field]"] = "Ladies Unstitched"
                        r["_source_brand"] = brand
                        r["_design_no"] = no
                        r["_fabric_spec_verbatim"] = d.get("fabric_spec_verbatim") or ""
                        first_row_written = True
                rows.append(r)

    out_csv = os.path.join(out_dir, "ladies-unstitched-izza-razab.csv")
    with open(out_csv, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=COLS)
        w.writeheader()
        w.writerows(rows)
    json.dump(uploads, open(os.path.join(out_dir, "upload-manifest.json"), "w"), indent=2)

    products = len({r["Handle"] for r in rows})
    variants = sum(1 for r in rows if r["Variant SKU"])
    print(f"{products} products, {variants} variants, {len(rows)} rows, {len(uploads)} images")
    print(f"csv    -> {out_csv}")
    print(f"images -> {up_dir}")
    if warnings:
        print("\nwarnings:")
        for w_ in warnings:
            print("  " + w_)


main()
