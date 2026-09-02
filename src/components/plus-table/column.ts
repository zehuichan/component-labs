import type { PlusTableColumn, RowData } from './types';

/**
 * 列配置的类型辅助函数，运行时原样返回数组。
 * 字面量数组套一层即可拿到行类型上下文：prop 收敛到行字段名，
 * editable / dependencies / render 等回调的 row 也不再是 any。
 */
export function defineColumns<T extends RowData = RowData>(
  columns: PlusTableColumn<T>[],
): PlusTableColumn<T>[] {
  return columns;
}
