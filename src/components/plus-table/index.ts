import PlusTable from './table.vue';

export { PlusTable };

export { PLUS_TABLE_INJECTION_KEY } from './tokens';
export { EDITOR_REGISTRY, resolveEditor } from './adapter';
export { defineColumns } from './table-column/defaults';

export type {
  EditorSlotProps,
  HeaderSlotProps,
  EditorBinding,
  CellView,
} from './table-cell/render-helper';
export type {
  BuiltinEditorType,
  ColumnComponent,
  EditorAdapter,
  EditorColumnFields,
  ResolvedEditor,
} from './adapter';
export type { Store } from './store';
export type { SettingItem } from './store/columns';
export type { CellPosition } from './store/current';
export type { DependencyState } from './store/dependencies';
export type { DirtyApi, DirtyCell } from './store/dirty';
export type { HistoryApi } from './store/history';
export type {
  AdaptiveConfig,
  CellChangePayload,
  CellError,
  CellRule,
  ContextMenuContext,
  ContextMenuItem,
  EditMode,
  HotkeyBinding,
  HotkeyContext,
  PageChangePayload,
  PlusTableEmits,
  PlusTableProps,
  RowContext,
  RowData,
  RowKey,
  ValidateResult,
} from './table/defaults';
export type {
  CellContext,
  ColumnDependencies,
  ColumnNode,
  DependencyApi,
  PlusTableColumn,
  PlusTableColumnDef,
  PlusTableDataColumn,
  PlusTableSpecialColumn,
  SpecialColumnType,
} from './table-column/defaults';
