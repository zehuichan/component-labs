import { effectScope, reactive, shallowRef, type EffectScope, type Slots } from 'vue';
import { vi } from 'vitest';
import { createStore } from '../../store/helper';
import { DEFAULT_PROPS } from '../../table/defaults';
import type { InternalStore } from '../../store';
import type { TableHost } from '../../store/context';
import type { PlusTable } from '../../tokens';
import type { PlusTableEmits, PlusTableProps, RowData } from '../../table/defaults';

/**
 * 测试里的列配置刻意保持宽松：不少用例要构造只有运行期才会拒绝的非法配置
 * （回调返回值类型错误、triggerFields 被就地改坏等），过不了 PlusTableColumn 的静态检查。
 */
export type TestColumnDef = Record<string, any>;

export interface TestTable<T extends RowData> {
  scope: EffectScope;
  table: PlusTable<T>;
  props: Omit<PlusTableProps<T>, 'columns'> & { columns: TestColumnDef[] };
  store: InternalStore<T>;
  emit: ReturnType<typeof vi.fn>;
  dispose: () => void;
}

export function createTestTable<T extends RowData>(
  options: {
    data: T[];
    columns: TestColumnDef[];
  } & Partial<Omit<PlusTableProps<T>, 'data' | 'columns'>>,
): TestTable<T> {
  const props = reactive({
    rowKey: 'id',
    mode: DEFAULT_PROPS.mode,
    // 默认不跟随写值触发校验：用例自己调校验入口，避免每次写值都挂一串异步校验
    validateEvent: false,
    ...options,
  }) as PlusTableProps<T>;
  const emit = vi.fn();
  const host = {
    props,
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
  } satisfies TableHost<T>;
  const scope = effectScope();
  let store!: InternalStore<T>;
  scope.run(() => {
    store = createStore<T>(host);
  });

  return {
    scope,
    table: { ...host, store },
    props,
    store,
    emit,
    dispose: () => scope.stop(),
  };
}
