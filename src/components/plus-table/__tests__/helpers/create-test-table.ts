import { effectScope, reactive, shallowRef, type EffectScope, type Slots } from 'vue';
import { vi } from 'vitest';
import { initComponentAdapter } from '@/adapter';
import { DEFAULT_PROPS } from '../../table';
import { useTable } from '../../use-table';
import type {
  PlusTableEmits,
  PlusTableProps,
  PlusTableResolvedProps,
  TableHost,
} from '../../table';
import type { PlusTableContext } from '../../tokens';
import type { RowData } from '../../types';

initComponentAdapter();

/**
 * 测试里的列配置刻意保持宽松：不少用例要构造只有运行期才会拒绝的非法配置
 * （回调返回值类型错误、triggerFields 被就地改坏等），过不了 PlusTableColumn 的静态检查。
 */
export type TestColumnDef = Record<string, any>;

export interface TestTable<T extends RowData> {
  scope: EffectScope;
  /** 与根组件 provide 的上下文同构：props + host + useTable 全部返回 */
  table: PlusTableContext<T>;
  props: Omit<PlusTableResolvedProps<T>, 'columns'> & { columns: TestColumnDef[] };
  emit: ReturnType<typeof vi.fn>;
  dispose: () => void;
}

/** 与 table.vue 的 withDefaults 等价：pageSizes 这类数组默认值在 DEFAULT_PROPS 里是工厂函数 */
function resolveDefaults() {
  return {
    ...DEFAULT_PROPS,
    pageSizes: DEFAULT_PROPS.pageSizes(),
  };
}

export function createTestTable<T extends RowData>(
  options: {
    data: T[];
    columns: TestColumnDef[];
  } & Partial<Omit<PlusTableProps<T>, 'data' | 'columns'>>,
): TestTable<T> {
  const props = reactive({
    ...resolveDefaults(),
    rowKey: 'id',
    // 默认不跟随写值触发校验：用例自己调校验入口，避免每次写值都挂一串异步校验
    validateEvent: false,
    ...options,
  }) as PlusTableResolvedProps<T>;
  const emit = vi.fn();
  const host: TableHost<T> = {
    emit: ((event: string, ...args: unknown[]) => {
      emit(event, ...args);
      if (event === 'update:data') props.data = args[0] as T[];
    }) as PlusTableEmits<T>,
    slots: {} as Slots,
    gridRef: shallowRef<HTMLElement>(),
    paginationRef: shallowRef<HTMLElement>(),
    columnSettingsRef: shallowRef(),
    contextMenuRef: shallowRef(),
    ids: {
      description: 'test-description',
      cell: (rowKey: string, colId: string) => `cell-${rowKey}-${colId}`,
      error: (rowKey: string, colId: string) => `error-${rowKey}-${colId}`,
    },
    // 测试 host 总是把 update:data 写回 props.data，等价于挂了监听
    hasDataListener: () => true,
  };
  const scope = effectScope();
  let table!: PlusTableContext<T>;
  scope.run(() => {
    table = { props, ...host, ...useTable<T>(props, host) };
  });

  return {
    scope,
    table,
    props: props as TestTable<T>['props'],
    emit,
    dispose: () => scope.stop(),
  };
}
