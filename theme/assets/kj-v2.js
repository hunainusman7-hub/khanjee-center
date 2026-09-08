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

  /* ---------------- brand marquee: base drift + scroll velocity, clickable ----------------
     Each row is duplicated once so the loop is seamless, then moved with a
     transform every frame. Scrolling adds to the speed and flips direction on
     scroll-up; hovering eases the rows to a crawl so the links can be clicked.
     Reduced-motion users get static, hand-scrollable rows (see kj-v2.css). */
  (function () {
    var rows = Array.prototype.slice.call(document.querySelectorAll('[data-bmq-row]'));
    if (!rows.length || reduce) return;
    var wrap = rows[0].parentElement;
    var hover = false, lastY = window.scrollY, vel = 0, state = [];

    rows.forEach(function (row, i) {
      if (row.dataset.bmqReady) return;
      row.dataset.bmqReady = '1';
      var half = row.children.length;
      row.innerHTML += row.innerHTML;
      /* the clone exists only to make the loop seamless: hide it from AT and the tab order */
      Array.prototype.slice.call(row.children, half).forEach(function (el) {
        el.setAttribute('aria-hidden', 'true'); el.setAttribute('tabindex', '-1');
      });
      var dir = parseInt(row.dataset.bmqDir, 10) || (i % 2 ? 1 : -1);
      state.push({ row: row, x: 0, dir: dir, w: 0 });
    });
    function measure() {
      state.forEach(function (s) { s.w = s.row.scrollWidth / 2; if (s.dir > 0 && s.x === 0) s.x = -s.w; });
    }
    measure();
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('scroll', function () {
      vel += (window.scrollY - lastY) * 0.28; lastY = window.scrollY;
    }, { passive: true });
    wrap.addEventListener('mouseenter', function () { hover = true; });
    wrap.addEventListener('mouseleave', function () { hover = false; });
    wrap.addEventListener('focusin',  function () { hover = true; });
    wrap.addEventListener('focusout', function () { hover = false; });

    (function tick() {
      vel *= 0.90;                                  /* decay */
      if (Math.abs(vel) < 0.01) vel = 0;
      var base = hover ? 0.05 : 0.42;               /* px per frame at rest */
      state.forEach(function (s) {
        if (!s.w) return;
        s.x += base * s.dir + vel * s.dir * 0.9;    /* scroll down speeds both rows along their own direction */
        if (s.x <= -s.w) s.x += s.w;
        if (s.x > 0)     s.x -= s.w;
        s.row.style.transform = 'translate3d(' + s.x.toFixed(2) + 'px,0,0)';
      });
      if (!document.hidden) window.requestAnimationFrame(tick);
      else document.addEventListener('visibilitychange', function once() {
        document.removeEventListener('visibilitychange', once); window.requestAnimationFrame(tick);
      });
    })();
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
