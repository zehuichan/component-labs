import { nextTick, watch } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestTable, type TestTable } from './helpers/create-test-table';

interface Row {
  id: number;
  name: string;
  amount: number;
}

const columns = [
  {
    prop: 'name',
    label: '名称',
    editable: true,
    required: true,
  },
  {
    prop: 'amount',
    label: '金额',
    editable: true,
  },
];

describe('PlusTable cell identity and row lifecycle', () => {
  const tables: TestTable<Row>[] = [];

  function setup(options: { history?: boolean; dirtyTracking?: boolean } = {}) {
    const data: Row[] = [
      { id: 1, name: 'one', amount: 10 },
      { id: 2, name: 'two', amount: 20 },
    ];
    const testTable = createTestTable({
      data,
      columns,
      history: options.history,
      dirtyTracking: options.dirtyTracking,
    });
    tables.push(testTable);
    return { ...testTable, rows: testTable.table.data.value };
  }

  afterEach(() => {
    for (const testTable of tables.splice(0)) testTable.dispose();
  });

  it('keeps current and editing identity while deriving new positions after reorder', () => {
    const { table, rows } = setup();

    table.setCurrentCell(0, 1, false);
    expect(table.startEdit(0, 1)).toBe(true);
    const currentRef = table.getCurrentRef();

    table.setData([rows[1]!, rows[0]!]);

    expect(table.getCurrentRef()).toBe(currentRef);
    expect(table.getCurrentRef()).toEqual({ rowKey: '1', colId: 'amount' });
    expect(table.currentCell.value).toEqual({
      rowIndex: 1,
      colIndex: 1,
    });
    expect(table.editingCell.value).toEqual({
      rowIndex: 1,
      colIndex: 1,
    });
    expect(table.isEditingRef('1', 'amount')).toBe(true);
  });

  it('keeps public position refs writable', () => {
    const { table } = setup();

    table.currentCell.value = { rowIndex: 1, colIndex: 0 };
    table.editingCell.value = { rowIndex: 0, colIndex: 1 };

    expect(table.getCurrentRef()).toEqual({ rowKey: '2', colId: 'name' });
    expect(table.isEditingRef('1', 'amount')).toBe(true);

    table.currentCell.value = null;
    table.editingCell.value = null;
    expect(table.getCurrentRef()).toBeNull();
    expect(table.editingCell.value).toBeNull();
  });

  it('does not notify position watchers when identity and indexes are unchanged', async () => {
    const { table, rows } = setup();
    table.setCurrentCell(0, 0, false);
    const changes: unknown[] = [];
    watch(table.currentCell, (value) => changes.push(value));

    table.setData([...rows, { id: 3, name: 'three', amount: 30 }]);
    await nextTick();

    expect(changes).toEqual([]);
  });

  it('invalidates every row-keyed domain when an object is replaced at the same key', async () => {
    const { table, rows } = setup({ history: true, dirtyTracking: true });
    table.setCurrentCell(0, 0, false);
    expect(table.startEdit(0, 0)).toBe(true);
    table.setDraft('1', 'name', 'draft');
    table.setCellValue(rows[0]!, 0, 'name', '');
    await table.validateCell(rows[0]!, 0, 'name');

    expect(table.canUndo.value).toBe(true);
    expect(table.isRowDirty('1')).toBe(true);
    expect(table.getErrors()).toHaveLength(1);

    const replacement = { id: 1, name: 'replacement', amount: 100 };
    table.setData([replacement, rows[1]!]);

    expect(table.currentCell.value).toBeNull();
    expect(table.editingCell.value).toBeNull();
    expect(table.canUndo.value).toBe(false);
    expect(table.isRowDirty('1')).toBe(false);
    expect(table.getErrors()).toEqual([]);
    expect(table.getDraft('1', 'name').has).toBe(false);
  });

  it('cleans the committed identity when a parent mutates rowKey externally', async () => {
    const { table, rows } = setup({ history: true, dirtyTracking: true });
    table.setCurrentCell(0, 0, false);
    expect(table.startEdit(0, 0)).toBe(true);
    table.setCellValue(rows[0]!, 0, 'name', 'changed');

    rows[0]!.id = 3;
    await nextTick();

    expect(table.currentCell.value).toBeNull();
    expect(table.editingCell.value).toBeNull();
    expect(table.canUndo.value).toBe(false);
    expect(table.isRowDirty('1')).toBe(false);
  });

  it('preserves keyed state and reindexes validation errors for a pure reorder', async () => {
    const { table, rows } = setup({ history: true, dirtyTracking: true });
    table.setCellValue(rows[0]!, 0, 'name', '');
    await table.validateCell(rows[0]!, 0, 'name');

    table.setData([rows[1]!, rows[0]!]);

    expect(table.canUndo.value).toBe(true);
    expect(table.isRowDirty('1')).toBe(true);
    expect(table.getErrors()).toEqual([
      expect.objectContaining({ rowKey: '1', rowIndex: 1, prop: 'name' }),
    ]);
  });

  it('routes row removals through the same cleanup contract', async () => {
    const { table } = setup({ history: true, dirtyTracking: true });
    table.setCurrentCell(0, 0, false);
    expect(table.startEdit(0, 0)).toBe(true);

    expect(table.removeRow(0)!.id).toBe(1);
    await nextTick();

    expect(table.data.value.map((row) => row.id)).toEqual([2]);
    expect(table.currentCell.value).toBeNull();
    expect(table.editingCell.value).toBeNull();
  });

  it('rejects duplicate row identities before mutating state', () => {
    const { table, rows } = setup();

    expect(() => table.setData([rows[0]!, { ...rows[0]! }])).toThrow(/rowKey="1".*重复/);
    expect(table.data.value).toEqual(rows);
  });

  it('allows an async row commit to finish after the same row is reordered', async () => {
    let releaseValidation!: () => void;
    let markStarted!: () => void;
    const validationStarted = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const validationGate = new Promise<void>((resolve) => {
      releaseValidation = resolve;
    });
    const testTable = createTestTable<Row>({
      data: [
        { id: 1, name: 'one', amount: 10 },
        { id: 2, name: 'two', amount: 20 },
      ],
      columns: [
        {
          prop: 'name',
          editable: true,
          rules: [
            {
              asyncValidator: async () => {
                markStarted();
                await validationGate;
              },
            },
          ],
        },
      ],
      mode: 'row',
    });
    tables.push(testTable);
    const rows = testTable.table.data.value;
    expect(testTable.table.startRowEdit(0)).toBe(true);

    const committing = testTable.table.commitRowEdit(0);
    await validationStarted;
    testTable.table.setData([rows[1]!, rows[0]!]);
    releaseValidation();

    await expect(committing).resolves.toBe(true);
    expect(testTable.table.editingRowKey.value).toBeNull();
  });

  it('does not commit a row when its validation is superseded', async () => {
    let validationCount = 0;
    let releaseFirst!: () => void;
    let releaseSecond!: () => void;
    let markFirstStarted!: () => void;
    let markSecondStarted!: () => void;
    let markThirdStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    const secondStarted = new Promise<void>((resolve) => {
      markSecondStarted = resolve;
    });
    const thirdStarted = new Promise<void>((resolve) => {
      markThirdStarted = resolve;
    });
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const testTable = createTestTable<Row>({
      data: [{ id: 1, name: 'invalid', amount: 10 }],
      columns: [
        {
          prop: 'name',
          editable: true,
          rules: [
            {
              asyncValidator: async () => {
                validationCount += 1;
                if (validationCount === 1) {
                  markFirstStarted();
                  await firstGate;
                } else if (validationCount === 2) {
                  markSecondStarted();
                  await secondGate;
                } else {
                  markThirdStarted();
                }
                throw new Error('invalid');
              },
            },
          ],
        },
      ],
      mode: 'row',
    });
    tables.push(testTable);
    const row = testTable.table.data.value[0]!;
    expect(testTable.table.startRowEdit(0)).toBe(true);

    const committing = testTable.table.commitRowEdit(0);
    await firstStarted;
    const newerValidation = testTable.table.validateCell(row, 0, 'name');
    await secondStarted;
    releaseFirst();

    const firstOutcome = await Promise.race([
      committing.then((result) => ({ result, source: 'commit' as const })),
      thirdStarted.then(() => ({ source: 'revalidation' as const })),
    ]);
    expect(firstOutcome).toEqual({ source: 'revalidation' });

    releaseSecond();
    await expect(newerValidation).resolves.toBeNull();
    await expect(committing).resolves.toBe(false);
    expect(testTable.table.editingRowKey.value).toBe('1');
  });

  it('serializes concurrent stable validations of the same row', async () => {
    let validationCount = 0;
    let releaseFirst!: () => void;
    let releaseSecond!: () => void;
    let markFirstStarted!: () => void;
    let markSecondStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    const secondStarted = new Promise<void>((resolve) => {
      markSecondStarted = resolve;
    });
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const testTable = createTestTable<Row>({
      data: [{ id: 1, name: 'invalid', amount: 10 }],
      columns: [
        {
          prop: 'name',
          rules: [
            {
              asyncValidator: async () => {
                validationCount += 1;
                if (validationCount === 1) {
                  markFirstStarted();
                  await firstGate;
                } else {
                  markSecondStarted();
                  await secondGate;
                }
                throw new Error('invalid');
              },
            },
          ],
        },
      ],
    });
    tables.push(testTable);

    const first = testTable.table.validateRow(0);
    await firstStarted;
    const second = testTable.table.validateRow(0);
    await Promise.resolve();
    expect(validationCount).toBe(1);

    releaseFirst();
    await expect(first).resolves.toHaveLength(1);
    await secondStarted;
    expect(validationCount).toBe(2);
    releaseSecond();
    await expect(second).resolves.toHaveLength(1);
  });

  it('validates each snapshot row once when rows reorder during validation', async () => {
    let releaseFirst!: () => void;
    let markFirstStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const validated: number[] = [];
    const testTable = createTestTable<Row>({
      data: [
        { id: 1, name: 'one', amount: 10 },
        { id: 2, name: 'two', amount: 20 },
      ],
      columns: [
        {
          prop: 'name',
          rules: [
            {
              asyncValidator: async (
                _rule: unknown,
                _value: unknown,
                _callback: unknown,
                source: Row,
              ) => {
                validated.push(source.id);
                if (source.id === 1) {
                  markFirstStarted();
                  await firstGate;
                }
              },
            },
          ],
        },
      ],
    });
    tables.push(testTable);
    const rows = testTable.table.data.value;

    const validating = testTable.table.validate(false);
    await firstStarted;
    testTable.table.setData([rows[1]!, rows[0]!]);
    releaseFirst();

    await expect(validating).resolves.toEqual({ valid: true, errors: [] });
    expect(validated).toEqual([1, 2]);
  });

  it('returns only canonical errors that still exist when validation finishes', async () => {
    let releaseSecond!: () => void;
    let markSecondStarted!: () => void;
    const secondStarted = new Promise<void>((resolve) => {
      markSecondStarted = resolve;
    });
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const testTable = createTestTable<Row>({
      data: [
        { id: 1, name: '', amount: 10 },
        { id: 2, name: 'two', amount: 20 },
      ],
      columns: [
        {
          prop: 'name',
          required: true,
          rules: [
            {
              asyncValidator: async (
                _rule: unknown,
                _value: unknown,
                _callback: unknown,
                source: Row,
              ) => {
                if (source.id === 2) {
                  markSecondStarted();
                  await secondGate;
                }
              },
            },
          ],
        },
      ],
    });
    tables.push(testTable);
    const rows = testTable.table.data.value;

    const validating = testTable.table.validate(false);
    await secondStarted;
    testTable.table.setData([rows[1]!]);
    releaseSecond();

    await expect(validating).resolves.toEqual({ valid: true, errors: [] });
  });

  it('rejects edits that would mutate the configured row identity', () => {
    interface KeyedRow {
      key: string;
      name: string;
    }
    const testTable = createTestTable<KeyedRow>({
      data: [{ key: 'one', name: 'One' }],
      columns: [
        { prop: 'key', editable: true },
        { prop: 'name', editable: true },
      ],
      rowKey: 'key',
    });
    const row = testTable.table.data.value[0]!;

    expect(() => testTable.table.setCellValue(row, 0, 'key', 'next')).toThrow(/rowKey.*不可修改/);
    expect(row.key).toBe('one');
    testTable.dispose();
  });

  it('also protects identities derived by a rowKey function', () => {
    interface KeyedRow {
      tenant: string;
      code: string;
      name: string;
    }
    const testTable = createTestTable<KeyedRow>({
      data: [{ tenant: 'acme', code: 'one', name: 'One' }],
      columns: [
        { prop: 'code', editable: true },
        { prop: 'name', editable: true },
      ],
      rowKey: (row) => `${row.tenant}:${row.code}`,
    });
    const row = testTable.table.data.value[0]!;

    expect(() => testTable.table.setCellValue(row, 0, 'code', 'next')).toThrow(/rowKey.*不可修改/);
    expect(row.code).toBe('one');
    testTable.dispose();
  });

  it('protects row identities exposed through getters', () => {
    interface GetterRow {
      code: string;
      readonly id: string;
    }
    const testTable = createTestTable<GetterRow>({
      data: [
        {
          code: 'one',
          get id() {
            return this.code;
          },
        },
      ],
      columns: [{ prop: 'code', editable: true }],
      rowKey: 'id',
    });
    const row = testTable.table.data.value[0]!;

    expect(() => testTable.table.setCellValue(row, 0, 'code', 'next')).toThrow(/rowKey.*不可修改/);
    expect(row.code).toBe('one');
    testTable.dispose();
  });

  it('protects row identities changed by accessor setters', () => {
    interface AccessorRow {
      _code: string;
      code: string;
      readonly id: string;
    }
    const testTable = createTestTable<AccessorRow>({
      data: [
        {
          _code: 'one',
          get code() {
            return this._code;
          },
          set code(value: string) {
            this._code = value;
          },
          get id() {
            return this._code;
          },
        },
      ],
      columns: [{ prop: 'code', editable: true }],
      rowKey: 'id',
    });
    const row = testTable.table.data.value[0]!;

    expect(() => testTable.table.setCellValue(row, 0, 'code', 'next')).toThrow(/rowKey.*不可修改/);
    expect(row.code).toBe('one');
    testTable.dispose();
  });

  it('does not mutate shared nested state while checking accessor setters', () => {
    interface NestedAccessorRow {
      state: { code: string };
      code: string;
      readonly id: string;
    }
    const testTable = createTestTable<NestedAccessorRow>({
      data: [
        {
          state: { code: 'one' },
          get code() {
            return this.state.code;
          },
          set code(value: string) {
            this.state.code = value;
          },
          get id() {
            return this.state.code;
          },
        },
      ],
      columns: [{ prop: 'code', editable: true }],
      rowKey: 'id',
    });
    const row = testTable.table.data.value[0]!;

    expect(() => testTable.table.setCellValue(row, 0, 'code', 'next')).toThrow(/rowKey.*不可修改/);
    expect(row.state.code).toBe('one');
    testTable.dispose();
  });

  it('skips automatic validation for writable fields without a column', async () => {
    const { table, rows } = setup();

    await expect(table.validateCell(rows[0]!, 0, 'derivedField')).resolves.toBeNull();
  });
});
