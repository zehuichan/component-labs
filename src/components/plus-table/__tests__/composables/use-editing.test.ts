import { afterEach, describe, expect, it } from 'vitest';
import { createTestTable, type TestTable } from '../helpers/create-test-table';

interface Row {
  id: number;
  name: string;
  amount: number;
}

/** 可手动放行的异步校验闸门，用于把编辑动作插到 commitRowEdit 的 await 中间 */
function createGate() {
  let release!: () => void;
  let markEntered!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    markEntered = resolve;
  });
  return {
    release,
    entered,
    async wait() {
      markEntered();
      await released;
    },
  };
}

describe('PlusTable row editing session', () => {
  const tables: TestTable<Row>[] = [];

  function setup(options: { validator?: () => Promise<void> } = {}) {
    const testTable = createTestTable<Row>({
      data: [
        { id: 1, name: 'one', amount: 10 },
        { id: 2, name: 'two', amount: 20 },
      ],
      columns: [
        {
          prop: 'name',
          label: '名称',
          editable: true,
          rules: options.validator ? [{ asyncValidator: options.validator }] : undefined,
        },
        { prop: 'amount', label: '金额', editable: true },
      ],
      mode: 'row',
    });
    tables.push(testTable);
    return { ...testTable, rows: testTable.table.data.value };
  }

  afterEach(() => {
    for (const testTable of tables.splice(0)) testTable.dispose();
  });

  it('flushes its own drafts before sampling the session epoch', async () => {
    const { table, rows } = setup({ validator: async () => {} });
    expect(table.startRowEdit(0)).toBe(true);
    table.setDraft('1', 'name', 'edited');
    table.setDraft('1', 'amount', 99);

    await expect(table.commitRowEdit(0)).resolves.toBe(true);

    expect(rows[0]).toMatchObject({ name: 'edited', amount: 99 });
    expect(table.getDraft('1', 'name').has).toBe(false);
    expect(table.editingRowKey.value).toBeNull();
  });

  it('does not commit when a draft is written while validation is in flight', async () => {
    const gate = createGate();
    const { table, rows } = setup({ validator: () => gate.wait() });
    expect(table.startRowEdit(0)).toBe(true);
    table.setDraft('1', 'name', 'first');

    const committing = table.commitRowEdit(0);
    await gate.entered;
    table.setDraft('1', 'name', 'second');
    gate.release();

    await expect(committing).resolves.toBe(false);
    expect(table.editingRowKey.value).toBe('1');
    expect(table.getDraft('1', 'name').value).toBe('second');
    expect(rows[0]!.name).toBe('first');
  });

  it('does not commit when the row edit is cancelled while validation is in flight', async () => {
    const gate = createGate();
    const { table, rows } = setup({ validator: () => gate.wait() });
    expect(table.startRowEdit(0)).toBe(true);
    table.setDraft('1', 'name', 'edited');

    const committing = table.commitRowEdit(0);
    await gate.entered;
    table.cancelRowEdit(0);
    gate.release();

    await expect(committing).resolves.toBe(false);
    expect(table.editingRowKey.value).toBeNull();
    expect(rows[0]!.name).toBe('one');
  });

  it('does not commit when the row object is replaced at the same key', async () => {
    const gate = createGate();
    const { table, rows } = setup({ validator: () => gate.wait() });
    expect(table.startRowEdit(0)).toBe(true);

    const committing = table.commitRowEdit(0);
    await gate.entered;
    table.setData([{ id: 1, name: 'replacement', amount: 100 }, rows[1]!]);
    gate.release();

    await expect(committing).resolves.toBe(false);
    expect(table.editingRowKey.value).toBeNull();
  });

  it('does not commit a session that was restarted on another row', async () => {
    const gate = createGate();
    const { table } = setup({ validator: () => gate.wait() });
    expect(table.startRowEdit(0)).toBe(true);

    const committing = table.commitRowEdit(0);
    await gate.entered;
    expect(table.startRowEdit(1)).toBe(true);
    gate.release();

    await expect(committing).resolves.toBe(false);
    expect(table.editingRowKey.value).toBe('2');
  });

  it('rolls back to the session snapshot and drops drafts on cancel', () => {
    const { table, rows } = setup();
    expect(table.startRowEdit(0)).toBe(true);
    table.setCellValue(rows[0]!, 0, 'amount', 42);
    table.setDraft('1', 'name', 'never committed');

    table.cancelRowEdit(0);

    expect(rows[0]).toMatchObject({ name: 'one', amount: 10 });
    expect(table.getDraft('1', 'name').has).toBe(false);
    expect(table.editingRowKey.value).toBeNull();
    expect(table.isRowEditing(rows[0]!)).toBe(false);
  });

  it('drops session history on cancel so redo cannot resurrect the edit', () => {
    const testTable = createTestTable<Row>({
      data: [
        { id: 1, name: 'one', amount: 100 },
        { id: 2, name: 'two', amount: 20 },
      ],
      columns: [
        { prop: 'name', label: '名称', editable: true },
        { prop: 'amount', label: '金额', editable: true },
      ],
      mode: 'row',
      history: true,
    });
    tables.push(testTable);
    const { table } = testTable;
    const row = table.data.value[0]!;

    expect(table.startRowEdit(0)).toBe(true);
    table.setCellValue(row, 0, 'amount', 500);
    table.cancelRowEdit(0);

    expect(row.amount).toBe(100);
    expect(table.canUndo.value).toBe(false);
    expect(table.canRedo.value).toBe(false);
    table.redo();
    expect(row.amount).toBe(100);
  });

  it('batches a row commit into a single undo entry', async () => {
    const testTable = createTestTable<Row>({
      data: [
        { id: 1, name: 'one', amount: 10 },
        { id: 2, name: 'two', amount: 20 },
      ],
      columns: [
        { prop: 'name', label: '名称', editable: true },
        { prop: 'amount', label: '金额', editable: true },
      ],
      mode: 'row',
      history: true,
    });
    tables.push(testTable);
    const { table } = testTable;
    const row = table.data.value[0]!;

    expect(table.startRowEdit(0)).toBe(true);
    table.setDraft('1', 'name', 'edited');
    table.setDraft('1', 'amount', 99);
    await expect(table.commitRowEdit(0)).resolves.toBe(true);

    expect(row).toMatchObject({ name: 'edited', amount: 99 });
    table.undo();
    expect(row).toMatchObject({ name: 'one', amount: 10 });
    expect(table.canUndo.value).toBe(false);
  });

  it('discards a buffered draft when the same field is written elsewhere', () => {
    const testTable = createTestTable<Row>({
      data: [{ id: 1, name: 'one', amount: 100 }],
      columns: [
        { prop: 'name', label: '名称', editable: true },
        { prop: 'amount', label: '金额', editable: true },
      ],
      mode: 'table',
      history: true,
    });
    tables.push(testTable);
    const { table } = testTable;
    const row = table.data.value[0]!;

    table.setDraft('1', 'amount', 999);
    table.setCellValue(row, 0, 'amount', 7000);
    expect(table.getDraft('1', 'amount').has).toBe(false);

    table.flushDraft(row, 0, '1', 'amount');
    expect(row.amount).toBe(7000);

    table.setDraft('1', 'amount', 777);
    table.setCellValue(row, 0, 'amount', 200);
    table.undo();
    expect(row.amount).toBe(7000);
    expect(table.getDraft('1', 'amount').has).toBe(false);
    table.flushDraft(row, 0, '1', 'amount');
    expect(row.amount).toBe(7000);
  });

  it('keeps failed validation inside the editing session', async () => {
    const { table } = setup({
      validator: async () => {
        throw new Error('invalid');
      },
    });
    expect(table.startRowEdit(0)).toBe(true);
    table.setDraft('1', 'name', 'edited');

    await expect(table.commitRowEdit(0)).resolves.toBe(false);

    expect(table.editingRowKey.value).toBe('1');
    expect(table.getErrors()).toHaveLength(1);
  });
});
