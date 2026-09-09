# QA — how to re-run the checks

Two suites, both offline, both fast. Run them after any change to
`theme/assets/kj-v2.*`, `kj-cart.js`, or the cart/product sections.

## 1. Shopify's own theme check

Validates Liquid syntax, section schemas, and every `render`/`section`/
`asset_url` reference.

```bash
cd theme && shopify theme check
```

Expected: **no real offences.** Four are known and benign until the theme
is pulled — `site.css`, `site.js`, `sections/header.liquid` and
`sections/footer.liquid` exist on the theme but not in this repo. Two
`OrphanedSnippet` warnings (`kj-footer`, `kj-nav`) are snippets the live
header/footer render, so they only look orphaned from inside the repo.
The 18 `ValidSchema` errors are theme-check failing to fetch its own
schema from raw.githubusercontent.com — not our schemas. Verify that
claim if it ever matters: every one of them says "Unable to parse
content from".

## 2. Marquee motion

The scroll-velocity integrator, tested directly rather than by eye —
nine properties including frame-rate independence and that the offset
never escapes its loop period.

```bash
node tools/marquee_motion_test.js
```

Expected: `all marquee motion checks pass`. If you change `DRIFT`,
`VEL_MAX` or `DECAY` in `kj-v2.js`, change them at the top of the test
to match; the test deliberately duplicates the maths so a typo in one
does not silently pass the other.

## 3. Browser pass

`_lab/` is gitignored scratch, so regenerate it when you need it. The
point of the harness is that its `assets/` directory is **flat**, exactly
like a Shopify theme's — which is what makes the font paths provable
locally instead of only on the live CDN.

```bash
mkdir -p _lab/qa/assets
cp theme/assets/*.woff2 theme/assets/fonts.css theme/assets/kj-v2.css \
   theme/assets/kj-v2.js theme/assets/kj-cart.js _lab/qa/assets/
curl -s https://www.khanjeecenter.com/cdn/shop/t/6/assets/site.css \
   -o _lab/qa/assets/site.css
python3 -m http.server 8000
```

Then in the console on a page that loads `assets/fonts.css`:

```js
document.fonts.ready.then(() => console.log(
  ['400 16px Archivo', '400 16px "Archivo Black"', '400 16px "Bodoni Moda"',
   '400 16px Italianno'].map(f => f + ' -> ' + document.fonts.check(f))));
```

All four must report `true`. `italic 400 16px "Bodoni Moda"` reports
false until something on the page actually uses it — that is lazy
loading working, not a fault. Force it with
`await document.fonts.load('italic 400 16px "Bodoni Moda"')`.

### What the last full pass found

43 automated checks passing: 39 contrast ratios against the WCAG floor
(4.5:1, or 3:1 where the type is 18pt+ or bold), touch-target sizes, and
`width`/`height` on every image. Fixed along the way: the quantity
stepper at 38x38, `Remove` at 17px tall and `View bag` at 16px, all
under the 44pt touch minimum.

**Two traps in this environment.** The browser pane runs hidden much of
the time, and a hidden tab gets no animation frames — so CSS transitions
freeze mid-flight and `getComputedStyle` returns the frozen value, not
the target. A control that reads `opacity: 0` there may be perfectly
fine. Set `el.style.transition = 'none'` before reading, or check which
rules actually match. Second: programmatic `.focus()` does not trigger
`:focus-visible` in Chrome, so focus rings cannot be verified that way —
grep the stylesheet or drive real keyboard input instead. Both produced
convincing false positives on the first pass.


## 4. Verifying a push actually pushed

`shopify theme push --only` reported "Theme upload complete" and silently
did not upload `assets/site.css`. Everything else in the same command
went up. So do not trust the success message — check.

Two flags matter in a non-interactive shell:

```bash
shopify theme push --theme <id> --nodelete --force --allow-live -o <file> …
```

`--allow-live` is required once the target is the live theme; without it
the CLI tries to prompt and the whole command dies. `--force` alone does
not cover it.

**Assets** — read them back off the CDN, which is ungated:

```bash
curl -s "https://www.khanjeecenter.com/cdn/shop/t/<slot>/assets/site.css?v=$RANDOM" \
  | grep -o -- '--font-display:[^;]*'
```

Add the cache-buster. A plain fetch served a stale copy and cost twenty
minutes of chasing a bug that was not there. Find `<slot>` by fetching a
known-new file from slots 6-12; it changes on every publish (6 → 8 → 9
so far).

**Liquid** is not on the CDN, so pull it back and diff:

```bash
shopify theme pull --theme <id> --path /tmp/verify --force \
  -o snippets/kj-mark.liquid -o sections/lada-band.liquid
diff theme/snippets/kj-mark.liquid /tmp/verify/snippets/kj-mark.liquid
```

## 5. Do not round-trip a Horizon theme

Covered in HANDOFF-SHOPIFY.md, repeated here because it costs a broken
storefront: pushing Horizon's own stock files back up fails validation
on about thirty of them, one of which is `templates/password.json` — on
a password-protected store that is the only page a visitor can reach.
Use `theme duplicate` for a server-side copy, then `push --only` the
handful of files you changed.

## 6. The two marks

`kj-svg-defs` stores the KJ mark as a bare `<path id="kj-path">` inside
`<defs>` — **no viewBox and no fill**. `kj-mark.liquid` supplies both on
the outer `<svg>`. Remove either and the mark breaks in a way that looks
like a CSS problem but is not: with no viewBox it draws at its native
1021x617 user units inside whatever box it is given, so at the header's
44px you see the top-left corner; with no fill it paints black, so it
stays black on the dark hero where it should be white. This shipped once.

The Lada mark is the client's own gold-gradient artwork at
`assets/lada-mark.png`, keyed to real alpha from a JPEG on black. It is
a fixed-colour image: `currentColor` does nothing to it, and it must
only ever sit on a dark ground, because gold on white is about 2:1. Its
lockup already reads BY KHAN JEE — do not set that as text beside it.


## 7. theme duplicate is ASYNC — wait before you push

This cost a whole publish cycle. `shopify theme duplicate` returns a
theme id immediately, but Shopify is still copying files into it. Push
to it during that window and the installation finishes AFTER your push
and overwrites it with the duplicated source. The theme id changes, the
content does not, and nothing errors.

The tell is that `theme publish` refuses with:

    You can't publish this theme until the installation is complete.

So the order is: duplicate, wait until publish stops refusing, THEN
push, THEN publish. Polling publish is the cheapest readiness check
there is:

```bash
for i in $(seq 1 12); do
  out=$(shopify theme publish --theme <new-id> --force 2>&1)
  echo "$out" | grep -qiE "success|live at" && break
  sleep 20
done
```

## 8. --only validates against the push, not the theme

`push --only templates/page.lada.json` failed with

    Section type 'lada-sizing' does not refer to an existing section file

while `sections/lada-sizing.liquid` was sitting on the theme the whole
time. A JSON template is validated against the files IN THAT PUSH, so
push a template together with every section it references.

## 9. Shopify minifies what it serves — grep the minified form

A check for the CSS you wrote will fail against the CSS that ships.
`rgba(14,14,15,.82)` comes back as `#0e0e0fd1`, `::after` as `:after`,
`inset:0` as four longhand properties, and redundant `0%` stops are
dropped. Verify by reading the served declaration and interpreting it,
not by grepping for your own source text.
