import { describe, expect, it } from 'vitest';
import PlusTable from '../../table.vue';
import { DEFAULT_PROPS } from '../../table/defaults';

type RuntimeProps = Record<string, { default?: unknown } | undefined>;

/**
 * withDefaults 现在接的是共享常量而不是字面量，编译产物走 mergeDefaults；
 * 这里直接读组件的运行期 props 声明，确认默认值确实落到了每个 prop 上。
 */
describe('PlusTable default props', () => {
  it('feeds the shared defaults into the component prop declaration', () => {
    const props = (PlusTable as unknown as { props: RuntimeProps }).props;

    for (const [key, expected] of Object.entries(DEFAULT_PROPS)) {
      expect(props[key]?.default).toBe(expected);
    }
    expect(props.pageSizes?.default).toBe(DEFAULT_PROPS.pageSizes);
    expect(DEFAULT_PROPS.pageSizes()).toEqual([10, 20, 50, 100]);
  });
});
