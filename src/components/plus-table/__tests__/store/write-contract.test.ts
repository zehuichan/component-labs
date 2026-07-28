import { afterEach, describe, expect, it } from 'vitest';
import { createTestTable, type TestTable } from '../helpers/create-test-table';

interface Row {
  id: number;
  name: string;
  amount: number;
  extra?: string;
}

const columns = [
  { prop: 'name', label: '名称', editable: true },
  { prop: 'amount', label: '金额', editable: true },
  { prop: 'extra', label: '附加', editable: true },
];

/** 所有字段写入都必须经 writeRowField 就地修改行对象，不经 update:data 换引用。 */
describe('PlusTable row field write contract', () => {
  const tables: TestTable<Row>[] = [];

  function setup(mode: 'cell' | 'row') {
    const testTable = createTestTable<Row>({
      data: [{ id: 1, name: 'one', amount: 10 }],
      columns,
      mode,
      history: true,
      dirtyTracking: true,
    });
    tables.push(testTable);
    return { ...testTable, row: testTable.store.states.data.value[0]! };
  }

  afterEach(() => {
    for (const table of tables.splice(0)) table.dispose();
  });

  it('mutates the row in place without emitting update:data', () => {
    const { store, emit, row } = setup('cell');

    store.setCellValue(row, 0, 'name', 'edited');

    expect(store.states.data.value[0]).toBe(row);
    expect(row.name).toBe('edited');
    expect(emit).not.toHaveBeenCalledWith('update:data', expect.anything());
    expect(emit).toHaveBeenCalledWith(
      'cell-change',
      expect.objectContaining({ prop: 'name', value: 'edited', oldValue: 'one' }),
    );
  });

  it('rolls a cancelled row back to its snapshot field by field', () => {
    const { store, row } = setup('row');

    expect(store.startRowEdit(0)).toBe(true);
    store.setCellValue(row, 0, 'name', 'edited');
    store.setCellValue(row, 0, 'extra', 'added');
    expect(store.isRowDirty('1')).toBe(true);

    store.cancelRowEdit(0);

    expect(store.states.data.value[0]).toBe(row);
    expect(row).toEqual({ id: 1, name: 'one', amount: 10 });
    expect('extra' in row).toBe(false);
    expect(store.isRowDirty('1')).toBe(false);
    expect(store.states.editingRowKey.value).toBeNull();
  });

  it('replays undo and redo through the same write contract', () => {
    const { store, row } = setup('cell');

    store.setCellValue(row, 0, 'name', 'edited');
    expect(store.canUndo.value).toBe(true);

    store.undo();
    expect(row.name).toBe('one');
    expect(store.isRowDirty('1')).toBe(false);
    expect(store.canRedo.value).toBe(true);

    store.redo();
    expect(row.name).toBe('edited');
    expect(store.isCellDirty('1', 'name')).toBe(true);
  });

  it('refuses writes that would change the resolved row identity', () => {
    const { store, row } = setup('cell');

    expect(() => store.setCellValue(row, 0, 'id', 2)).toThrow(/rowKey.*不可修改/);
    expect(row.id).toBe(1);
  });
});
