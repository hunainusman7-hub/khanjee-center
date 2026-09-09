/* ============================================================
   Khan Jee — cart
   Add to cart, quantity, remove, and the drawer.

   Every mutation goes through Shopify's cart AJAX API and asks the
   Section Rendering API to re-render the drawer (and the cart page,
   when we are on it) in the same round trip. So the server does all
   the money formatting and all the discount arithmetic, and this file
   never computes a price. That is the whole design: there is no local
   copy of the cart to drift out of date.

   Progressive enhancement: with JS off, every form here still posts to
   /cart/add and /cart/change the normal way and the browser follows the
   redirect. Nothing below is required to buy.
   ============================================================ */
(function () {
  'use strict';

  var DRAWER_SECTION = 'kj-cart-drawer';
  var CART_SECTION = 'main-cart';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /* ---------- which sections to ask for ----------
     Only ask for the cart page section when a cart page is actually on
     screen, otherwise Shopify renders it for nothing on every add. */
  function wantedSections() {
    var s = [DRAWER_SECTION];
    if ($('[data-kj-cart-page]')) s.push(CART_SECTION);
    return s.join(',');
  }

  function announce(msg) {
    var live = $('[data-kj-cart-live]');
    if (live) live.textContent = msg;
  }

  /* ---------- swap in freshly rendered markup ---------- */
  function applySections(sections) {
    if (!sections) return;

    if (sections[DRAWER_SECTION]) {
      var old = $('[data-kj-drawer]');
      var wasOpen = old && old.getAttribute('data-open') === 'true';
      var host = document.createElement('div');
      host.innerHTML = sections[DRAWER_SECTION];
      var fresh = host.querySelector('[data-kj-drawer]');
      if (fresh && old) {
        old.parentNode.replaceChild(fresh, old);
        // The section re-renders closed; if it was open, keep it open.
        if (wasOpen) setOpen(true, { silent: true });
      }
    }

    if (sections[CART_SECTION]) {
      var page = $('[data-kj-cart-page]');
      if (page) {
        var h2 = document.createElement('div');
        h2.innerHTML = sections[CART_SECTION];
        var freshPage = h2.querySelector('[data-kj-cart-page]');
        if (freshPage) page.parentNode.replaceChild(freshPage, page);
      }
    }
  }

  function setCount(n) {
    $$('[data-cart-count]').forEach(function (el) {
      el.textContent = n;
      // Some headers hide a zero badge; keep that behaviour honest.
      if (el.hasAttribute('data-cart-count-hide-empty')) el.hidden = n === 0;
    });
    var label = $('[data-cart-link]');
    if (label) {
      label.setAttribute('aria-label', n === 1 ? 'Bag, 1 item' : 'Bag, ' + n + ' items');
    }
  }

  /* ---------- drawer open / close, with focus handled ---------- */
  var lastFocus = null;

  function panel() { return $('[data-kj-drawer-panel]'); }

  function closeOtherPanels() {
    [['[data-nav]', '[data-nav-toggle]'],
     ['[data-filters]', '[data-filter-toggle]']].forEach(function (pair) {
      var pane = $(pair[0]);
      var toggle = $(pair[1]);
      if (pane && pane.getAttribute('data-open') === 'true') {
        pane.setAttribute('data-open', 'false');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      }
    });
    // site.js locks the body for the filters panel; the drawer manages
    // its own lock, so clear the inline one rather than fight it.
    document.body.style.overflow = '';
  }

  function setOpen(open, opts) {
    var d = $('[data-kj-drawer]');
    if (!d) return;
    opts = opts || {};

    if (open) {
      if (!opts.silent) lastFocus = document.activeElement;

      /* One modal at a time. The mobile nav and the filters panel are
         both driven by site.js and both take over the screen; if a tap
         on Add to bag opened the bag on top of an already-open nav, a
         visitor would have two stacked panels and no idea which the
         back gesture closes. Close them first. */
      closeOtherPanels();

      d.setAttribute('data-open', 'true');
      d.setAttribute('aria-hidden', 'false');
      document.documentElement.classList.add('kj-noscroll');
      var p = panel();
      if (p && !opts.silent) {
        var first = p.querySelector('[data-kj-drawer-close]:not([tabindex="-1"])');
        (first || p).focus({ preventScroll: true });
      }
    } else {
      d.setAttribute('data-open', 'false');
      d.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('kj-noscroll');
      if (lastFocus && document.contains(lastFocus)) {
        lastFocus.focus({ preventScroll: true });
      }
      lastFocus = null;
    }
  }

  /* Keep Tab inside the panel while the dialog is open — without this
     the focus ring walks off into the page behind the scrim. */
  document.addEventListener('keydown', function (e) {
    var d = $('[data-kj-drawer]');
    if (!d || d.getAttribute('data-open') !== 'true') return;

    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key !== 'Tab') return;

    var p = panel();
    if (!p) return;
    var f = $$('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])', p)
      .filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
    if (!f.length) return;

    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- delegated clicks ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;

    if (t.closest('[data-kj-drawer-close]')) { setOpen(false); return; }
    if (t.closest('[data-kj-drawer-open]')) { e.preventDefault(); setOpen(true); return; }

    var up = t.closest('[data-kj-qty-up]');
    var down = t.closest('[data-kj-qty-down]');
    if (up || down) {
      var wrap = (up || down).closest('[data-kj-qty]');
      var input = $('[data-kj-qty-input]', wrap);
      var next = Math.max(0, (parseInt(input.value, 10) || 0) + (up ? 1 : -1));
      changeLine(lineOf(up || down), next);
      return;
    }

    var rm = t.closest('[data-kj-remove]');
    if (rm) { changeLine(lineOf(rm), 0); return; }
  });

  document.addEventListener('change', function (e) {
    var input = e.target.closest('[data-kj-qty-input]');
    if (!input) return;
    var v = parseInt(input.value, 10);
    changeLine(lineOf(input), isNaN(v) || v < 0 ? 1 : v);
  });

  function lineOf(el) {
    var li = el.closest('[data-kj-line]');
    return li ? li.getAttribute('data-kj-line') : null;
  }

  function busy(on) {
    var d = $('[data-kj-drawer]');
    if (d) d.setAttribute('data-busy', on ? 'true' : 'false');
    var p = $('[data-kj-cart-page]');
    if (p) p.setAttribute('data-busy', on ? 'true' : 'false');
  }

  /* ---------- add ---------- */
  document.addEventListener('submit', function (e) {
    var form = e.target.closest('form[data-kj-atc]');
    if (!form) return;
    e.preventDefault();

    var btn = form.querySelector('[type="submit"]');
    var err = form.querySelector('[data-kj-atc-error]');
    var body = new FormData(form);
    body.append('sections', wantedSections());
    body.append('sections_url', window.location.pathname);

    if (btn) { btn.setAttribute('data-loading', 'true'); btn.disabled = true; }
    if (err) { err.textContent = ''; err.hidden = true; }
    busy(true);

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: body
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (!res.ok) {
          // Shopify puts the human-readable reason in `description`
          // (e.g. only N left in stock). Show it where it happened
          // rather than opening an empty drawer.
          var msg = res.body.description || res.body.message || 'That could not be added.';
          if (err) { err.textContent = msg; err.hidden = false; }
          announce(msg);
          return;
        }
        applySections(res.body.sections);
        return fetch('/cart.js', { headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json(); })
          .then(function (cart) {
            setCount(cart.item_count);
            announce((res.body.product_title || 'Item') + ' added. Bag has ' + cart.item_count + '.');
            setOpen(true);
          });
      })
      .catch(function () {
        var msg = 'Could not reach the shop. Check your connection and try again.';
        if (err) { err.textContent = msg; err.hidden = false; }
        announce(msg);
      })
      .finally(function () {
        if (btn) { btn.removeAttribute('data-loading'); btn.disabled = false; }
        busy(false);
      });
  });

  /* ---------- change / remove ---------- */
  function changeLine(line, quantity) {
    if (!line) return;
    busy(true);

    fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        line: parseInt(line, 10),
        quantity: quantity,
        sections: wantedSections(),
        sections_url: window.location.pathname
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        applySections(cart.sections);
        setCount(cart.item_count);
        announce(quantity === 0
          ? 'Removed. Bag has ' + cart.item_count + '.'
          : 'Bag updated. ' + cart.item_count + ' in the bag.');
      })
      .catch(function () { announce('Could not update the bag. Please try again.'); })
      .finally(function () { busy(false); });
  }

  /* ---------- boot ----------
     Trust the server-rendered count that is already in the markup; only
     correct it if the page came out of a cache with a stale cart. */
  fetch('/cart.js', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.json(); })
    .then(function (cart) { setCount(cart.item_count); })
    .catch(function () { /* leave the rendered count alone */ });
})();
