import { computed, onBeforeUnmount, onMounted, reactive, type Ref } from 'vue';

/** Height of the sticky site header, in px. */
export const SITE_HEADER_HEIGHT = 56;

const bands = reactive(new Set<HTMLElement>());

/** True while a dark marketing band sits behind the sticky site header. */
export const inkBandActive = computed(() => bands.size > 0);

export function markInkBand(el: HTMLElement, behindHeader: boolean) {
  if (behindHeader) bands.add(el);
  else bands.delete(el);
}

/**
 * Reports whether `target` — a section painted on the dark canvas — currently runs
 * underneath the header, so the header can stay on ink instead of flipping to the
 * light shell mid-band.
 */
export function useInkBand(target: Ref<HTMLElement | null>) {
  let frame = 0;

  function measure() {
    const el = target.value;
    if (!el) return;

    const { top, bottom } = el.getBoundingClientRect();
    markInkBand(el, top <= SITE_HEADER_HEIGHT && bottom > SITE_HEADER_HEIGHT);
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      measure();
    });
  }

  onMounted(() => {
    if (typeof window === 'undefined') return;
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
  });

  onBeforeUnmount(() => {
    if (typeof window === 'undefined') return;
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    if (target.value) markInkBand(target.value, false);
  });
}
