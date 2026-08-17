import { createApp, h, nextTick } from 'vue';
import { createMemoryHistory, createRouter, RouterLink, type Router } from 'vue-router';
import { afterEach, describe, expect, it } from 'vitest';
import SiteHome from '../site-home.vue';
import { columnsSnippet, linkageSnippet, persistSnippet } from '../home-snippets';

describe('site-home', () => {
  const mounted: Array<{ app: ReturnType<typeof createApp>; host: Element }> = [];

  async function mountHome() {
    const router: Router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/plus-table/api-overview', component: { template: '<div />' } },
        { path: '/plus-table/basic-editing', component: { template: '<div />' } },
        { path: '/erp/sales-order-linkage', component: { template: '<div />' } },
        { path: '/composables/use-form-draft', component: { template: '<div />' } },
      ],
    });
    await router.push('/');
    await router.isReady();

    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({ render: () => h(SiteHome) });
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

  it('renders the hero headline and primary call to action', async () => {
    const host = await mountHome();

    expect(host.querySelector('h1')?.textContent).toContain('明细自动跟上');
    expect(host.querySelector('a[href="/plus-table/basic-editing"]')).toBeTruthy();
  });

  it('renders one story block per capability', async () => {
    const host = await mountHome();
    const headings = [...host.querySelectorAll('h2, h3')].map((node) => node.textContent ?? '');

    expect(headings.some((text) => text.includes('三种编辑粒度'))).toBe(true);
    expect(headings.some((text) => text.includes('规则写在一处'))).toBe(true);
    expect(headings.some((text) => text.includes('草稿、自动保存'))).toBe(true);
    expect(headings.some((text) => text.includes('从一张表格开始'))).toBe(true);
  });

  it('offers copyable commands for running the playground locally', async () => {
    const host = await mountHome();
    const commands = [...host.querySelectorAll('code')].map((node) => node.textContent ?? '');

    expect(commands.some((text) => text.includes('pnpm dev'))).toBe(true);
    expect(commands.some((text) => text.includes('git clone'))).toBe(true);
  });

  it('renders a labelled source snippet for every story', async () => {
    const host = await mountHome();
    const labels = [...host.querySelectorAll('figcaption')].map((node) => node.textContent ?? '');
    const source = host.textContent ?? '';

    for (const snippet of [columnsSnippet, linkageSnippet, persistSnippet]) {
      expect(labels.some((text) => text.includes(snippet.label))).toBe(true);
      expect(source).toContain(snippet.code.split('\n')[0]);
    }
  });

  it('deep links into the playground demos', async () => {
    const host = await mountHome();

    for (const href of [
      '/plus-table/api-overview',
      '/erp/sales-order-linkage',
      '/composables/use-form-draft',
    ]) {
      expect(host.querySelector(`a[href="${href}"]`)).toBeTruthy();
    }
  });
});
