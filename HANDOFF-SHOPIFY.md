# Handoff — Khan Jee Center Shopify build

Everything needed to pick this up on another machine. Current as of 8 Sep 2026.

> The older `HANDOFF.md` / `BUILD-NOTES.md` describe the **static landing-page
> comparison** that came before this. The business facts in `HANDOFF.md` §1 are
> still correct and still worth reading. Its design decisions have been
> superseded by §4 below.

---

## 1. Get set up (30 minutes)

```bash
# 1. the repo
git clone https://github.com/zw-uml/khanjee-center.git
cd khanjee-center
git checkout claude/shopify-store-integration-f96pko

# 2. Shopify CLI
npm install -g @shopify/cli @shopify/theme
shopify auth login --store khanjeecenter.myshopify.com

# 3. pull the FULL theme (see the warning below)
shopify theme pull --theme 158200332461 --path ./shopify-theme

# 4. work live against the draft theme
cd shopify-theme && shopify theme dev --theme 158200332461
```

### ⚠️ Read this before you edit anything

**`theme/` in this repo is NOT the whole theme.** It holds only the files the
v2 redesign touched. Files like `sections/header.liquid`,
`sections/footer.liquid`, `sections/main-product.liquid`,
`sections/main-cart.liquid`, `assets/site.css`, `assets/site.js`,
`assets/fonts.css` and the font `.woff2` files **exist only on the Shopify
theme** — they were uploaded during the port and never committed back.

So: **`shopify theme pull` first**, and treat that pull as the source of truth.
Then copy this repo's `theme/*` over the top of it (they are newer), and from
then on commit the whole theme, not just the changed files. That gap is the
single biggest trap in this handoff.

---

## 2. Store and theme IDs

| | |
|---|---|
| Store | `khanjeecenter.myshopify.com` — public domain `www.khanjeecenter.com` |
| **Live theme** | `Khan Jee Liquid Port - fix` — `158157045933` |
| **Draft theme (all v2 work)** | `Khan Jee — v2 Design` — `158200332461` |
| Draft preview | `https://www.khanjeecenter.com/?preview_theme_id=158200332461` |
| Location (inventory) | `gid://shopify/Location/88274272429` |
| Branch | `claude/shopify-store-integration-f96pko` (PR #1, open, no CI) |
| Admin API token | in Hunain's `SHOPIFY.md`. **Never paste it into a chat window.** |

**The draft theme is not published.** Publishing must be done by hand in
Shopify admin → Online Store → Themes → Actions → Publish. Automated publishing
is blocked, so nobody has done it yet — this is the #1 pending item.

---

## 3. What is built

### Sections (all in `theme/sections/`)
`hero-slideshow` · `category-rail` · `product-carousel` · `collection-split` ·
`editorial-pair` · `brand-marquee` · `brand-directory` · `product-rail` ·
`main-collection` · `main-cart` · and the five Lada sections
(`lada-hero`, `lada-craft`, `lada-collection`, `lada-promise`, `lada-sizing`).

### Snippets
`product-card.liquid` (hover image swap + the white-label naming rule),
`kj-nav.liquid`, `kj-footer.liquid`.

### Templates
`index.json` (hero → categories → trending → split → pair → brand-marquee →
lada-band), `page.lada.json`, `page.brands.json`.

### Assets
`kj-v2.css` (~27 KB, the whole v2 design layer, extends `site.css`) and
`kj-v2.js` (~7 KB — hero slideshow, marquee duplication, touch image swap,
carousel tabs, split dots; all progressive enhancement, nothing breaks with JS
off).

### Not yet done
- **`main-product.liquid` (the product page) is still the basic first-build
  version** — a plain image, title, price, add-to-cart. It is the next job and
  the one every product you add will use. Plan: gallery with thumbnails, title
  + SKU, price with compare-at/% OFF, add-to-cart plus a WhatsApp enquiry
  secondary, trust row, spec table off the five `custom.by_*` metafields,
  related-products rail using `product-card`.
- Bridal page, fabric-by-the-metre department, about / stores / size-guide
  copy, search results page.
- Real logos for the ~62 whitelist brands that don't have a file yet.

---

## 4. Design rules — these were hard-won, don't drift off them

The client rejected an earlier build in these words: *"the design is just very
off, it doesn't look good at all"*, and separately *"you changed the theme and
the colour scheme, I want the same old one"* and *"fonts are irregular"*. All
three were about drift away from the original `site.css`. So:

**Tokens come from `site.css` and do not get redefined.**
`--accent:#9A1B2F` (crimson) · `--gold:#C6A15B` · `--surface-dark:#14100E` ·
`--bg:#FFFFFF` · `--radius:0` (square corners — no rounding anywhere).

**Type system, stated once at the bottom of `kj-v2.css` so it can't drift:**

| Font | Used for — and only this |
|---|---|
| `--font-heavy` Archivo Black | hero H1 and the header wordmark |
| `--font-display` Bodoni Moda | every heading, card title, brand name |
| `--font-ui` Archivo | body, eyebrows, tabs, buttons, prices |
| `--font-script` Italianno | Lada script only |

**The Hiran Minar hero gradient.** The client noticed the moment it went
missing. It is the `.hs__scrim` rule in `kj-v2.css` — a radial crimson wash
over a vertical dark gradient, plus a `saturate/contrast/sepia` filter on
`.hs__img`. If the hero ever looks flat, that rule got clobbered.

**Reference:** mariab.pk layouts, plus the screenshots in the chat history.
"Choose your cloth" was removed on instruction and must not come back.

---

## 5. The white-label product model — this is a commercial rule, not a style one

The shop stocks ~60 supplier brands. **Only Dynasty and Pasha may be sold under
their real cloth name.** Everything else is sold as a Khan Jee piece under a
generated SKU, and the supplier brand is never shown.

Enforced in `snippets/product-card.liquid`:

```liquid
assign named_houses = 'Dynasty,Pasha' | split: ','
assign show_vendor = false
for house in named_houses
  if product.vendor == house
    assign show_vendor = true
  endif
endfor
```

**Never publish `vendor_brand` to any customer-facing surface** — that includes
`<meta>` tags, JSON-LD, image alt text, image filenames, and the Shopify
`Vendor` field. `internal.*` metafields must be created with
`"visibleToStorefrontApiAccess": false`. `kjc_master.csv` (SKU → supplier map)
is confidential: never in the theme repo, never in a public bucket, never in a
client WhatsApp group.

This has been broken once already — a product went live titled "Khan Jee
Gentlemen **Nishat** Boski…". Nishat is a supplier. It was renamed. Check every
title before it goes ACTIVE.

**Brand logos are the one exception**: all brands get a logo on the brand wall
(`brand-directory` / `brand-marquee`). The rule is about *product listings*, not
the brand wall. Tagline is **"All brands under one roof"** (not "20 brands").

### SKU scheme
`KJC-{CAT}-{5 digits}`, CAT ∈ `LU` ladies unstitched · `LB` ladies bridal ·
`GU` gents unstitched · `LP` lawn print · `SH` shawls · `FM` fabric by metre ·
`LD` Lada.

---

## 6. Products currently on the store

13 products, all **DRAFT**, all created without images:

| SKU | note |
|---|---|
| `KJC-GU-10001`, `10003`, `10004`, `10005`, `10008`, `10009`, `10010`, `10011`, `10013` | Khan Jee gents |
| `KJC-GU-10002`, `KJC-GU-10006` | **Dynasty** — real name shown |
| `KJC-LU-10012`, `KJC-LU-10014` | Khan Jee ladies |

Product IDs: 8752701735085, 8752701833389, 8752702161069, 8752702357677,
8752702488749, 8752702718125, 8752702816429, 8752702914733, 8752702980269,
8752703078573, 8752703209645, 8752703340717, 8752703406253.

Inventory was set with `inventoryItemUpdate(tracked: true)` then
`inventoryActivate(available: 25)` at the location above. If a product shows
**Sold out**, that pair of calls is what fixes it — `inventorySetOnHandQuantities`
fails with *"inventory item is not stocked at this location"* unless
`inventoryActivate` ran first.

### Blocked on you: images
The photos are generic `IMG_60xx.JPG` filenames in Drive, the sheet's Photo
column is empty, and the files are 3–7 MB each. **Nothing can map an image to a
product without a human doing it.** Fill in the filename column of
`kjc-image-mapping.csv`, upload the photos to Shopify Files (or make the Drive
folder link-public), then attach images and flip the 13 products to ACTIVE.

Sheet: `docs.google.com/spreadsheets/d/15pUA79CJinHPg_GAmIPoHq0d6FqAMNBaA1s4Tdsy0AM`

---

## 7. Techniques worth keeping

**Upload theme files without pushing bytes through a chat context.** Commit to
GitHub, then `themeFilesUpsert` with `type: URL` pointed at
`raw.githubusercontent.com/zw-uml/khanjee-center/<branch>/theme/<path>` —
Shopify fetches it server-side. This turned a rate-limit failure into two API
calls. On Hunain's laptop `shopify theme push` does the same job more simply.

**Known API gotchas.** The input type is `InventoryItemInput`, not
`InventoryItemUpdateInput`. `themeDuplicate` returns its payload under
`newTheme`, not `theme`. `themeFilesUpsert` refuses to target the live theme —
duplicate to a draft first. A `page.foo.json` and a `page.foo.liquid` cannot
coexist; `page.brands` is the `.liquid` one and renders
`{% section 'brand-directory' %}`.

**The cart page.** Shopify's stock `main-cart` is block-based and needs locale
keys this theme doesn't have — it rendered as a wall of "Translation missing:".
`sections/main-cart.liquid` here is deliberately self-contained. Don't swap it
back for the Horizon version.

---

## 8. Do these next, in this order

1. **Publish the draft theme by hand** and look at the preview.
2. Redesign `main-product.liquid` (§3).
3. Map the product images and take the 13 products ACTIVE (§6).
4. Confirm two department calls with the client: **Gul Ahmad** is currently
   under Gents, **Zebtan** under Bridal.
5. Remaining pages: bridal, fabric-by-the-metre, about / stores / size guide,
   search.
