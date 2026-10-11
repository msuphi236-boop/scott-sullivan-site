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
