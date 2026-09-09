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
