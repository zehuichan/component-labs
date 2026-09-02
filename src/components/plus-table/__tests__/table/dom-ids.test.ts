import { createApp, defineComponent, h, nextTick } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../table-column-settings/index.vue', () => ({
  default: { name: 'PlusTableColumnSettings', render: () => null },
}));

vi.mock('../../components/column', () => ({
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
  };
});

import PlusTable from '../../table.vue';
import { usePlusTable } from '../../tokens';

/** rowKey 由业务数据决定，可能带空格、中文、`-`、`_` 等 id 不友好的字符 */
const KEY_SAMPLES: Array<[rowKey: string, colId: string]> = [
  ['1', 'name'],
  ['a', 'b-c'],
  ['a-b', 'c'],
  ['a_b', 'c'],
  ['a', '_b_c'],
  ['订单 #1', 'amount'],
  ['订单 #1 ', 'amount'],
  ['a-b-c', 'd'],
  ['a', 'b-c-d'],
];

describe('PlusTable dom ids', () => {
  const mounted: Array<{ app: ReturnType<typeof createApp>; host: Element }> = [];

  async function mountIds() {
    const host = document.createElement('div');
    document.body.append(host);
    let ids!: ReturnType<typeof usePlusTable>['ids'];
    const Probe = defineComponent({
      name: 'IdsProbe',
      setup() {
        ids = usePlusTable().ids;
        return () => null;
      },
    });
    const app = createApp({
      render: () =>
        h(
          PlusTable,
          { data: [], columns: [{ prop: 'name', label: '名称' }], rowKey: 'id' },
          { toolbar: () => h(Probe) },
        ),
    });
    app.mount(host);
    await nextTick();
    mounted.push({ app, host });
    return { ids, host };
  }

  afterEach(() => {
    for (const { app, host } of mounted.splice(0)) {
      app.unmount();
      host.remove();
    }
  });

  it('keeps cell / error ids unique across separator-heavy keys', async () => {
    const { ids } = await mountIds();

    const generated = [
      ...KEY_SAMPLES.map(([rowKey, colId]) => ids.cell(rowKey, colId)),
      ...KEY_SAMPLES.map(([rowKey, colId]) => ids.error(rowKey, colId)),
      ids.description,
    ];

    expect(new Set(generated).size).toBe(generated.length);
  });

  it('stays queryable through the CSS.escape lookup path', async () => {
    const { ids, host } = await mountIds();

    for (const [rowKey, colId] of KEY_SAMPLES) {
      const el = document.createElement('div');
      el.id = ids.cell(rowKey, colId);
      host.append(el);
      expect(host.querySelector(`#${CSS.escape(el.id)}`)).toBe(el);
    }
  });
});
