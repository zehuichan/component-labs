import { createApp, h, nextTick } from 'vue';
import { createMemoryHistory, createRouter, RouterLink, type Router } from 'vue-router';
import { afterEach, describe, expect, it } from 'vitest';
import SiteHeader from '../site-header.vue';
import { markInkBand } from '../site-ink-band';

describe('site-header', () => {
  const mounted: Array<{ app: ReturnType<typeof createApp>; host: Element }> = [];

  async function mountHeader(initialPath = '/') {
    const router: Router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    });
    await router.push(initialPath);
    await router.isReady();

    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({ render: () => h(SiteHeader) });
    app.use(router);
    app.component('RouterLink', RouterLink);
    app.mount(host);
    await nextTick();
    mounted.push({ app, host });
    return host;
  }

  afterEach(() => {
    for (const { app, host } of mounted.splice(0)) {
      app.unmount();
      host.remove();
    }
  });

  it('renders the brand lockup pointing at the site home', async () => {
    const host = await mountHeader();
    const brand = host.querySelector('a[href="/"]') as HTMLAnchorElement | null;

    expect(brand).toBeTruthy();
    expect(brand!.textContent).toContain('Workbench');
  });

  it('keeps only the GitHub entry beside the brand', async () => {
    const host = await mountHeader();
    const links = [...host.querySelectorAll('a')].map((node) => node.getAttribute('href'));

    expect(links).toEqual(['/', 'https://github.com/zehuichan/workbench']);
  });

  it('switches to the ink treatment while a dark band runs behind it', async () => {
    const host = await mountHeader();
    expect(host.querySelector('header')?.className).not.toContain('dark');

    const band = document.createElement('div');
    markInkBand(band, true);
    await nextTick();
    expect(host.querySelector('header')?.className).toContain('dark');

    markInkBand(band, false);
    await nextTick();
    expect(host.querySelector('header')?.className).not.toContain('dark');
  });

  it('renders a GitHub repository link', async () => {
    const host = await mountHeader();
    const github = host.querySelector(
      'a[href="https://github.com/zehuichan/workbench"]',
    ) as HTMLAnchorElement | null;

    expect(github).toBeTruthy();
    expect(github!.rel).toContain('noopener');
  });
});
