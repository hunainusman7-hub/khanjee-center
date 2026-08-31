/* Khan Jee Center — no dependencies.
   Three jobs: reveal on enter, drive the hero's scroll progress
   variable, and run the mobile menu. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- reveal --------------------------------------------------------
     The hidden start state is only opted into once this script runs, so
     a failed script can never leave the page invisible. */
  var items = document.querySelectorAll('[data-reveal]');
  function showAll() { items.forEach(function (el) { el.classList.add('is-in'); }); }
  if (!reduce && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('js-reveal');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (el) { io.observe(el); });
    setTimeout(showAll, 2500);   /* safety net for odd webviews */
  }

  /* --- mobile menu ---------------------------------------------------- */
  var burger = document.querySelector('[data-burger]');
  var nav = document.querySelector('[data-nav]');
  if (burger && nav) {
    var set = function (open) {
      nav.setAttribute('data-open', String(open));
      burger.setAttribute('aria-expanded', String(open));
    };
    set(false);
    burger.addEventListener('click', function () {
      set(burger.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') { set(false); burger.focus(); }
    });
    var mq = matchMedia('(min-width: 901px)');
    var reset = function () { if (mq.matches) set(false); };
    mq.addEventListener ? mq.addEventListener('change', reset) : mq.addListener(reset);
  }

  /* --- hero progress + header ----------------------------------------- */
  var hero = document.querySelector('[data-hero]');
  var header = document.querySelector('[data-header]');
  if (!hero) return;
  var ticking = false;
  function frame() {
    ticking = false;
    var h = hero.offsetHeight || 1;
    var p = Math.min(1, Math.max(0, scrollY / h));
    if (!reduce) hero.style.setProperty('--p', p.toFixed(4));
    /* Reveal the header earlier on phones — it is the only route to the
       menu, and the hero fills the whole viewport there. */
    var trigger = innerWidth < 900 ? .45 : .72;
    if (header) header.classList.toggle('is-on', scrollY > h * trigger);
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  frame();
})();
