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
    const testTable = createTestTable<Row>({ data, columns, ...options });
    tables.push(testTable);
    return testTable;
  }

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    for (const testTable of tables.splice(0)) testTable.dispose();
  });

  it('normalizes stable unique ids and keeps special columns outside data indexes', () => {
    const { table } = setup([
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

    expect(table.originColumns.value.map((node) => node.id)).toEqual(['#', 'Group', '操作']);
    expect(table.columns.value.map((node) => node.id)).toEqual(['a-primary', 'a-secondary']);
    expect(table.allColumns.value.map((node) => node.id)).toEqual(['a-primary', 'a-secondary']);
    expect(table.settingItems.value.map((item) => item.id)).toEqual([
      'Group',
      'a-primary',
      'a-secondary',
    ]);
    expect(table.getColumnIndex('#')).toBe(-1);
  });

  it('toggles grouped leaves while retaining the complete column registry', () => {
    const { table } = setup([
      {
        label: 'Group',
        children: [
          { prop: 'a', label: 'A' },
          { prop: 'b', label: 'B' },
        ],
      },
      { prop: 'c', label: 'C' },
    ]);

    table.toggleColumnVisible('Group', false);

    expect(table.columns.value.map((node) => node.id)).toEqual(['c']);
    expect(table.allColumns.value.map((node) => node.id)).toEqual(['a', 'b', 'c']);
    expect(table.settingItems.value.find((item) => item.id === 'Group')).toEqual(
      expect.objectContaining({ checked: false, indeterminate: false }),
    );

    table.toggleColumnVisible('a', true);
    expect(table.columns.value.map((node) => node.id)).toEqual(['a', 'c']);
    expect(table.settingItems.value.find((item) => item.id === 'Group')).toEqual(
      expect.objectContaining({ checked: false, indeterminate: true }),
    );
  });

  it('reorders configurable siblings without moving special-column anchors', () => {
    const { table } = setup([
      { type: 'index', label: '#' },
      { prop: 'a', label: 'A' },
      { prop: 'b', label: 'B' },
      { type: 'operation', label: '操作' },
    ]);

    table.updateColumnOrder('b', 'a', 'before');

    expect(table.originColumns.value.map((node) => node.id)).toEqual(['#', 'b', 'a', '操作']);
    expect(table.columns.value.map((node) => node.id)).toEqual(['b', 'a']);
  });

  it.each(['before', 'after'] as const)(
    'ignores a reorder when the target does not exist (%s)',
    (position) => {
      const { table } = setup([
        { prop: 'a', label: 'A' },
        { prop: 'b', label: 'B' },
        { prop: 'c', label: 'C' },
      ]);

      table.updateColumnOrder('c', 'missing', position);

      expect(table.originColumns.value.map((node) => node.id)).toEqual(['a', 'b', 'c']);
      expect(table.columns.value.map((node) => node.id)).toEqual(['a', 'b', 'c']);
      expect(table.orderMap.value).toEqual({});
    },
  );

  it('matches Element Plus top-level fixed ordering', () => {
    const { table } = setup([
      { prop: 'a', label: 'A' },
      { prop: 'b', label: 'B', fixed: 'right' },
      { prop: 'c', label: 'C', fixed: 'left' },
    ]);

    expect(table.originColumns.value.map((node) => node.id)).toEqual(['c', 'a', 'b']);
    expect(table.columns.value.map((node) => node.id)).toEqual(['c', 'a', 'b']);
    expect(table.getColumnIndex('a')).toBe(1);
  });

  it('treats fixed=true as a left-fixed column', () => {
    const { table } = setup([
      { prop: 'a', label: 'A' },
      { prop: 'b', label: 'B', fixed: true },
      { prop: 'c', label: 'C', fixed: 'right' },
    ]);

    expect(table.columns.value.map((node) => node.id)).toEqual(['b', 'a', 'c']);
  });

  it('allocates collision-free ids including reserved parent ids', () => {
    const { table } = setup([
      { label: 'A' },
      { label: 'A' },
      { label: 'A#1' },
      { label: '__root' },
    ]);
    const ids = table.columnTree.value.map((node) => node.id);

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
    const testTable = setup([
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
    testTable.table.setCurrentCell(0, 1, false);
    expect(testTable.table.startEdit(0, 1)).toBe(true);
    testTable.table.setColumnWidth('a-secondary', 160);

    testTable.props.columns = [
      {
        prop: 'a',
        label: 'Secondary',
        columnKey: 'a-secondary',
        editable: true,
      },
    ];
    await nextTick();

    expect(testTable.table.getCurrentRef()).toEqual({
      rowKey: '1',
      colId: 'a-secondary',
    });
    expect(testTable.table.editingCell.value).toEqual({
      rowIndex: 0,
      colIndex: 0,
    });
    expect(testTable.table.widthMap.value).toEqual({
      'a-secondary': 160,
    });
  });

  it('keeps special leaves out of visibility defaults and group state', () => {
    const { table } = setup([
      {
        label: 'Group',
        visible: false,
        children: [
          { type: 'index', label: '#' },
          { prop: 'a', label: 'A' },
        ],
      },
    ]);

    expect([...table.hiddenIds.value]).toEqual(['a']);
    expect(table.settingItems.value.find((item) => item.id === 'Group')).toEqual(
      expect.objectContaining({ checked: false, indeterminate: false }),
    );
    expect(table.originColumns.value).toHaveLength(1);
    expect(table.columns.value).toEqual([]);
  });

  it('applies initial visibility and reset defaults', () => {
    const { table } = setup([
      { prop: 'a', label: 'A', visible: false },
      { prop: 'b', label: 'B' },
    ]);

    expect(table.columns.value.map((node) => node.id)).toEqual(['b']);
    table.toggleColumnVisible('a', true);
    expect(table.columns.value.map((node) => node.id)).toEqual(['a', 'b']);
    table.resetSettings();
    expect(table.columns.value.map((node) => node.id)).toEqual(['b']);
  });

  it('persists visibility, order, and rounded widths', async () => {
    const first = setup(
      [
        { prop: 'a', label: 'A' },
        { prop: 'b', label: 'B' },
      ],
      { cache: true, id: 'columns-test' },
    );
    first.table.toggleColumnVisible('b', false);
    first.table.updateColumnOrder('b', 'a', 'before');
    first.table.setColumnWidth('a', 120.6);
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
    expect(second.table.columns.value.map((node) => node.id)).toEqual(['a']);
    expect(second.table.widthMap.value).toEqual({ a: 121 });
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

    const { table } = setup(
      [
        { type: 'index', label: '#' },
        { prop: 'a', label: 'A' },
      ],
      { cache: true, id: 'stale-cache' },
    );

    expect(table.hiddenIds.value).toEqual(new Set(['a']));
    expect(table.orderMap.value).toEqual({ __root: ['a'] });
    expect(table.widthMap.value).toEqual({ a: 100 });
  });

  it('reconciles overlays when the reactive column schema changes', async () => {
    const testTable = setup([{ prop: 'a', label: 'A' }]);
    testTable.table.setColumnWidth('a', 120);

    testTable.props.columns = [
      { prop: 'b', label: 'B', visible: false },
      { prop: 'c', label: 'C' },
    ];
    await nextTick();

    expect(testTable.table.columns.value.map((node) => node.id)).toEqual(['c']);
    expect(testTable.table.hiddenIds.value).toEqual(new Set(['b']));
    expect(testTable.table.widthMap.value).toEqual({});
  });

  it('clears removed-column drafts but preserves a still-visible duplicate view', async () => {
    const testTable = setup([
      { prop: 'a', label: 'Primary', columnKey: 'a-primary' },
      { prop: 'a', label: 'Secondary', columnKey: 'a-secondary' },
      { prop: 'b', label: 'B' },
    ]);
    testTable.table.setDraft('1', 'a', 'draft');

    testTable.table.toggleColumnVisible('a-primary', false);
    expect(testTable.table.getDraft('1', 'a').has).toBe(true);

    testTable.table.toggleColumnVisible('a-secondary', false);
    expect(testTable.table.getDraft('1', 'a').has).toBe(false);

    testTable.table.setDraft('1', 'b', 'draft');
    testTable.props.columns = [{ prop: 'a', label: 'A' }];
    await nextTick();
    expect(testTable.table.getDraft('1', 'b').has).toBe(false);
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
    const testTable = setup([
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
    const row = testTable.table.data.value[0]!;

    const validating = testTable.table.validateCell(row, 0, 'a');
    await started;
    testTable.props.columns = [{ prop: 'b', label: 'B' }];
    await nextTick();
    release();

    await expect(validating).resolves.toBeNull();
    expect(testTable.table.getErrors()).toEqual([]);
  });

  it('invalidates errors when validation rules mutate in place', async () => {
    const testTable = setup([{ prop: 'a', label: 'A', required: true }]);
    const row = testTable.table.data.value[0]!;
    await testTable.table.validateCell(row, 0, 'a');
    expect(testTable.table.getErrors()).toHaveLength(1);

    testTable.props.columns[0]!.required = false;
    await nextTick();

    expect(testTable.table.getErrors()).toEqual([]);
  });

  it('writes each setting change through immediately and stays quiet while loading', () => {
    const key = 'plus-table:settings:explicit-persist';
    const { table } = setup(
      [
        { prop: 'a', label: 'A' },
        { prop: 'b', label: 'B' },
      ],
      { cache: true, id: 'explicit-persist' },
    );
    // 加载阶段只读不写，没改过设置就不该凭空产生缓存条目
    expect(localStorage.getItem(key)).toBeNull();

    table.toggleColumnVisible('b', false);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({
      hidden: ['b'],
      order: {},
      widths: {},
    });

    table.setColumnWidth('a', 120);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({
      hidden: ['b'],
      order: {},
      widths: { a: 120 },
    });
  });

  it('removes the persisted entry when settings are reset', async () => {
    const { table } = setup([{ prop: 'a', label: 'A' }], {
      cache: true,
      id: 'reset-test',
    });
    table.setColumnWidth('a', 120);
    expect(localStorage.getItem('plus-table:settings:reset-test')).not.toBeNull();

    table.resetSettings();

    expect(localStorage.getItem('plus-table:settings:reset-test')).toBeNull();
    await nextTick();
    expect(localStorage.getItem('plus-table:settings:reset-test')).toBeNull();
  });

  it('prunes the persisted payload when the column schema changes', async () => {
    const key = 'plus-table:settings:schema-prune';
    const testTable = setup(
      [
        { prop: 'a', label: 'A' },
        { prop: 'b', label: 'B' },
      ],
      { cache: true, id: 'schema-prune' },
    );
    testTable.table.toggleColumnVisible('b', false);
    testTable.table.setColumnWidth('a', 100);

    testTable.props.columns = [{ prop: 'b', label: 'B' }];
    await nextTick();

    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({
      hidden: ['b'],
      order: {},
      widths: {},
    });
  });

  it('persists a legitimate setting changed in the same tick as reset', async () => {
    const { table } = setup([{ prop: 'a', label: 'A' }], {
      cache: true,
      id: 'reset-follow-up-test',
    });

    table.resetSettings();
    table.setColumnWidth('a', 140);
    await nextTick();

    expect(JSON.parse(localStorage.getItem('plus-table:settings:reset-follow-up-test')!)).toEqual({
      hidden: [],
      order: {},
      widths: { a: 140 },
    });
  });

  it('validates hidden data columns', async () => {
    const { table } = setup([
      { prop: 'a', label: 'A', required: true, visible: false },
      { prop: 'b', label: 'B' },
    ]);

    expect(await table.validateRow(0)).toEqual([
      expect.objectContaining({ prop: 'a', rowKey: '1' }),
    ]);
    expect(table.getColumnIndex('a')).toBe(-1);
  });

  it('validates duplicate views of one prop as a single field', async () => {
    const { table } = setup([
      {
        prop: 'a',
        label: 'Required view',
        required: true,
        columnKey: 'a-required',
      },
      { prop: 'a', label: 'Secondary view', columnKey: 'a-secondary' },
    ]);

    expect(await table.validateRow(0)).toEqual([
      expect.objectContaining({ prop: 'a', rowKey: '1' }),
    ]);
  });

  it('rejects invalid width updates without changing the column view', () => {
    const { table } = setup([{ prop: 'a', label: 'A' }]);

    expect(() => table.setColumnWidth('missing', 100)).toThrow(/未知列/);
    expect(() => table.setColumnWidth('a', 0)).toThrow(/有限正数/);
    expect(table.columns.value.map((node) => node.id)).toEqual(['a']);
  });

  it('persists an explicit auto override that outranks the configured width', () => {
    const key = 'plus-table:settings:auto-width';
    const { table } = setup([{ prop: 'a', label: 'A', width: 140 }], {
      cache: true,
      id: 'auto-width',
    });

    table.setColumnWidth('a', null);

    // 缺 key = 回落列配置；key 存在但为 null = 强制自动，两者必须可区分
    expect(table.widthMap.value).toEqual({ a: null });
    expect('a' in table.widthMap.value).toBe(true);
    expect(JSON.parse(localStorage.getItem(key)!).widths).toEqual({ a: null });

    table.clearColumnWidth('a');
    expect(table.widthMap.value).toEqual({});
  });

  it('reloads an explicit auto override from the cache', () => {
    localStorage.setItem(
      'plus-table:settings:auto-width-reload',
      JSON.stringify({ hidden: [], order: {}, widths: { a: null } }),
    );

    const { table } = setup([{ prop: 'a', label: 'A', width: 140 }], {
      cache: true,
      id: 'auto-width-reload',
    });

    expect(table.widthMap.value).toEqual({ a: null });
  });

  it('drops the width override so the column falls back to auto width', () => {
    const key = 'plus-table:settings:clear-width';
    const { table } = setup(
      [
        { prop: 'a', label: 'A' },
        { prop: 'b', label: 'B', width: 90 },
      ],
      { cache: true, id: 'clear-width' },
    );
    table.setColumnWidth('a', 160);
    table.setColumnWidth('b', 200);

    table.clearColumnWidth('a');

    expect(table.widthMap.value).toEqual({ b: 200 });
    expect(JSON.parse(localStorage.getItem(key)!).widths).toEqual({ b: 200 });

    // 列配置里的 width 不受覆盖层影响，清除后仍是列自己的宽度
    table.clearColumnWidth('b');
    expect(table.widthMap.value).toEqual({});
    expect(table.getColumnById('b')?.column.width).toBe(90);
  });

  it('rejects clearing an unknown column and no-ops without an override', () => {
    const { table } = setup([{ prop: 'a', label: 'A' }]);

    expect(() => table.clearColumnWidth('missing')).toThrow(/未知列/);
    expect(() => table.clearColumnWidth('a')).not.toThrow();
    expect(table.widthMap.value).toEqual({});
  });
});
