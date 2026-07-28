import { nextTick } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestTable, type TestTable } from '../helpers/create-test-table';
import type { EditMode } from '../../table/defaults';

interface Row {
  id: number;
  name: string;
  amount: number;
}

const columns = [
  { prop: 'name', label: '名称', editable: true },
  { prop: 'amount', label: '金额', editable: (context: { row: Row }) => context.row.id > 0 },
  { prop: 'id', label: '编号' },
];

function createRows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `row-${index}`,
    amount: index,
  }));
}

describe('PlusTable table-mode scale guard', () => {
  const tables: TestTable<Row>[] = [];

  function setup(rowCount: number, mode: EditMode = 'table') {
    const testTable = createTestTable<Row>({
      data: createRows(rowCount),
      columns,
      mode,
    });
    tables.push(testTable);
    return testTable;
  }

  afterEach(() => {
    for (const table of tables.splice(0)) table.dispose();
    vi.restoreAllMocks();
  });

  it('warns once when table mode would keep too many editors mounted', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 2 个可编辑列 × 1001 行 = 2002 个常驻编辑器，超过 2000 的建议上限
    const { props } = setup(1001);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('mode="table"');

    props.data = createRows(1500);
    await nextTick();

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('stays quiet below the threshold and outside table mode', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    setup(999);
    setup(5000, 'cell');

    expect(warn).not.toHaveBeenCalled();
  });
});
