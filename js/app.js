/**
 * app.js — UI interactions
 *   • Vulnerability filter buttons
 *   • Animated stat counters
 */

// ── Vulnerability filter ─────────────────────────
function initFilter() {
  const buttons = document.querySelectorAll('.filter-btn[data-filter]');
  const cards   = document.querySelectorAll('.vuln-card[data-severity]');

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.filter;

      buttons.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      cards.forEach((card) => {
        const show = target === 'all' || card.dataset.severity === target;
        card.hidden = !show;
      });
    });
  });
}

// ── Animated stat counters ───────────────────────
function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  if (isNaN(target)) return;

  let current  = 0;
  const step   = target / 15;

  const tick = () => {
    current = Math.min(current + step, target);
    el.textContent = Math.round(current);
    if (current < target) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

function initCounters() {
  const statsRow = document.querySelector('.stats-row');
  if (!statsRow) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.querySelectorAll('[data-target]').forEach(animateCounter);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.5 }
  );

  observer.observe(statsRow);
}

// ── Boot ─────────────────────────────────────────
initFilter();
initCounters();
