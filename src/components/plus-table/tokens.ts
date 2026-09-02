import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { PlusTableResolvedProps, TableHost } from './table';
import type { RowData } from './types';
import type { UseTableReturn } from './use-table';

/**
 * 注入给子组件（列 / 单元格 / 列设置 / 右键菜单）的表格上下文：
 * props + 宿主能力 + useTable 的全部返回，扁平铺在一层上。
 */
export type PlusTableContext<T extends RowData = RowData> = TableHost<T> &
  UseTableReturn<T> & {
    props: PlusTableResolvedProps<T>;
  };

export const PLUS_TABLE_INJECTION_KEY: InjectionKey<PlusTableContext<any>> = Symbol('plus-table');

export function usePlusTable<T extends RowData = RowData>(): PlusTableContext<T> {
  const table = inject(PLUS_TABLE_INJECTION_KEY);
  if (!table) {
    throw new Error('[PlusTable] 当前组件必须在 PlusTable 内部使用');
  }
  return table;
}
