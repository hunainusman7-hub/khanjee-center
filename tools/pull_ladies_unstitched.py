#!/usr/bin/env python3
"""Pull ladies UNSTITCHED products from the brands' own Shopify stores.

Every one of these brands runs Shopify, which means /collections.json and
/products.json return structured data — title, price, compare-at, tags,
product_type, variants, images. That is far steadier than scraping HTML,
and it gives us the fields the Khan Jee facets actually need instead of
guesses parsed out of markup.

Khan Jee sells unstitched cloth only, so the filter matters more than the
fetch. Three signals, in order of trust:
  1. the product sits in a collection whose handle says unstitched
  2. product_type or tags say unstitched
  3. the title says unstitched
and anything that looks stitched/pret/ready-to-wear is dropped even if
one of those matched.

Run:  pull_ladies_unstitched.py <outdir> [brand ...]
"""
import json
import re
import subprocess
import sys
import pathlib
import time

COLL_CAP = 60   # per brand; anything dropped is reported, never silent

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

# brand -> its own domain, established from the logo research
BRANDS = {
    "Alkaram": "alkaramstudio.com",
    "Asim Jofa": "asimjofa.com",
    "Crimson": "crimson.com.pk",
    "Gulaal": "gulaal.pk",
    "Bin Ilyas": "binilyas.com",
    "Charizma": "houseofcharizma.com",
    "Elan": "elan.pk",
    "Emaan Adeel": "emaanadeel.com",
    "Mushq": "mushq.com",
    "Rang Rasia": "rangrasiya.com.pk",
    "Ramshah": "ramsha.pk",
    "Lakhanee": "lakhanyonline.com",
    "Raessa": "raeesapremium.com",
    "Florent": "florentpakistan.com",
    "Izinek": "iznikfashions.com",
    "Jhora": "johra.pk",
    "Maria B": "mariab.pk",
}

UNSTITCHED_HINT = re.compile(
    r"unstitch|un-stitch|unstiched|fabric|lawn|khaddar|karandi|cambric|"
    r"jacquard|chiffon|organza|velvet|silk|linen|suit", re.I)
UNSTITCHED_STRICT = re.compile(r"unstitch|un-stitch|unstiched", re.I)
STITCHED_BAD = re.compile(
    r"\bpret\b|ready.to.wear|\bstitched\b|\bkurti\b|\bkurta\b(?!\s*fabric)|"
    r"\bshirt\b(?!ing)|\btrouser\b|\bdupatta\b$|\bbag\b|\bshoe|\bjewel|"
    r"\bfragrance|\bperfume|\bmakeup|\bcosmetic|gift.card|\bmask\b|\bscarf\b",
    re.I)

FABRICS = ["Lawn", "Khaddar", "Karandi", "Cambric", "Jacquard", "Chiffon",
           "Organza", "Velvet", "Net", "Silk", "Linen", "Cotton", "Grip",
           "Viscose", "Georgette", "Raw Silk", "Marina", "Dhanak", "Satin"]
PIECES = [("3", re.compile(r"\b(3|three)[\s-]*(pc|pcs|piece|pieces)\b", re.I)),
          ("2", re.compile(r"\b(2|two)[\s-]*(pc|pcs|piece|pieces)\b", re.I)),
          ("1", re.compile(r"\b(1|one)[\s-]*(pc|pcs|piece|pieces)\b", re.I))]

# Some brands never state a count and instead name the garments, e.g.
# Alkaram's product_type is literally "SHIRT, TROUSER & DUPATTA". Counting
# the named pieces is the only way to get a facet value for those.
GARMENTS = re.compile(r"\bshirt\b|\btrouser\b|\bdupatta\b|\blining\b|\bbottom\b", re.I)


def pieces_from_garments(text):
    found = {m.group(0).lower() for m in GARMENTS.finditer(text or "")}
    found.discard("lining")          # a lining is not sold as a piece
    return str(len(found)) if found else ""


def get(url):
    r = subprocess.run(["curl", "-sL", "--max-time", "40", "-A", UA, url],
                       capture_output=True, text=True)
    if r.returncode != 0 or not r.stdout.strip():
        return None
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        return None


def collections(domain):
    out, page = [], 1
    while page <= 6:
        d = get(f"https://{domain}/collections.json?limit=250&page={page}")
        if not d or not d.get("collections"):
            break
        out += d["collections"]
        if len(d["collections"]) < 250:
            break
        page += 1
        time.sleep(0.3)
    return out


def products(domain, collection=None):
    base = f"https://{domain}"
    if collection:
        base += f"/collections/{collection}"
    out, page = [], 1
    while page <= 12:
        d = get(f"{base}/products.json?limit=250&page={page}")
        if not d or not d.get("products"):
            break
        out += d["products"]
        if len(d["products"]) < 250:
            break
        page += 1
        time.sleep(0.3)
    return out


def derive(p, source_collection):
    hay = " ".join([p.get("title", ""), p.get("product_type", "") or "",
                    " ".join(p.get("tags", []) or []), source_collection or ""])
    fabric = next((f for f in FABRICS if re.search(rf"\b{f}\b", hay, re.I)), "")
    pieces = next((n for n, rx in PIECES if rx.search(hay)), "")
    if not pieces:
        pieces = pieces_from_garments(p.get("product_type", "") + " " + p.get("title", ""))
    v = (p.get("variants") or [{}])[0]
    price = v.get("price") or ""
    cmp_at = v.get("compare_at_price") or ""
    imgs = [i.get("src", "") for i in (p.get("images") or [])]
    return {
        "source_title": p.get("title", "").strip(),
        "handle": p.get("handle", ""),
        "product_type": (p.get("product_type") or "").strip(),
        "tags": "|".join(p.get("tags") or []),
        "fabric": fabric,
        "pieces": pieces,
        "price_pkr": price,
        "compare_at_pkr": cmp_at,
        "available": any(x.get("available") for x in (p.get("variants") or [])),
        "variant_count": len(p.get("variants") or []),
        "image_count": len(imgs),
        "images": "|".join(imgs[:6]),
        "source_collection": source_collection or "",
        "source_url": f"https://{{domain}}/products/{p.get('handle','')}",
    }


def is_unstitched(p, coll_handle):
    title = p.get("title", "") or ""
    ptype = p.get("product_type", "") or ""
    tags = " ".join(p.get("tags") or [])
    if STITCHED_BAD.search(title) and not UNSTITCHED_STRICT.search(title + tags + ptype + (coll_handle or "")):
        return False, "looks stitched/non-cloth"
    for field, why in ((coll_handle or "", "collection"), (ptype, "product_type"),
                       (tags, "tags"), (title, "title")):
        if UNSTITCHED_STRICT.search(field):
            return True, f"strict:{why}"
    for field, why in ((coll_handle or "", "collection"), (ptype, "product_type")):
        if UNSTITCHED_HINT.search(field):
            return True, f"hint:{why}"
    return False, "no unstitched signal"


def main(outdir, only=None):
    out = pathlib.Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    summary = []
    for brand, domain in BRANDS.items():
        if only and brand not in only:
            continue
        cols = collections(domain)
        unst = [c["handle"] for c in cols
                if UNSTITCHED_STRICT.search(c["handle"]) or UNSTITCHED_STRICT.search(c.get("title", ""))]
        rows, seen = [], set()
        if unst:
            for h in unst[:COLL_CAP]:
                for p in products(domain, h):
                    if p["id"] in seen:
                        continue
                    ok, _ = is_unstitched(p, h)
                    if not ok:
                        continue
                    seen.add(p["id"])
                    r = derive(p, h)
                    r["source_url"] = r["source_url"].replace("{domain}", domain)
                    r["brand"] = brand
                    rows.append(r)
        else:
            for p in products(domain):
                ok, _ = is_unstitched(p, None)
                if not ok or p["id"] in seen:
                    continue
                seen.add(p["id"])
                r = derive(p, "")
                r["source_url"] = r["source_url"].replace("{domain}", domain)
                r["brand"] = brand
                rows.append(r)

        (out / f"{brand.lower().replace(' ', '-')}.json").write_text(json.dumps(rows, indent=1))
        summary.append({"brand": brand, "domain": domain,
                        "collections_total": len(cols),
                        "unstitched_collections": unst,
                        "products": len(rows),
                        "with_images": sum(1 for r in rows if r["image_count"]),
                        "with_fabric": sum(1 for r in rows if r["fabric"]),
                        "with_pieces": sum(1 for r in rows if r["pieces"])})
        s = summary[-1]
        capped = max(0, len(unst) - COLL_CAP)
        note = f"  [CAPPED: {capped} more unstitched collections not read]" if capped else ""
        print(f"  {brand:14} {domain:22} {s['products']:4} unstitched  "
              f"({min(len(unst), COLL_CAP)} of {len(unst)} unstitched collections, "
              f"{len(cols)} total){note}", flush=True)

    (out / "_summary.json").write_text(json.dumps(summary, indent=1))
    tot = sum(s["products"] for s in summary)
    print(f"\n  {tot} products across {len(summary)} brands")


if __name__ == "__main__":
    main(sys.argv[1], set(sys.argv[2:]) or None)
