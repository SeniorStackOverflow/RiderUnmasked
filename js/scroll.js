/**
 * scroll.js — Scroll-driven behaviors
 *   • Reveal elements when they enter the viewport
 *   • Highlight the active nav link based on scroll position
 */

// ── Reveal on scroll ─────────────────────────────
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  },
  { threshold: 0.08 }
);

document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

// ── Active nav link ──────────────────────────────
const sections = Array.from(document.querySelectorAll('section[id]'));
const navLinks  = Array.from(document.querySelectorAll('.nav__link[href^="#"]'));

function updateActiveNav() {
  const scrollY = window.scrollY + 90;
  let current = '';

  sections.forEach((section) => {
    if (scrollY >= section.offsetTop) {
      current = section.id;
    }
  });

  navLinks.forEach((link) => {
    link.classList.toggle('is-active', link.getAttribute('href') === '#' + current);
  });
}

window.addEventListener('scroll', updateActiveNav, { passive: true });
