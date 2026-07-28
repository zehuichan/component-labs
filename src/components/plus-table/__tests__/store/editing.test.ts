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
    return { ...testTable, rows: testTable.store.states.data.value };
  }

  afterEach(() => {
    for (const table of tables.splice(0)) table.dispose();
  });

  it('flushes its own drafts before sampling the session epoch', async () => {
    const { store, rows } = setup({ validator: async () => {} });
    expect(store.startRowEdit(0)).toBe(true);
    store.setDraft('1', 'name', 'edited');
    store.setDraft('1', 'amount', 99);

    await expect(store.commitRowEdit(0)).resolves.toBe(true);

    expect(rows[0]).toMatchObject({ name: 'edited', amount: 99 });
    expect(store.getDraft('1', 'name').has).toBe(false);
    expect(store.states.editingRowKey.value).toBeNull();
  });

  it('does not commit when a draft is written while validation is in flight', async () => {
    const gate = createGate();
    const { store, rows } = setup({ validator: () => gate.wait() });
    expect(store.startRowEdit(0)).toBe(true);
    store.setDraft('1', 'name', 'first');

    const committing = store.commitRowEdit(0);
    await gate.entered;
    store.setDraft('1', 'name', 'second');
    gate.release();

    await expect(committing).resolves.toBe(false);
    expect(store.states.editingRowKey.value).toBe('1');
    expect(store.getDraft('1', 'name').value).toBe('second');
    expect(rows[0]!.name).toBe('first');
  });

  it('does not commit when the row edit is cancelled while validation is in flight', async () => {
    const gate = createGate();
    const { store, rows } = setup({ validator: () => gate.wait() });
    expect(store.startRowEdit(0)).toBe(true);
    store.setDraft('1', 'name', 'edited');

    const committing = store.commitRowEdit(0);
    await gate.entered;
    store.cancelRowEdit(0);
    gate.release();

    await expect(committing).resolves.toBe(false);
    expect(store.states.editingRowKey.value).toBeNull();
    expect(rows[0]!.name).toBe('one');
  });

  it('does not commit when the row object is replaced at the same key', async () => {
    const gate = createGate();
    const { store, rows } = setup({ validator: () => gate.wait() });
    expect(store.startRowEdit(0)).toBe(true);

    const committing = store.commitRowEdit(0);
    await gate.entered;
    store.setData([{ id: 1, name: 'replacement', amount: 100 }, rows[1]!]);
    gate.release();

    await expect(committing).resolves.toBe(false);
    expect(store.states.editingRowKey.value).toBeNull();
  });

  it('does not commit a session that was restarted on another row', async () => {
    const gate = createGate();
    const { store } = setup({ validator: () => gate.wait() });
    expect(store.startRowEdit(0)).toBe(true);

    const committing = store.commitRowEdit(0);
    await gate.entered;
    expect(store.startRowEdit(1)).toBe(true);
    gate.release();

    await expect(committing).resolves.toBe(false);
    expect(store.states.editingRowKey.value).toBe('2');
  });

  it('rolls back to the session snapshot and drops drafts on cancel', () => {
    const { store, rows } = setup();
    expect(store.startRowEdit(0)).toBe(true);
    store.setCellValue(rows[0]!, 0, 'amount', 42);
    store.setDraft('1', 'name', 'never committed');

    store.cancelRowEdit(0);

    expect(rows[0]).toMatchObject({ name: 'one', amount: 10 });
    expect(store.getDraft('1', 'name').has).toBe(false);
    expect(store.states.editingRowKey.value).toBeNull();
    expect(store.isRowEditing(rows[0]!)).toBe(false);
  });

  it('keeps failed validation inside the editing session', async () => {
    const { store } = setup({
      validator: async () => {
        throw new Error('invalid');
      },
    });
    expect(store.startRowEdit(0)).toBe(true);
    store.setDraft('1', 'name', 'edited');

    await expect(store.commitRowEdit(0)).resolves.toBe(false);

    expect(store.states.editingRowKey.value).toBe('1');
    expect(store.getErrors()).toHaveLength(1);
  });
});
