import { nextTick, toRaw } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestTable, type TestTable } from '../helpers/create-test-table';
import type { DependencyApi } from '../../table-column/defaults';

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
    const table = createTestTable<Row>({ data: createData(), columns });
    tables.push(table);
    return table;
  }

  afterEach(() => {
    for (const table of tables.splice(0)) table.dispose();
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
    const table = setup([
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
    const node = table.store.getColumnById('b')!;
    const row = table.store.states.data.value[0]!;

    /**
     * 绕开响应式把配置改成 normalize 会拒绝的形状：归一化不会重跑，
     * 于是只要取状态 / 广播变更还在断言配置，这里就会抛。
     */
    const raw = toRaw(table.props.columns[1]!) as { dependencies: { triggerFields: string[] } };
    raw.dependencies.triggerFields = [''];

    for (let index = 0; index < 5; index += 1) {
      expect(table.store.getDependencyState(row, 0, node).disabled).toBe(false);
      table.store.notifyFieldChange(row, 0, 'a');
    }
    table.store.setCellValue(row, 0, 'a', 'lock');

    expect(trigger).toHaveBeenCalledTimes(6);
    expect(table.store.getDependencyState(row, 0, node).disabled).toBe(true);
  });

  it('indexes dependents by trigger field, including hidden columns', () => {
    const { store } = setup([
      { prop: 'a', label: 'A' },
      {
        prop: 'b',
        label: 'B',
        visible: false,
        dependencies: { triggerFields: ['a', 'a'], trigger: () => {} },
      },
      { prop: 'c', label: 'C', dependencies: { triggerFields: ['a', 'd'], trigger: () => {} } },
    ]);

    const index = store.states.triggerIndex.value;
    expect([...index.keys()].sort()).toEqual(['a', 'd']);
    // 同一字段重复声明只登记一次，隐藏列同样在索引里
    expect(index.get('a')!.map((node) => node.id)).toEqual(['b', 'c']);
    expect(index.get('d')!.map((node) => node.id)).toEqual(['c']);
  });

  it('runs only the triggers registered for the changed field', () => {
    const onA = vi.fn();
    const onD = vi.fn();
    const { store } = setup([
      { prop: 'a', label: 'A' },
      { prop: 'b', label: 'B', dependencies: { triggerFields: ['a'], trigger: onA } },
      { prop: 'c', label: 'C', dependencies: { triggerFields: ['d'], trigger: onD } },
    ]);
    const row = store.states.data.value[0]!;

    store.setCellValue(row, 0, 'a', 'next');
    expect(onA).toHaveBeenCalledTimes(1);
    expect(onD).not.toHaveBeenCalled();

    // 没有依赖方的字段：不广播，也不遍历任何列
    store.setCellValue(row, 0, 'c', 'next');
    expect(onA).toHaveBeenCalledTimes(1);
    expect(onD).not.toHaveBeenCalled();

    store.setCellValue(row, 0, 'd', 'next');
    expect(onD).toHaveBeenCalledTimes(1);
  });

  it('stops a mutually triggering chain after one pass per field', () => {
    const onB = vi.fn();
    const onC = vi.fn();
    const { store } = setup([
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
    const row = store.states.data.value[0]!;

    store.setCellValue(row, 0, 'b', 'x');

    expect(onB).toHaveBeenCalledTimes(1);
    expect(onC).toHaveBeenCalledTimes(1);
    expect(row.c).toBe('x!');
    expect(row.b).toBe('x!?');
  });

  it('returns a shared empty state for columns without dependencies', () => {
    const { store } = setup([{ prop: 'a', label: 'A' }]);
    const node = store.getColumnById('a')!;
    const row = store.states.data.value[0]!;

    const state = store.getDependencyState(row, 0, node);
    expect(state).toEqual({ disabled: false, required: false, rules: null, componentProps: {} });
    expect(store.getDependencyState(row, 0, node)).toBe(state);
  });

  it('caches by row, row index, generation and declared trigger fields', () => {
    const componentProps = vi.fn((row: Row) => ({ options: OPTION_SETS[row.a] ?? [] }));
    const { store } = setup([
      { prop: 'a', label: 'A' },
      { prop: 'b', label: 'B', dependencies: { triggerFields: ['a'], componentProps } },
    ]);
    const node = store.getColumnById('b')!;
    const row = store.states.data.value[0]!;

    const first = store.getDependencyState(row, 0, node);
    expect(store.getDependencyState(row, 0, node)).toBe(first);
    expect(componentProps).toHaveBeenCalledTimes(1);

    // 行下标变化算未命中；重算结果等价时仍复用同一份引用
    store.getDependencyState(row, 1, node);
    expect(componentProps).toHaveBeenCalledTimes(2);
    expect(store.getDependencyState(row, 0, node)).toBe(first);
    expect(componentProps).toHaveBeenCalledTimes(3);

    // 声明的触发字段变了：重算且换新状态
    store.setCellValue(row, 0, 'a', 'x');
    const afterTriggerField = store.getDependencyState(row, 0, node);
    expect(componentProps).toHaveBeenCalledTimes(4);
    expect(afterTriggerField).not.toBe(first);
    expect(afterTriggerField.componentProps).toEqual({ options: ['x-1', 'x-2'] });

    // 同行其他字段写入推进代数：重算，但等价结果保持引用稳定
    store.setCellValue(row, 0, 'd', 'noise');
    const afterOtherField = store.getDependencyState(row, 0, node);
    expect(componentProps).toHaveBeenCalledTimes(5);
    expect(afterOtherField).toBe(afterTriggerField);
    expect(afterOtherField.componentProps).toBe(afterTriggerField.componentProps);
  });

  it('recomputes after a bare generation bump and after the row identity is replaced', async () => {
    const disabled = vi.fn((row: Row) => row.a === 'lock');
    const table = setup([
      { prop: 'a', label: 'A' },
      { prop: 'b', label: 'B', dependencies: { triggerFields: ['a'], disabled } },
    ]);
    const node = table.store.getColumnById('b')!;
    const row = table.store.states.data.value[0]!;

    table.store.getDependencyState(row, 0, node);
    expect(disabled).toHaveBeenCalledTimes(1);

    table.store.bumpDependencyGeneration('1');
    table.store.getDependencyState(row, 0, node);
    expect(disabled).toHaveBeenCalledTimes(2);

    // 同 rowKey 换了行对象：缓存随行身份一起作废
    table.props.data = [{ id: 1, a: 'lock', b: '', c: '', d: '' }];
    await nextTick();
    const nextRow = table.store.states.data.value[0]!;
    expect(nextRow).not.toBe(row);
    expect(table.store.getDependencyState(nextRow, 0, node).disabled).toBe(true);
    expect(disabled).toHaveBeenCalledTimes(3);
  });

  it('drops cached state when a dependency callback is swapped in place', async () => {
    const table = setup([
      { prop: 'a', label: 'A' },
      {
        prop: 'b',
        label: 'B',
        dependencies: { triggerFields: ['a'], disabled: () => false },
      },
    ]);
    const row = table.store.states.data.value[0]!;
    expect(table.store.getDependencyState(row, 0, table.store.getColumnById('b')!).disabled).toBe(
      false,
    );

    const config = table.props.columns[1] as { dependencies: { disabled: () => boolean } };
    config.dependencies.disabled = () => true;
    await nextTick();

    expect(table.store.getDependencyState(row, 0, table.store.getColumnById('b')!).disabled).toBe(
      true,
    );
  });

  it('type-checks callback results on every recompute', () => {
    const { store } = setup([
      { prop: 'a', label: 'A' },
      {
        prop: 'b',
        label: 'B',
        dependencies: { triggerFields: ['a'], required: () => 'yes' },
      },
    ]);
    const node = store.getColumnById('b')!;
    const row = store.states.data.value[0]!;

    expect(() => store.getDependencyState(row, 0, node)).toThrow(
      /dependencies.required 必须返回 boolean/,
    );
  });
});
