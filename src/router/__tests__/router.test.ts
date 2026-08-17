import { describe, expect, it } from 'vitest';
import { router } from '..';
import SiteHome from '@/views/home/site-home.vue';
import SiteLayout from '@/layouts/site-layout.vue';
import PlaygroundLayout from '@/layouts/playground-layout.vue';

describe('router', () => {
  it('renders the site home inside the site shell at the root path', () => {
    const resolved = router.resolve('/');

    expect(resolved.name).toBe('home');
    expect(resolved.matched.map((record) => record.components?.default)).toEqual([
      SiteLayout,
      SiteHome,
    ]);
  });

  it('keeps playground demos inside the playground shell', () => {
    const resolved = router.resolve('/plus-table/basic-editing');

    expect(resolved.name).toBe('plus-table-basic-editing');
    expect(resolved.matched[0]?.components?.default).toBe(PlaygroundLayout);
  });

  it('exposes sidebar grouping metadata for every playground demo', () => {
    const grouped = router.getRoutes().filter((route) => route.meta.group);

    expect(grouped.length).toBeGreaterThan(0);
    for (const route of grouped) {
      expect(typeof route.meta.title).toBe('string');
      expect(typeof route.meta.order).toBe('number');
    }
  });
});
