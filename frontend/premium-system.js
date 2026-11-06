/* BorrowBuddy premium motion system. GSAP is optional; CSS remains the fallback. */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canAnimate = !reduceMotion;

  function revealElements() {
    const elements = document.querySelectorAll('.scroll-reveal, .reveal, .reveal-scale, .reveal-group > *');
    if (!elements.length) return;
    if (!canAnimate) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries, instance) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          instance.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    elements.forEach((element) => observer.observe(element));
  }

  function magneticButtons() {
    if (!canAnimate || window.innerWidth < 768) return;
    document.querySelectorAll('.magnetic-button').forEach((button) => {
      button.addEventListener('pointermove', (event) => {
        const rect = button.getBoundingClientRect();
        const x = (event.clientX - rect.left - rect.width / 2) * 0.12;
        const y = (event.clientY - rect.top - rect.height / 2) * 0.12;
        button.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
      button.addEventListener('pointerleave', () => { button.style.transform = ''; });
    });
  }

  function perspectiveCards() {
    if (!canAnimate || window.innerWidth < 768) return;
    document.querySelectorAll('.perspective-card, .tilt-3d').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const max = Number(card.dataset.tiltMax || 5);
        const rotateY = ((event.clientX - rect.left) / rect.width - 0.5) * max;
        const rotateX = ((event.clientY - rect.top) / rect.height - 0.5) * -max;
        card.style.setProperty('--rotate-x', `${rotateX}deg`);
        card.style.setProperty('--rotate-y', `${rotateY}deg`);
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rotate-x', '0deg');
        card.style.setProperty('--rotate-y', '0deg');
      });
    });
  }

  function gsapScrollEnhancement() {
    if (!canAnimate || !window.gsap || !window.ScrollTrigger) return;
    window.gsap.registerPlugin(window.ScrollTrigger);
    window.gsap.utils.toArray('[data-parallax]').forEach((element) => {
      window.gsap.to(element, {
        yPercent: Number(element.dataset.parallax || -10),
        ease: 'none',
        scrollTrigger: { trigger: element, scrub: true }
      });
    });
  }

  function cinematicPointerField() {
    const field = document.querySelector('.hero-premium-wrap');
    if (!field || !canAnimate || window.innerWidth < 768) return;
    field.addEventListener('pointermove', (event) => {
      const bounds = field.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      field.style.setProperty('--pointer-x', `${x * 18}px`);
      field.style.setProperty('--pointer-y', `${y * 14}px`);
      field.querySelectorAll('.liquid-blob').forEach((blob, index) => {
        blob.style.marginLeft = `${x * (index + 1) * 6}px`;
        blob.style.marginTop = `${y * (index + 1) * 5}px`;
      });
    });
    field.addEventListener('pointerleave', () => {
      field.style.setProperty('--pointer-x', '0px');
      field.style.setProperty('--pointer-y', '0px');
    });
  }

  window.BorrowBuddyMotion = {
    AnimatedPageTransition: (element) => element?.classList.add('is-visible'),
    ScrollReveal: revealElements,
    ParallaxSection: gsapScrollEnhancement,
    CinematicHero: () => document.querySelector('.hero-premium-wrap'),
    PerspectiveCard: perspectiveCards,
    MagneticButton: magneticButtons,
    FloatingObject: () => document.querySelectorAll('.floating-object'),
    AnimatedCounter: (element, end) => {
      if (!element || !canAnimate) return;
      const start = performance.now();
      const duration = 900;
      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        element.textContent = Math.round(progress * end).toLocaleString('en-IN');
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    GlassPanel: (element) => element?.classList.add('glass-panel'),
    SectionTransition: (element) => element?.classList.add('section-transition')
  };

  function init() {
    revealElements();
    magneticButtons();
    perspectiveCards();
    gsapScrollEnhancement();
    cinematicPointerField();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
