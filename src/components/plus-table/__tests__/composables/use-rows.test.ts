import { nextTick } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestTable } from '../helpers/create-test-table';

interface Row {
  id: number;
  name: string;
}

describe('PlusTable rows', () => {
  const tables: ReturnType<typeof createTestTable<Row>>[] = [];

  afterEach(() => {
    for (const testTable of tables.splice(0)) testTable.dispose();
  });

  it('preserves tolerant public index semantics', async () => {
    const testTable = createTestTable<Row>({
      data: [
        { id: 1, name: 'one' },
        { id: 2, name: 'two' },
      ],
      columns: [{ prop: 'name' }],
    });
    tables.push(testTable);

    testTable.table.insertRow({ id: 3, name: 'first' }, -10);
    await nextTick();
    testTable.table.insertRow({ id: 4, name: 'last' }, 100);
    await nextTick();

    expect(testTable.table.data.value.map((row) => row.id)).toEqual([3, 1, 2, 4]);
    expect(testTable.table.removeRow(-1)).toBeUndefined();
    expect(testTable.table.duplicateRow(100, { id: 5 })).toBeUndefined();
    expect(testTable.table.moveRow(-1, 1)).toBe(false);
    expect(testTable.table.moveRow(0, 100)).toBe(false);
    expect(testTable.table.data.value.map((row) => row.id)).toEqual([3, 1, 2, 4]);
  });

  it('rejects inserting a row whose rowKey already exists', () => {
    const testTable = createTestTable<Row>({
      data: [
        { id: 1, name: 'one' },
        { id: 2, name: 'two' },
      ],
      columns: [{ prop: 'name' }],
    });
    tables.push(testTable);

    expect(() => testTable.table.insertRow({ id: 2, name: 'clash' })).toThrow(/rowKey="2"/);
    expect(() => testTable.table.duplicateRow(0, {})).toThrow(/rowKey="1"/);
    expect(testTable.table.data.value).toHaveLength(2);
  });
});
