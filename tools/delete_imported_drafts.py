#!/usr/bin/env python3
"""Delete ONLY the products this project's importer created.

Deletion is irreversible and Shopify has no undo, so this tool is built
to be unable to delete the wrong thing rather than trusted not to.

THREE INDEPENDENT GUARDS, all must pass before a product is touched:

  1. SKU must match  KJC-<CAT>-<BRAND>-<NNNNN>  — the four-segment form
     the importer generates. The thirteen products that were on the store
     before this project are three-segment (KJC-GU-10001), so they can
     never match.
  2. The five-digit counter must be >= 10015. 10001-10014 are the
     pre-existing products and are refused by number as well as by shape.
  3. Status must be DRAFT. An active product is never deleted, whatever
     its SKU, because an active product may have been sold.

And a fourth, procedural: --dry-run is the default. Deleting requires
--confirm AND typing the expected count with --expect, so a run that
finds more than you thought aborts instead of proceeding.

    export SHOPIFY_ADMIN_TOKEN=shpat_...
    python3 tools/delete_imported_drafts.py                    # dry run
    python3 tools/delete_imported_drafts.py --vendor Alkaram   # scope it
    python3 tools/delete_imported_drafts.py --confirm --expect 515

Token needs write_products.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time

STORE = "qw4zqf-sv.myshopify.com"
API = "2025-01"

# the importer's four-segment form; the pre-existing 13 are three-segment
MINE = re.compile(r"^KJC-(LU|LB|GU|LP|SH|FM|LD)-[A-Z0-9]{3}-(\d{5})$")
PROTECTED_MAX = 10014          # 10001-10014 were on the store before this


def gql(query, variables, token):
    r = subprocess.run([
        "curl", "-sS", "--max-time", "90",
        f"https://{STORE}/admin/api/{API}/graphql.json",
        "-H", f"X-Shopify-Access-Token: {token}",
        "-H", "Content-Type: application/json",
        "-d", json.dumps({"query": query, "variables": variables}),
    ], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"curl failed: {r.stderr[:200]}")
    d = json.loads(r.stdout)
    if d.get("errors"):
        raise RuntimeError(f"graphql: {json.dumps(d['errors'])[:300]}")
    return d["data"]


Q = """
query($cursor: String) {
  products(first: 100, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id title status vendor
      variants(first: 1) { nodes { sku } }
    }
  }
}"""

M_DELETE = """
mutation($input: ProductDeleteInput!) {
  productDelete(input: $input) { deletedProductId userErrors { field message } }
}"""


def load_token():
    t = os.environ.get("SHOPIFY_ADMIN_TOKEN", "")
    if not t:
        env = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                           ".env.local")
        if os.path.exists(env):
            for line in open(env, encoding="utf-8"):
                if line.strip().startswith("SHOPIFY_ADMIN_TOKEN"):
                    t = line.split("=", 1)[1].strip().strip("'\"")
    return t


def classify(p):
    """Return (deletable, reason)."""
    sku = ((p.get("variants") or {}).get("nodes") or [{}])[0].get("sku") or ""
    if p.get("status") != "DRAFT":
        return False, f"status is {p.get('status')}, not DRAFT"
    m = MINE.match(sku)
    if not m:
        return False, f"SKU {sku or '(none)'} is not the importer's four-segment form"
    if int(m.group(2)) <= PROTECTED_MAX:
        return False, f"SKU {sku} is in the protected 10001-{PROTECTED_MAX} range"
    return True, ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--confirm", action="store_true", help="actually delete")
    ap.add_argument("--expect", type=int, help="abort unless exactly this many match")
    ap.add_argument("--vendor", help="restrict to one vendor")
    a = ap.parse_args()

    token = load_token()
    if not token:
        sys.exit("No token. Put SHOPIFY_ADMIN_TOKEN=shpat_... in .env.local or export it.")

    print("  scanning every product on the store…")
    deletable, kept, cursor, total = [], [], None, 0
    while True:
        d = gql(Q, {"cursor": cursor}, token)
        pr = d["products"]
        for p in pr["nodes"]:
            total += 1
            ok, why = classify(p)
            if ok and a.vendor and p.get("vendor") != a.vendor:
                ok, why = False, f"vendor {p.get('vendor')} is not {a.vendor}"
            (deletable if ok else kept).append((p, why))
        if not pr["pageInfo"]["hasNextPage"]:
            break
        cursor = pr["pageInfo"]["endCursor"]
        time.sleep(0.25)

    print(f"  {total} products on the store")
    print(f"  {len(deletable)} match every guard and would be deleted")
    print(f"  {len(kept)} are protected\n")

    reasons = {}
    for p, why in kept:
        key = re.sub(r"KJC-\S+", "KJC-…", why)
        reasons.setdefault(key, []).append(p)
    print("  why the protected ones are protected:")
    for why, ps in sorted(reasons.items(), key=lambda x: -len(x[1])):
        print(f"    {len(ps):5}  {why}")
        for p in ps[:3]:
            sku = ((p.get('variants') or {}).get('nodes') or [{}])[0].get('sku') or '(none)'
            print(f"             e.g. {sku:22} {p['title'][:44]}")
    print()

    if not a.confirm:
        print("  DRY RUN. Nothing deleted. Re-run with --confirm --expect <count>.")
        for p, _ in deletable[:5]:
            sku = ((p.get('variants') or {}).get('nodes') or [{}])[0].get('sku')
            print(f"    would delete {sku:22} {p['title'][:46]}")
        if len(deletable) > 5:
            print(f"    … and {len(deletable)-5} more")
        return

    if a.expect is None:
        sys.exit("  --confirm requires --expect <count>, so a surprise aborts.")
    if a.expect != len(deletable):
        sys.exit(f"  ABORTED. You expected {a.expect}, I matched {len(deletable)}. "
                 f"Nothing deleted — check the filter before forcing it.")

    print(f"  deleting {len(deletable)}…")
    done = 0
    for p, _ in deletable:
        d = gql(M_DELETE, {"input": {"id": p["id"]}}, token)
        errs = d["productDelete"]["userErrors"]
        if errs:
            print(f"    !! {p['title'][:40]}: {errs[0]['message']}")
        else:
            done += 1
        time.sleep(0.55)
        if done % 100 == 0:
            print(f"    … {done}/{len(deletable)}")
    print(f"\n  deleted {done} of {len(deletable)}")


if __name__ == "__main__":
    main()
