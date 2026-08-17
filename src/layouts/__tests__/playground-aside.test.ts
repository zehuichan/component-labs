import { createApp, h, nextTick } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import PlaygroundAside from '../playground-aside.vue';
import { playgroundAds, SPONSOR_INQUIRY_URL, type PlaygroundSponsor } from '../sponsors';

describe('playground-aside', () => {
  const mounted: Array<{ app: ReturnType<typeof createApp>; host: Element }> = [];

  async function mountAside(
    props: {
      ads?: typeof playgroundAds;
      sponsors?: readonly PlaygroundSponsor[];
    } = {},
  ) {
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({
      render: () => h(PlaygroundAside, props),
    });
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

  it('renders ad and sponsor section labels', async () => {
    const host = await mountAside();
    expect(host.textContent).toContain('广告');
    expect(host.textContent).toContain('赞助商');
    expect(host.textContent).toContain('成为赞助商');
  });

  it('renders configured ads as external sponsored links', async () => {
    const host = await mountAside();
    const ad = playgroundAds[0];
    expect(ad).toBeDefined();
    const link = host.querySelector(`a[href="${ad!.href}"]`);
    expect(link).not.toBeNull();
    expect(link!.getAttribute('rel')).toContain('sponsored');
    expect(link!.textContent).toContain(ad!.title);
  });

  it('links become-sponsor CTA to inquiry URL', async () => {
    const host = await mountAside();
    const cta = [...host.querySelectorAll('a')].find((el) =>
      el.textContent?.includes('成为赞助商'),
    );
    expect(cta).toBeDefined();
    expect(cta!.getAttribute('href')).toBe(SPONSOR_INQUIRY_URL);
  });

  it('renders sponsor entries when provided', async () => {
    const host = await mountAside({
      sponsors: [
        {
          id: 'acme',
          name: 'Acme',
          href: 'https://example.com/acme',
          slogan: 'Build faster',
        },
      ],
    });

    expect(host.textContent).toContain('Acme');
    expect(host.textContent).toContain('Build faster');
    expect(host.textContent).toContain('AC');
    const link = host.querySelector('a[href="https://example.com/acme"]');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('rel')).toContain('sponsored');
  });

  it('hides the ads section when ads are empty', async () => {
    const host = await mountAside({ ads: [] });
    expect(host.textContent).not.toContain('广告');
    expect(host.textContent).toContain('赞助商');
  });
});
