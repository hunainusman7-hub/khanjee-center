/* Khan Jee v2 — progressive enhancement. Nothing here is required for the
   page to be readable or navigable with JS off. */
(function () {
  'use strict';

  /* Asked every time, never captured in a boolean at parse time.
     Reduce Motion is a system setting, not a device fact: somebody can
     turn it on with the shop already open, often precisely because
     something on the page is moving and making them ill. A snapshot
     taken at load would keep every loop in this file running for the
     rest of that visit. Same for (hover:hover): a tablet gains and
     loses a trackpad while the page stays put. */
  var motionMQ = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var hoverMQ = window.matchMedia && window.matchMedia('(hover: hover)');
  function reduced() { return !!(motionMQ && motionMQ.matches); }
  function noHover() { return !!(hoverMQ && !hoverMQ.matches); }
  function onMotionChange(fn) {
    if (!motionMQ) return;
    motionMQ.addEventListener ? motionMQ.addEventListener('change', fn) : motionMQ.addListener(fn);
  }
  /* Scrolls asked for in script carry their own behavior, and that
     option beats the stylesheet's scroll-behavior — so a page-wide
     `scroll-behavior:auto` under reduced motion does NOT rescue a
     scrollBy({behavior:'smooth'}). Every programmatic scroll in this
     file goes through here instead. */
  function scrollEase() { return reduced() ? 'auto' : 'smooth'; }

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
    function start() { if (delay && !reduced()) { stop(); timer = setInterval(function () { show(i + 1); }, delay); } }
    function stop()  { if (timer) { clearInterval(timer); timer = null; } }

    /* An interval already ticking does not stop itself when the setting
       changes, and the slides cross-fade, so a visitor who turns Reduce
       Motion on would keep getting the one thing they just asked the
       machine to stop. */
    onMotionChange(function () { reduced() ? stop() : start(); });

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
    /* Motion is expressed per second and scaled by frame time, not
       applied per frame. Per-frame constants run at double speed on a
       120Hz phone, which is most new phones here. */
    var DRIFT = 25;      /* px per second at rest */
    var HOVER_DRIFT = 3; /* eased to a crawl so the links can be clicked */
    var VEL_MAX = 900;   /* px per second, clamped */
    var DECAY = 0.06;    /* velocity half-life, in seconds-ish */

    /* Every strip this file has wired. Kept so a change to the motion
       setting can reach a loop that is already running, rather than
       only the next one to be created. */
    var live = [];

    function bootAll(root) {
      Array.prototype.slice.call((root || document).querySelectorAll('[data-bmq]')).forEach(init);
    }

    bootAll(document);

    /* Turning Reduce Motion ON stops every strip where it stands; the
       stylesheet's own reduced-motion block pins the rows at transform
       none and hands the strip back as a plain horizontal scroller, so
       nothing is left mid-drift. Turning it OFF builds and starts the
       strips that refused to initialise at load. */
    onMotionChange(function () {
      if (reduced()) { live.forEach(function (c) { c.stop(); }); return; }
      bootAll(document);
      live.forEach(function (c) { c.start(); });
    });

    function init(wrap) {
      /* Reduce Motion is asked here rather than once at the top of the
         file, and the strip is simply not built while it is on. init
         duplicates every logo to hide the seam, and the reduced-motion
         stylesheet turns .bmq__rows into a row the visitor scrolls by
         hand — where a duplicate set would print all seventy-four
         brands twice. So: no clone, no loop, and the strip is built
         properly the moment the setting is turned off. */
      if (reduced() || wrap.getAttribute('data-bmq-ready')) return;

      var rows = Array.prototype.slice.call(wrap.querySelectorAll('[data-bmq-row]'));
      if (!rows.length) return;
      wrap.setAttribute('data-bmq-ready', 'true');

      var raf = null, hover = false, lastY = window.scrollY, vel = 0, last = 0;
      var onScreen = true, paused = false;
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
        /* READ EVERY ROW FIRST, WRITE AFTERWARDS. paint() sets a
           transform, and a transform write between two offsetLeft
           reads forces the engine to lay the row out again to answer
           the second one. Two passes means one layout for the whole
           strip instead of one per row. */
        var reads = state.map(function (s) {
          var first = s.row.children[0];
          var clone = s.row.children[s.half];
          return (first && clone) ? clone.offsetLeft - first.offsetLeft
                                  : s.row.scrollWidth / 2;
        });

        state.forEach(function (s, i) {
          var w = reads[i];
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

      /* ONE REMEASURE PER FRAME, NOT ONE PER LOGO.

         Width changes after first paint, twice: the logos are lazy and
         Bodoni replaces the fallback in the typographic items, so
         measuring once at init leaves the loop period wrong for the
         life of the page. But hanging measure() straight off each
         image's load event meant seventy-four of them, arriving a few
         milliseconds apart, each reading offsetLeft on every row while
         the animation loop was writing transforms to those same rows —
         up to ninety forced layouts interleaved with the frames the
         strip is trying to draw, which is exactly the part of the page
         load where a phone has nothing to spare.

         They all want the same answer, so coalesce them into the next
         frame and read once. Deferring also keeps the ResizeObserver
         callback out of its own "loop completed with undelivered
         notifications" warning, since the writes no longer happen
         inside it. */
      var queued = false;
      function remeasure() {
        if (queued) return;
        queued = true;
        window.requestAnimationFrame(function () { queued = false; measure(); });
      }

      if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
      wrap.querySelectorAll('img').forEach(function (img) {
        if (!img.complete) img.addEventListener('load', remeasure, { once: true });
      });
      if (window.ResizeObserver) {
        var ro = new ResizeObserver(remeasure);
        ro.observe(wrap);
      } else {
        window.addEventListener('resize', remeasure, { passive: true });
      }

      function onScroll() {
        var y = window.scrollY;
        var dy = y - lastY;
        /* lastY moves even while the strip is parked, or the first
           frame after it scrolls back into view is handed the whole
           journey as one delta. */
        lastY = y;
        if (!onScreen || paused) return;
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
        if (raf !== null || document.hidden || !onScreen || paused || reduced()) return;
        last = 0;
        raf = window.requestAnimationFrame(frame);
      }
      function stop() {
        if (raf !== null) { window.cancelAnimationFrame(raf); raf = null; }
      }
      var me = { start: start, stop: stop };
      live.push(me);

      /* OFF SCREEN IS OFF. The strip sits low on the home page, and
         without this it held a frame callback open for the whole visit
         — writing transforms to two rows nobody could see, on a phone,
         while the customer read the rest of the page. The margin means
         it is already moving by the time it is scrolled to, rather than
         starting from a standstill in view. */
      if (window.IntersectionObserver) {
        var vis = new IntersectionObserver(function (entries) {
          onScreen = entries[entries.length - 1].isIntersecting;
          if (onScreen) start(); else stop();
        }, { rootMargin: '150px 0px' });
        vis.observe(wrap);
      }

      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop(); else start();
      });

      /* A WAY TO STOP IT WITHOUT A MOUSE.

         On a pointer device the strip eases to a crawl on hover, which
         is what makes seventy-four moving links clickable. A phone has
         no hover and had nothing in its place: the links never stood
         still, so the only way to reach one was to chase it.

         First tap anywhere on the strip stops it and is not passed on
         — a tap aimed at a moving logo is a tap on whatever happens to
         be under the finger by the time it lands, so opening that is
         worse than opening nothing. With the strip stopped the second
         tap goes through to the logo the visitor can now actually see.
         Tapping the strip again away from a link starts it moving.

         Same two-step the product cards use for their second
         photograph, so it is one habit on this site rather than two.
         data-bmq-paused is on the wrapper for the stylesheet to show
         that the strip is held. */
      wrap.addEventListener('click', function (e) {
        if (!noHover()) return;
        var link = e.target.closest && e.target.closest('a');
        if (!paused) {
          /* Only a link's own default is worth cancelling; a tap on the
             gap between two logos had nothing to do anyway. */
          if (link) e.preventDefault();
          paused = true;
          wrap.setAttribute('data-bmq-paused', 'true');
          stop();
          return;
        }
        /* Paused already: a link is the visitor's choice and is left
           alone, and a tap on the empty part of the strip resumes. */
        if (link) return;
        paused = false;
        wrap.removeAttribute('data-bmq-paused');
        start();
      });

      /* The theme editor replaces a section's DOM wholesale. Without
         this the old loop keeps writing transforms to detached nodes
         while the new markup sits still, un-duplicated. Dropping the
         controller matters for the same reason: left in `live`, the
         next change to the motion setting would start a loop on a
         wrapper that is no longer in the document. */
      document.addEventListener('shopify:section:unload', function (e) {
        if (!e.target.contains(wrap)) return;
        stop();
        var at = live.indexOf(me);
        if (at !== -1) live.splice(at, 1);
      });

      start();
    }

    document.addEventListener('shopify:section:load', function (e) { bootAll(e.target); });
  })();

  /* ---------------- product card image swap on touch ----------------

     On a pointer device the second photograph arrives on :hover and
     CSS does the whole thing. A phone has no hover, so the first tap on
     the photograph swaps the frame and the second one follows the link.

     DELEGATED FROM THE DOCUMENT, not bound to the cards present at
     parse time. Every grid on this site is re-rendered in place — the
     white shop's filters and the Lada listing's filters both come back
     through the Section Rendering API, and the quick view panel builds
     a card's worth of markup out of a fetched product page. Cards bound
     once at load are the cards that were there before the customer
     filtered anything, and after one filter change the swap was gone
     from a grid that looks identical.

     snippets/lada-product-card.liquid now carries data-pcard,
     .pcard__link and .pcard__img--alt alongside its own .lcard names,
     so the Lada card comes down this same path rather than growing a
     second copy of it here. Reading the hover setting per event rather
     than once also covers the tablet that gains a trackpad mid-visit. */
  document.addEventListener('click', function (e) {
    if (!noHover() || !e.target.closest) return;

    var card = e.target.closest('[data-pcard]');
    var link = e.target.closest('.pcard__link');

    /* A tap anywhere else on the page puts every card back to its
       first frame, so a grid is never left with one card mid-swap. */
    if (!card) { clearTouched(null); return; }
    if (!link || !card.contains(link)) return;
    if (card.classList.contains('is-touched')) return;      /* second tap navigates */

    var alt = card.querySelector('.pcard__img--alt');
    if (!alt) return;                                       /* nothing to swap to */

    /* ASK THE STYLESHEET BEFORE SWALLOWING THE TAP.

       This handler cancels a real link, and it is only worth cancelling
       if something visible happens instead. The .is-touched rule is
       written per card family in CSS, so a card that grows the
       data-pcard hook before its own rule lands would answer the first
       tap with nothing at all and read as a broken link — on a phone,
       on the grid that is the whole shop. Add the class, ask what the
       second frame's opacity resolved to, and stand down if the answer
       is still zero. Failing back to the link is the safe direction. */
    clearTouched(card);
    card.classList.add('is-touched');
    /* THE RESOLVED VALUE DURING A TRANSITION IS THE ANIMATED ONE, NOT
       THE TARGET, and reading only that answered "nothing happened" on
       the very card where everything happens.

       .pcard__media img carries transition:opacity, so adding the class
       does not jump the alt frame to 1: it starts a fade, and the
       getComputedStyle below runs the style recalc that CREATES that
       fade, so it is handed the value at t=0 — the 0 we are trying to
       leave. The check therefore stood down on every .pcard on the
       white shop, put the class straight back, and let the tap navigate
       — which is the whole swap, gone from every phone, with the CSS
       for it sitting right there working.

       Measured in Chrome on a painted card, which is the only state
       that matters (before first paint there is no before-change style,
       no transition is created, and the read returns 1 — which is why
       this passes a quick probe at parse time and fails in the shop):
         rule + transition   opacity "0", one opacity transition running
         no rule             opacity "0", no transitions
         rule, no transition opacity "1", no transitions
       So ask the second question when the first says 0. A transition on
       opacity, started by the class we just added, IS the stylesheet
       answering yes. No rule means no style change means no transition,
       and that card still falls through to its link. */
    var lit = window.getComputedStyle(alt).opacity !== '0';
    if (!lit && alt.getAnimations) {
      lit = alt.getAnimations().some(function (a) {
        return a.transitionProperty === 'opacity';
      });
    }
    if (!lit) {
      card.classList.remove('is-touched');
      return;
    }
    e.preventDefault();
  });

  function clearTouched(except) {
    document.querySelectorAll('[data-pcard].is-touched').forEach(function (c) {
      if (c !== except) c.classList.remove('is-touched');
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
      rail.scrollBy({ left: dir * Math.round(rail.clientWidth * 0.8), behavior: scrollEase() });
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
        if (s) rail.scrollTo({ left: s.offsetLeft - rail.offsetLeft, behavior: scrollEase() });
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

    /* NOTHING A CUSTOMER READS IS WRITTEN IN THIS FILE.

       Three English words used to live here, and they overwrote
       whatever sections/main-product.liquid had rendered into the
       button. So the section's own wording — and any translation of
       it — survived exactly until the shopper changed one option, at
       which point the page started speaking in strings nobody can find
       in the theme editor. Copy belongs in Liquid.

       Two sources take their place. The resting wording is read off
       the button once, before anything touches it, so it is by
       definition whatever the section rendered. The out-of-stock
       wording comes off data attributes the section fills from its own
       settings. When an attribute is absent the label is left exactly
       as Liquid wrote it and only `disabled` changes: a button that
       cannot be pressed already says so, and making the sentence up
       here is how a theme ends up with one word that cannot be edited
       or translated. */
    var restWord = label ? label.textContent.trim() : '';
    var soldWord = form.getAttribute('data-sold-label');
    /* A pairing the shop does not list at all reads the same as one
       that has run out: either way the customer cannot have it. The
       separate attribute exists for a shop that wants to say so
       differently, and falls back to the one word when it does not. */
    var goneWord = form.getAttribute('data-unavailable-label') || soldWord;

    function say(word) { if (label && word) label.textContent = word; }

    function sync() {
      var chosen = selects.map(function (s) { return s.value; });
      var match = variants.filter(function (v) {
        return v.options.every(function (o, i) { return o === chosen[i]; });
      })[0];

      if (!match) {
        if (atc) atc.disabled = true;
        say(goneWord);
        return;
      }
      idField.value = match.id;
      if (atc) atc.disabled = !match.available;
      say(match.available ? restWord : soldWord);
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
   adds; and the header is painted dark by the stylesheet from the
   first frame, so it neither reads anything written here nor has a
   state left to lose. The gate falls back to its 61px default height,
   which is the bar's height on every viewport where it does not wrap.
   ============================================================ */
(function () {
  'use strict';

  /* Asked every time, for the reason given at the top of this file:
     Reduce Motion is a setting, not a device fact, and a boolean
     captured at parse time keeps the page moving for the rest of the
     visit after somebody turns it on. */
  var motionMQ = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  function reduced() { return !!(motionMQ && motionMQ.matches); }

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

     THE LIST BELOW WAS ONCE FIVE NAMES THAT NOTHING EMITTED. Every
     one of them — .lada__grid, .lada__stages, .lada__proof-list,
     .lada__routes, .lada__house-grid — belonged to Lada sections that
     were cut or rewritten, so the second source had gone the same way
     as the first and the whole layer was dead code that looked alive.
     Checked against every file in sections/, the containers that
     actually ship are the ones named below. They are not all Lada:
     the effect was always written as a site-wide grammar and scoping
     it to one page is half of what made the Lada page read as a
     different website.

     Rails and scrollports are deliberately absent — .crail__track,
     .pcar rails, .csplit__rail. They are horizontal scrollers, and a
     child that fades and rises while its own scrollport is snapping
     to it fights itself.

     Layout columns are absent too: .pdp__grid and .lpdp__grid hold
     the buying column, and holding an Add to bag button back behind
     an entrance animation is the sort of premium that costs a sale.

     Three hard guards before anything is hidden: prefers-reduced-
     motion, IntersectionObserver actually existing, and the site's own
     [data-reveal] hook. That last one matters now that Liquid marks
     the Lada cards and the gateway doors with data-reveal: site.js
     already hides and reveals those, with its own class, its own
     observer and its own timing, and an element caught by both would
     be hidden twice and revealed on whichever transition finished
     last. One element, one reveal. Whoever marks it first owns it. */
  var REVEAL_GROUPS = [
    '.lada-gate__doors',  /* /pages/lada     : the two doors        */
    '.pgrid',             /* every product grid, Lada listing too   */
    '.pdp__rel-grid',     /* product page    : the other pieces     */
    '.epair',             /* home            : the editorial pair   */
    '.bdir__grid',        /* brands page     : the houses           */
    '.bwall',             /* brand wall      : one group's houses   */
    '.grid-brand'         /* collections index : the brand cards    */
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
    if (reduced() || !('IntersectionObserver' in window)) return;

    var scope = root && root.querySelectorAll ? root : document;
    var found = slice(scope.querySelectorAll(REVEAL_SEL));
    var items = [];
    found.forEach(function (el) {
      /* data-lada-reveal is the "already handled" mark. Without it a
         rescan re-hides an element that has finished its reveal. */
      if (el.hasAttribute('data-lada-reveal')) return;
      /* site.js got there first. See the note above REVEAL_GROUPS. */
      if (el.hasAttribute('data-reveal')) return;
      items.push(el);
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

    /* Safety net, and the same shape as site.js's: both ask whether
       anything is on screen and still hidden, and neither touches what
       is below the fold. (site.js used to reveal EVERY item after two
       seconds unconditionally, which quietly cancelled the effect for
       anything the visitor had not reached yet. It no longer does, and
       the two nets should stay in step.)

       This is narrower than this file's first version, which only
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

  /* ---------------- 2. header: publish the bar's height ----------------

     Measures .hdr and publishes it as --lada-hdr-h on <html>, because
     .lada-gate sizes itself with calc(100svh - var(--lada-hdr-h,61px))
     and the gateway is meant to be exactly one screen. With nothing
     publishing it every gate fell back to the hardcoded 61px and the
     doors were a few pixels out on any viewport where the bar wrapped.

     THERE IS NO SCROLLED STATE HERE ANY MORE, and that is the point.
     This block used to keep a `scrolled-past-header` class on <body>,
     rewritten from a scroll listener for the life of the page, and
     nothing in the theme ever read it: no rule in either stylesheet,
     no other script. The header treatment it was meant to drive is
     `.template-page-lada:has(.lada-gate) .hdr`, which paints the bar
     dark from the first frame with no JavaScript at all — deliberately,
     so there is no white flash before a script runs. Deleting the class
     takes a scroll listener and a per-frame <body> class write off the
     one page on the site that is a full-screen image.

     Scoped three ways so it cannot run elsewhere: a Lada body template
     class, the presence of .hdr, and the presence of the full plate the
     measurement is for. The body check accepts all three Lada templates
     because the page, the listing and the product page are one register
     and a hook that only knows about one of them is how they drift
     apart. The .lada-gate check is what keeps this to the one surface
     that actually reads the variable: on the listing and the product
     page there is no gate section and nothing to measure for.

     THAT PLATE IS .lada-gate, AND IT USED TO BE .lada__hero. The hero
     section was replaced by sections/lada-gateway.liquid, which emits
     `.lada .lada-gate`, and nothing has emitted .lada__hero since — so
     this function returned on its first real check and never ran on the
     page it was written for.

     State lives at module scope, not inside initHeader, because the
     theme editor can call initHeader again after a section reload and
     the listener bound on the first call has to see the new element
     rather than a stale closure. */
  var hdrEl = null;
  var hdrBound = false;

  function hdrMeasure() {
    if (!hdrEl) return;
    /* The bar is min-height:60px but wraps on narrow viewports, so the
       height is measured rather than hardcoded. Measured off the header
       itself, so it stays correct if an announcement bar is ever added
       above it. */
    document.documentElement.style.setProperty('--lada-hdr-h', hdrEl.offsetHeight + 'px');
  }

  var LADA_TEMPLATES = ['template-page-lada', 'template-collection-lada', 'template-product-lada'];

  function initHeader() {
    var body = document.body;
    if (!body) return;
    var onLada = LADA_TEMPLATES.some(function (c) { return body.classList.contains(c); });
    if (!onLada) return;

    /* No plate under the bar: either this is the listing or the product
       page, or the client has removed the gateway section in the theme
       editor. Nothing reads --lada-hdr-h without a gate, so stand down
       rather than keep measuring for a rule that cannot match. */
    if (!document.querySelector('.lada-gate')) { hdrEl = null; return; }

    hdrEl = document.querySelector('.hdr');
    if (!hdrEl) return;

    hdrMeasure();

    if (hdrBound) return;
    hdrBound = true;
    window.addEventListener('resize', hdrMeasure, { passive: true });
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

/* ---------------- lada quick view (16 Sep 2026) ---------------- */
/* ============================================================
   LADA QUICK VIEW — behaviour for snippets/lada-quick-view.liquid
   Merge target: assets/kj-v2.js, appended as its own IIFE at the end
   of the file, alongside the two Lada IIFEs already there. It shares
   no state with anything and exports nothing, so it can be dropped in
   without touching a line of what is above it.

   Nothing here is required to buy. The panel is an enhancement on top
   of two real links: the card's photograph and its name both go to the
   product page, and that page is the whole truth. If this file is
   blocked, 404s or is still parsing, the quick view button does
   nothing and every card is still a working route to a product.

   THE ONE THING TO KNOW BEFORE EDITING. Everything below is delegated
   from `document` and every element is looked up at the moment it is
   used, never cached in a closure. The panel and the grid live inside
   sections/lada-collection.liquid, and a filter change re-renders that
   section through the Section Rendering API — which replaces both the
   cards AND the dialog node. assets/kj-cart.js learned this the same
   way with the bag drawer and looks up [data-kj-drawer] on every call;
   this file follows it.
   ============================================================ */
(function () {
  'use strict';

  /* Where the panel looks for its content inside the fetched section,
     in order.

     data-lada-qv-content / data-lada-qv-media first, so any section can
     nominate its own buying column and lead frame and be picked up with
     no change here. Then sections/main-product-lada.liquid's .lpdp__
     names, which is what product.lada.json renders. Then the shared
     product page's .pdp__ names, so the panel still answers for a Lada
     product that has not been given the Lada template yet.

     Three names rather than one because the Lada product section
     deliberately does NOT reuse .pdp__form and .pdp__buy: kj-v2.js
     binds those at parse time for <select> options and that page needs
     radios. Its reasons are good and this file follows the markup
     rather than asking it to change. */
  var CONTENT_SEL = ['[data-lada-qv-content]', '.lpdp__info', '.pdp__info'];

  /* Every entry names the product's OWN media region. There is no bare
     `img` at the end of this list and there must never be one again.
     The second request in load() asks for the plain product URL, so the
     document being searched is then the WHOLE page: header, footer and
     sections/main-product.liquid's .pdp__rel-grid of other products. A
     piece with no photograph yet — which is how every Lada product
     ships until the client loads his shoot — matched none of the real
     selectors, fell through to `img`, and the panel showed A DIFFERENT
     PRODUCT'S photograph as this one's lead frame. An empty plate is
     the honest answer and buildMedia now always draws one. */
  var MEDIA_SEL = ['[data-lada-qv-media]', '.lpdp__frame img', '.lpdp__img',
                   '.pdp__stage img', '.pdp__gal img'];

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function dialog() { return $('[data-lada-qv]'); }
  function isOpen() { var d = dialog(); return !!(d && d.hasAttribute('open')); }

  /* Raw section HTML, keyed by product url, for this page view only.
     Re-opening the same card is then instant and silent. Nothing is
     stored across navigations: a price or a stock state going stale in
     a tab left open all afternoon is exactly what the Section
     Rendering API is here to prevent. */
  var cache = {};
  var token = 0;            /* the open this response belongs to */
  var lastTrigger = null;   /* the card button that opened the panel */
  var pendingReturn = null; /* a trigger owed focus once the bag closes */
  var bagWatch = null;

  /* ---------------------------------------------------------------
     1. OPEN
     --------------------------------------------------------------- */

  function open(trigger) {
    var dlg = dialog();
    if (!dlg || dlg.hasAttribute('open')) return;

    var url = trigger.getAttribute('data-product-url') ||
              trigger.getAttribute('href');
    if (!url || url.charAt(0) === '#') return;

    /* showModal is what makes this a modal dialog: top layer, the rest
       of the document inert, Escape, and a focus trap, all from the
       browser. Without it there is no honest way to be modal that does
       not start writing `inert` on the same elements kj-cart.js writes
       it on — so instead of half a dialog, the customer gets the real
       product page, which is where the button was pointing anyway. */
    if (typeof dlg.showModal !== 'function') { window.location.href = url; return; }

    lastTrigger = trigger;
    pendingReturn = null;

    /* The name is set BEFORE the dialog opens so it has its real
       accessible name from the first frame. It comes from the card,
       because the card already has it and the fetch has not happened
       yet. Once the section lands, its own heading wins. */
    setTitle(titleFor(trigger));
    setFullHref(url);

    reset();
    try { dlg.showModal(); } catch (e) { window.location.href = url; return; }

    document.documentElement.classList.add('lada-qv-lock');

    /* Focus the close button, the same place the bag drawer starts.
       showModal already moves focus into the dialog, but which element
       it picks differs between browsers and the close button is the
       one control that is always there, whatever the fetch returns. */
    var x = $('[data-lada-qv-close]:not([aria-hidden="true"])', dlg);
    var p = $('[data-lada-qv-panel]', dlg);
    (x || p || dlg).focus({ preventScroll: true });

    watchBag();
    load(url, ++token);
  }

  function titleFor(trigger) {
    var explicit = trigger.getAttribute('data-product-title');
    if (explicit) return explicit;
    /* The card's own heading. Falls back to the panel's default, which
       is a setting, so no customer-facing string is written in here. */
    var card = trigger.closest('.lcard') || trigger.closest('article');
    var h = card && $('.lcard__title, h2, h3', card);
    return (h && h.textContent.trim()) || '';
  }

  function setTitle(text) {
    var dlg = dialog();
    var el = dlg && $('[data-lada-qv-title]', dlg);
    if (!el) return;
    el.textContent = text || dlg.getAttribute('data-lada-qv-fallback-title') || '';
  }

  function setFullHref(url) {
    var dlg = dialog();
    if (!dlg) return;
    $$('[data-lada-qv-full]', dlg).forEach(function (a) { a.setAttribute('href', url); });
  }

  /* Back to the loading state. Done on open rather than on close so the
     panel does not visibly empty itself while it is sliding away. */
  function reset() {
    var dlg = dialog();
    if (!dlg) return;
    var body = $('[data-lada-qv-body]', dlg);
    var slot = $('[data-lada-qv-slot]', dlg);
    if (slot) slot.innerHTML = '';
    show('[data-lada-qv-load]', true);
    show('[data-lada-qv-fail]', false);
    show('[data-lada-qv-foot]', false);
    if (body) { body.setAttribute('aria-busy', 'true'); body.scrollTop = 0; }
  }

  function show(sel, on) {
    var dlg = dialog();
    var el = dlg && $(sel, dlg);
    if (el) el.hidden = !on;
  }

  /* ---------------------------------------------------------------
     2. CLOSE
     --------------------------------------------------------------- */

  /* EVERY way out goes through here, and the cleanup happens BEFORE
     the dialog is told to close.

     The obvious shape for this was a listener on the dialog's own
     `close` event, with every path just calling dlg.close(). It was
     written that way first and the scroll lock stayed on the page:
     the browser this was built against fires no close event at all,
     not for dlg.close() and not for Escape, on a plain <dialog> with
     nothing else on the page. Whether that is a bug in one build or
     not, hanging the release of a scroll lock on a single event is
     one failure away from a site the customer cannot scroll, so the
     cleanup does not depend on an event any more. The listener below
     is kept as a second chance for a close this file did not start,
     and it is written to be safe to run twice. */
  function close() {
    var dlg = dialog();
    if (!dlg) return;

    token++; /* orphan any response still in flight */
    document.documentElement.classList.remove('lada-qv-lock');
    if (dlg.hasAttribute('open')) dlg.close();

    /* The browser returns focus to whatever was focused when showModal
       ran, which is the card's own button — but only if anything was
       focused at all. Safari does not focus a <button> when it is
       clicked and a touch does not focus anything anywhere, so for most
       of the people who will use this panel there is nothing for the
       browser to return to, and the close button of a dialog that is
       now display:none KEEPS the focus. Verified in a browser: after
       Escape, document.activeElement was still .lada-qv__x inside the
       closed dialog, so the next Tab restarted from the top of the
       document and the grid was gone.

       Three ways it can be stranded, then: nothing focused, <body>, or
       still inside the dialog that just closed. Any of them and it goes
       back to the card. If the browser DID return it to the card, the
       card is not inside the dialog and none of this runs. */
    var lost = !document.activeElement ||
               document.activeElement === document.body ||
               dlg.contains(document.activeElement);
    if (lost && lastTrigger && document.contains(lastTrigger)) {
      lastTrigger.focus({ preventScroll: true });
    }
    lastTrigger = null;
  }

  document.addEventListener('close', function (e) {
    if (!e.target || !e.target.hasAttribute || !e.target.hasAttribute('data-lada-qv')) return;
    document.documentElement.classList.remove('lada-qv-lock');
  }, true);

  /* Escape. The browser closes a modal dialog on Escape by itself, and
     that path would skip everything above it, so it is taken over
     here instead. preventDefault stops the UA close request; close()
     on the next line does the same job with the cleanup attached. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    var dlg = dialog();
    if (!dlg || !dlg.hasAttribute('open')) return;

    /* The size guide comes in with the buying column as a <details>,
       and on the product page Escape closes THAT, not the page. Taking
       Escape over for the dialog without this made the one key a
       customer uses to dismiss the chart close the whole panel and
       lose his place in the grid. Innermost thing first, which is what
       Escape means everywhere else. */
    var slot = $('[data-lada-qv-slot]', dlg);
    var openDetails = slot && $('details[open]', slot);
    if (openDetails) {
      e.preventDefault();
      openDetails.open = false;
      var sum = $('summary', openDetails);
      if (sum) sum.focus({ preventScroll: true });
      return;
    }

    e.preventDefault();
    close();
  }, true);

  /* ---------------------------------------------------------------
     3. FETCH
     --------------------------------------------------------------- */

  function sectionUrl(url, id) {
    var u = new URL(url, window.location.origin);
    u.searchParams.set('section_id', id);
    return u.pathname + u.search;
  }

  function get(url) {
    return fetch(url, {
      headers: { Accept: 'text/html', 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'same-origin'
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    });
  }

  function load(url, mine) {
    if (cache[url]) { paint(cache[url], url, mine); return; }

    var dlg = dialog();
    var id = (dlg && dlg.getAttribute('data-lada-qv-section')) || 'main';

    /* Two steps, and the second one is the point. A section id is the
       key in a JSON template, not a filename, and templates/product
       .lada.json does not exist yet — so the id in the setting is a
       reasonable guess until it does. If the guess is wrong the
       section response comes back empty or without anything usable in
       it, and rather than showing a failure for a configuration
       mistake the panel asks for the plain product page and takes the
       same fragment out of that. One request when the id is right,
       two when it is not, a failure only when the product itself
       cannot be reached. */
    get(sectionUrl(url, id))
      .then(function (html) {
        if (usable(html)) return html;
        return get(url);
      })
      .catch(function () { return get(url); })
      .then(function (html) {
        if (!usable(html)) throw new Error('empty');
        cache[url] = html;
        paint(html, url, mine);
      })
      .catch(function () { fail(mine); });
  }

  function usable(html) {
    if (!html || !html.trim()) return false;
    return !!pick(parse(html), CONTENT_SEL);
  }

  /* Memoised on the last string parsed. A single open asks "is this
     usable" and then builds from the same markup, and parsing a whole
     product page three times to answer one question is work nobody
     asked for. Only the panel reads this document and it clones every
     node it takes, so handing the same one back twice is safe. */
  var lastHtml = null, lastDoc = null;
  function parse(html) {
    if (html === lastHtml && lastDoc) return lastDoc;
    lastHtml = html;
    lastDoc = new DOMParser().parseFromString(html, 'text/html');
    return lastDoc;
  }

  function pick(doc, list) {
    for (var i = 0; i < list.length; i++) {
      var el = doc.querySelector(list[i]);
      if (el) return el;
    }
    return null;
  }

  function fail(mine) {
    if (mine !== token || !isOpen()) return;
    var body = $('[data-lada-qv-body]', dialog());
    show('[data-lada-qv-load]', false);
    show('[data-lada-qv-fail]', true);
    show('[data-lada-qv-foot]', false); /* the failure block carries the link */
    if (body) body.removeAttribute('aria-busy');
  }

  /* ---------------------------------------------------------------
     4. BUILD WHAT GOES IN THE PANEL
     --------------------------------------------------------------- */

  function paint(html, url, mine) {
    if (mine !== token || !isOpen()) return; /* a later card won the race */

    var dlg = dialog();
    var slot = $('[data-lada-qv-slot]', dlg);
    var body = $('[data-lada-qv-body]', dlg);
    if (!slot) return;

    var doc = parse(html);
    var src = pick(doc, CONTENT_SEL) || doc.body;
    var info = src.cloneNode(true);

    /* A <script> parsed by DOMParser has not "already started", so
       appending it to the live document RUNS it — unlike the same
       markup set through innerHTML. A product section may legitimately
       carry one, and running a second copy of a section's boot script
       inside a panel is how two variant pickers end up fighting over
       one form. JSON payloads stay: they never execute, and the
       variant table below is read out of one. */
    $$('script', info).forEach(function (s) {
      var t = (s.getAttribute('type') || '').toLowerCase();
      if (t.indexOf('json') === -1) s.remove();
    });

    /* The product page's h1 becomes the dialog's own heading rather
       than a second copy of the name inside it. One h1 per page is the
       binding rule and the listing already spent it. */
    var h1 = $('h1', info);
    if (h1) { setTitle(h1.textContent.trim()); h1.remove(); }

    dedupeIds(info);
    /* Added, not assigned. Wiping the element's own classes would take
       the product section's internal layout with it. */
    info.classList.add('lada-qv__info');
    info.removeAttribute('id');

    /* The Lada product page's stylesheet is written as
       `.template-product-lada .lpdp__x`, scoped that way so the dark
       register ends the moment a customer opens an Alkaram lawn suit.
       That scope is a body class, and the panel opens on the LISTING,
       whose body class is .template-collection-lada — so every one of
       those rules would miss and the fetched column would arrive with
       no styling at all.

       Putting the template's own class on this wrapper switches its
       stylesheet back on for the fetched markup and for nothing else:
       the class is on an element inside the dialog, so it cannot reach
       a single other element on the listing. The alternative was to
       restate that stylesheet here under .lada-qv__info, which is one
       product page owned by two files and safe to edit in neither.

       Only when the fragment actually is that markup. A fragment taken
       off the shared .pdp__info has nothing those rules can match, and
       a class that describes it wrongly is a lie left for the next
       person to read. */
    if (info.querySelector('[class*="lpdp__"]') || /(^|\s)lpdp__/.test(info.className || '')) {
      info.classList.add('template-product-lada');
    }

    slot.innerHTML = '';
    slot.appendChild(buildMedia(doc));
    slot.appendChild(info);

    syncVariants(slot);
    syncLada(slot);
    syncQty(slot);
    setFullHref(url);

    show('[data-lada-qv-load]', false);
    show('[data-lada-qv-fail]', false);
    show('[data-lada-qv-foot]', true);
    if (body) body.removeAttribute('aria-busy');
  }

  /* ALWAYS returns a plate, never null.

     It used to return null when it found no photograph, and paint()
     then appended one child to a slot that is
     `grid-template-columns:minmax(0,42%) minmax(0,1fr)` on desktop. The
     buying column landed in the 42% track with the 1fr track empty
     beside it: the whole panel squeezed into its left two fifths next
     to a hole. That is not an edge case, it is the shipping state —
     every Lada product has no photograph until the client loads his
     shoot — and it is the state the brief calls out by name.

     The empty plate is what the stylesheet was already written for: 4:5
     at --lada-ground, a reserved frame rather than a collapsed row, the
     same answer sections/main-product-lada.liquid gives with
     .lpdp__frame--empty. aria-hidden for the same reason it carries it
     there: an empty box is nothing to announce. */
  function buildMedia(doc) {
    var box = document.createElement('div');
    box.className = 'lada-qv__media';

    var found = pick(doc, MEDIA_SEL);
    if (found && found.tagName !== 'IMG') found = found.querySelector('img');
    if (!found) { box.setAttribute('aria-hidden', 'true'); return box; }

    var img = found.cloneNode(false);

    /* The product page's lead frame is a photograph and nothing else
       now: the tabpanel role and the tab stop that used to sit on it
       are gone from sections/main-product.liquid, and the Lada page's
       frame never had them. What it still carries is page state, none
       of which survives the trip into a panel — the id the thumbnail
       strip's aria-controls points at, the `hidden` that strip toggles,
       a load priority for a frame that is at the top of a page but not
       at the top of this one, and .pdp__/.lpdp__ paint that would drag
       the product page's layout into a 40vw column. role, tabindex and
       aria-label are swept with them: a clone is a poor place to find
       out that a gallery grew them back. */
    ['id', 'role', 'tabindex', 'aria-label', 'hidden', 'fetchpriority', 'class', 'style']
      .forEach(function (a) { img.removeAttribute(a); });

    img.className = 'lada-qv__img';
    img.setAttribute('loading', 'eager');
    img.setAttribute('decoding', 'async');
    /* The panel is never full width, so the product page's own sizes
       would have the browser pick a candidate two steps too large. */
    img.setAttribute('sizes', '(min-width:760px) 40vw, 92vw');

    box.appendChild(img);
    return box;
  }

  /* Ids arriving from another page can collide with ids already on this
     one — a quick view opened from the related grid ON a product page is
     the real case. A duplicate id silently breaks the label that points
     at it, so rename both sides together. */
  function dedupeIds(root) {
    var map = {};
    $$('[id]', root).forEach(function (el) {
      var id = el.id;
      if (!id || !document.getElementById(id)) return;
      var next = 'qv-' + id;
      map[id] = next;
      el.id = next;
    });
    if (!Object.keys(map).length) return;

    ['for', 'aria-controls', 'aria-labelledby', 'aria-describedby', 'list'].forEach(function (attr) {
      $$('[' + attr + ']', root).forEach(function (el) {
        var out = el.getAttribute(attr).split(/\s+/).map(function (v) {
          return map[v] || v;
        }).join(' ');
        el.setAttribute(attr, out);
      });
    });
  }

  /* ---------------------------------------------------------------
     5. THE INJECTED CONTROLS

     assets/kj-v2.js wires the option selects and the quantity stepper
     by querying the document once at load, so markup that arrives
     afterwards gets nothing. Rather than ask that file to change, the
     same two behaviours are delegated here and scoped to the inside of
     the panel — so the real product page keeps the handlers it already
     has and nothing is bound twice.

     Add to bag needs no help at all: kj-cart.js listens for submit on
     form[data-kj-atc] at document level, so the form that arrives in
     here posts to /cart/add.js and reports its own failures into
     [data-kj-atc-error] exactly as it does on the product page.
     --------------------------------------------------------------- */

  function inSlot(el) { return !!(el && el.closest('[data-lada-qv-slot]')); }

  function syncVariants(root) {
    var form = $('form[data-kj-atc]', root) || $('.pdp__form', root) || $('form', root);
    if (!form) return;

    var data = $('[data-pdp-variants]', form);
    var idField = $('[data-pdp-variant-id]', form) || $('input[name="id"]', form);
    var selects = $$('[data-pdp-option]', form);
    if (!data || !idField || !selects.length) return;

    var variants;
    try { variants = JSON.parse(data.textContent); } catch (e) { return; }

    var btn = $('[type="submit"]', form);
    if (!btn) return;
    /* Only ever the dedicated label span. Writing text straight into
       the button would delete the spinner element that kj-cart.js
       reveals while the add is in flight. A button with no label span
       simply keeps its wording and only gains or loses `disabled`. */
    var label = $('.pdp__atc-t, .lcard__quick-t', form);

    /* The two strings this can show are the button's own starting text
       and one setting on the dialog. Nothing customer-facing is written
       in this file. */
    var dlg = dialog();
    if (label && !label.hasAttribute('data-qv-label')) {
      label.setAttribute('data-qv-label', label.textContent.trim());
    }
    var canBuy = label && label.getAttribute('data-qv-label');
    var sold = (dlg && dlg.getAttribute('data-lada-qv-sold')) || 'Sold out';
    function say(text) { if (label) label.textContent = text; }

    var chosen = selects.map(function (s) { return s.value; });
    var match = variants.filter(function (v) {
      return v.options && v.options.every(function (o, i) { return o === chosen[i]; });
    })[0];

    if (!match) { btn.disabled = true; say(sold); return; }
    idField.value = match.id;
    btn.disabled = !match.available;
    say(match.available ? canBuy : sold);
  }

  /* The Lada product section ships its own behaviour in a <script> at
     the bottom of the section, scoped to that section's id, and this
     file deliberately does not run it: a second copy of it would fight
     the real one on a product page, which is the very thing its author
     guarded against. Everything it does that only makes the page nicer
     is simply not done in here, and the page degrades the way that
     section already documents.

     What is NOT "nicer" is re-supplied below, off the same attributes
     the section already emits. The first version of this file only
     re-supplied half of it and shipped two faults, both recorded here
     because the shape of the markup is what caused them:

     THE VARIANT. sections/main-product-lada.liquid has TWO paths.

       one option   every radio is name="id" value="<variant id>" and
                    carries data-lpdp-variant-radio; the checked radio
                    IS the field the form posts, and Liquid disables
                    the ones that are gone.
       two or more  the radios are named lpdp-o0, lpdp-o1 and carry an
                    OPTION VALUE, grouped by [data-lpdp-group], and the
                    form posts a hidden input[name="id"] carrying
                    [data-lpdp-variant-id]. Whether a pairing exists at
                    all is a script's job on that path; Liquid says so
                    in as many words.

     Only the first path was handled. On the second, nothing ever
     rewrote that hidden field, so a customer who chose ecru in medium
     got the FIRST variant added to his bag whatever he picked, at the
     first variant's price, with the add button never disabled for a
     pairing that does not exist. Alamgeer is colour and Ready to Wear
     is S/M/L, so both ship on the one-option path today and the fault
     was invisible — until the first piece is listed in two colours and
     three sizes, which is a day away, not a year. Both paths are
     driven below, off [data-lpdp-variants], exactly as the section's
     own script drives them.

     THE PRICE comes with it: every variant's price is rendered by
     Liquid and all but one carries `hidden`. A panel that misprices a
     garment is the worst thing it can do.

     THE WORDING. The button's label span is [data-lpdp-atc-t], not
     .pdp__atc-t, so syncVariants() below could never have found it.
     Its resting text is read off the button itself and the only other
     string is the dialog's own sold-out setting: nothing a customer
     reads is written in this file.

     THE STEPPER. Its plus and minus ship `hidden` and the section's
     script reveals them AND sets data-ready on the wrapper. The
     product stylesheet gives the buttons a display that outranks the
     hidden attribute, so in here they appeared on their own — but
     without data-ready the same stylesheet keeps the no-script layout,
     so the panel showed the native number spinners and the plus and
     minus at once, in the wider field, with neither button ever
     dimming at one or at the cap. Both are set here now. The min and
     max are read off the input, so the section's cap of three is kept
     rather than restated. */
  function ladaMap(root) {
    var json = $('[data-lpdp-variants]', root);
    if (!json) return [];
    try { return JSON.parse(json.textContent) || []; } catch (e) { return []; }
  }

  function ladaById(map, id) {
    for (var i = 0; i < map.length; i++) {
      if (String(map[i].id) === String(id)) return map[i];
    }
    return null;
  }

  function ladaByOptions(map, chosen) {
    for (var i = 0; i < map.length; i++) {
      var opts = map[i].options || [];
      var ok = true;
      for (var k = 0; k < chosen.length; k++) {
        if (chosen[k] === null || opts[k] !== chosen[k]) { ok = false; break; }
      }
      if (ok) return map[i];
    }
    return null;
  }

  function syncLada(root) {
    if (!root) return;

    var direct = $('[data-lpdp-variant-radio]:checked', root);
    var groups = $$('[data-lpdp-group]', root);

    /* No choice to make. A piece with one variant renders a hidden id
       and nothing else, and Liquid has already disabled the button if
       it is gone — so touching anything here could only undo that. */
    if (!direct && !groups.length) return;

    var map = ladaMap(root);
    var variant = null;

    if (direct) {
      /* The radio IS the id. The map is still the truth about whether
         that variant can be bought; `disabled` on the radio is Liquid's
         own answer and stands in if the map did not come with it. */
      variant = ladaById(map, direct.value) ||
                { id: direct.value, available: !direct.disabled };
    } else {
      var chosen = groups.map(function (g) {
        var on = $('input:checked', g);
        return on ? on.value : null;
      });
      variant = ladaByOptions(map, chosen);
    }

    var idField = $('[data-lpdp-variant-id]', root);
    var atc = $('[data-lpdp-atc]', root) || $('[type="submit"]', root);
    var label = $('[data-lpdp-atc-t]', root);

    /* Read once and kept on the element: the button's own resting
       wording, whatever setting the client typed it into. */
    if (label && !label.hasAttribute('data-qv-label')) {
      label.setAttribute('data-qv-label', label.textContent.trim());
    }
    var dlg = dialog();
    var addWord = label && label.getAttribute('data-qv-label');
    var soldWord = (dlg && dlg.getAttribute('data-lada-qv-sold')) || 'Sold out';

    /* A pairing that does not exist reads the same as one that is gone.
       The dialog's setting says "sold out" and that is right for both:
       either way the customer cannot have it. One string, not two. */
    if (!variant) {
      if (atc) atc.disabled = true;
      if (label) label.textContent = soldWord;
      return;
    }

    /* THE LINE THE WHOLE FIX IS FOR. On the combination path this is
       the field /cart/add.js receives. */
    if (idField) idField.value = variant.id;
    if (atc) atc.disabled = variant.available === false;
    if (label) label.textContent = variant.available === false ? soldWord : addWord;

    $$('[data-lpdp-vprice]', root).forEach(function (el) {
      el.hidden = el.getAttribute('data-lpdp-vprice') !== String(variant.id);
    });
  }

  /* The wrapper arrives without data-ready, which is how the product
     stylesheet tells the no-script layout from the wired one, and the
     two buttons arrive with `hidden`. Both are the section's own
     handshake and both are completed here, so the row inside the panel
     is the row the customer sees on the product page. */
  function syncQty(root) {
    var wrap = $('[data-lpdp-qty]', root);
    if (!wrap) return;
    var input = qtyInput(wrap);
    var steps = $$('[data-lpdp-step]', wrap);
    if (!input || !steps.length) return;
    steps.forEach(function (b) { b.hidden = false; });
    wrap.setAttribute('data-ready', 'true');
    sweepQty(wrap);
  }

  function qtyInput(wrap) {
    return $('input[type="number"]', wrap) || $('input[name="quantity"]', wrap);
  }

  function qtyBounds(input) {
    var min = parseInt(input.getAttribute('min'), 10);
    var max = parseInt(input.getAttribute('max'), 10);
    return { min: isNaN(min) ? 1 : min, max: isNaN(max) ? null : max };
  }

  /* Dimmed at one and at the cap rather than removed, so the row does
     not change width as the number changes. The product stylesheet
     already paints :disabled that way. */
  function sweepQty(wrap) {
    var input = qtyInput(wrap);
    if (!input) return;
    var b = qtyBounds(input);
    var n = parseInt(input.value, 10);
    if (isNaN(n)) n = b.min;
    $$('[data-lpdp-step]', wrap).forEach(function (btn) {
      var d = parseInt(btn.getAttribute('data-lpdp-step'), 10) || 0;
      btn.disabled = d > 0 ? (b.max !== null && n >= b.max) : n <= b.min;
    });
  }

  function clampQty(input) {
    var b = qtyBounds(input);
    var n = parseInt(input.value, 10);
    if (isNaN(n) || n < b.min) n = b.min;
    if (b.max !== null && n > b.max) n = b.max;
    input.value = n;
  }

  function stepQty(btn) {
    var wrap = btn.closest('[data-lpdp-qty]') || btn.parentNode;
    var input = qtyInput(wrap);
    if (!input) return;
    var by = parseInt(btn.getAttribute('data-lpdp-step'), 10) || 0;
    input.value = (parseInt(input.value, 10) || qtyBounds(input).min) + by;
    clampQty(input);
    sweepQty(wrap);
  }

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.closest || !inSlot(t)) return;

    var slot = t.closest('[data-lada-qv-slot]');
    if (t.closest('[data-pdp-option]')) { syncVariants(slot); return; }

    /* Both Lada paths change through a radio: the one-option path's
       radio is the id itself, the combination path's is an option value
       inside a [data-lpdp-group]. syncLada tells them apart. The size
       guide's inches / centimetres toggle is a radio too and rides in
       the same form, so it reaches here — syncLada is a no-op for it
       because it is in no group and carries no variant radio marker. */
    if (t.type === 'radio') { syncLada(slot); return; }

    var qwrap = t.closest('[data-lpdp-qty]');
    if (qwrap) { clampQty(t); sweepQty(qwrap); }
  });

  /* ---------------------------------------------------------------
     6. CLICKS, ALL DELEGATED
     --------------------------------------------------------------- */

  /* Where the press started. A drag that begins on the buy form and
     ends on the scrim is not a request to close the panel. */
  var downOnScrim = false;
  document.addEventListener('pointerdown', function (e) {
    /* The class is only on <html> while the panel is open, so on every
       other press anywhere on the site this listener costs one string
       comparison and stops. */
    if (!document.documentElement.classList.contains('lada-qv-lock')) {
      downOnScrim = false;
      return;
    }
    var dlg = dialog();
    downOnScrim = !!(dlg && dlg.hasAttribute('open') &&
      (e.target === dlg || (e.target.closest && e.target.closest('.lada-qv__scrim'))));
  }, true);

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    var trigger = t.closest('[data-lada-quickview]');
    if (trigger) {
      /* Nothing is cancelled unless there is a panel to open. If the
         snippet was not rendered, a trigger that is a real <a> must be
         left alone to go to the product page. */
      if (!dialog()) return;
      e.preventDefault();
      open(trigger);
      return;
    }

    var dlg = dialog();
    if (!dlg || !dlg.hasAttribute('open')) return;

    if (t.closest('[data-lada-qv-close]')) { close(); return; }

    /* The dialog element itself fills the viewport with the panel
       floating inside it, so a click on the dark area lands here. */
    if ((t === dlg || t.closest('.lada-qv__scrim')) && downOnScrim) { close(); return; }

    var step = t.closest('[data-lpdp-step]');
    if (step && inSlot(step)) { stepQty(step); return; }

    var up = t.closest('[data-pdp-qty-up]');
    var down = t.closest('[data-pdp-qty-down]');
    if ((up || down) && inSlot(up || down)) {
      var wrap = (up || down).closest('.pdp__buy, [data-kj-qty], form') || dlg;
      var input = $('[data-pdp-qty]', wrap) || $('input[name="quantity"]', wrap);
      /* Through the same clamp as the Lada stepper. The shared product
         page ships min="1" and no max today, so this changes nothing
         now; it means the day a max is added there the panel honours it
         instead of letting a customer ask for a quantity /cart/add.js
         will refuse. */
      if (input) {
        input.value = (parseInt(input.value, 10) || 1) + (up ? 1 : -1);
        clampQty(input);
      }
      return;
    }
  });

  /* ---------------------------------------------------------------
     7. HANDING OVER TO THE BAG

     Adding from inside the panel opens the bag drawer on top of it, and
     kj-cart.js makes the bag modal by putting `inert` on every top
     level element that is not the drawer. This panel is in the top
     layer and is not one of those elements, so it would sit ABOVE the
     bag with the bag unreachable underneath — two modals, and the wrong
     one on top. kj-cart.js already states the rule for this ("one modal
     at a time") and closes the nav and the filters when it opens; it
     cannot close something it does not know about, so the panel steps
     aside itself.

     There is no event to listen for: kj-cart.js fires none. What it
     does do is flip data-open on the drawer, and it replaces the whole
     drawer node on every cart change, so the observer is on the body
     with an attribute filter rather than on a node that will not
     survive the first add.

     Started on the first open, not at boot, so a page where nobody ever
     opens a quick view pays nothing for it.
     --------------------------------------------------------------- */

  function watchBag() {
    if (bagWatch || typeof MutationObserver !== 'function') return;
    bagWatch = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var el = records[i].target;
        if (!el.hasAttribute || !el.hasAttribute('data-kj-drawer')) continue;
        if (el.getAttribute('data-open') === 'true') handOff(el);
        else returnToCard();
      }
    });
    bagWatch.observe(document.body, {
      subtree: true, attributes: true, attributeFilter: ['data-open']
    });
  }

  function handOff(drawer) {
    if (!isOpen()) return;

    /* Remembered before closing, because closing clears it. The bag
       has already recorded the add button inside this panel as the
       thing to focus when it closes, and that button is about to stop
       being focusable, so focus would land on <body>. Sending it back
       to the card the customer was looking at is the honest end of
       the journey. */
    pendingReturn = lastTrigger;

    close();

    /* dlg.close() returns focus to the card synchronously, which would
       pull it straight out of the bag that just opened. Put it back.

       Not in one go, though. kj-cart.js's drawer is hidden with
       visibility:hidden and slid off on a transform, and both only
       come off when data-open flips — so at the moment this observer
       runs the panel can still be visibility:hidden, and focus() on
       something inside it is a silent no-op that leaves focus behind
       the open bag on a card that is about to be inert. So it is
       tried, and tried again on the next frame, and once more on a
       timer. The timer is not redundant: a frame callback does not run
       at all while the tab is in the background, which is exactly
       where a slow add can finish. Each attempt stops as soon as focus
       has landed. */
    tryFocusBag(drawer);
    requestAnimationFrame(function () { tryFocusBag(drawer); });
    setTimeout(function () { tryFocusBag(drawer); }, 120);
  }

  function tryFocusBag(drawer) {
    if (!drawer || drawer.getAttribute('data-open') !== 'true') return true;
    var panel = $('[data-kj-drawer-panel]', drawer) || drawer;
    if (panel.contains(document.activeElement)) return true;
    var target = $('[data-kj-drawer-close]:not([tabindex="-1"])', panel) || panel;
    target.focus({ preventScroll: true });
    return document.activeElement === target;
  }

  function returnToCard() {
    if (!pendingReturn) return;
    var card = pendingReturn;
    pendingReturn = null;
    if (!document.contains(card)) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    card.focus({ preventScroll: true });
  }
})();
