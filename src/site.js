// Keyboard and swipe navigation on an artwork page:
// ← / → previous and next work, Esc back to the index.
(function () {
  var prev = document.querySelector('a[rel="prev"]');
  var next = document.querySelector('a[rel="next"]');
  var index = document.querySelector('a[data-index]');
  if (!next) return;

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight') { location.href = next.href; }
    else if (e.key === 'ArrowLeft' && prev) { location.href = prev.href; }
    else if (e.key === 'Escape' && index) { location.href = index.href; }
  });

  var x0 = null, y0 = null;
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      location.href = (dx < 0 ? next : (prev || next)).href;
    }
  }, { passive: true });
})();

(function () {
  var root = document.querySelector('.slideshow');
  if (!root) return;
  var slides = Array.from(root.querySelectorAll('.slide')), current = 0;
  function move(step) {
    slides[current].hidden = true;
    current = (current + step + slides.length) % slides.length;
    slides[current].hidden = false;
    root.querySelector('.count').textContent = (current + 1) + ' / ' + slides.length;
  }
  root.querySelectorAll('[data-step]').forEach(function (b) {
    b.addEventListener('click', function () { move(Number(b.dataset.step)); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1);
    }
  });
  var x = null, y = null;
  root.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    x = e.touches[0].clientX; y = e.touches[0].clientY;
  }, {passive:true});
  root.addEventListener('touchend', function (e) {
    if (x === null) return;
    var dx = e.changedTouches[0].clientX - x, dy = e.changedTouches[0].clientY - y;
    x = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)*1.5) move(dx < 0 ? 1 : -1);
  }, {passive:true});
})();
