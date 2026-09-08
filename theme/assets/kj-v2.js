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

  /* ---------------- brand marquee: duplicate each row once so the loop is seamless ---------------- */
  document.querySelectorAll('[data-bmq-row]').forEach(function (row) {
    row.innerHTML += row.innerHTML;
  });

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
})();
