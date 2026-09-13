# Khan Jee Center — pick up here

Written 14 Sep 2026, at the end of a session that ran out of context.
This replaces the older handoffs as the entry point. `HANDOFF-SHOPIFY.md`
still holds the business rules and the SKU scheme and is worth reading
second; `BUILD-NOTES.md` describes the static landing pages that came
before any of this and is now history.

---

## 1. The facts, corrected

Several of these were wrong in the previous handoff and cost hours.

| | |
|---|---|
| store | **`qw4zqf-sv.myshopify.com`** |
| public | `www.khanjeecenter.com` (password-protected, **`skublu`**) |
| **NOT** | `khanjeecenter.myshopify.com` — that handle 404s. It is in the old handoff and it misled a research agent once. |
| base theme | **Horizon**, not Dawn (`theme_store_id 2481`) |
| live theme | **`158241357997`** "Khan Jee — v2.6 collection split fixes" |
| rollback | `158240669869` (v2.5) |
| CDN slot | **13** — it changes on every publish; find it by fetching a known-new file from slots 6-20 |
| location | `gid://shopify/Location/88274272429` |
| repo | `hunainusman7-hub/khanjee-center`, branch `claude/marquee-fonts-logos`, remote `fork` |
| upstream | `zw-uml/khanjee-center` (Zain's), remote `origin` — nothing has been pushed there |

`theme/` in this repo is the **whole theme**, 595 files. The previous
handoff's biggest warning — that it was a partial theme and a push would
delete `header.liquid`, `footer.liquid`, `site.css` and `site.js` — no
longer applies. Pull before pushing anyway, because the theme editor can
change JSON templates underneath you.

Node v24.20.0 and Shopify CLI 4.7.1 are installed under `~/.local`;
`export PATH="$HOME/.local/bin:$PATH"`. The CLI is logged in.

---

## 2. THE TRAPS

Read this section before touching the store. Every one of these cost
real time, and most of them fail **silently**.

### theme duplicate is asynchronous
It returns an id immediately while Shopify is still copying files in. A
push landing in that window gets overwritten when the installation
completes — **the theme id changes, the content does not, and nothing
errors**. The only tell is that publish refuses with *"You can't publish
this theme until the installation is complete."* Poll publish as the
readiness probe; it takes about seven attempts, roughly two minutes.

### theme push reports success while skipping files
A push said "Theme upload complete" and silently did not upload
`assets/site.css`. **Verify every push.** Assets are readable from the
CDN with a cache-buster; Liquid is not, so pull it back and diff.

### push --only validates against the push, not the theme
`push --only templates/page.lada.json` failed with *"Section type
'lada-sizing' does not refer to an existing section file"* while that
section was sitting on the theme. Push a JSON template together with
every section it references.

### --allow-live is required once the target is live
`--force` does not cover it. Without it the CLI tries to prompt and the
command dies in a non-interactive shell.

### never round-trip this theme through a full push
Horizon's own stock blocks fail validation on the way back up — about
thirty of them. The first attempt produced a draft whose
`templates/password.json` was broken, which on a password-protected
store is the only page anyone can reach. Use `theme duplicate` for the
copy, then `push --only` the files you changed.

### Shopify minifies what it serves
Grepping the CSS you wrote against the CSS that ships gives false
negatives. `rgba(14,14,15,.82)` comes back as `#0e0e0fd1`, `::after` as
`:after`, `inset:0` as four longhand properties.

### the browser pane lies
It runs hidden much of the time, and a hidden tab gets no animation
frames — so CSS transitions freeze and `getComputedStyle` returns the
frozen value, not the target. A control reading `opacity: 0` there may
be fine. It also reports `innerWidth: 0` sometimes, which makes every
measurement meaningless; `resize_window` with explicit dimensions fixes
it. And programmatic `.focus()` never triggers `:focus-visible` in
Chrome, so focus rings cannot be verified that way.

### edits can silently not apply
Two CSS edits failed because the search strings did not match the file's
actual whitespace. Nothing errored, theme check passed. Caught only by
measuring in the browser afterwards. **Verify the effect, not the edit.**

### deleting a product destroys its photographs
Shopify has no undo for products, and product media is purged with the
product — all 16 Grace images returned 404 within minutes. Export before
any bulk operation.

---

## 3. What is live

**Type** — Montserrat throughout, matching mariab.pk (body 300, headings
500; micro labels stay at 400 because 300 at 11px with wide tracking is
not readable). Self-hosted as two variable files. Bodoni Moda, Archivo,
Archivo Black and Italianno are still served but nothing uses them for
text; putting one back is one line in `site.css`.

**The fonts bug that started this** — `fonts.css` had been copied from
the static site and pointed every `@font-face` at `../fonts/`. A Shopify
theme has one flat asset directory, so all ten 404'd and the storefront
rendered in whatever each device had. That is what "the fonts are
irregular" was. Fixed, and the theme copy must never be overwritten with
`assets/css/fonts.css` again.

**Locale** — `en.default.json` had been reduced to a single key while
every other locale kept its full set, so the storefront printed
"Translation missing: en.<key>" wherever a Horizon snippet asked for a
string. Eighteen of them on the password page alone, including the
password field's own label. Restored from the untouched Horizon theme
still sitting unpublished on the store. 366 offences to 0.

**The bag** — quick-add was `display:none` below 900px and `opacity:0`
until hover, so phone visitors had no way to add to a bag at all. Now
44px in the card's flow on touch, floating over the photograph on a real
pointer. Adding goes through `/cart/add.js` with the Section Rendering
API, so the server formats every price. Drawer has a focus trap, `inert`
on both sides, Esc, focus returned to the opener, and undo on removal
that restores quantity and line properties.

**Marks** — the KJ mark was 1,270 straight line segments and zero curves,
traced from a raster. Refitted as 44 cubic Beziers, worst deviation
0.277% of the mark's width, file halved. Lada is the client's own
gold-gradient artwork keyed to real alpha from a JPEG on black; it is a
fixed-colour image and must only ever sit on a dark ground.

**`kj-svg-defs` holds a bare `<path id="kj-path">` with NO viewBox and NO
fill.** `kj-mark.liquid` supplies both. Remove either and the mark draws
at native 1021x617 inside a 44px box — you see the corner — and paints
black instead of white. This shipped once.

**Logos** — 45 of 60 brands, up from 8. The 15 without have a reason on
file; Stallers is a product category, not a brand.

**Photography** — six category tiles replaced with Pakistani/South Asian
subjects in eastern dress, all Pexels licence, credited in `CREDITS.md`.

**Radius** — one scale (4/8/12/pill). There had been four different
answers including a hardcoded 3px.

**Links** — `kj-collection-url` returns a brand's collection if it
exists, else the gender collection with `filter.p.vendor` applied. 52 of
60 brand links used to point at collections that do not exist. Needs the
Vendor filter enabled in the free **Search & Discovery** app.

---

## 4. Tooling

All in `tools/`. The three that need an Admin API token read
`SHOPIFY_ADMIN_TOKEN` from the environment or from a gitignored
`.env.local`.

| | |
|---|---|
| `import_products.py` | creates products with images, tags, the four `custom.by_*` metafields, inventory activated at the location, and automated brand collections on a tag rule. `--audit` reads back what landed and reports FAILED or missing images — `productCreate` returns *before* Shopify finishes fetching remote media, so success is not the same as done. |
| `delete_imported_drafts.py` | four guards, dry-run by default, refuses to run unless the matched count equals a number you type. Cannot touch `KJC-GU-10001`-`10014`. |
| `fit_curves.py` | the Bezier refit, with a deviation gate |
| `fetch_brand_logos.py` / `update_logo_map.py` | logo download, vetting, contact sheet, and writing both logo maps from one source |
| `fetch_category_images.py` | download, centre-crop to the tile ratio, contact sheet in the real tile |
| `pull_ladies_unstitched.py` / `build_import_csv.py` | the brand-site pull and the CSV build |
| `marquee_motion_test.js` | nine checks on the marquee integrator, `node tools/marquee_motion_test.js` |

`QA.md` is the runbook. Two suites: `shopify theme check` (four known
benign offences) and the marquee test.

---

## 5. Outstanding

**Products are paused** at the client's request — "we will add products
only when we have the real inventory now". Nothing is half-done waiting
on this. When it resumes:

- `data/recover-grace.csv` — four products the client deleted by mistake,
  recovered from a snapshot. **Do this first, it is the only copy.**
  Their 16 images are gone; `data/recover-grace-image-filenames.txt`
  lists the filenames to match against whatever the client still has.
- `data/test-20.csv` — 20 products, 60 image fetches
- `data/alkaram-1img.csv` — 515 Alkaram at one image each
- `data/ladies-unstitched-import.csv` — all 4,551. **Do not import this
  through the native importer**; it is 23,602 rows and asks Shopify for
  23,602 serial remote image fetches, which is what jammed it before.
- `data/alkaram-activate.csv` — flips 515 to active at inventory 5

**Do not install a bulk app.** Four were assessed. EasyCSV has no delete
at any tier; Hextom refuses to ship delete at all; CS Bulk Delete is
$100 and has no SKU filter, so it cannot express the one exclusion this
job needs; Matrixify is the only one that does both halves but its free
tier is 10 products per job and three reviewers report being charged
after uninstalling. The scripts do both jobs at $0.

**Lada page** — `data/LADA-PAGE-SPEC.json` is a nine-section spec from
teardowns of nine premium Pakistani sites. Hero, grid, ordering, motion
and copy are fixed; the remaining sections are not built.
`data/LADA-PHOTOGRAPHY-BRIEF.md` has 14 slots specified to the point a
photographer can shoot them. There is still only ONE Lada photograph.

**Never audited** — `main-product.liquid` and `main-cart.liquid` have
never been seen rendering with real products, because there are none.
The mobile navigation has never been tested on a real device.

---

## 6. Needs the client

- **Ghazi Ilamdin** — five candidate Ghazi labels, unresolved
- **Stallers** — not a brand; it is "stoler/stole", a shawl category
- **Nine misspelled brand names.** Their own domains and logos read
  Iznik (not Izinek), Johra (not Jhora), Raeesa (not Raessa), Zara
  Shahjahan (not Zahra), Lakhany (not Lakhanee), Ramsha (not Ramshah),
  Rang Rasiya, Parishay (not Parishy), Purimen (not Puri), Gul Ahmed
  (not Ahmad). The collection handles and nav labels use the misspellings.
- **The Lada logo** the client supplied is named `Gemini_Generated_Image_…`
  and differs from their packaging. Worth getting the vector original.
- **The KJ mark's source artwork is a low-fidelity raster.** It is as
  clean as a faithful reproduction can be. Genuinely professional means
  the original vector, or a commissioned redraw.

---

## 7. Credentials

- Storefront password `skublu` — needed for `theme dev --store-password`
  and to read the site with curl
- **No Admin API token.** The CLI cannot create products, collections or
  inventory; only the Admin API can. A `shpat_` token in `.env.local`
  unlocks the three scripts. A `shpss_` key was tried and returns 401 —
  that is the app's secret key, not an access token.
- **A GitHub PAT is in the first session's transcript, unrotated**, with
  `admin:org`, `delete_repo` and `workflow` scopes. **Rotate it.**
- A `shpss_` Shopify key was also pasted into chat. **Rotate that too.**
