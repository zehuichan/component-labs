import type { Directive } from 'vue';

const observers = new WeakMap<HTMLElement, IntersectionObserver>();

/**
 * Marks an element as entered so the `site-reveal` utility can transition it in.
 * Falls back to the visible state wherever IntersectionObserver is unavailable
 * (tests, older browsers) so content is never trapped at opacity 0.
 */
export const vReveal: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    const delay = binding.value ?? 0;
    if (delay) el.style.setProperty('--reveal-delay', `${delay}ms`);

    if (typeof IntersectionObserver === 'undefined') {
      el.dataset.reveal = 'in';
      return;
    }

    el.dataset.reveal = 'out';

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          el.dataset.reveal = 'in';
          observer.disconnect();
          observers.delete(el);
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
    );

    observer.observe(el);
    observers.set(el, observer);
  },
  unmounted(el) {
    observers.get(el)?.disconnect();
    observers.delete(el);
  },
};
