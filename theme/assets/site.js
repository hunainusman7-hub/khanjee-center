/* Khan Jee — L2 interactions. No dependencies, ~4KB.
   Everything here is progressive enhancement: with JS off the page
   stays fully readable and navigable. */
(function () {
  'use strict';

  /* Asked every time, never captured in a boolean at parse time.
     Reduce Motion is a system setting a visitor can turn on with the
     shop already open, and a snapshot taken at load would keep the
     page moving for the rest of that visit. */
  var motionMQ = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  function reduced() { return !!(motionMQ && motionMQ.matches); }
  function onMotionChange(fn) {
    if (!motionMQ) return;
    motionMQ.addEventListener ? motionMQ.addEventListener('change', fn) : motionMQ.addListener(fn);
  }

  /* ---------- reveal on enter ---------- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    /* RUN AGAIN FOR MARKUP THAT ARRIVES LATER, and that is not a nicety.

       .js-reveal on <html> lives for the whole page, and the rule it
       switches on is `.js-reveal [data-reveal]{opacity:0}`. So any
       element carrying data-reveal that appears after this first pass
       is hidden by the stylesheet with nothing watching it: it does not
       arrive late, it never arrives at all. The client edits the Lada
       gateway and the category grid in the theme editor, where a
       section is re-rendered on every keystroke, and both of those
       sections mark their cards with data-reveal — so without the
       events at the bottom of this block he would watch his own doors
       vanish as he typed. */
    var scan = function (root) {
      if (reduced()) return;
      var found = (root || document).querySelectorAll('[data-reveal]');
      if (!found.length) return;
      document.documentElement.classList.add('js-reveal');

      var fresh = [];
      found.forEach(function (el) {
        /* The "already handled" mark. Without it a rescan hands the
           observer an element that has finished its reveal, and the
           2.5s net below would be armed against it a second time. */
        if (el.hasAttribute('data-reveal-seen')) return;
        el.setAttribute('data-reveal-seen', '');
        fresh.push(el);
        io.observe(el);
      });
      if (!fresh.length) return;

      /* Safety net, and it has to be a narrow one.

         The blanket version of this revealed EVERY item after two
         seconds, whether it was on screen or not. On any page taller
         than the fold that timer fires long before the visitor has
         scrolled to the second section, so every target below the fold
         was already revealed by the time it arrived: the observer's
         work was thrown away and the only thing the effect still did
         was hold the top of the page back for two seconds. It was the
         reveal's own off switch.

         So ask the question that actually matters instead: is anything
         sitting ON SCREEN and still hidden once the page has had time
         to settle. If so the observer missed it and we reveal it.
         Anything below the fold is left to the observer, which is the
         whole point of the effect. */
      setTimeout(function () {
        var h = window.innerHeight || document.documentElement.clientHeight;
        fresh.forEach(function (el) {
          if (el.classList.contains('is-in')) return;
          var r = el.getBoundingClientRect();
          if (r.top < h && r.bottom > 0) { el.classList.add('is-in'); io.unobserve(el); }
        });
      }, 2500);
    };

    scan(document);

    /* None of these fire on the live storefront, so a shopper pays
       nothing for them. A select reveals outright rather than
       observing: the editor has just scrolled to the thing the client
       clicked and it needs to be on screen now, not after a callback. */
    document.addEventListener('shopify:section:load', function (e) { scan(e.target); });
    document.addEventListener('shopify:section:reorder', function () { scan(document); });
    document.addEventListener('shopify:section:select', function (e) {
      if (!e.target || !e.target.querySelectorAll) return;
      e.target.querySelectorAll('[data-reveal]').forEach(function (el) { el.classList.add('is-in'); });
    });
  }

  /* ---------- nav drawer ---------- */
  var navBtn = document.querySelector('[data-nav-toggle]');
  var nav = document.querySelector('[data-nav]');
  if (navBtn && nav) {
    var setNav = function (open) {
      nav.setAttribute('data-open', String(open));
      navBtn.setAttribute('aria-expanded', String(open));
    };
    setNav(false);
    navBtn.hidden = false;
    navBtn.addEventListener('click', function () {
      setNav(navBtn.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navBtn.getAttribute('aria-expanded') === 'true') { setNav(false); navBtn.focus(); }
    });
    var wide = matchMedia('(min-width: 1024px)');
    var onWide = function () { if (wide.matches) setNav(false); };
    wide.addEventListener ? wide.addEventListener('change', onWide) : wide.addListener(onWide);
  }

  /* ---------- filter drawer (listing pages) ---------- */
  var fBtn = document.querySelector('[data-filter-toggle]');
  var filters = document.querySelector('[data-filters]');
  var scrim = document.querySelector('[data-scrim]');
  if (fBtn && filters) {
    var setF = function (open) {
      filters.setAttribute('data-open', String(open));
      fBtn.setAttribute('aria-expanded', String(open));
      if (scrim) scrim.setAttribute('data-open', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    };
    setF(false);
    fBtn.addEventListener('click', function () { setF(fBtn.getAttribute('aria-expanded') !== 'true'); });
    if (scrim) scrim.addEventListener('click', function () { setF(false); });
    filters.querySelectorAll('[data-filter-close]').forEach(function (b) {
      b.addEventListener('click', function () { setF(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && fBtn.getAttribute('aria-expanded') === 'true') { setF(false); fBtn.focus(); }
    });
  }

  /* ---------- filter chips: hold the highlight across the reload ---------- */
  /* .is-on is the only marker for a selected facet, on both rails. It
     used to be aria-pressed here, which is the same attribute the two
     collection sections dropped: a chip is a <label>, aria-pressed
     means nothing without role="button", and the checkbox inside
     already reports `checked`. Liquid prints .is-on on an active chip,
     so writing the same class is what keeps this handler and the
     reloaded page from disagreeing about which chip is lit.

     Driven off the checkbox's change, not a click on the label.
     Activating a label forwards a second, synthetic click to the
     control inside, and that click bubbles back out through the label
     — so a toggle bound here fires twice per tap and lands exactly
     where it started, which is the highlight going missing all over
     again. The checkbox is the state; read it rather than guess at it.

     Worth doing at all because the chip submits its form: this holds
     the selection lit through the round trip instead of letting it
     blink off while the new page loads. */
  document.querySelectorAll('[data-facet] .chip').forEach(function (c) {
    var box = c.querySelector('input[type="checkbox"]');
    if (!box) return;
    box.addEventListener('change', function () {
      c.classList.toggle('is-on', box.checked);
    });
  });

  /* ---------- hero scroll progress ---------- */
  var hero = document.querySelector('[data-hero]');
  if (hero) {
    var ticking = false;
    var frame = function () {
      ticking = false;
      /* Asked per frame, not once at bind time, so turning Reduce
         Motion on mid-visit actually stops the parallax. The property
         is removed rather than pinned at 0 so the stylesheet's own
         default takes over again. */
      if (reduced()) { hero.style.removeProperty('--p'); return; }
      var h = hero.offsetHeight || 1;
      hero.style.setProperty('--p', Math.min(1, Math.max(0, scrollY / h)).toFixed(4));
    };
    addEventListener('scroll', function () {
      if (ticking) return; ticking = true; requestAnimationFrame(frame);
    }, { passive: true });
    onMotionChange(frame);
    frame();
  }

  /* ---------- brand strip: base drift + scroll velocity ---------- */
  var rows = document.querySelectorAll('[data-strip-row]');
  if (rows.length) {
    var last = scrollY, vel = 0;
    var state = [], raf = null, built = false, onScreen = true;

    /* The rows are only duplicated once the strip is actually going to
       move. Under Reduce Motion the stylesheet turns .strip__rows into
       a plain horizontal scroller, and duplicating the logos there
       would print every brand twice in something the visitor scrolls
       by hand. */
    function build() {
      if (built) return;
      built = true;
      rows.forEach(function (row, i) {
        var half = row.children.length;
        /* duplicate the children once so the loop is seamless */
        row.innerHTML += row.innerHTML;
        /* The clone exists to hide the seam, nothing else. Left in the
           tab order and in the accessibility tree it doubles every
           brand name and every tab stop in the strip. */
        Array.prototype.slice.call(row.children, half).forEach(function (el) {
          el.setAttribute('aria-hidden', 'true');
          el.setAttribute('tabindex', '-1');
        });
        state.push({ row: row, x: 0, dir: i % 2 === 0 ? -1 : 1, w: 0 });
      });
      measure();
    }

    function measure() { state.forEach(function (s) { s.w = s.row.scrollWidth / 2; }); }

    addEventListener('scroll', function () {
      var y = scrollY;
      /* lastY is updated even while the strip is parked, otherwise the
         first frame after it scrolls back into view is handed the whole
         page's worth of delta and the logos teleport. */
      var dy = y - last; last = y;
      if (raf !== null) vel += dy * 0.30;
    }, { passive: true });
    addEventListener('resize', measure, { passive: true });

    function tick() {
      vel *= 0.92;
      state.forEach(function (s) {
        if (!s.w) return;
        s.x += (0.35 + Math.abs(vel)) * s.dir + (vel * s.dir * 0.6);
        if (s.x <= -s.w) s.x += s.w;
        if (s.x >= 0) s.x -= s.w;
        s.row.style.transform = 'translate3d(' + s.x.toFixed(2) + 'px,0,0)';
      });
      raf = requestAnimationFrame(tick);
    }

    /* document.hidden matters here: a background tab runs no animation
       frames, so starting while hidden would store a raf id that never
       fires and every later start() would then see raf !== null and
       bail, freezing the strip for the life of the page. */
    function start() {
      if (raf !== null || reduced() || !onScreen || document.hidden) return;
      build();
      raf = requestAnimationFrame(tick);
    }
    function stop() {
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    }

    /* A strip two screens below the fold was running a frame callback
       for the whole visit, writing transforms nobody could see.

       Watch each row's PARENT, not the row. The row is the element this
       loop translates, and a row sitting at -w has its own box shifted
       a full period off to the left; asking whether that box overlaps
       the viewport is asking about the animation rather than about the
       section. The track never moves. */
    if (window.IntersectionObserver) {
      var hosts = [];
      rows.forEach(function (row) {
        var host = row.parentElement || row;
        if (hosts.indexOf(host) === -1) hosts.push(host);
      });
      var seen = [];
      var vis = new IntersectionObserver(function (es) {
        /* A callback carries only the targets that CHANGED, so the
           answer has to be kept per host rather than recomputed from
           whatever arrived this time. */
        es.forEach(function (e) {
          var i = hosts.indexOf(e.target);
          if (i !== -1) seen[i] = e.isIntersecting;
        });
        onScreen = seen.some(Boolean);
        onScreen ? start() : stop();
      }, { rootMargin: '150px 0px' });
      hosts.forEach(function (host) { vis.observe(host); });
    }
    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : start();
    });
    onMotionChange(function () { reduced() ? stop() : start(); });

    start();
  }
})();
