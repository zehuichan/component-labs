import type { Component } from 'vue';
import type { CellError, EditMode, PlusTableColumn, RowData } from './types';

/** editor-${prop} 插槽的统一读写接口，与内置/自定义编辑器共享同一套取值 / 写值策略 */
export interface EditorSlotProps<T extends RowData = RowData> {
  row: T;
  rowIndex: number;
  column: PlusTableColumn<T>;
  value: unknown;
  setValue: (value: unknown) => void;
  commit: () => void;
  cancel: () => void;
}

/** header-${prop} 插槽参数 */
export interface HeaderSlotProps<T extends RowData = RowData> {
  column: PlusTableColumn<T>;
}

/** 内置 / 自定义编辑器组件的完整绑定，可直接 h(component, bind) 展开渲染 */
export interface EditorBinding {
  component: Component;
  bind: Record<string, unknown>;
}

/** 供 PlusTableCell 消费的单元格视图模型 */
export interface CellView<T extends RowData = RowData> {
  value: unknown;
  editing: boolean;
  editable: boolean;
  active: boolean;
  disabled: boolean;
  required: boolean;
  dirty: boolean;
  error: CellError | undefined;
  mode: EditMode;
  /** editing 为 true 且未使用 editor-${prop} 插槽时非空 */
  editorBind: EditorBinding | null;
  /** editing 为 true 且存在 editor-${prop} 插槽时非空 */
  editorSlotProps: EditorSlotProps<T> | null;
}
