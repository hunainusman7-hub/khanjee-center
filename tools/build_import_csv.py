#!/usr/bin/env python3
"""Turn the pulled brand data into a Shopify product-import CSV.

Everything comes in as DRAFT. 4,551 products going live unreviewed would
be reckless — 53% of them are already out of stock at the source, and
Khan Jee's shelf in Sheikhupura is not the same thing as a brand's entire
online range. The client decides what they actually hold.

Two title columns are emitted, not one, because the naming rule is the
client's call and getting it wrong has bitten this store before (a
product went live as "Khan Jee Gentlemen Nishat Boski"):

  title_branded    "Alkaram · Embroidered Lawn 3 Piece"
  title_whitelabel "Ladies Unstitched Lawn 3 Piece" + the KJC SKU only

The handoff's white-label rule says only Dynasty and Pasha are sold under
their own cloth name and a supplier must never be named to a customer.
But these seventeen are houses Khan Jee stocks BY NAME — the navigation
already links /collections/ladies-alkaram. Those are different things:
a supplier of unbranded cloth, versus a branded house on the shelf.
Pick the column that matches the intent and delete the other before
importing.

Usage: build_import_csv.py <inventory_dir> <out.csv>
"""
import csv
import json
import pathlib
import re
import sys

CAT = "LU"                                  # Ladies Unstitched
SEQ_START = 10015                           # 10001-10014 are spent on the 13 live products
BRAND_CODES = json.loads((pathlib.Path(__file__).resolve().parent.parent
                          / "data" / "brand-codes.json").read_text())
COLOURS = ["Ivory", "White", "Black", "Red", "Maroon", "Pink", "Peach",
           "Blue", "Navy", "Teal", "Green", "Olive", "Yellow", "Mustard",
           "Orange", "Purple", "Lilac", "Grey", "Brown", "Beige", "Gold",
           "Silver", "Rust", "Sage", "Cream"]

HEADER = ["Handle", "Title", "Body (HTML)", "Vendor", "Type", "Tags", "Published",
          "Option1 Name", "Option1 Value", "Variant SKU", "Variant Inventory Tracker",
          "Variant Inventory Qty", "Variant Inventory Policy", "Variant Fulfillment Service",
          "Variant Price", "Variant Compare At Price", "Variant Requires Shipping",
          "Variant Taxable", "Image Src", "Image Position", "Image Alt Text", "Status",
          # facet metafields the theme's filters read
          "Metafield: custom.by_fabric [single_line_text_field]",
          "Metafield: custom.by_pieces [single_line_text_field]",
          "Metafield: custom.by_type [single_line_text_field]",
          "Metafield: custom.by_color [single_line_text_field]",
          # review columns, not for import — delete before uploading
          "_title_branded", "_title_whitelabel", "_source_brand", "_source_url",
          "_in_stock_at_source"]


def colour_of(text):
    for c in COLOURS:
        if re.search(rf"\b{c}\b", text, re.I):
            return c
    return ""


def type_of(text):
    for t, rx in [("Embroidered", r"embroider"), ("Printed", r"\bprint"),
                  ("Jacquard", r"jacquard"), ("Plain", r"\bplain\b|\bsolid\b"),
                  ("Formal", r"formal|festive|luxury|wedding"),
                  ("Casual", r"casual|everyday|basic")]:
        if re.search(rx, text, re.I):
            return t
    return ""


def main(indir, outpath):
    rows = []
    for f in sorted(pathlib.Path(indir).glob("*.json")):
        if f.name.startswith("_"):
            continue
        rows += json.loads(f.read_text())

    seq = SEQ_START - 1
    out = []
    unknown = set()
    for r in rows:
        seq += 1
        bc = BRAND_CODES.get(r["brand"])
        if not bc:
            unknown.add(r["brand"])
            bc = "UNK"
        # KJC-{CAT}-{BRAND}-{NNNNN} — see data/SKU-SCHEME.md
        sku = f"KJC-{CAT}-{bc}-{seq:05d}"
        hay = " ".join([r["source_title"], r["product_type"], r["tags"]])
        fabric = r["fabric"]
        pieces = f"{r['pieces']} piece" if r["pieces"] else ""
        ptype = type_of(hay)
        colour = colour_of(hay)

        bits = [b for b in [ptype, fabric, pieces] if b]

        # Prefer the brand's own title when it is actually descriptive —
        # "3-PC Unstitched Embroidered Lawn Collection CC6-10" beats
        # anything derived. But some brands title by garment list
        # ("RTS | SHIRT, TROUSER & DUPATTA"), which reads as noise on a
        # shelf, so fall back to the derived description for those.
        src = re.sub(r"\s*\|\s*", " ", r["source_title"]).strip()
        src = re.sub(r"\s{2,}", " ", src)
        descriptive = bool(re.search(r"unstitch|lawn|chiffon|khaddar|cambric|karandi|"
                                     r"jacquard|organza|velvet|silk|linen|embroider|print",
                                     src, re.I))
        core = src if descriptive and len(src) > 12 else (" ".join(bits) or "Unstitched")

        generic = core if descriptive else (
            "Ladies Unstitched" if core == "Unstitched" else "Ladies Unstitched " + core)
        generic = re.sub(rf"^{re.escape(r['brand'])}\s*", "", generic, flags=re.I).strip()
        branded = f"{r['brand']} · {generic}"

        handle = re.sub(r"[^a-z0-9]+", "-",
                        f"{r['brand']} {r['handle']}".lower()).strip("-")[:100]
        tags = [t for t in [f"brand:{r['brand']}", "gender:ladies", "unstitched",
                            f"fabric:{fabric}" if fabric else "",
                            f"pieces:{r['pieces']}" if r["pieces"] else "",
                            f"type:{ptype}" if ptype else "",
                            f"colour:{colour}" if colour else ""] if t]

        imgs = [i for i in (r["images"].split("|") if r["images"] else []) if i]
        first = imgs[0] if imgs else ""

        out.append({
            "Handle": handle,
            "Title": branded,
            "Body (HTML)": "",
            "Vendor": r["brand"],
            "Type": "Ladies Unstitched",
            "Tags": ", ".join(tags),
            "Published": "FALSE",
            "Option1 Name": "Title",
            "Option1 Value": "Default Title",
            "Variant SKU": sku,
            "Variant Inventory Tracker": "shopify",
            "Variant Inventory Qty": "0",
            "Variant Inventory Policy": "deny",
            "Variant Fulfillment Service": "manual",
            "Variant Price": r["price_pkr"] or "",
            "Variant Compare At Price": (r["compare_at_pkr"]
                                         if r["compare_at_pkr"] not in ("", "0.00", None) else ""),
            "Variant Requires Shipping": "TRUE",
            "Variant Taxable": "TRUE",
            "Image Src": first,
            "Image Position": "1" if first else "",
            "Image Alt Text": generic,
            "Status": "draft",
            "Metafield: custom.by_fabric [single_line_text_field]": fabric,
            "Metafield: custom.by_pieces [single_line_text_field]": pieces,
            "Metafield: custom.by_type [single_line_text_field]": ptype,
            "Metafield: custom.by_color [single_line_text_field]": colour,
            "_title_branded": branded,
            "_title_whitelabel": generic,
            "_source_brand": r["brand"],
            "_source_url": r["source_url"],
            "_in_stock_at_source": "yes" if r["available"] else "no",
        })
        # extra images become continuation rows on the same handle
        for n, src in enumerate(imgs[1:6], start=2):
            blank = {k: "" for k in HEADER}
            blank["Handle"] = handle
            blank["Image Src"] = src
            blank["Image Position"] = str(n)
            out.append(blank)

    with open(outpath, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=HEADER)
        w.writeheader()
        w.writerows(out)

    if unknown:
        print(f"  !! no brand code for: {sorted(unknown)} — coded UNK, fix the register")
    prod = sum(1 for o in out if o["Variant SKU"])
    instock = sum(1 for o in out if o.get("_in_stock_at_source") == "yes")
    print(f"  {prod} products, {len(out)} CSV rows (extra image rows included)")
    print(f"  in stock at source: {instock}  |  out of stock: {prod - instock}")
    print(f"  all rows Status=draft, Published=FALSE, Inventory Qty=0")
    master = pathlib.Path(outpath).with_name("kjc_master.csv")
    with open(master, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["sku", "brand_code", "brand", "category", "source_url"])
        for o in out:
            if not o["Variant SKU"]:
                continue
            w.writerow([o["Variant SKU"], o["Variant SKU"].split("-")[2],
                        o["_source_brand"], CAT, o["_source_url"]])
    print(f"  wrote {outpath}")
    print(f"  wrote {master} — the SKU -> brand register")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
