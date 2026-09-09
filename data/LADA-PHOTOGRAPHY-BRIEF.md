# Lada — photography brief

Derived from teardowns of nine premium Pakistani clothing sites:
  amiradnan.com, naushemian.com, ismailfarid.com, republicwomenswear.com, sapphireonline.pk, khaadi.com, sanasafinaz.com, mariab.pk, theworldofhsy.com

## Why this exists

There is exactly ONE Lada photograph in the repository —
`theme/assets/lada-waistcoats.jpg`, 1000x1250 — and it is doing double duty
as both the hero of /pages/lada and the background of the homepage band.
The three craft blocks expose image pickers and ship no images. The product
grid shows its empty state because all 13 draft products are imageless.

For scale: sanasafinaz serves 1,112 images at 99.3% single-ratio compliance;
ismailfarid enforces a spec across 3,393. Lada is a one-picture brand page.
**No layout change fixes this. Only a shoot does.**

## What the set does, near-unanimously

- One locked portrait product ratio, enforced in css, never re-cropped
- Model on location or on a built set. never white sweep, never flat-lay, never ghost mannequin
- The card carries almost nothing, and what it withholds is deliberate
- Every transactional affordance is hover-deferred or absent
- The hover frame is another model shot, not a detail macro and not a ui panel
- Zero radius and no shadow on merchandising surfaces

## Slots

### hero-plate-desktop
- **subject** — One male model, mid-30s, standing three-quarter turn to camera, weight on the back foot, hands relaxed — not hand-on-hip. Wearing a Lada waistcoat over a plain kurta and shalwar, styled head to toe including shoes. Framed waist-up-plus, roughly knee to just above the head, model placed in the RIGHT two-thirds of the frame with the left third held quiet and low-detail for the eyebrow, mark and lede to sit over. Location: a warm plaster or old brick wall, a carved wooden door, or a shaded arcade in Sheikhupura — real architecture, no studio.
- **ratio** — 3:2 landscape. Deliver 2880x1920 master, serve 1440w/2880w. Set the width and height attributes to the TRUE intrinsic dimensions — the current section hard-codes 2400x1500 over a 1000x1250 file.
- **treatment** — Late-afternoon side light, one direction, no fill flash. Warm grade, shadows kept open rather than crushed, so the frame sits against #0E0E0F without a hard edge. NO opacity reduction and NO overall tint — the only overlay is a bottom-anchored gradient from rgba(14,14,15,.72) at 0% to transparent by 55%, so the type has a contrast floor and the top two-thirds of the photograph runs at full strength. Garment tone should differ from the wall tone by at least two stops so the waistcoat's silhouette reads at a glance. Two separately art-directed uploads, not one file re-cropped by CSS: ismailfarid ships 1440x551 desktop and 640x960 mobile as distinct files, khaadi ships a 1920x700 triptych and a different 1000x1500 portrait, sapphire swaps 2:1 and 4:5 via <picture><source media>. Amir Adnan's failure is the reason: one padding-bottom:56.25% rule in both media queries gives a 90vh desktop hero and a 26vh letterboxed strip at 375px.

### hero-plate-mobile
- **subject** — Same model, same garment, same location and same session — but recomposed, not cropped. Tighter: chest to head, turned slightly further into the light, with the waistcoat's front closure and collar band clearly legible at small size. Quiet area at the BOTTOM third for type, since the mobile plate stacks its copy under the figure.
- **ratio** — 4:5 portrait, 1200x1500. Served under <source media="(max-width:749px)">.
- **treatment** — Identical grade to the desktop plate so the two read as one shoot. Because the copy sits low, the gradient runs from rgba(14,14,15,.8) at 0% to transparent by 62%. Do not simply object-fit:cover the landscape master — Sana Safinaz's teardown shows what that costs: a 16:9 source in a 100vh frame centre-crops about 10% vertically and it is the baked-in text at the edges that gets clipped.

### card-primary
- **subject** — Per piece. Single male model, three-quarter turn, cropped from just above the head to MID-THIGH — the waistcoat's hem, the shalwar's fall and the hands all in frame. Model styled head to toe. Front closure, collar band and pocket line all readable. One model across the whole range so the grid reads as one shoot.
- **ratio** — 4:5 (0.800). Master 1600x2000, srcset 400/800/1200/1600w, object-fit:cover into an aspect-ratio:4/5 box.
- **treatment** — On location or on a built set with a tonal background chosen to harmonise with the garment and sit low-contrast against it — ismailfarid's exact method (off-white waistcoat in open desert against blown-out pale sky; maroon monogram waistcoat in an atelier interior of stacked painters' canvases and a period wooden chair). Never a white sweep, never a flat-lay, never a ghost mannequin: khaadi's most consistent decision across its whole catalogue is that every product image has a human in it. Warm, single-source natural light. Placeholder box behind the image must be --lada-panel #17171A, not the light theme's --surface #FAF8F6.

### card-hover
- **subject** — Per piece, SAME set, same light, same model, same session as card-primary. Full head-to-toe standing figure, feet near the bottom edge of the frame, front-on or a shallow three-quarter. This frame's only job is to answer 'what does the whole thing look like on'.
- **ratio** — 4:5, 1600x2000, identical to card-primary so the cross-fade has no reframe.
- **treatment** — Identical grade and background to card-primary — the hover must change the information, not the register. Ismail Farid's shot sequence is the model to copy exactly: frame 1 a three-quarter mid-thigh-up crop, frame 2 the full standing figure, and the card hover is nothing but that pair. Naushemian's rule is the same stated negatively — the hover frame is always a second model frame, never a detail or a flat.

### pdp-macro
- **subject** — Per piece, two to three frames. Construction evidence at close range, no model face: the buttonhole and button (bone, brass or self-covered) at roughly life size; the bone-lip or welt pocket corner; the collar band where it meets the shoulder seam; the lining and the internal facing shown by holding the front open. Hands may appear. For any embroidered or brocade piece, one frame of the thread work at 1:1.
- **ratio** — 4:5, FULL FRAME — same 1600x2000 box as the card and the PDP gallery. Not a square, not an inset, not a thumbnail.
- **treatment** — Raking side light to reveal weave and stitch depth; shallow depth of field with the stitch line as the plane of focus. Republic's discipline is the point: its macro detail frames (lace hem, tilla embroidery, laser cutwork) are delivered at the same full 13:16 portrait frame as the model shots, so the craftsmanship shot gets the same real estate. The set's gap makes the case — Amir Adnan has almost no macro at all (median 3 images per product means three near-identical poses rather than a pose plus a weave close-up), and naushemian is criticised for shipping only 2 gallery images on a ₨95,000 made-to-order garment with nothing evidencing the embroidery being sold. Target 5 to 7 frames per Lada piece: primary, full-length, two to three macros, one back view.

### craft-cut
- **subject** — The Sheikhupura workshop floor. Hands and forearms only, no face: chalk and a pattern card on cloth on the cutting table, shears mid-cut, the marked panel lifting away. Real table, real offcuts, real light through the shop window — not staged clean.
- **ratio** — 4:5, 1200x1500.
- **treatment** — Available light, warm, slightly underexposed so it reads as a working room rather than a set. Grade to match the garment photography. This is provenance photography, so resist styling it: the persuasive detail is the wear on the table.

### craft-sew
- **subject** — A machinist at the needle plate, mid-seam, hands guiding the panel under the foot. Face optional and only with consent; if named, credit the maker in the copy. The needle, the thread cone and the seam allowance in focus.
- **ratio** — 4:5, 1200x1500.
- **treatment** — Same available-light, same grade. A slow enough shutter that the machine reads as running. Naushemian credits its karigars by name in the lookbook intro and HSY signs its homepage story in the first person as the founder — naming the person is what turns a process shot into provenance.

### craft-finish
- **subject** — The pressing and the finishing: a heavy iron on the shoulder over a ham, steam visible; or the completed waistcoat on a wooden form or a hanger against the workshop wall, with the pocket line and hem falling correctly. No model.
- **ratio** — 4:5, 1200x1500.
- **treatment** — Same grade. One clean, resolved frame — this is the section's full stop, so it should be the calmest of the three.

### lookbook-portrait
- **subject** — Six frames, one per look, editorial rather than catalogue: the model seated on stone steps, walking through an arcade, standing in a doorway, half-turned against a painted wall, hands adjusting a cuff, a back view showing the waistcoat's rear seam and belt. Full-length or near it. Two of the six may include a second figure for scale and rhythm.
- **ratio** — 2:3 portrait, delivered at native camera resolution — 1707x2560 or larger, uncropped.
- **treatment** — This is the one place to loosen the grid: presented full-bleed and whole, as the photographer framed them, not art-directed into a card. Zero captions, zero prices, zero badges. Three of the six get wrapped in a bare product link with no visible affordance. Naushemian's /farhaad-2026 is the exact reference — 33 portrait frames at 1707x2560 served uncropped with EXIF intact, no commerce signal anywhere on the page, and 6 frames quietly wrapped in <a href="/product/…">.

### lookbook-landscape
- **subject** — Two frames, wider and quieter, to break the portrait run: the model small in a large architectural space; or a horizontal detail — a row of finished coats on a rail, the shopfront's inner arch, cloth bolts stacked. These carry no garment sell, only register.
- **ratio** — 3:2 landscape, 2560x1707, uncropped.
- **treatment** — Same grade as the portraits. Full-bleed, no caption. Naushemian mixes 8 landscape frames at 2560x1707 into its 33 portraits for exactly this rhythm. Important: these two frames MUST have a mobile counterpart or be dropped below 750px — Republic's two full-bleed 32:15 banners collapse to 23px and 83px tall on a 375px phone, unreadable slivers that still load full-size files.

### measure-service
- **subject** — The measuring itself, at the shop counter. Hands and a cloth tape across a customer's chest over a shirt, or the tape draped over the tailor's shoulder beside a notebook of measurements. No faces. Include one recognisable piece of the shop — the counter edge, a bolt of cloth, the brass rule.
- **ratio** — 3:2 landscape, 1800x1200.
- **treatment** — Warm interior light, slightly high angle looking down at the tape and the notebook. This frame has to say 'a person does this for you in a room', which is the whole differentiator. Do not stage it with a suited stylist; the credible version is the shop as it is.

### house-shopfront
- **subject** — Khan Jee Center, Civil Quarters Road, Sheikhupura — the actual shopfront, exterior, at dusk with the interior lights on so the shop reads as open and occupied. Signage legible. Street context visible but not busy.
- **ratio** — 3:2 landscape, 2400x1600.
- **treatment** — Blue-hour exposure balanced for the warm interior, so the doorway glows against a cool street. This is the 1978 claim made visible, and it is the single asset in this brief that none of the nine studied sites can match with art direction — Ismail Farid, Republic, Naushemian and HSY all assert their physical premises in plain footer text precisely because it is the strongest trust signal available.

### size-diagram
- **subject** — NOT a photograph. A line drawing of a Lada waistcoat, front elevation, drawn at 1px in --lada-champagne #C6A15B on transparent, with six measurement callouts on hairline leader lines: chest, waist, length from collar base, shoulder, collar, armhole. A second smaller elevation of a coat beside it.
- **ratio** — 4:5, delivered as inline SVG so it inherits the champagne token and stays crisp at any size.
- **treatment** — Hairlines only, no fills, no shadow, no radius — consistent with khaadi's line-drawn information architecture. Sapphire pairs exactly this kind of garment technical drawing with its INCHES/CM tabbed table of seven measurements, and its teardown calls that the correct model for eastern silhouettes where fit is cut-specific. Sits beside the 38R-46R table and inside the PDP size popover.

### DELIVERY RULES FOR EVERY SLOT ABOVE
- **subject** — Production constraints that apply across the whole shoot, not a picture.
- **ratio** — Two ratios only on the entire page: 4:5 for everything in the commerce flow (card, hover, macro, PDP gallery, craft) and 2:3 or 3:2 for editorial (lookbook, hero, measure, house). Shoot to the crop; never re-crop one master into a different box.
- **treatment** — WEBP or well-compressed JPEG, never PNG for photography — Amir Adnan ships 308 PNGs out of 962 catalogue images, including two waistcoat files at 1.8MB and 2.3MB at 1080px. Ship 2x for anything decorative: khaadi's mega-menu editorial image is a 370x360 natural file upscaled to 389px and its collection circles are 80x80 at 80px display, both visibly soft at dpr 2. No video anywhere on this page — HSY's hero MP4 has no poster frame, so first paint is an empty 75vh void until the file buffers, and Amir Adnan autoplays four 1080p/7.2Mbps reels on its homepage. Alt text written per image and never copy-pasted: naushemian's men's kurta card carries alt="Off-White Needleveil Ladies Dress with Striped Dupatta", and khaadi's hero alt is literally "Image Here". Print the fit reference in HTML next to the price ('Model is 5'11", wearing 40R'), not burned into the photograph — Amir Adnan burns it in bottom-right and the 2:3 card crop cuts off the right third, so it survives only on the PDP. Finally: do NOT source the architecture from stock. The Getty Hiran Minar images are off-limits on this project, and the licensed Hiran Minar photograph in use (Shaguftakarim, CC BY-SA 4.0) carries a footer credit obligation — Sheikhupura architecture shot for this brief avoids the question entirely and is more credible for a label that is actually made there.

