# SKU scheme

    KJC - {CAT} - {BRAND} - {NNNNN}
    KJC - LU    - ASJ     - 10231

`KJC` and the `{CAT}` codes are unchanged from what was already decided.
`{BRAND}` and the shared counter are the part that was missing.

## KJC
Fixed. Every code is a Khan Jee code — that is what "we name them
ourselves" means. A house on the shelf can be shown by name to a
customer; the code is still ours.

## CAT — two letters, as decided

| code | meaning |
|---|---|
| `GU` | gents unstitched |
| `LU` | ladies unstitched |
| `LB` | ladies bridal |
| `LP` | lawn print |
| `SH` | shawls |
| `FM` | fabric by the metre |
| `LD` | Lada |

## BRAND — three letters

The link. It is what makes a code tell you, on a tag in the shop and
without looking anything up, which house a piece came from. The full
register is `data/brand-codes.csv` — 60 houses plus two of our own:

- `KHJ` — Khan Jee's own unbranded cloth
- `LDA` — Lada

Codes are derived, not invented: one word takes its first three letters
(`ALK` Alkaram, `GUL` Gulaal), two words take the first two letters of
the first plus the initial of the second (`ASJ` Asim Jofa, `MAB` Maria B,
`RAR` Rang Rasia). Collisions fall through a fixed list of alternatives
and only then to a digit — `SH2` Shahista is the single case, because
`SHA`, `SHH` and `SHR` were already taken by Shabbir, Shiza Hassan and
Shaffer.

**The register is append-only.** A code that has been printed on a tag
must never be reassigned to a different house.

## NNNNN — five digits, one shared counter

Not per-category and not per-brand. A single running sequence across the
whole catalogue, so no number is ever used twice and a code is unique on
its own.

`10001`–`10014` are already spent on the 13 products on the store, so
everything new starts at **`10015`**.

## The 14 products already on the store

They carry the old two-segment form (`KJC-GU-10002`) because they were
created before the brand segment existed. Their numbers are reserved
either way, so they can be left alone or restamped later; nothing
depends on them matching.

## kjc_master.csv

`data/kjc_master.csv` maps every SKU to its brand and to the source URL
it was read from. It is committed because these are houses Khan Jee
stocks BY NAME — the brand is already in the product title, the Vendor
field and the navigation, so the mapping reveals nothing a customer
cannot see on the page.

That is not true of unbranded cloth. If rows for a supplier who is NOT
named to customers are ever added to this file — the original handoff's
example is Nishat — the file becomes confidential and must come out of
the repo. Keep those in a separate register.
