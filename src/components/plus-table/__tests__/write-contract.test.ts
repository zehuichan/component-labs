import { afterEach, describe, expect, it } from 'vitest';
import { createTestTable, type TestTable } from './helpers/create-test-table';

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
    return { ...testTable, row: testTable.table.data.value[0]! };
  }

  afterEach(() => {
    for (const testTable of tables.splice(0)) testTable.dispose();
  });

  it('mutates the row in place without emitting update:data', () => {
    const { table, emit, row } = setup('cell');

    table.setCellValue(row, 0, 'name', 'edited');

    expect(table.data.value[0]).toBe(row);
    expect(row.name).toBe('edited');
    expect(emit).not.toHaveBeenCalledWith('update:data', expect.anything());
    expect(emit).toHaveBeenCalledWith(
      'cell-change',
      expect.objectContaining({ prop: 'name', value: 'edited', oldValue: 'one' }),
    );
  });

  it('rolls a cancelled row back to its snapshot field by field', () => {
    const { table, row } = setup('row');

    expect(table.startRowEdit(0)).toBe(true);
    table.setCellValue(row, 0, 'name', 'edited');
    table.setCellValue(row, 0, 'extra', 'added');
    expect(table.isRowDirty('1')).toBe(true);

    table.cancelRowEdit(0);

    expect(table.data.value[0]).toBe(row);
    expect(row).toEqual({ id: 1, name: 'one', amount: 10 });
    expect('extra' in row).toBe(false);
    expect(table.isRowDirty('1')).toBe(false);
    expect(table.editingRowKey.value).toBeNull();
  });

  it('replays undo and redo through the same write contract', () => {
    const { table, row } = setup('cell');

    table.setCellValue(row, 0, 'name', 'edited');
    expect(table.canUndo.value).toBe(true);

    table.undo();
    expect(row.name).toBe('one');
    expect(table.isRowDirty('1')).toBe(false);
    expect(table.canRedo.value).toBe(true);

    table.redo();
    expect(row.name).toBe('edited');
    expect(table.isCellDirty('1', 'name')).toBe(true);
  });

  it('refuses writes that would change the resolved row identity', () => {
    const { table, row } = setup('cell');

    expect(() => table.setCellValue(row, 0, 'id', 2)).toThrow(/rowKey.*不可修改/);
    expect(row.id).toBe(1);
  });
});
