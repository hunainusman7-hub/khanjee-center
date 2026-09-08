/* Khan Jee v2 — progressive enhancement only.
   Touch devices have no hover, so the first tap on a card reveals the
   second image and the second tap follows the link. Pointer devices are
   handled entirely in CSS and this file does nothing for them. */
(function () {
  'use strict';
  if (!window.matchMedia || window.matchMedia('(hover: hover)').matches) return;

  var cards = document.querySelectorAll('[data-pcard]');
  if (!cards.length) return;

  cards.forEach(function (card) {
    var alt = card.querySelector('.pcard__img--alt');
    if (!alt) return;                       // single-image product: leave the link alone
    var link = card.querySelector('.pcard__link');
    if (!link) return;

    link.addEventListener('click', function (e) {
      if (card.classList.contains('is-touched')) return;   // second tap → navigate
      e.preventDefault();
      cards.forEach(function (c) { c.classList.remove('is-touched'); });
      card.classList.add('is-touched');
    });
  });

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-pcard]')) return;
    cards.forEach(function (c) { c.classList.remove('is-touched'); });
  });
})();
