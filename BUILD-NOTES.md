# Khan Jee Center — landing page, three directions

Three complete landing-page directions for the client to compare. Open
`index.html` for the chooser, or go straight to a variant:

| | Direction | In one line |
|---|---|---|
| **V1** | `v1-cinematic/` | Full-bleed hero, mark centred, staggered editorial grid |
| **V2** | `v2-ledger/` | Type-led order book — no photography needed |
| **V3** | `v3-bolt/` | Merchandising-led, closest to how PK fabric retail converts |

Run locally:

```bash
node .claude/serve.mjs
```

All three share `assets/css/{tokens,base,fonts}.css` and `assets/js/site.js`.
Only the per-variant stylesheet differs. **Content is identical across all
three** — this is a choice about voice, not about what is on the page.

---

## What this build is, and is not

It is a **design-direction comparison**, built as static HTML so the client can
look at three options quickly. It is **not** the production Shopify theme.

Every section is marked with a `<!-- SECTION: name -->` comment that maps 1:1
onto a future `sections/*.liquid`, and the CSS is already tokenised the way
Shopify theme settings expect — so the port is mechanical, not a rewrite. But
the standing instruction that the real build forks Dawn and compiles Tailwind
to `assets/theme.css` still applies to that build. Nothing here contradicts it;
this step just comes before it.

---

## Where this came from

**Seeded from Hunain's `v1-cinematic`** (github.com/hunainusman7-hub/khanjee-landing).
His v2-gallery was dropped, as instructed. What carried over: the full-bleed
cinematic hero, the wordmark pinning into the header on scroll, the staggered
category grid, square corners — and the **traced KJ logo mark**, which is the
one asset reused verbatim.

What did **not** carry over, and why:

| His v1 | This build | Why |
|---|---|---|
| "Khan Jee Fabrics — House of Brands" | **Khan Jee Center** | Name resolved 30 Aug 2026 |
| Royal red / gold / sandstone, Bodoni + Archivo | **The Dye House** palette, Fraunces + Karla + IBM Plex Mono | Dye House is the canonical, WCAG-checked system |
| Six category tiles | Khaddar-led + full stocked range | The client's actual list made both models wrong |
| "Fifty of Pakistan's finest labels" | *(cut)* | Unverified number. The real list is in `data/stock-list.json` |
| Hiran Minar hero photo (CC BY-SA) | Procedural weave placeholder | Attribution burden, and it is a monument not a fabric |

**Reference sites reviewed live (31 Aug 2026):** Rastah, LAMA, Maria B,
Limelight, Brunello Cucinelli.

- **Rastah** → centred wordmark with the nav split around it (used in V3)
- **LAMA / Maria B** → PKR figures in tabular mono, category chips above the
  grid, a sticky mobile bar pairing the primary CTA with a support channel
- **Brunello Cucinelli** → the biggest influence. Their hero headline is 28px,
  not 64px; their primary CTA has no fill, no border, no radius — 14px
  uppercase at 0.2em tracking and nothing else. Awwwards lists their whole
  palette as **two** colours. That restraint drove `--radius: 0`, the
  `.btn-text` style, and using indigo/brass far more sparingly than a first
  pass would. Their accessibility and performance scored 6.6/10 — that part
  is explicitly *not* copied, since 4G mobile is load-bearing here.

---

## The client's real range

`data/stock-list.json` — 10 gents lines, 16 ladies, 2 bridal, transcribed from
the client's handwritten list.

**Khaddar is the focus**, per the client's own instruction. So khaddar gets the
hero, the three confirmed cuts as a full section, and the calculator. Every
other line appears once, as plain text, in "The house" — proof of range, not a
department being built this sprint.

**No supplier logo or catalogue image appears anywhere.** Stocking a label is
not the same as holding rights to its artwork. Verified: zero `<img>` elements
in that section on all three pages.

---

## Open questions — none of these are guesses to be made

1. **Spellings.** Transcribed from handwriting. `Nuréh` (written "Nuren" —
   corroborated by a Nuréh catalogue in Hunain's repo), `Narkin's`,
   `Colorum / Izza`, `Watan / Nazakat` all need the client's own spelling.
2. **Where LADA sits.** The brief has it as a confirmed in-house waistcoat
   label (38R–46R). It appears nowhere on the client's stock list — probably
   because that list covers *stocked* labels and LADA is their own. It
   currently has no nav slot. Confirm.
3. **Ladies' lines: buyable or enquiry-only?** All three default to
   `enquire_only`. One attribute on `<body>` flips it:
   `data-women-mode="buyable"`. No rebuild.
4. **Policy copy.** The instruction was to port real copy from the prior
   build's `privacy-policy.html` / `terms.html`. **Those files do not exist** —
   the prior build has only khaddar/lada/women/bridal/locations/size-chart.
   There is no policy copy to port. It has to be written or supplied.
5. **Type scale.** The instruction was to pull exact `clamp()` values from the
   old build's `base.css`. That file uses **fixed rem sizes with no `clamp()`
   anywhere**, so there was nothing to port; the fluid scale in `tokens.css` is
   built fresh off that scale's floor and ceiling.

Everything unconfirmed renders as a visibly hatched `[PENDING]` marker —
13 of them per page. None has been filled with a plausible-looking value.

---

## The logo

Client instruction: **the mark is red, and the mark itself does not change.**
Both honoured — the traced SVG is byte-identical to Hunain's.

`--kj-red: #9A1B2F` is scoped to the mark alone, exactly the way
`--whatsapp` is scoped to the WhatsApp trigger. It is not a sixth palette
colour and is never used for text, a button, a rule or a background.

One caveat worth knowing: red on indigo measures **1.67:1** — invisible. Every
candidate red failed on indigo (best was 2.51:1, still under the 3:1 floor for
a non-text graphic). So the mark is red on light surfaces and reverses to bone
on the indigo footer and the V1 hero scrim. Same shape, same file — the normal
light/dark pair any one-colour mark needs, not a second logo.

---

## QA — measured, not eyeballed

Run at **375 / 390 / 768 / 1280**, on all three pages plus the chooser.

- **Horizontal overflow: none** at any width.
- **Contrast: zero failures.** Every text node checked against its real
  computed background at its real size, WCAG AA (4.5:1 normal, 3:1 large).
- **Touch targets:** all ≥44×44. The only sub-44 link is the phone number
  inside the ticker sentence — WCAG's own inline-text exception (SC 2.5.5/2.5.8).
- **Body text** 16px+ everywhere; smallest annotation label is 12px.
- **Header** 57px at 375px (56px content + 1px hairline).

### Three real bugs found and fixed during QA

1. **Brass buttons failed AA.** I had bone-on-brass at 2.6:1 and indigo-on-brass
   at 4.9:1. Measured, it is the exact opposite: **bone on brass 4.87:1
   (passes)**, indigo on brass 2.57:1 (fails, and fails large-text 3:1 too).
   Buttons now take bone text.
2. **Brass text on parchment: 4.34:1**, just under 4.5. Fixed the way the
   earlier QA pass fixed the same class of problem — not by changing `--brass`,
   but by deriving `--brass-text: #895D2D` for small text (4.68:1 on
   parchment, 5.26:1 on bone). `--brass` itself is untouched.
3. **The V1 hero headline could render blank.** With
   `animation-fill-mode: both`, an animation that is delayed, throttled or
   never started holds its `from` state — `translateY(105%)` inside an
   `overflow:hidden` box — and the `<h1>` disappears. Caught it live: browsers
   freeze animations in hidden tabs, and a bad 4G connection can stall the same
   way. The clip and the transform now only apply once JS adds `.is-ready`, so
   with no JS the headline is simply plain and visible. Verified in both states.

Footer nav links and the logo were also under 44px on the first pass; fixed.

---

## Performance

- Fonts **self-hosted**, 8 woff2 files, **212KB total**. No Google Fonts
  request, no CDN. Fraunces and Karla are variable, so 400–700 costs one file
  each. Fraunces' optical-size axis is on (`font-optical-sizing: auto`).
- Placeholder imagery is **procedural SVG** — two transposed `feTurbulence`
  layers (warp + weft) over a dyed ground plus a slub layer, with GSM driving
  thread frequency so a heavier cloth reads visibly coarser. **~1.5KB each,
  20KB for all five.** Real photography drops into the same slot with no
  markup change.
- No Tailwind CDN, no Lenis, no parallax, no ambient grain, no magnetic hover.
  Card hover and the V2 swatch reveal are gated behind
  `(hover:hover) and (pointer:fine)` so no phone is shipped dead code.
