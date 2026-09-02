import PlusTable from './table.vue';

export { PlusTable };

export { PLUS_TABLE_INJECTION_KEY, usePlusTable } from './tokens';
export { resolveEditor } from './adapter';
export { defineColumns } from './column';

export type { ColumnComponent, EditorColumnFields, EditorTrigger, ResolvedEditor } from './adapter';
export type { ComponentType } from '@/adapter';
export type { CellView, EditorBinding, EditorSlotProps, HeaderSlotProps } from './cell';
export type { PlusTableContext } from './tokens';
export type { UseTableReturn } from './use-table';
export type { SettingItem } from './composables/use-columns';
export type { DependencyState } from './composables/use-dependencies';
export type { DirtyCell } from './composables/use-dirty';
export type {
  AdaptiveConfig,
  CellChangePayload,
  ContextMenuContext,
  ContextMenuItem,
  ContextMenuItemSlotProps,
  HotkeyBinding,
  HotkeyContext,
  PageChangePayload,
  PlusTableEmits,
  PlusTableProps,
  PlusTableResolvedProps,
  ValidateResult,
} from './table';
export type {
  CellContext,
  CellError,
  CellPosition,
  CellRule,
  ColumnDependencies,
  ColumnNode,
  DependencyApi,
  EditMode,
  PlusTableColumn,
  PlusTableColumnDef,
  PlusTableDataColumn,
  PlusTableSpecialColumn,
  RowContext,
  RowData,
  RowKey,
  SpecialColumnType,
} from './types';
