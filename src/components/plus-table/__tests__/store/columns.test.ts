import { nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestTable, type TestTable } from '../helpers/create-test-table';

interface Row {
  id: number;
  a: string;
  b: string;
  c: string;
}

const data: Row[] = [{ id: 1, a: '', b: 'b', c: 'c' }];

describe('PlusTable columns', () => {
  const tables: TestTable<Row>[] = [];

  function setup(
    columns: Record<string, unknown>[],
    options: { cache?: boolean; id?: string } = {},
  ) {
    const table = createTestTable<Row>({ data, columns, ...options });
    tables.push(table);
    return table;
  }

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    for (const table of tables.splice(0)) table.dispose();
  });

  it('normalizes stable unique ids and keeps special columns outside data indexes', () => {
    const { store } = setup([
      { type: 'index', label: '#' },
      {
        label: 'Group',
        children: [
          { prop: 'a', label: 'A', columnKey: 'a-primary' },
          { prop: 'a', label: 'A again', columnKey: 'a-secondary' },
        ],
      },
      { type: 'operation', label: '操作' },
    ]);

    expect(store.states.originColumns.value.map((node) => node.id)).toEqual(['#', 'Group', '操作']);
    expect(store.states.columns.value.map((node) => node.id)).toEqual(['a-primary', 'a-secondary']);
    expect(store.states.allColumns.value.map((node) => node.id)).toEqual([
      'a-primary',
      'a-secondary',
    ]);
    expect(store.settingItems.value.map((item) => item.id)).toEqual([
      'Group',
      'a-primary',
      'a-secondary',
    ]);
    expect(store.getColumnIndex('#')).toBe(-1);
  });

  it('toggles grouped leaves while retaining the complete column registry', () => {
    const { store } = setup([
      {
        label: 'Group',
        children: [
          { prop: 'a', label: 'A' },
          { prop: 'b', label: 'B' },
        ],
      },
      { prop: 'c', label: 'C' },
    ]);

    store.toggleColumnVisible('Group', false);

    expect(store.states.columns.value.map((node) => node.id)).toEqual(['c']);
    expect(store.states.allColumns.value.map((node) => node.id)).toEqual(['a', 'b', 'c']);
    expect(store.settingItems.value.find((item) => item.id === 'Group')).toEqual(
      expect.objectContaining({ checked: false, indeterminate: false }),
    );

    store.toggleColumnVisible('a', true);
    expect(store.states.columns.value.map((node) => node.id)).toEqual(['a', 'c']);
    expect(store.settingItems.value.find((item) => item.id === 'Group')).toEqual(
      expect.objectContaining({ checked: false, indeterminate: true }),
    );
  });

  it('reorders configurable siblings without moving special-column anchors', () => {
    const { store } = setup([
      { type: 'index', label: '#' },
      { prop: 'a', label: 'A' },
      { prop: 'b', label: 'B' },
      { type: 'operation', label: '操作' },
    ]);

    store.updateColumnOrder('b', 'a', 'before');

    expect(store.states.originColumns.value.map((node) => node.id)).toEqual([
      '#',
      'b',
      'a',
      '操作',
    ]);
    expect(store.states.columns.value.map((node) => node.id)).toEqual(['b', 'a']);
  });

  it.each(['before', 'after'] as const)(
    'ignores a reorder when the target does not exist (%s)',
    (position) => {
      const { store } = setup([
        { prop: 'a', label: 'A' },
        { prop: 'b', label: 'B' },
        { prop: 'c', label: 'C' },
      ]);

      store.updateColumnOrder('c', 'missing', position);

      expect(store.states.originColumns.value.map((node) => node.id)).toEqual(['a', 'b', 'c']);
      expect(store.states.columns.value.map((node) => node.id)).toEqual(['a', 'b', 'c']);
      expect(store.states.orderMap.value).toEqual({});
    },
  );

  it('matches Element Plus top-level fixed ordering', () => {
    const { store } = setup([
      { prop: 'a', label: 'A' },
      { prop: 'b', label: 'B', fixed: 'right' },
      { prop: 'c', label: 'C', fixed: 'left' },
    ]);

    expect(store.states.originColumns.value.map((node) => node.id)).toEqual(['c', 'a', 'b']);
    expect(store.states.columns.value.map((node) => node.id)).toEqual(['c', 'a', 'b']);
    expect(store.getColumnIndex('a')).toBe(1);
  });

  it('treats fixed=true as a left-fixed column', () => {
    const { store } = setup([
      { prop: 'a', label: 'A' },
      { prop: 'b', label: 'B', fixed: true },
      { prop: 'c', label: 'C', fixed: 'right' },
    ]);

    expect(store.states.columns.value.map((node) => node.id)).toEqual(['b', 'a', 'c']);
  });

  it('allocates collision-free ids including reserved parent ids', () => {
    const { store } = setup([
      { label: 'A' },
      { label: 'A' },
      { label: 'A#1' },
      { label: '__root' },
    ]);
    const ids = store.states._columns.value.map((node) => node.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain('__root');
  });

  it('requires explicit columnKey identities for duplicate-prop views', () => {
    expect(() =>
      setup([
        { prop: 'a', label: 'Primary' },
        { prop: 'a', label: 'Secondary' },
      ]),
    ).toThrow(/duplicate prop="a".*columnKey/);
  });

  it('keeps an explicitly keyed duplicate view stable when its sibling is removed', async () => {
    const table = setup([
      {
        prop: 'a',
        label: 'Primary',
        columnKey: 'a-primary',
        editable: true,
      },
      {
        prop: 'a',
        label: 'Secondary',
        columnKey: 'a-secondary',
        editable: true,
      },
    ]);
    table.store.setCurrentCell(0, 1, false);
    expect(table.store.startEdit(0, 1)).toBe(true);
    table.store.setColumnWidth('a-secondary', 160);

    table.props.columns = [
      {
        prop: 'a',
        label: 'Secondary',
        columnKey: 'a-secondary',
        editable: true,
      },
    ];
    await nextTick();

    expect(table.store.getCurrentRef()).toEqual({
      rowKey: '1',
      colId: 'a-secondary',
    });
    expect(table.store.states.editingCell.value).toEqual({
      rowIndex: 0,
      colIndex: 0,
    });
    expect(table.store.states.widthMap.value).toEqual({
      'a-secondary': 160,
    });
  });

  it('keeps special leaves out of visibility defaults and group state', () => {
    const { store } = setup([
      {
        label: 'Group',
        visible: false,
        children: [
          { type: 'index', label: '#' },
          { prop: 'a', label: 'A' },
        ],
      },
    ]);

    expect([...store.states.hiddenIds.value]).toEqual(['a']);
    expect(store.settingItems.value.find((item) => item.id === 'Group')).toEqual(
      expect.objectContaining({ checked: false, indeterminate: false }),
    );
    expect(store.states.originColumns.value).toHaveLength(1);
    expect(store.states.columns.value).toEqual([]);
  });

  it('applies initial visibility and reset defaults', () => {
    const { store } = setup([
      { prop: 'a', label: 'A', visible: false },
      { prop: 'b', label: 'B' },
    ]);

    expect(store.states.columns.value.map((node) => node.id)).toEqual(['b']);
    store.toggleColumnVisible('a', true);
    expect(store.states.columns.value.map((node) => node.id)).toEqual(['a', 'b']);
    store.resetSettings();
    expect(store.states.columns.value.map((node) => node.id)).toEqual(['b']);
  });

  it('persists visibility, order, and rounded widths', async () => {
    const first = setup(
      [
        { prop: 'a', label: 'A' },
        { prop: 'b', label: 'B' },
      ],
      { cache: true, id: 'columns-test' },
    );
    first.store.toggleColumnVisible('b', false);
    first.store.updateColumnOrder('b', 'a', 'before');
    first.store.setColumnWidth('a', 120.6);
    await nextTick();

    expect(JSON.parse(localStorage.getItem('plus-table:settings:columns-test')!)).toEqual({
      hidden: ['b'],
      order: { __root: ['b', 'a'] },
      widths: { a: 121 },
    });

    first.dispose();
    const second = setup(
      [
        { prop: 'a', label: 'A' },
        { prop: 'b', label: 'B' },
      ],
      { cache: true, id: 'columns-test' },
    );
    expect(second.store.states.columns.value.map((node) => node.id)).toEqual(['a']);
    expect(second.store.states.widthMap.value).toEqual({ a: 121 });
  });

  it('sanitizes stale persisted overlays when loading a cache', () => {
    localStorage.setItem(
      'plus-table:settings:stale-cache',
      JSON.stringify({
        hidden: ['#', 'a', 'missing'],
        order: { __root: ['missing', 'a'], missing: ['a'] },
        widths: { a: 100, missing: 200 },
      }),
    );

    const { store } = setup(
      [
        { type: 'index', label: '#' },
        { prop: 'a', label: 'A' },
      ],
      { cache: true, id: 'stale-cache' },
    );

    expect(store.states.hiddenIds.value).toEqual(new Set(['a']));
    expect(store.states.orderMap.value).toEqual({ __root: ['a'] });
    expect(store.states.widthMap.value).toEqual({ a: 100 });
  });

  it('reconciles overlays when the reactive column schema changes', async () => {
    const table = setup([{ prop: 'a', label: 'A' }]);
    table.store.setColumnWidth('a', 120);

    table.props.columns = [
      { prop: 'b', label: 'B', visible: false },
      { prop: 'c', label: 'C' },
    ];
    await nextTick();

    expect(table.store.states.columns.value.map((node) => node.id)).toEqual(['c']);
    expect(table.store.states.hiddenIds.value).toEqual(new Set(['b']));
    expect(table.store.states.widthMap.value).toEqual({});
  });

  it('clears removed-column drafts but preserves a still-visible duplicate view', async () => {
    const table = setup([
      { prop: 'a', label: 'Primary', columnKey: 'a-primary' },
      { prop: 'a', label: 'Secondary', columnKey: 'a-secondary' },
      { prop: 'b', label: 'B' },
    ]);
    table.store.setDraft('1', 'a', 'draft');

    table.store.toggleColumnVisible('a-primary', false);
    expect(table.store.getDraft('1', 'a').has).toBe(true);

    table.store.toggleColumnVisible('a-secondary', false);
    expect(table.store.getDraft('1', 'a').has).toBe(false);

    table.store.setDraft('1', 'b', 'draft');
    table.props.columns = [{ prop: 'a', label: 'A' }];
    await nextTick();
    expect(table.store.getDraft('1', 'b').has).toBe(false);
  });

  it('invalidates removed-column errors and in-flight validation', async () => {
    let release!: () => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const table = setup([
      {
        prop: 'a',
        label: 'A',
        rules: [
          {
            asyncValidator: async () => {
              markStarted();
              await gate;
              throw new Error('stale');
            },
          },
        ],
      },
      { prop: 'b', label: 'B' },
    ]);
    const row = table.store.states.data.value[0]!;

    const validating = table.store.validateCell(row, 0, 'a');
    await started;
    table.props.columns = [{ prop: 'b', label: 'B' }];
    await nextTick();
    release();

    await expect(validating).resolves.toBeNull();
    expect(table.store.getErrors()).toEqual([]);
  });

  it('invalidates errors when validation rules mutate in place', async () => {
    const table = setup([{ prop: 'a', label: 'A', required: true }]);
    const row = table.store.states.data.value[0]!;
    await table.store.validateCell(row, 0, 'a');
    expect(table.store.getErrors()).toHaveLength(1);

    table.props.columns[0]!.required = false;
    await nextTick();

    expect(table.store.getErrors()).toEqual([]);
  });

  it('writes each setting change through immediately and stays quiet while loading', () => {
    const key = 'plus-table:settings:explicit-persist';
    const { store } = setup(
      [
        { prop: 'a', label: 'A' },
        { prop: 'b', label: 'B' },
      ],
      { cache: true, id: 'explicit-persist' },
    );
    // 加载阶段只读不写，没改过设置就不该凭空产生缓存条目
    expect(localStorage.getItem(key)).toBeNull();

    store.toggleColumnVisible('b', false);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({
      hidden: ['b'],
      order: {},
      widths: {},
    });

    store.setColumnWidth('a', 120);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({
      hidden: ['b'],
      order: {},
      widths: { a: 120 },
    });
  });

  it('removes the persisted entry when settings are reset', async () => {
    const { store } = setup([{ prop: 'a', label: 'A' }], {
      cache: true,
      id: 'reset-test',
    });
    store.setColumnWidth('a', 120);
    expect(localStorage.getItem('plus-table:settings:reset-test')).not.toBeNull();

    store.resetSettings();

    expect(localStorage.getItem('plus-table:settings:reset-test')).toBeNull();
    await nextTick();
    expect(localStorage.getItem('plus-table:settings:reset-test')).toBeNull();
  });

  it('prunes the persisted payload when the column schema changes', async () => {
    const key = 'plus-table:settings:schema-prune';
    const table = setup(
      [
        { prop: 'a', label: 'A' },
        { prop: 'b', label: 'B' },
      ],
      { cache: true, id: 'schema-prune' },
    );
    table.store.toggleColumnVisible('b', false);
    table.store.setColumnWidth('a', 100);

    table.props.columns = [{ prop: 'b', label: 'B' }];
    await nextTick();

    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({
      hidden: ['b'],
      order: {},
      widths: {},
    });
  });

  it('persists a legitimate setting changed in the same tick as reset', async () => {
    const { store } = setup([{ prop: 'a', label: 'A' }], {
      cache: true,
      id: 'reset-follow-up-test',
    });

    store.resetSettings();
    store.setColumnWidth('a', 140);
    await nextTick();

    expect(JSON.parse(localStorage.getItem('plus-table:settings:reset-follow-up-test')!)).toEqual({
      hidden: [],
      order: {},
      widths: { a: 140 },
    });
  });

  it('validates hidden data columns', async () => {
    const { store } = setup([
      { prop: 'a', label: 'A', required: true, visible: false },
      { prop: 'b', label: 'B' },
    ]);

    expect(await store.validateRow(0)).toEqual([
      expect.objectContaining({ prop: 'a', rowKey: '1' }),
    ]);
    expect(store.getColumnIndex('a')).toBe(-1);
  });

  it('validates duplicate views of one prop as a single field', async () => {
    const { store } = setup([
      {
        prop: 'a',
        label: 'Required view',
        required: true,
        columnKey: 'a-required',
      },
      { prop: 'a', label: 'Secondary view', columnKey: 'a-secondary' },
    ]);

    expect(await store.validateRow(0)).toEqual([
      expect.objectContaining({ prop: 'a', rowKey: '1' }),
    ]);
  });

  it('rejects invalid width updates without changing the column view', () => {
    const { store } = setup([{ prop: 'a', label: 'A' }]);

    expect(() => store.setColumnWidth('missing', 100)).toThrow(/未知列/);
    expect(() => store.setColumnWidth('a', 0)).toThrow(/有限正数/);
    expect(store.states.columns.value.map((node) => node.id)).toEqual(['a']);
  });

  it('persists an explicit auto override that outranks the configured width', () => {
    const key = 'plus-table:settings:auto-width';
    const { store } = setup([{ prop: 'a', label: 'A', width: 140 }], {
      cache: true,
      id: 'auto-width',
    });

    store.setColumnWidth('a', null);

    // 缺 key = 回落列配置；key 存在但为 null = 强制自动，两者必须可区分
    expect(store.states.widthMap.value).toEqual({ a: null });
    expect('a' in store.states.widthMap.value).toBe(true);
    expect(JSON.parse(localStorage.getItem(key)!).widths).toEqual({ a: null });

    store.clearColumnWidth('a');
    expect(store.states.widthMap.value).toEqual({});
  });

  it('reloads an explicit auto override from the cache', () => {
    localStorage.setItem(
      'plus-table:settings:auto-width-reload',
      JSON.stringify({ hidden: [], order: {}, widths: { a: null } }),
    );

    const { store } = setup([{ prop: 'a', label: 'A', width: 140 }], {
      cache: true,
      id: 'auto-width-reload',
    });

    expect(store.states.widthMap.value).toEqual({ a: null });
  });

  it('drops the width override so the column falls back to auto width', () => {
    const key = 'plus-table:settings:clear-width';
    const { store } = setup(
      [
        { prop: 'a', label: 'A' },
        { prop: 'b', label: 'B', width: 90 },
      ],
      { cache: true, id: 'clear-width' },
    );
    store.setColumnWidth('a', 160);
    store.setColumnWidth('b', 200);

    store.clearColumnWidth('a');

    expect(store.states.widthMap.value).toEqual({ b: 200 });
    expect(JSON.parse(localStorage.getItem(key)!).widths).toEqual({ b: 200 });

    // 列配置里的 width 不受覆盖层影响，清除后仍是列自己的宽度
    store.clearColumnWidth('b');
    expect(store.states.widthMap.value).toEqual({});
    expect(store.getColumnById('b')?.column.width).toBe(90);
  });

  it('rejects clearing an unknown column and no-ops without an override', () => {
    const { store } = setup([{ prop: 'a', label: 'A' }]);

    expect(() => store.clearColumnWidth('missing')).toThrow(/未知列/);
    expect(() => store.clearColumnWidth('a')).not.toThrow();
    expect(store.states.widthMap.value).toEqual({});
  });
});
