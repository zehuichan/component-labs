import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { TableHost } from './store/context';
import type { InternalStore, Store } from './store';
import type { RowData } from './table/defaults';

/** 公开注入上下文仅暴露兼容的 index-based Store。 */
interface PlusTableContext<T extends RowData = RowData> extends TableHost<T> {
  store: Store<T>;
}

/**
 * 组件内部上下文可访问稳定 CellRef 相关成员。
 * host 先建、createStore 完成后一次性合入 store，装配期不存在回填空档。
 */
export interface PlusTable<T extends RowData = RowData> extends TableHost<T> {
  store: InternalStore<T>;
}

export const PLUS_TABLE_INJECTION_KEY: InjectionKey<PlusTableContext<any>> = Symbol('plus-table');

export function usePlusTable<T extends RowData = RowData>(): PlusTable<T> {
  const table = inject(PLUS_TABLE_INJECTION_KEY);
  if (!table) {
    throw new Error('[PlusTable] 当前组件必须在 PlusTable 内部使用');
  }
  return table as unknown as PlusTable<T>;
}
