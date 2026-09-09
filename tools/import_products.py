#!/usr/bin/env python3
"""Import the ladies-unstitched CSV into Shopify, and file each product
into its brand collection.

WHY THIS IS A SCRIPT YOU RUN, NOT SOMETHING I RAN
The Shopify CLI can pull and push themes; it cannot create products or
collections. That needs an Admin API token, and an Admin token must not
be pasted into a chat window — so it goes in your shell, not in mine:

    export SHOPIFY_ADMIN_TOKEN=shpat_...
    python3 tools/import_products.py --dry-run          # look first
    python3 tools/import_products.py --limit 20         # a real test batch
    python3 tools/import_products.py                    # everything

Token needs: write_products, write_inventory.
Get one at Admin -> Settings -> Apps -> Develop apps -> create an app.

WHAT IT DOES
1. Creates one AUTOMATED collection per brand, with the rule
   tag equals brand:<Brand>. Automated, not manual — so a product files
   itself the moment it carries the tag, and anything imported later
   lands in the right place without a second pass. This is what fixes
   "the products aren't showing up in their respective pages".
2. Creates each product as DRAFT with its images, price, compare-at
   price, tags and the four custom.by_* metafields the theme's filters
   read.
3. Activates inventory at the store location and sets the quantity.
   inventoryItemUpdate(tracked:true) must run BEFORE inventoryActivate,
   or Shopify answers "inventory item is not stocked at this location" —
   that pair, in that order, is what stops a product reading Sold out.
4. Skips anything already present, by SKU, so re-running is safe.

Everything stays DRAFT. Nothing here publishes.
"""
import argparse
import csv
import json
import os
import re
import subprocess
import sys
import time

STORE = "qw4zqf-sv.myshopify.com"
API = "2025-01"
LOCATION_GID = "gid://shopify/Location/88274272429"
CSV_PATH = "data/ladies-unstitched-import.csv"
DEFAULT_QTY = 10


def gql(query, variables, token):
    body = json.dumps({"query": query, "variables": variables})
    r = subprocess.run([
        "curl", "-sS", "--max-time", "90",
        f"https://{STORE}/admin/api/{API}/graphql.json",
        "-H", f"X-Shopify-Access-Token: {token}",
        "-H", "Content-Type: application/json",
        "-d", body,
    ], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"curl failed: {r.stderr[:300]}")
    try:
        d = json.loads(r.stdout)
    except json.JSONDecodeError:
        raise RuntimeError(f"non-JSON reply: {r.stdout[:300]}")
    if d.get("errors"):
        raise RuntimeError(f"graphql errors: {json.dumps(d['errors'])[:400]}")
    return d["data"]


Q_EXISTING_SKUS = """
query($cursor: String) {
  productVariants(first: 250, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes { sku }
  }
}"""

M_COLLECTION = """
mutation($input: CollectionInput!) {
  collectionCreate(input: $input) {
    collection { id handle title }
    userErrors { field message }
  }
}"""

M_PRODUCT = """
mutation($input: ProductInput!, $media: [CreateMediaInput!]) {
  productCreate(input: $input, media: $media) {
    product { id handle variants(first: 1) { nodes { id inventoryItem { id } } } }
    userErrors { field message }
  }
}"""

M_TRACK = """
mutation($id: ID!, $input: InventoryItemInput!) {
  inventoryItemUpdate(id: $id, input: $input) {
    inventoryItem { id tracked }
    userErrors { field message }
  }
}"""

M_ACTIVATE = """
mutation($inventoryItemId: ID!, $locationId: ID!, $available: Int) {
  inventoryActivate(inventoryItemId: $inventoryItemId, locationId: $locationId,
                    available: $available) {
    inventoryLevel { id quantities(names: ["available"]) { name quantity } }
    userErrors { field message }
  }
}"""


def existing_skus(token):
    out, cursor = set(), None
    while True:
        d = gql(Q_EXISTING_SKUS, {"cursor": cursor}, token)
        pv = d["productVariants"]
        for n in pv["nodes"]:
            if n.get("sku"):
                out.add(n["sku"])
        if not pv["pageInfo"]["hasNextPage"]:
            return out
        cursor = pv["pageInfo"]["endCursor"]
        time.sleep(0.3)


def read_csv(path):
    """Fold the image continuation rows back onto their product."""
    products, order = {}, []
    for row in csv.DictReader(open(path, encoding="utf-8")):
        h = row["Handle"]
        if row.get("Variant SKU"):
            row["_images"] = [row["Image Src"]] if row["Image Src"] else []
            products[h] = row
            order.append(h)
        elif h in products and row.get("Image Src"):
            products[h]["_images"].append(row["Image Src"])
    return [products[h] for h in order]


def brand_collections(rows, token, dry):
    brands = sorted({r["_source_brand"] for r in rows})
    made = []
    for b in brands:
        handle = "ladies-" + re.sub(r"[^a-z0-9]+", "-", b.lower()).strip("-")
        inp = {
            "title": f"Ladies · {b}",
            "handle": handle,
            "descriptionHtml": f"<p>Unstitched cloth by {b}, on the shelf at Khan Jee.</p>",
            # Automated: the rule does the filing, now and for every later import.
            "ruleSet": {"appliedDisjunctively": False,
                        "rules": [{"column": "TAG", "relation": "EQUALS",
                                   "condition": f"brand:{b}"}]},
        }
        if dry:
            print(f"    would create collection {handle}  (rule: tag = brand:{b})")
            made.append(handle)
            continue
        d = gql(M_COLLECTION, {"input": inp}, token)
        errs = d["collectionCreate"]["userErrors"]
        if errs:
            msg = errs[0]["message"]
            if "already been taken" in msg.lower() or "must be unique" in msg.lower():
                print(f"    collection {handle} already exists, left alone")
            else:
                print(f"    !! {handle}: {msg}")
        else:
            print(f"    created {d['collectionCreate']['collection']['handle']}")
            made.append(handle)
        time.sleep(0.4)
    return made


def make_product(r, token, qty, dry):
    mf = []
    for key, col in [("by_fabric", "Metafield: custom.by_fabric [single_line_text_field]"),
                     ("by_pieces", "Metafield: custom.by_pieces [single_line_text_field]"),
                     ("by_type",   "Metafield: custom.by_type [single_line_text_field]"),
                     ("by_color",  "Metafield: custom.by_color [single_line_text_field]")]:
        if r.get(col):
            mf.append({"namespace": "custom", "key": key,
                       "type": "single_line_text_field", "value": r[col]})

    inp = {
        "title": r["Title"],
        "handle": r["Handle"],
        "vendor": r["Vendor"],
        "productType": r["Type"],
        "tags": [t.strip() for t in r["Tags"].split(",") if t.strip()],
        "status": "DRAFT",
        "metafields": mf,
    }
    media = [{"originalSource": u, "mediaContentType": "IMAGE",
              "alt": r.get("Image Alt Text") or r["Title"]}
             for u in r["_images"][:6]]

    if dry:
        print(f"    would create {r['Variant SKU']}  {r['Title'][:44]:44} "
              f"Rs {r['Variant Price']:>9}  {len(media)} images, {len(mf)} metafields")
        return

    d = gql(M_PRODUCT, {"input": inp, "media": media}, token)
    errs = d["productCreate"]["userErrors"]
    if errs:
        print(f"    !! {r['Variant SKU']}: {errs[0]['message']}")
        return
    prod = d["productCreate"]["product"]
    var = prod["variants"]["nodes"][0]
    item = var["inventoryItem"]["id"]

    # tracked first, THEN activate — the other order fails with
    # "inventory item is not stocked at this location"
    gql(M_TRACK, {"id": item, "input": {"tracked": True}}, token)
    gql(M_ACTIVATE, {"inventoryItemId": item, "locationId": LOCATION_GID,
                     "available": qty}, token)
    print(f"    {r['Variant SKU']}  {prod['handle'][:52]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--qty", type=int, default=DEFAULT_QTY)
    ap.add_argument("--in-stock-only", action="store_true",
                    help="skip rows the source brand has already sold out")
    ap.add_argument("--csv", default=CSV_PATH)
    a = ap.parse_args()

    token = os.environ.get("SHOPIFY_ADMIN_TOKEN", "")
    if not token and not a.dry_run:
        sys.exit("SHOPIFY_ADMIN_TOKEN is not set. Export it, or use --dry-run.")

    rows = read_csv(a.csv)
    if a.in_stock_only:
        before = len(rows)
        rows = [r for r in rows if r.get("_in_stock_at_source") == "yes"]
        print(f"  in-stock filter: {before} -> {len(rows)}")
    if a.limit:
        rows = rows[:a.limit]

    print(f"  {len(rows)} products to import, quantity {a.qty}, all DRAFT")
    if not a.dry_run:
        print("  reading existing SKUs so a re-run cannot duplicate…")
        have = existing_skus(token)
        before = len(rows)
        rows = [r for r in rows if r["Variant SKU"] not in have]
        print(f"  {before - len(rows)} already on the store, {len(rows)} to create")

    print("\n  collections")
    brand_collections(rows, token, a.dry_run)

    print("\n  products")
    for i, r in enumerate(rows, 1):
        make_product(r, token, a.qty, a.dry_run)
        if not a.dry_run:
            time.sleep(0.55)        # 2 calls/sec is the REST-era limit; be kind
        if i % 100 == 0:
            print(f"    … {i}/{len(rows)}")

    print(f"\n  done. {len(rows)} products, all DRAFT — nothing is published.")


if __name__ == "__main__":
    main()
