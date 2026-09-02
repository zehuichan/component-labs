import { nextTick, toRaw } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestTable, type TestTable } from '../helpers/create-test-table';
import type { DependencyApi } from '../../types';

interface Row {
  id: number;
  a: string;
  b: string;
  c: string;
  d: string;
}

/** 稳定引用的下拉项，用来验证等价重算后 componentProps 不换引用 */
const OPTION_SETS: Record<string, string[]> = {
  '': [],
  x: ['x-1', 'x-2'],
};

function createData(): Row[] {
  return [{ id: 1, a: '', b: '', c: '', d: '' }];
}

describe('PlusTable dependencies', () => {
  const tables: TestTable<Row>[] = [];

  function setup(columns: Record<string, unknown>[]) {
    const testTable = createTestTable<Row>({ data: createData(), columns });
    tables.push(testTable);
    return testTable;
  }

  afterEach(() => {
    for (const testTable of tables.splice(0)) testTable.dispose();
  });

  it('rejects dependencies declared outside a leaf data column', () => {
    expect(() =>
      setup([
        {
          label: 'Group',
          dependencies: { triggerFields: ['a'] },
          children: [{ prop: 'a', label: 'A' }],
        },
      ]),
    ).toThrow(/只能配置在具有非空 prop 的叶子数据列上/);
  });

  it('rejects malformed trigger fields while normalizing', () => {
    expect(() => setup([{ prop: 'a', label: 'A', dependencies: { triggerFields: [''] } }])).toThrow(
      /triggerFields 必须是字段名数组/,
    );
  });

  it('asserts dependency config only while normalizing, never on the hot paths', () => {
    const trigger = vi.fn();
    const testTable = setup([
      { prop: 'a', label: 'A' },
      {
        prop: 'b',
        label: 'B',
        dependencies: {
          triggerFields: ['a'],
          disabled: (row: Row) => row.a === 'lock',
          trigger,
        },
      },
    ]);
    const node = testTable.table.getColumnById('b')!;
    const row = testTable.table.data.value[0]!;

    /**
     * 绕开响应式把配置改成 normalize 会拒绝的形状：归一化不会重跑，
     * 于是只要取状态 / 广播变更还在断言配置，这里就会抛。
     */
    const raw = toRaw(testTable.props.columns[1]!) as { dependencies: { triggerFields: string[] } };
    raw.dependencies.triggerFields = [''];

    for (let index = 0; index < 5; index += 1) {
      expect(testTable.table.getDependencyState(row, 0, node).disabled).toBe(false);
      testTable.table.notifyFieldChange(row, 0, 'a');
    }
    testTable.table.setCellValue(row, 0, 'a', 'lock');

    expect(trigger).toHaveBeenCalledTimes(6);
    expect(testTable.table.getDependencyState(row, 0, node).disabled).toBe(true);
  });

  it('indexes dependents by trigger field, including hidden columns', () => {
    const { table } = setup([
      { prop: 'a', label: 'A' },
      {
        prop: 'b',
        label: 'B',
        visible: false,
        dependencies: { triggerFields: ['a', 'a'], trigger: () => {} },
      },
      { prop: 'c', label: 'C', dependencies: { triggerFields: ['a', 'd'], trigger: () => {} } },
    ]);

    const index = table.triggerIndex.value;
    expect([...index.keys()].sort()).toEqual(['a', 'd']);
    // 同一字段重复声明只登记一次，隐藏列同样在索引里
    expect(index.get('a')!.map((node) => node.id)).toEqual(['b', 'c']);
    expect(index.get('d')!.map((node) => node.id)).toEqual(['c']);
  });

  it('runs only the triggers registered for the changed field', () => {
    const onA = vi.fn();
    const onD = vi.fn();
    const { table } = setup([
      { prop: 'a', label: 'A' },
      { prop: 'b', label: 'B', dependencies: { triggerFields: ['a'], trigger: onA } },
      { prop: 'c', label: 'C', dependencies: { triggerFields: ['d'], trigger: onD } },
    ]);
    const row = table.data.value[0]!;

    table.setCellValue(row, 0, 'a', 'next');
    expect(onA).toHaveBeenCalledTimes(1);
    expect(onD).not.toHaveBeenCalled();

    // 没有依赖方的字段：不广播，也不遍历任何列
    table.setCellValue(row, 0, 'c', 'next');
    expect(onA).toHaveBeenCalledTimes(1);
    expect(onD).not.toHaveBeenCalled();

    table.setCellValue(row, 0, 'd', 'next');
    expect(onD).toHaveBeenCalledTimes(1);
  });

  it('stops a mutually triggering chain after one pass per field', () => {
    const onB = vi.fn();
    const onC = vi.fn();
    const { table } = setup([
      {
        prop: 'a',
        label: 'A',
        dependencies: {
          triggerFields: ['b'],
          trigger: (row: Row, api: DependencyApi<Row>) => {
            onB();
            api.setValue('c', `${row.b}!`);
          },
        },
      },
      {
        prop: 'b',
        label: 'B',
        dependencies: {
          triggerFields: ['c'],
          trigger: (row: Row, api: DependencyApi<Row>) => {
            onC();
            api.setValue('b', `${row.c}?`);
          },
        },
      },
    ]);
    const row = table.data.value[0]!;

    table.setCellValue(row, 0, 'b', 'x');

    expect(onB).toHaveBeenCalledTimes(1);
    expect(onC).toHaveBeenCalledTimes(1);
    expect(row.c).toBe('x!');
    expect(row.b).toBe('x!?');
  });

  it('returns a shared empty state for columns without dependencies', () => {
    const { table } = setup([{ prop: 'a', label: 'A' }]);
    const node = table.getColumnById('a')!;
    const row = table.data.value[0]!;

    const state = table.getDependencyState(row, 0, node);
    expect(state).toEqual({ disabled: false, required: false, rules: null, componentProps: {} });
    expect(table.getDependencyState(row, 0, node)).toBe(state);
  });

  it('caches by row identity and generation; rowIndex argument is ignored for residents', () => {
    const componentProps = vi.fn((row: Row) => ({ options: OPTION_SETS[row.a] ?? [] }));
    const { table } = setup([
      { prop: 'a', label: 'A' },
      { prop: 'b', label: 'B', dependencies: { triggerFields: ['a'], componentProps } },
    ]);
    const node = table.getColumnById('b')!;
    const row = table.data.value[0]!;

    const first = table.getDependencyState(row, 0, node);
    expect(table.getDependencyState(row, 0, node)).toBe(first);
    expect(componentProps).toHaveBeenCalledTimes(1);

    // 调用方传入的 rowIndex 只是提示：在册行一律按 keysMap 现查，不算未命中
    expect(table.getDependencyState(row, 1, node)).toBe(first);
    expect(componentProps).toHaveBeenCalledTimes(1);

    // 声明的触发字段变了：重算且换新状态
    table.setCellValue(row, 0, 'a', 'x');
    const afterTriggerField = table.getDependencyState(row, 0, node);
    expect(componentProps).toHaveBeenCalledTimes(2);
    expect(afterTriggerField).not.toBe(first);
    expect(afterTriggerField.componentProps).toEqual({ options: ['x-1', 'x-2'] });

    // 同行其他字段写入推进代数：重算，但等价结果保持引用稳定
    table.setCellValue(row, 0, 'd', 'noise');
    const afterOtherField = table.getDependencyState(row, 0, node);
    expect(componentProps).toHaveBeenCalledTimes(3);
    expect(afterOtherField).toBe(afterTriggerField);
    expect(afterOtherField.componentProps).toBe(afterTriggerField.componentProps);
  });

  it('recomputes after a bare generation bump and after the row identity is replaced', async () => {
    const disabled = vi.fn((row: Row) => row.a === 'lock');
    const testTable = setup([
      { prop: 'a', label: 'A' },
      { prop: 'b', label: 'B', dependencies: { triggerFields: ['a'], disabled } },
    ]);
    const node = testTable.table.getColumnById('b')!;
    const row = testTable.table.data.value[0]!;

    testTable.table.getDependencyState(row, 0, node);
    expect(disabled).toHaveBeenCalledTimes(1);

    testTable.table.bumpDependencyGeneration('1');
    testTable.table.getDependencyState(row, 0, node);
    expect(disabled).toHaveBeenCalledTimes(2);

    // 同 rowKey 换了行对象：缓存随行身份一起作废
    testTable.props.data = [{ id: 1, a: 'lock', b: '', c: '', d: '' }];
    await nextTick();
    const nextRow = testTable.table.data.value[0]!;
    expect(nextRow).not.toBe(row);
    expect(testTable.table.getDependencyState(nextRow, 0, node).disabled).toBe(true);
    expect(disabled).toHaveBeenCalledTimes(3);
  });

  it('drops cached state when a dependency callback is swapped in place', async () => {
    const testTable = setup([
      { prop: 'a', label: 'A' },
      {
        prop: 'b',
        label: 'B',
        dependencies: { triggerFields: ['a'], disabled: () => false },
      },
    ]);
    const row = testTable.table.data.value[0]!;
    expect(
      testTable.table.getDependencyState(row, 0, testTable.table.getColumnById('b')!).disabled,
    ).toBe(false);

    const config = testTable.props.columns[1] as { dependencies: { disabled: () => boolean } };
    config.dependencies.disabled = () => true;
    await nextTick();

    expect(
      testTable.table.getDependencyState(row, 0, testTable.table.getColumnById('b')!).disabled,
    ).toBe(true);
  });

  it('type-checks callback results on every recompute', () => {
    const { table } = setup([
      { prop: 'a', label: 'A' },
      {
        prop: 'b',
        label: 'B',
        dependencies: { triggerFields: ['a'], required: () => 'yes' },
      },
    ]);
    const node = table.getColumnById('b')!;
    const row = table.data.value[0]!;

    expect(() => table.getDependencyState(row, 0, node)).toThrow(
      /dependencies.required 必须返回 boolean/,
    );
  });
});
