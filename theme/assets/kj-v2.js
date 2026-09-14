/* Khan Jee v2 — progressive enhancement. Nothing here is required for the
   page to be readable or navigable with JS off. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- hero slideshow ---------------- */
  document.querySelectorAll('[data-hs]').forEach(function (root) {
    var slides = Array.prototype.slice.call(root.querySelectorAll('[data-hs-slide]'));
    if (slides.length < 2) return;

    var dots  = Array.prototype.slice.call(root.querySelectorAll('[data-hs-dot]'));
    var prev  = root.querySelector('[data-hs-prev]');
    var next  = root.querySelector('[data-hs-next]');
    var delay = (parseInt(root.dataset.autoplay, 10) || 0) * 1000;
    var i = 0, timer = null;

    function show(n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) {
        var on = k === i;
        s.classList.toggle('is-active', on);
        if (on) { s.removeAttribute('aria-hidden'); } else { s.setAttribute('aria-hidden', 'true'); }
      });
      dots.forEach(function (d, k) {
        d.classList.toggle('is-active', k === i);
        d.setAttribute('aria-selected', k === i ? 'true' : 'false');
      });
    }
    function start() { if (delay && !reduce) { stop(); timer = setInterval(function () { show(i + 1); }, delay); } }
    function stop()  { if (timer) { clearInterval(timer); timer = null; } }

    if (prev) prev.addEventListener('click', function () { show(i - 1); start(); });
    if (next) next.addEventListener('click', function () { show(i + 1); start(); });
    dots.forEach(function (d) {
      d.addEventListener('click', function () { show(parseInt(d.dataset.hsDot, 10)); start(); });
    });

    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', start);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { stop(); } else { start(); }
    });

    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { show(i - 1); start(); }
      if (e.key === 'ArrowRight') { show(i + 1); start(); }
    });

    /* swipe */
    var x0 = null;
    root.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; stop(); }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) { show(dx < 0 ? i + 1 : i - 1); }
      x0 = null; start();
    }, { passive: true });

    show(0);
    start();
  });

  /* ---------------- brand marquee ----------------
     Two rows of brand logos drifting in opposite directions, each one a
     link to that brand's collection. Scrolling the page adds to the
     speed and scrolling up reverses it, so the strip reads as connected
     to the page rather than as decoration running on its own clock.

     Reduced-motion users get static rows they can scroll by hand
     instead (see kj-v2.css). */
  (function () {
    var wraps = Array.prototype.slice.call(document.querySelectorAll('[data-bmq]'));
    if (!wraps.length || reduce) return;

    /* Motion is expressed per second and scaled by frame time, not
       applied per frame. Per-frame constants run at double speed on a
       120Hz phone, which is most new phones here. */
    var DRIFT = 25;      /* px per second at rest */
    var HOVER_DRIFT = 3; /* eased to a crawl so the links can be clicked */
    var VEL_MAX = 900;   /* px per second, clamped */
    var DECAY = 0.06;    /* velocity half-life, in seconds-ish */

    wraps.forEach(function (wrap) { init(wrap); });

    function init(wrap) {
      var rows = Array.prototype.slice.call(wrap.querySelectorAll('[data-bmq-row]'));
      if (!rows.length) return;

      var raf = null, hover = false, lastY = window.scrollY, vel = 0, last = 0;
      var state = rows.map(function (row, i) {
        var half = row.children.length;
        if (!half) return null;
        row.innerHTML += row.innerHTML;
        /* The clone is only there to make the loop seamless. Keep it out
           of the tab order and out of the accessibility tree, or every
           brand is announced twice and Tab walks through a duplicate set. */
        Array.prototype.slice.call(row.children, half).forEach(function (el) {
          el.setAttribute('aria-hidden', 'true');
          el.setAttribute('tabindex', '-1');
        });
        return {
          row: row, half: half, x: 0, w: 0,
          dir: parseInt(row.dataset.bmqDir, 10) || (i % 2 ? 1 : -1)
        };
      }).filter(Boolean);
      if (!state.length) return;

      /* The loop period is the distance to the first clone, which is
         the item run PLUS a full gap. scrollWidth/2 is short by half a
         gap — 2*W + (2n-1)*g halved is W + (n-0.5)*g — and the strip
         visibly jumps by that much on every wrap. Read the clone's own
         offset instead and the gap takes care of itself. */
      function paint(s) {
        s.row.style.transform = 'translate3d(' + s.x.toFixed(2) + 'px,0,0)';
      }

      function measure() {
        state.forEach(function (s) {
          var first = s.row.children[0];
          var clone = s.row.children[s.half];
          var w = (first && clone) ? clone.offsetLeft - first.offsetLeft
                                   : s.row.scrollWidth / 2;
          if (w <= 0) return;

          if (!s.w) {
            /* First measure. x lives in [-w, 0), so a row travelling
               right has to START at -w — from 0 it would go positive on
               the very first frame and snap a whole period backwards,
               which reads as the strip glitching the moment it loads. */
            s.x = s.dir > 0 ? -w : 0;
          } else {
            /* Later measures happen when the logos finish loading or
               Bodoni swaps in. Carry the position across proportionally
               so the strip does not jump to a different place in the
               loop every time a width settles. */
            s.x = s.x / s.w * w;
          }
          s.w = w;
          s.x = ((s.x % w) - w) % w;
          if (s.x === 0) s.x = -w;                        /* -0 lands here */
          paint(s);
        });
      }
      measure();

      /* Width changes after first paint, twice: the logos are lazy and
         Bodoni replaces the fallback in the typographic items. Measuring
         once at init leaves the period wrong for the life of the page. */
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
      wrap.querySelectorAll('img').forEach(function (img) {
        if (!img.complete) img.addEventListener('load', measure, { once: true });
      });
      if (window.ResizeObserver) {
        var ro = new ResizeObserver(measure);
        ro.observe(wrap);
      } else {
        window.addEventListener('resize', measure, { passive: true });
      }

      function onScroll() {
        var y = window.scrollY;
        var dy = y - lastY;
        lastY = y;
        /* Scroll restoration and anchor jumps arrive as one enormous
           delta; without a clamp the strip teleports. */
        if (Math.abs(dy) > 240) dy = dy > 0 ? 240 : -240;
        vel += dy * 14;
        if (vel > VEL_MAX) vel = VEL_MAX;
        if (vel < -VEL_MAX) vel = -VEL_MAX;
        if (raf === null) start();
      }
      window.addEventListener('scroll', onScroll, { passive: true });

      wrap.addEventListener('mouseenter', function () { hover = true; });
      wrap.addEventListener('mouseleave', function () { hover = false; });

      /* .bmq__rows uses overflow:clip, not hidden, so it is not a scroll
         container and Tab cannot scroll the strip sideways behind the
         mask. Belt and braces: if anything does scroll it, put it back,
         and translate the focused row so the focused link is on screen
         rather than parked outside the clip. */
      wrap.addEventListener('focusin', function (e) {
        hover = true;
        if (wrap.scrollLeft) wrap.scrollLeft = 0;
        var item = e.target.closest('[data-bmq-row] > *');
        if (!item) return;
        var s = state.filter(function (st) { return st.row === item.parentElement; })[0];
        if (!s || !s.w) return;
        var pad = 24;
        var itemLeft = item.offsetLeft;
        var visible = wrap.clientWidth;
        var pos = itemLeft + s.x;
        if (pos < pad) s.x += pad - pos;
        else if (pos + item.offsetWidth > visible - pad) {
          s.x -= (pos + item.offsetWidth) - (visible - pad);
        }
        paint(s);
      });
      wrap.addEventListener('focusout', function () { hover = false; });

      function frame(now) {
        var dt = last ? (now - last) / 1000 : 0.016;
        last = now;
        if (dt > 0.1) dt = 0.1;                       /* a tab that was backgrounded */

        vel *= Math.pow(DECAY, dt);
        if (Math.abs(vel) < 0.5) vel = 0;

        var base = hover ? HOVER_DRIFT : DRIFT;
        state.forEach(function (s) {
          if (!s.w) return;
          s.x += (base * s.dir + vel * s.dir) * dt;
          s.x = ((s.x % s.w) - s.w) % s.w;            /* one wrap, any overshoot */
          paint(s);
        });

        raf = window.requestAnimationFrame(frame);
      }

      /* The document.hidden guard matters: a background tab never runs
         animation frames, so calling this while hidden would leave a raf
         id that never fires — and the visibilitychange handler below
         would then see raf !== null and bail, leaving the strip frozen
         for good once the tab was finally opened. Opening a shop in a
         new tab is common enough that this is not a corner case. */
      function start() {
        if (raf !== null || document.hidden) return;
        last = 0;
        raf = window.requestAnimationFrame(frame);
      }
      function stop() {
        if (raf !== null) { window.cancelAnimationFrame(raf); raf = null; }
      }

      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop(); else start();
      });

      /* The theme editor replaces a section's DOM wholesale. Without
         this the old loop keeps writing transforms to detached nodes
         while the new markup sits still, un-duplicated. */
      document.addEventListener('shopify:section:unload', function (e) {
        if (e.target.contains(wrap)) stop();
      });

      start();
    }

    document.addEventListener('shopify:section:load', function (e) {
      e.target.querySelectorAll('[data-bmq]').forEach(init);
    });
  })();

  /* ---------------- product card image swap on touch ---------------- */
  if (window.matchMedia && !window.matchMedia('(hover: hover)').matches) {
    var cards = document.querySelectorAll('[data-pcard]');
    cards.forEach(function (card) {
      if (!card.querySelector('.pcard__img--alt')) return;
      var link = card.querySelector('.pcard__link');
      if (!link) return;
      link.addEventListener('click', function (e) {
        if (card.classList.contains('is-touched')) return;   /* second tap navigates */
        e.preventDefault();
        cards.forEach(function (c) { c.classList.remove('is-touched'); });
        card.classList.add('is-touched');
      });
    });
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-pcard]')) return;
      cards.forEach(function (c) { c.classList.remove('is-touched'); });
    });
  }

  /* ---------------- product carousel: tabs, arrows, progress ---------------- */
  document.querySelectorAll('[data-pcar]').forEach(function (root) {
    var tabs   = Array.prototype.slice.call(root.querySelectorAll('[data-pcar-tab]'));
    var panels = Array.prototype.slice.call(root.querySelectorAll('[data-pcar-panel]'));

    function activePanel() { return panels.find(function (p) { return !p.hidden; }) || panels[0]; }
    function railOf(p) { return p ? p.querySelector('[data-pcar-rail]') : null; }

    function syncBar(panel) {
      var rail = railOf(panel);
      var bar  = panel && panel.querySelector('[data-pcar-bar] span');
      if (!rail || !bar) return;
      var max = rail.scrollWidth - rail.clientWidth;
      var frac = rail.clientWidth / rail.scrollWidth;
      bar.style.width = Math.max(8, frac * 100) + '%';
      bar.style.left  = (max > 0 ? (rail.scrollLeft / max) * (100 - frac * 100) : 0) + '%';
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var i = tab.dataset.pcarTab;
        tabs.forEach(function (t) {
          var on = t === tab;
          t.classList.toggle('is-active', on);
          t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        panels.forEach(function (p) { p.hidden = p.dataset.pcarPanel !== i; });
        syncBar(activePanel());
      });
    });

    function scrollBy(dir) {
      var rail = railOf(activePanel());
      if (!rail) return;
      rail.scrollBy({ left: dir * Math.round(rail.clientWidth * 0.8), behavior: 'smooth' });
    }
    var prev = root.querySelector('[data-pcar-prev]');
    var next = root.querySelector('[data-pcar-next]');
    if (prev) prev.addEventListener('click', function () { scrollBy(-1); });
    if (next) next.addEventListener('click', function () { scrollBy(1); });

    panels.forEach(function (p) {
      var rail = railOf(p);
      if (rail) rail.addEventListener('scroll', function () { syncBar(p); }, { passive: true });
    });
    window.addEventListener('resize', function () { syncBar(activePanel()); }, { passive: true });
    syncBar(activePanel());
  });

  /* ---------------- collection split: dots drive the rail ---------------- */
  document.querySelectorAll('[data-csplit]').forEach(function (root) {
    var rail = root.querySelector('[data-csplit-rail]');
    var dots = Array.prototype.slice.call(root.querySelectorAll('[data-csplit-dot]'));
    if (!rail || !dots.length) return;
    var slides = Array.prototype.slice.call(rail.children);

    dots.forEach(function (d) {
      d.addEventListener('click', function () {
        var s = slides[parseInt(d.dataset.csplitDot, 10)];
        if (s) rail.scrollTo({ left: s.offsetLeft - rail.offsetLeft, behavior: 'smooth' });
      });
    });
    rail.addEventListener('scroll', function () {
      var i = 0, best = Infinity;
      slides.forEach(function (s, k) {
        var d = Math.abs(s.offsetLeft - rail.offsetLeft - rail.scrollLeft);
        if (d < best) { best = d; i = k; }
      });
      dots.forEach(function (d, k) { d.classList.toggle('is-active', k === i); });
    }, { passive: true });
  });
})();

/* ---------------- product page: gallery, quantity, options ----------------
   All three are enhancements. The gallery ships every image in the
   markup with only the first visible, so with JS off a visitor still
   sees the product; the thumbnails simply swap which one is shown. The
   quantity buttons sit either side of a real number input, and the
   option selects post the right variant id because the hidden field is
   updated on change — with JS off the first available variant is
   already in that field. */
(function () {
  'use strict';

  /* --- gallery --- */
  document.querySelectorAll('.pdp__gal').forEach(function (gal) {
    var thumbs = Array.prototype.slice.call(gal.querySelectorAll('[data-pdp-thumb]'));
    if (thumbs.length < 2) return;
    var imgs = Array.prototype.slice.call(gal.querySelectorAll('.pdp__img'));

    function show(id) {
      imgs.forEach(function (img) {
        var on = img.id === 'pdp-media-' + id;
        img.hidden = !on;
        img.classList.toggle('is-active', on);
      });
      thumbs.forEach(function (t) {
        var on = t.dataset.pdpThumb === String(id);
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }

    thumbs.forEach(function (t) {
      t.addEventListener('click', function () { show(t.dataset.pdpThumb); });
    });

    /* Left/right arrows walk the thumbnails, which is what a tablist
       is expected to do. */
    gal.addEventListener('keydown', function (e) {
      var i = thumbs.indexOf(document.activeElement);
      if (i < 0) return;
      var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1;
      if (n < 0 || n >= thumbs.length) return;
      e.preventDefault();
      thumbs[n].focus();
      show(thumbs[n].dataset.pdpThumb);
    });
  });

  /* --- quantity stepper --- */
  document.querySelectorAll('.pdp__buy').forEach(function (buy) {
    var input = buy.querySelector('[data-pdp-qty]');
    if (!input) return;
    var up = buy.querySelector('[data-pdp-qty-up]');
    var down = buy.querySelector('[data-pdp-qty-down]');
    function step(by) {
      var n = (parseInt(input.value, 10) || 1) + by;
      input.value = Math.max(1, n);
    }
    if (up) up.addEventListener('click', function () { step(1); });
    if (down) down.addEventListener('click', function () { step(-1); });
  });

  /* --- option selects -> variant id --- */
  document.querySelectorAll('.pdp__form').forEach(function (form) {
    var data = form.querySelector('[data-pdp-variants]');
    var idField = form.querySelector('[data-pdp-variant-id]');
    var selects = Array.prototype.slice.call(form.querySelectorAll('[data-pdp-option]'));
    if (!data || !idField || !selects.length) return;

    var variants;
    try { variants = JSON.parse(data.textContent); } catch (e) { return; }

    var atc = form.querySelector('.pdp__atc');
    var label = form.querySelector('.pdp__atc-t');

    function sync() {
      var chosen = selects.map(function (s) { return s.value; });
      var match = variants.filter(function (v) {
        return v.options.every(function (o, i) { return o === chosen[i]; });
      })[0];

      if (!match) {
        if (atc) atc.disabled = true;
        if (label) label.textContent = 'Unavailable';
        return;
      }
      idField.value = match.id;
      if (atc) atc.disabled = !match.available;
      if (label) label.textContent = match.available ? 'Add to bag' : 'Sold out';
    }

    selects.forEach(function (s) { s.addEventListener('change', sync); });
    sync();
  });
})();


/* ================================================================
   LADA PAGE COMPLETION  —  merged 14 Sep 2026
   Two self-contained IIFEs, appended rather than inlined per section
   so the page costs no extra request. Each no-ops when its markup is
   absent, so they are harmless on every page that is not Lada.
   ================================================================ */


/* ---------------- sizing ---------------- */
/* ---------------- Lada size chart: inches / centimetres ----------------
   Progressive enhancement, and nothing else. The chart ships in inches
   as markup; this reveals the toggle and rewrites the cells. With the
   script absent or broken the customer still reads a correct chart and
   never sees a control that cannot answer.

   Every cell carries its inch value verbatim in data-lada-in, so
   switching back to inches restores exactly what the client typed,
   including a stray unit ("38 in"), rather than a number this file has
   rounded twice. parseFloat reads through that suffix.

   Scoped per table: the same snippet renders again inside the PDP size
   popover, and two instances on one page must not drive each other. */
(function () {
  'use strict';

  function toCm(inches) {
    /* One decimal. 38 in reads 96.5, not 96.52, because nobody measures
       a chest to a tenth of a millimetre. */
    var v = Math.round(inches * 25.4) / 10;
    return String(v);
  }

  function setUnit(root, unit) {
    var cells = root.querySelectorAll('[data-lada-in]');
    var i, raw, num;
    for (i = 0; i < cells.length; i++) {
      raw = cells[i].getAttribute('data-lada-in');
      num = parseFloat(raw);
      if (isNaN(num)) continue;
      cells[i].textContent = unit === 'cm' ? toCm(num) : raw;
    }
    var cap = root.querySelector('[data-lada-caption]');
    var next = root.getAttribute(unit === 'cm' ? 'data-cap-cm' : 'data-cap-in');
    if (cap && next) cap.textContent = next;
  }

  function init(scope) {
    var roots = (scope || document).querySelectorAll('[data-lada-sizetable]');
    if (!roots.length) return;

    Array.prototype.forEach.call(roots, function (root) {
      if (root.getAttribute('data-lada-ready')) return;

      var radios = root.querySelectorAll('[data-lada-unit]');
      if (!radios.length) return;

      var group = root.querySelector('[data-lada-units]');
      if (group) group.removeAttribute('hidden');

      /* The caption is the one line that states the unit, so it is also
         the right thing to announce. Set here rather than in the markup:
         with no script nothing ever changes and a live region would be
         a promise the page does not keep. */
      var cap = root.querySelector('[data-lada-caption]');
      if (cap) cap.setAttribute('aria-live', 'polite');

      Array.prototype.forEach.call(radios, function (radio) {
        radio.addEventListener('change', function () {
          if (radio.checked) setUnit(root, radio.value);
        });
      });

      /* Firefox restores radio state across a reload, so trust the DOM
         rather than assuming inches. */
      var on = root.querySelector('[data-lada-unit]:checked');
      if (on) setUnit(root, on.value);

      root.setAttribute('data-lada-ready', 'true');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(document); });
  } else {
    init(document);
  }

  /* The client fills this page in the theme editor, where a section is
     re-rendered on every keystroke and arrives without our listeners. */
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();


/* ---------------- interactions ---------------- */
/* ============================================================
   LADA INTERACTION LAYER: behaviour for _lab/build/interactions.css.
   Merge target: kj-v2.js, appended as its own IIFE at the end of the
   file. It is deliberately self-contained (no shared state, no
   exported helpers) so it can be dropped in without touching a line
   of what is already there.

   Progressive enhancement throughout. With this file blocked, 404ing
   or still parsing: every element is visible, because the hidden
   state lives behind the .js-lada-reveal class that only this script
   adds; the CTA arrow is drawn by CSS and needs nothing from here;
   and the header stays transparent over a page whose every section
   is already --lada-ground, so nothing becomes unreadable, it just
   stops flipping.
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function slice(list) { return Array.prototype.slice.call(list); }

  /* ---------------- 1. staggered scroll reveal, once ----------------

     WHAT GETS REVEALED. Two sources, and the second one is the point.

     A hand-written class="lada-reveal" is honoured. But no Lada
     section emits that class: the first version of this file was an
     opt-in contract that nothing had opted into, so the whole reveal
     layer was inert on the live page. So the script also marks the
     element children of the grids named in REVEAL_GROUPS. That is
     the spec's own framing of the effect ("a --animation-order
     custom property on each grid child"), and keeping the list here
     rather than in nine section files means one place to edit and no
     coupling to any single section's internals: if a container is
     renamed the effect stops, and stopping means content that was
     never hidden stays visible, which is the safe direction to fail.

     .lada__frames (the lookbook) is deliberately absent. The lookbook
     puts scroll-snap-type on the root scrollport; a full-bleed plate
     that fades and rises while the scrollport is snapping to it
     fights itself.

     Two hard guards before anything is hidden: prefers-reduced-motion,
     and IntersectionObserver actually existing. Either one missing and
     we return before adding the root class, so the page keeps content
     that was never hidden in the first place. */
  var REVEAL_GROUPS = [
    '.lada__grid',        /* lada-collection : the product cards */
    '.lada__stages',      /* lada-craft      : the three tables   */
    '.lada__proof-list',  /* lada-proof      : the proof band     */
    '.lada__routes',      /* lada-house      : the contact routes */
    '.lada__house-grid'   /* lada-house      : copy beside media  */
  ];
  var REVEAL_SEL = '.lada-reveal, ' + REVEAL_GROUPS.join(' > *, ') + ' > *';

  var io = null;

  function observer() {
    if (io) return io;
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-revealed');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    return io;
  }

  /* root is the whole document on first run, and one re-rendered
     section when the theme editor hands us a shopify:section:load. */
  function scanReveal(root) {
    if (reduce || !('IntersectionObserver' in window)) return;

    var scope = root && root.querySelectorAll ? root : document;
    var found = slice(scope.querySelectorAll(REVEAL_SEL));
    var items = [];
    found.forEach(function (el) {
      /* data-lada-reveal is the "already handled" mark. Without it a
         rescan re-hides an element that has finished its reveal. */
      if (!el.hasAttribute('data-lada-reveal')) items.push(el);
    });
    if (!items.length) return;

    /* Read the whole layout FIRST, write after. Two passes rather than
       one because interleaving getBoundingClientRect() with class and
       style writes forces a synchronous layout per item, which on a
       twenty-card grid is twenty layouts before first paint.

       The read also has to happen before .lada-reveal goes on, or on a
       rescan (when .js-lada-reveal is already on <html>) we would be
       measuring elements we had just translated by 2rem. */
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var plan = [];
    var lastParent = null;
    var n = 0;

    items.forEach(function (el) {
      /* Index within the element's own parent, so each grid restarts
         its stagger at 0 instead of inheriting the running total from
         every section above it: on the eighth section a document-wide
         counter would be asking for a two second delay. querySelectorAll
         returns document order, so siblings arrive contiguously and a
         running comparison is enough. */
      if (el.parentNode !== lastParent) { lastParent = el.parentNode; n = 0; }

      /* Cap at 7, which is 525ms of stagger. Past that the last card in
         a long grid is still waiting to start well after the visitor has
         scrolled it back off screen, which reads as a stuck page. */
      var order = Math.min(n, 7);
      n++;

      var declared = el.style.getPropertyValue('--animation-order').trim();
      plan.push({
        el: el,
        order: declared === '' ? order : null,
        /* Anything already on screen when the script runs is never
           hidden. Hiding it here and revealing it on the observer's
           first callback is a visible flash of the fold on every load,
           and it is worse on a slow connection, which is exactly when
           it is least affordable. 0.9vh rather than vh so an element
           straddling the fold counts as on screen. */
        visible: el.getBoundingClientRect().top < vh * 0.9
      });
    });

    /* One synchronous write pass: mark, order, and reveal whatever was
       already on screen. Nothing paints between these and the root
       class below, so there is no frame in which a visible element is
       hidden. */
    plan.forEach(function (p) {
      p.el.setAttribute('data-lada-reveal', '');
      p.el.classList.add('lada-reveal');
      if (p.order !== null) p.el.style.setProperty('--animation-order', String(p.order));
      if (p.visible) p.el.classList.add('is-revealed');
    });

    document.documentElement.classList.add('js-lada-reveal');

    var ob = observer();
    plan.forEach(function (p) { if (!p.visible) ob.observe(p.el); });

    /* Safety net, and narrower than site.js's, which reveals EVERY
       item after two seconds unconditionally and so quietly cancels
       the effect for anything the visitor has not reached yet.

       It is also narrower than this file's first version, which only
       fired "if the observer has not called back even once", a
       condition that can never be true, because IntersectionObserver
       is specified to deliver an initial callback for every target the
       moment it is observed. That net was dead code. This one asks the
       question that actually matters: is anything sitting on screen,
       still hidden, 2.5 seconds later. If so the observer missed it
       and we reveal it. Anything still below the fold is left alone. */
    window.setTimeout(function () {
      var h = window.innerHeight || document.documentElement.clientHeight;
      plan.forEach(function (p) {
        if (p.el.classList.contains('is-revealed')) return;
        var r = p.el.getBoundingClientRect();
        if (r.top < h && r.bottom > 0) {
          p.el.classList.add('is-revealed');
          ob.unobserve(p.el);
        }
      });
    }, 2500);
  }

  /* ---------------- 2. header: solid past the plate ----------------

     Adds `scrolled-past-header` to <body>, and publishes the header's
     measured height as --lada-hdr-h on <html> so the CSS can give the
     page's anchor targets (#lada-collection and friends, which the
     hero button links to) clearance under a now-fixed bar.

     There was no such class anywhere in this theme already:
     assets/header.js is Horizon's and theme.liquid never loads it, so
     nothing else listens to scroll for the header and this is the only
     listener of its kind.

     Scoped three ways so it cannot run on any other page: the body
     template class, the presence of .hdr, and the presence of the hero
     plate. The CSS side is scoped identically with :has(.lada__hero),
     so if the template is ever reordered and the hero is no longer
     first, both halves stand down together and the shared sticky
     header comes back.

     State lives at module scope, not inside initHeader, because the
     theme editor can call initHeader again after a section reload and
     the listeners bound on the first call have to see the new
     measurement rather than a stale closure. */
  var hdrEl = null;
  var hdrThreshold = 0;
  var hdrPast = null;
  var hdrTicking = false;
  var hdrBound = false;

  function hdrMeasure() {
    if (!hdrEl) return;
    /* The bar is min-height:60px but wraps on narrow viewports, so the
       threshold is measured rather than hardcoded. Measured off the
       header itself, so it stays correct if an announcement bar is
       ever added above it. */
    hdrThreshold = hdrEl.offsetHeight;
    document.documentElement.style.setProperty('--lada-hdr-h', hdrThreshold + 'px');
  }

  function hdrApply() {
    hdrTicking = false;
    if (!hdrEl) return;
    var now = (window.pageYOffset || document.documentElement.scrollTop) > hdrThreshold;
    /* Compare before writing. Without this the class is set on every
       frame of every scroll, and each write is a style invalidation
       on <body>, which is the root of the whole page's cascade. */
    if (now === hdrPast) return;
    hdrPast = now;
    document.body.classList.toggle('scrolled-past-header', now);
  }

  function hdrOnScroll() {
    if (hdrTicking) return;
    hdrTicking = true;
    window.requestAnimationFrame(hdrApply);
  }

  function initHeader() {
    var body = document.body;
    if (!body || !body.classList.contains('template-page-lada')) return;

    if (!document.querySelector('.lada__hero')) {
      /* Hero removed in the theme editor. The CSS :has() has already
         handed the header back to the shared sticky rule, so drop the
         class with it rather than leaving a dead flag on <body>. */
      hdrEl = null;
      hdrPast = null;
      body.classList.remove('scrolled-past-header');
      return;
    }

    hdrEl = document.querySelector('.hdr');
    if (!hdrEl) return;

    hdrMeasure();
    hdrPast = null;
    /* Run once at start. A reload halfway down the page, or a landing
       on #lada-collection from the hero button, both begin already
       scrolled past the header, and without this the bar would be
       transparent over the grid until the visitor happened to scroll. */
    hdrApply();

    if (hdrBound) return;
    hdrBound = true;
    window.addEventListener('scroll', hdrOnScroll, { passive: true });
    window.addEventListener('resize', function () {
      hdrMeasure();
      hdrOnScroll();
    }, { passive: true });
  }

  /* ---------------- 3. start, and stay correct in the theme editor --

     THE CLIENT FILLS THIS PAGE HIMSELF, IN THE EDITOR, so a
     first-run-only script is not enough. .js-lada-reveal lives on
     <html> for the life of the page, which means any .lada-reveal
     element that arrives later is hidden by CSS with nothing watching
     it: add a lookbook frame or reorder a section and the new content
     is invisible until reload. These four Shopify editor events are
     the fix, and none of them ever fire on the live storefront, so
     binding them costs a shopper nothing.

     select events reveal outright rather than observing: the editor
     has just scrolled to the thing the client clicked, and it needs to
     be on screen now, not after an observer callback. */
  scanReveal(document);
  initHeader();

  function revealWithin(node) {
    if (!node || !node.querySelectorAll) return;
    slice(node.querySelectorAll('.lada-reveal')).forEach(function (el) {
      el.classList.add('is-revealed');
    });
    if (node.classList && node.classList.contains('lada-reveal')) node.classList.add('is-revealed');
  }

  document.addEventListener('shopify:section:load', function (e) {
    scanReveal(e.target);
    initHeader();
  });
  document.addEventListener('shopify:section:reorder', function () {
    scanReveal(document);
    initHeader();
  });
  document.addEventListener('shopify:section:select', function (e) { revealWithin(e.target); });
  document.addEventListener('shopify:block:select', function (e) {
    var t = e.target;
    if (t && t.closest) {
      var wrap = t.closest('.lada-reveal');
      if (wrap) wrap.classList.add('is-revealed');
    }
    revealWithin(t);
  });
}());
