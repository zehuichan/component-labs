import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestTable, type TestTable } from '../helpers/create-test-table';
import type { RuleItem } from 'async-validator';

/** 统计 Schema 构造次数，用来观察纯静态规则的 Schema 是否被复用 */
const schemaCounter = vi.hoisted(() => ({ constructed: 0 }));

vi.mock('async-validator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('async-validator')>();
  const Original = actual.default;
  function CountingSchema(this: unknown, descriptor: unknown) {
    schemaCounter.constructed += 1;
    return new (Original as unknown as new (descriptor: unknown) => unknown)(descriptor);
  }
  return { ...actual, default: CountingSchema as unknown as typeof actual.default };
});

interface Row {
  id: number;
  a: string;
  b: string;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function createRows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({ id: index + 1, a: '', b: '' }));
}

describe('PlusTable validation', () => {
  const tables: TestTable<Row>[] = [];

  function setup(data: Row[], columns: Record<string, unknown>[]) {
    const testTable = createTestTable<Row>({ data, columns });
    tables.push(testTable);
    return testTable;
  }

  afterEach(() => {
    for (const testTable of tables.splice(0)) testTable.dispose();
    vi.restoreAllMocks();
  });

  it('validates rows through a bounded concurrency pool', async () => {
    let active = 0;
    let peak = 0;
    const validatedIds: number[] = [];
    const rule: RuleItem = {
      asyncValidator: async (_rule, _value, _callback, source) => {
        active += 1;
        peak = Math.max(peak, active);
        validatedIds.push((source as Row).id);
        await delay(1);
        active -= 1;
      },
    };
    const { table } = setup(createRows(12), [{ prop: 'a', label: 'A', rules: [rule] }]);

    const result = await table.validate(false);

    // 12 行只有 4 条在飞：既不是串行（1），也不是一次性全放出去（12）
    expect(peak).toBe(4);
    expect(validatedIds).toHaveLength(12);
    expect(new Set(validatedIds).size).toBe(12);
    expect(result.valid).toBe(true);
  });

  /**
   * 让错误的写入顺序与视觉顺序完全相反：末行的 A 最先失败，首行的 B 最后失败，
   * 且 fixed 把 B 排到了 A 前面。
   */
  function setupScrambledErrors() {
    const failAfter = (ms: (row: Row) => number): RuleItem => ({
      asyncValidator: async (_rule, _value, _callback, source) => {
        await delay(ms(source as Row));
        throw new Error('不能为空');
      },
    });
    const testTable = setup(createRows(2), [
      { prop: 'a', label: 'A', rules: [failAfter((row) => (row.id === 1 ? 20 : 0))] },
      { prop: 'b', label: 'B', fixed: 'left', rules: [failAfter(() => 40)] },
    ]);
    return testTable.table;
  }

  it('returns errors ordered by visual row and column position', async () => {
    const table = setupScrambledErrors();

    const result = await table.validate(false);

    expect(table.columns.value.map((node) => node.column.prop)).toEqual(['b', 'a']);
    expect(result.errors.map((error) => [error.rowIndex, error.prop])).toEqual([
      [0, 'b'],
      [0, 'a'],
      [1, 'b'],
      [1, 'a'],
    ]);
    expect(table.getErrors()).toEqual(result.errors);
  });

  it('activates the visually first error cell', async () => {
    const table = setupScrambledErrors();

    await table.validate();

    expect(table.currentCell.value).toEqual({ rowIndex: 0, colIndex: 0 });
  });

  it('keeps hidden-column errors last and skips scrolling to them', async () => {
    const { table } = setup(createRows(1), [
      { prop: 'a', label: 'A', required: true, visible: false },
      { prop: 'b', label: 'B', required: true },
    ]);

    const result = await table.validate();

    expect(result.errors.map((error) => error.prop)).toEqual(['b', 'a']);
    expect(table.currentCell.value).toEqual({ rowIndex: 0, colIndex: 0 });
  });

  it('stops retrying a row that keeps being preempted by newer input', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let attempts = 0;
    let preempting = false;
    let testTable!: TestTable<Row>;
    const preemptedRule: RuleItem = {
      asyncValidator: async (_rule, _value, _callback, source) => {
        // 抢占用的那次校验不再自我递归，每一轮重试只被打断一次
        if (preempting) return;
        preempting = true;
        attempts += 1;
        void testTable.table.validateCell(source as Row, 0, 'a');
        preempting = false;
        await delay(0);
      },
    };
    testTable = setup(createRows(1), [{ prop: 'a', label: 'A', rules: [preemptedRule] }]);

    await expect(testTable.table.validateRow(0)).resolves.toEqual([]);

    // 首次 + 5 次重试后放弃，不再无限重试
    expect(attempts).toBe(6);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('放弃重试'));
  });

  it('reuses one Schema for static rules and rebuilds it for dependency-driven rules', async () => {
    const { table } = setup(createRows(2), [
      { prop: 'a', label: 'A', required: true },
      {
        prop: 'b',
        label: 'B',
        dependencies: { triggerFields: ['a'], required: (row: Row) => row.a === '' },
      },
    ]);
    const [first, second] = table.data.value as [Row, Row];

    schemaCounter.constructed = 0;
    await table.validateCell(first, 0, 'a');
    await table.validateCell(first, 0, 'a');
    await table.validateCell(second, 1, 'a');
    expect(schemaCounter.constructed).toBe(1);

    schemaCounter.constructed = 0;
    await table.validateCell(first, 0, 'b');
    await table.validateCell(first, 0, 'b');
    expect(schemaCounter.constructed).toBe(2);
  });

  it('rebuilds the cached Schema after the column rules change', async () => {
    const testTable = setup(createRows(1), [{ prop: 'a', label: 'A', required: true }]);
    const row = testTable.table.data.value[0]!;

    schemaCounter.constructed = 0;
    await testTable.table.validateCell(row, 0, 'a');
    expect(schemaCounter.constructed).toBe(1);

    testTable.props.columns[0]!.label = 'A 列';
    await testTable.table.validateCell(row, 0, 'a');

    expect(schemaCounter.constructed).toBe(2);
    expect(testTable.table.getCellError(row, 'a')?.message).toBe('A 列不能为空');
  });
});
