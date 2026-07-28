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
    for (const table of tables.splice(0)) table.dispose();
  });

  it('preserves tolerant public index semantics', async () => {
    const table = createTestTable<Row>({
      data: [
        { id: 1, name: 'one' },
        { id: 2, name: 'two' },
      ],
      columns: [{ prop: 'name' }],
    });
    tables.push(table);

    table.store.insertRow({ id: 3, name: 'first' }, -10);
    await nextTick();
    table.store.insertRow({ id: 4, name: 'last' }, 100);
    await nextTick();

    expect(table.store.states.data.value.map((row) => row.id)).toEqual([3, 1, 2, 4]);
    expect(table.store.removeRow(-1)).toBeUndefined();
    expect(table.store.duplicateRow(100, { id: 5 })).toBeUndefined();
    expect(table.store.moveRow(-1, 1)).toBe(false);
    expect(table.store.moveRow(0, 100)).toBe(false);
    expect(table.store.states.data.value.map((row) => row.id)).toEqual([3, 1, 2, 4]);
  });

  it('rejects inserting a row whose rowKey already exists', () => {
    const table = createTestTable<Row>({
      data: [
        { id: 1, name: 'one' },
        { id: 2, name: 'two' },
      ],
      columns: [{ prop: 'name' }],
    });
    tables.push(table);

    expect(() => table.store.insertRow({ id: 2, name: 'clash' })).toThrow(/rowKey="2"/);
    expect(() => table.store.duplicateRow(0, {})).toThrow(/rowKey="1"/);
    expect(table.store.states.data.value).toHaveLength(2);
  });
});
