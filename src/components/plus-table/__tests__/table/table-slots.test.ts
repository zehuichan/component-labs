import { createApp, h, nextTick } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../table-column-settings/index.vue', () => ({
  default: { name: 'PlusTableColumnSettings', render: () => null },
}));

vi.mock('../../table-context-menu/index.vue', () => ({
  default: { name: 'PlusTableContextMenu', render: () => null },
}));

vi.mock('../../table-column', () => ({
  default: { name: 'PlusTableColumnNode', render: () => null },
}));

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>();
  const { defineComponent, h } = await import('vue');
  return {
    ...actual,
    ElTable: defineComponent({
      name: 'ElTable',
      setup(_, { slots }) {
        return () => h('div', { class: 'mock-el-table' }, slots.default?.());
      },
    }),
    ElPagination: defineComponent({
      name: 'ElPagination',
      setup() {
        return () => h('div', { class: 'mock-el-pagination' });
      },
    }),
    ElTableColumn: defineComponent({
      name: 'ElTableColumn',
      setup(_, { slots }) {
        return () =>
          h('div', { class: 'mock-el-table-column' }, [
            slots.header?.(),
            slots.default?.({ row: {}, $index: -1 }),
          ]);
      },
    }),
  };
});

import PlusTable from '../../table.vue';

describe('PlusTable title / summary slots', () => {
  const mounted: Array<{ app: ReturnType<typeof createApp>; host: Element }> = [];

  async function mount(
    slots: Record<string, () => unknown> = {},
    props: Record<string, unknown> = {},
  ) {
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({
      render: () =>
        h(
          PlusTable,
          {
            data: [],
            columns: [{ prop: 'name', label: '名称' }],
            rowKey: 'id',
            ...props,
          },
          slots,
        ),
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

  it('puts title and toolbar on one header row', async () => {
    const host = await mount({
      title: () => '任务列表',
      toolbar: () => h('button', '新增'),
    });

    const header = host.querySelector('.plus-table__header');
    expect(header).toBeTruthy();
    expect(header!.querySelector('.plus-table__title')?.textContent).toBe('任务列表');
    expect(header!.querySelector('.plus-table__toolbar')).toBeTruthy();
    expect(host.querySelector('.plus-table__title')?.parentElement).toBe(header);
  });

  it('shows summary with pagination on the same footer row', async () => {
    const host = await mount({ summary: () => '已选 3 项' }, { total: 20, page: 1, pageSize: 5 });

    const footer = host.querySelector('.plus-table__footer');
    expect(footer).toBeTruthy();
    expect(footer!.querySelector('.plus-table__summary')?.textContent).toBe('已选 3 项');
    expect(footer!.querySelector('.plus-table__pagination')).toBeTruthy();
    expect(footer!.querySelector('.mock-el-pagination')).toBeTruthy();
  });

  it('shows footer with summary only when total is omitted', async () => {
    const host = await mount({ summary: () => '合计 10' });

    const footer = host.querySelector('.plus-table__footer');
    expect(footer).toBeTruthy();
    expect(footer!.querySelector('.plus-table__summary')?.textContent).toBe('合计 10');
    expect(footer!.querySelector('.plus-table__pagination')).toBeNull();
  });

  it('hides title / summary wrappers when slots are absent', async () => {
    const host = await mount({}, { total: 10 });

    expect(host.querySelector('.plus-table__header')).toBeNull();
    expect(host.querySelector('.plus-table__title')).toBeNull();
    expect(host.querySelector('.plus-table__summary')).toBeNull();
    expect(host.querySelector('.plus-table__footer')).toBeTruthy();
    expect(host.querySelector('.plus-table__pagination')).toBeTruthy();
  });

  it('shows header when only toolbar is provided', async () => {
    const host = await mount({
      toolbar: () => h('button', '新增'),
    });

    const header = host.querySelector('.plus-table__header');
    expect(header).toBeTruthy();
    expect(header!.querySelector('.plus-table__title')).toBeNull();
    expect(header!.querySelector('.plus-table__toolbar')).toBeTruthy();
  });
});
