/* Khan Jee — L2 interactions. No dependencies, ~4KB.
   Everything here is progressive enhancement: with JS off the page
   stays fully readable and navigable. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- reveal on enter ---------- */
  var items = document.querySelectorAll('[data-reveal]');
  if (items.length && !reduce && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('js-reveal');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (el) { io.observe(el); });
    /* safety net: never leave the page blank if the observer stays silent */
    setTimeout(function () { items.forEach(function (el) { el.classList.add('is-in'); }); }, 2000);
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

  /* ---------- filter chips: visual toggle only until products exist ---------- */
  document.querySelectorAll('[data-facet] .chip').forEach(function (c) {
    c.addEventListener('click', function () {
      c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    });
  });

  /* ---------- hero scroll progress ---------- */
  var hero = document.querySelector('[data-hero]');
  if (hero && !reduce) {
    var ticking = false;
    var frame = function () {
      ticking = false;
      var h = hero.offsetHeight || 1;
      hero.style.setProperty('--p', Math.min(1, Math.max(0, scrollY / h)).toFixed(4));
    };
    addEventListener('scroll', function () {
      if (ticking) return; ticking = true; requestAnimationFrame(frame);
    }, { passive: true });
    frame();
  }

  /* ---------- brand strip: base drift + scroll velocity ---------- */
  var rows = document.querySelectorAll('[data-strip-row]');
  if (rows.length && !reduce) {
    var last = scrollY, vel = 0;
    addEventListener('scroll', function () {
      vel += (scrollY - last) * 0.30; last = scrollY;
    }, { passive: true });

    var state = [];
    rows.forEach(function (row, i) {
      /* duplicate the children once so the loop is seamless */
      row.innerHTML += row.innerHTML;
      state.push({ row: row, x: 0, dir: i % 2 === 0 ? -1 : 1, w: 0 });
    });
    var measure = function () { state.forEach(function (s) { s.w = s.row.scrollWidth / 2; }); };
    measure();
    addEventListener('resize', measure, { passive: true });

    (function tick() {
      vel *= 0.92;
      state.forEach(function (s) {
        if (!s.w) return;
        s.x += (0.35 + Math.abs(vel)) * s.dir + (vel * s.dir * 0.6);
        if (s.x <= -s.w) s.x += s.w;
        if (s.x >= 0) s.x -= s.w;
        s.row.style.transform = 'translate3d(' + s.x.toFixed(2) + 'px,0,0)';
      });
      requestAnimationFrame(tick);
    })();
  }
})();
