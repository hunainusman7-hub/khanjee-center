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
