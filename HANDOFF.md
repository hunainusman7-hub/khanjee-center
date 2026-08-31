# Handoff — Khan Jee Center landing pages

**Read this first.** It carries the context from Zain's session (31 Aug 2026)
into whatever machine picks this up next. Everything here is either confirmed
by the client or explicitly flagged as unconfirmed — nothing in between.

```bash
git clone https://github.com/zw-uml/khanjee-center.git
cd khanjee-center && python3 -m http.server 8000
```

Live: **https://zw-uml.github.io/khanjee-center/** (Pages, `main` branch, root)

---

## 1. What the business actually is

**Khan Jee Center** — Civil Quarters Road, Sheikhupura, Punjab. Est. **1978**.
Owner **Abdul Hayee Khan**. WhatsApp **+92 301 9090590**
(`https://wa.me/923019090590`). Domain **khanjeecenter.com**. PKR, PKT.

It is a **multi-brand fabric and ready-to-wear house** — a "house of brands".
It is **NOT a khaddar house.** This was got wrong once and corrected: khaddar is
**one category among many**, sitting beside boski, shirting, shawls and about
28 stocked labels. Do not let khaddar become the identity again, in copy, in
the title tag, or in the nav.

Names that are retired and must not come back: "Khan Jee Khadar", "Khan Jee"
alone. "Khaddar" stays correct as a *fabric word*, never as the brand.

### What they stock
Full list in `data/stock-list.json`.

- **Gents** — Khaddar, Boski, Shirting, Shawls, Grace, Pasha, Dynasty,
  Gul Ahmed, Asco, Narkin's
- **Ladies** — Maria.B, Nishat, Limelight, Zellbury, Saira Shakira,
  Khoobsoorat, Shaista, Nuréh, Razab, Mahees, Izza, Colorum, Watan, Nazakat,
  Abaya, Shawls
- **Bridal** — Razab, Maria.B

Transcribed from a handwritten note. **Spellings still need the client's own:**
Nuréh (written "Nuren"), Narkin's, Colorum/Izza, Watan/Nazakat.

**Stocking a label is not the same as holding rights to its logo or catalogue
imagery.** Every brand name renders as plain text. No supplier logo or
catalogue photo goes on this site until dealer status and image rights are
confirmed in writing. This is a real business risk, not a copy nuance.

---

## 2. Decisions already made — don't relitigate

| | |
|---|---|
| **Logo** | The traced KJ mark in `assets/logo/kj-mark.svg`. **Do not redraw it.** It is **red** (`--red: #9A1B2F`), reversing to white on dark surfaces. |
| **Palette** | Red brand, warm neutrals, white shop ground. In `assets/css/tokens.css`. A Navy/Gold and an Indigo/Bone "Dye House" palette both appear in older docs — **both are dead.** |
| **Type** | Archivo (body/UI), Archivo Black (wordmark/hero), Bodoni Moda (heritage quote + brand marquee only), Italianno (LADA script, unused so far). |
| **Figures** | **No monospace.** Archivo with `tabular-nums`. An earlier IBM Plex Mono treatment was rejected — it read as a spec sheet. None of the brands they stock use a mono for prices. |
| **No cut calculator** | Removed on instruction. Cloth lengths get pre-set as **Shopify variants** once the client confirms them. Do not rebuild a calculator. |
| **No standalone khaddar page** | Removed on instruction. |

### The market is the brief
Measured 31 Aug 2026 on the brands Khan Jee actually stocks:

| Site | Images on homepage | Ground | Type |
|---|---|---|---|
| Gul Ahmed | 222 | white | Montserrat / Cabin |
| Maria B | 97 | white | Montserrat |
| Zellbury | 94 | white | Roboto |
| Limelight | 62 | white | Visby CF |

**White ground, plain workhorse sans, 60–220 photographs.** The product
photography *is* the design; typography stays out of its way. A first attempt
that ignored this — cream editorial ground, Didone serif, procedural textures,
loud `[PENDING]` boxes on the page — was rejected outright. Design from the
market, not from spec documents. **Never put engineering markers in a
client-facing design.**

Other references reviewed: Rastah (centred wordmark, nav split around it),
LAMA (sticky mobile CTA bar, PKR strikethrough pricing), Brunello Cucinelli
(restraint — 28px headings, no button chrome, two-colour palette).

---

## 3. The three versions

- **V1 — Cinematic** *(built, live at `/v1/`)*. Hiran Minar hero with Ken
  Burns, warm maroon scrim so shadows stay red, header slides in after the
  hero. White shop below: counter section, category tiles, brand marquee,
  new-in row, heritage band, service strip.
- **V2 — Shop-first** *(not built)*. The Zellbury/Gul Ahmed structure:
  promotional banner carousel, dense category and product grids, sale badges,
  brand roster. Converts hardest.
- **V3 — Editorial** *(not built)*. Fashion-house feel, serif display, big
  photography, 1978 story front and centre, low product density.

Root `index.html` already lists all three; V2/V3 are marked "Soon" so the URL
structure won't change when they land.

---

## 4. Photography — the biggest gap

Only **7 real images** exist, all carried over from Hunain's first repo:
`assets/img/hero/` (Hiran Minar ×4 crops) and `assets/img/categories/` (6).

Credits and licences are in `CREDITS.md` — **read it before adding images.**
Short version: Hiran Minar is CC BY-SA 4.0 and the footer attribution is
required; two category tiles are client-supplied catalogue covers; the rest are
Pexels. Getty stock that appeared in the original supplied material is **not
used and must not be** — one copy had its watermark removed.

The gap is marked with **one quiet grey line**, never a hatched box:
> "The full catalogue is being photographed at the shop this week."

Highest-impact single change available: a real bolt-of-cloth shot. Right now
`men-unstitched.jpg` does double duty as both the counter image and a tile.

---

## 5. Still unconfirmed — do not invent values

1. **Exchange/return window** — no number anywhere yet.
2. **PostEx delivery SLA** — no hour or day count yet.
3. **Exact street address** beyond "Civil Quarters Road".
4. **Prices** — nothing priced. Not on the page at all right now.
5. **Policy copy** (refund / privacy / terms / shipping). The earlier brief said
   to port these from a prior static build — **those files do not exist.** That
   build has only khaddar/lada/women/bridal/locations/size-chart. This copy has
   to be written or supplied.
6. **Where LADA sits.** An earlier brief has it as a confirmed in-house
   waistcoat label, sizes 38R–46R. It appears **nowhere** on the client's own
   stock list. Currently it shows once, in red italic at the end of the brand
   marquee, as "LADA — our own".
7. **"Fifty labels, and one of our own"** — the marquee headline, carried from
   Hunain's copy. **28 names are on the actual list.** Needs a real number or
   softer wording before launch.
8. **Cloth lengths.** 4.0m / 4.5m / 7.0m were confirmed for men's khaddar in an
   earlier brief, but with the calculator removed they are not on the page.
   They become Shopify variants later.

---

## 6. Where things are

```
khanjee-center/
├── index.html              version chooser (V1 live, V2/V3 stubbed)
├── v1/index.html           V1 — the built page
├── assets/
│   ├── css/  tokens · base · v1 · fonts     <- tokens.css is the one to edit
│   ├── js/site.js          reveal, hero scroll progress, mobile menu
│   ├── fonts/              self-hosted woff2, no CDN request
│   ├── img/hero · categories
│   └── logo/kj-mark.svg    do not redraw
├── data/stock-list.json    the real brand list + spelling flags
├── CREDITS.md              licences — read before adding imagery
└── BUILD-NOTES.md          older notes; this file supersedes where they differ
```

**Build hygiene that is already handled:** fonts self-hosted (no Google Fonts
request), reveal animations are opt-in via a `js-reveal` class so a failed
script can never leave content invisible, 2.5s safety net reveals everything
regardless, `prefers-reduced-motion` respected throughout, no horizontal
overflow at 375/390/768/1280, touch targets ≥44px.

**Shopify:** the eventual build is Online Store 2.0, forking Dawn, Tailwind
compiled to a static `assets/theme.css` — never the Play CDN. Cart is the real
Shopify cart (COD via PostEx, card via UnumPay once NTN clears). WhatsApp is a
**support channel**, not the checkout — except bridal, which is a booking
request. These pages are design direction, not the theme; every section is
marked with an HTML comment that maps to a future `sections/*.liquid`.
