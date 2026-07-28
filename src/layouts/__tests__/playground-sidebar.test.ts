import { createApp, h, nextTick } from 'vue';
import { createMemoryHistory, createRouter, RouterLink, type Router } from 'vue-router';
import { afterEach, describe, expect, it } from 'vitest';
import { SidebarProvider } from '@/ui/sidebar';
import PlaygroundSidebar from '../playground-sidebar.vue';

describe('playground-sidebar', () => {
  const mounted: Array<{ app: ReturnType<typeof createApp>; host: Element }> = [];

  async function mountWithRouter(
    groups: { name: string; links: { to: string; label: string; badge?: string }[] }[],
    initialPath = '/composables/use-auto-save',
  ) {
    const router: Router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        {
          path: '/composables/use-auto-save',
          component: { template: '<div />' },
        },
        {
          path: '/composables/use-form-draft',
          component: { template: '<div />' },
        },
      ],
    });
    await router.push(initialPath);
    await router.isReady();

    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({
      render: () =>
        h(SidebarProvider, null, {
          default: () => h(PlaygroundSidebar, { groups }),
        }),
    });
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

  it('renders group labels and links', async () => {
    const host = await mountWithRouter([
      {
        name: 'Form',
        links: [
          { to: '/composables/use-auto-save', label: 'use-auto-save' },
          { to: '/composables/use-form-draft', label: 'use-form-draft' },
        ],
      },
    ]);

    expect(host.textContent).toContain('Form');
    expect(host.textContent).toContain('use-auto-save');
    expect(host.textContent).toContain('use-form-draft');
  });

  it('marks the current route link active', async () => {
    const host = await mountWithRouter(
      [
        {
          name: 'Form',
          links: [
            { to: '/composables/use-auto-save', label: 'use-auto-save' },
            { to: '/composables/use-form-draft', label: 'use-form-draft' },
          ],
        },
      ],
      '/composables/use-auto-save',
    );

    const active = host.querySelector('[data-active="true"]');
    expect(active?.textContent).toContain('use-auto-save');
  });

  it('renders beta badges when provided', async () => {
    const host = await mountWithRouter([
      {
        name: 'ERP 场景',
        links: [
          { to: '/composables/use-auto-save', label: '销售订单联动', badge: 'beta' },
          { to: '/composables/use-form-draft', label: 'API Overview' },
        ],
      },
    ]);

    expect(host.textContent).toContain('beta');
    expect(host.textContent).toContain('销售订单联动');
    expect(host.textContent).toContain('API Overview');
  });
});
