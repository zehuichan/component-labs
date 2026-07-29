import { computed, shallowRef, type ComputedRef, type Ref, type ShallowRef, type Slots } from 'vue';
import { DEFAULT_PROPS } from '../table/defaults';
import type { PlusTableEmits, PlusTableProps, RowData, RowKey, EditMode } from '../table/defaults';
import type { ColumnNode } from '../table-column/defaults';
import type { ContextMenuExpose } from '../table-context-menu/types';
import type { WriteRowFieldResult } from './write';

export type { ContextMenuExpose } from '../table-context-menu/types';

export interface RowLocation<T extends RowData = RowData> {
  row: T;
  rowIndex: number;
}

export interface CellLocation<T extends RowData = RowData> extends RowLocation<T> {
  node: ColumnNode<T>;
  colIndex: number;
  prop: string;
  rowKey: string;
}

/** 宿主侧能力：不持有 store，避免装配期环。 */
export interface TableHost<T extends RowData = RowData> {
  props: PlusTableProps<T>;
  emit: PlusTableEmits<T>;
  slots: Slots;
  gridRef: Ref<HTMLElement | undefined>;
  paginationRef: Ref<HTMLElement | undefined>;
  /** 列设置抽屉 */
  columnSettingsRef: Ref<ColumnSettingsExpose | undefined>;
  /** 右键菜单（表头内置 + 表体自定义） */
  contextMenuRef: Ref<ContextMenuExpose | undefined>;
  ids: {
    description: string;
    cell: (rowKey: string, colId: string) => string;
    error: (rowKey: string, colId: string) => string;
  };
}

/** PlusTableColumnSettings 对宿主暴露的能力 */
export interface ColumnSettingsExpose {
  open: () => void;
}

/** 共享原语：各子 store 通过上下文读取，不再经 table.store 反向互访。 */
export interface TableCoreStates<T extends RowData = RowData> {
  data: ShallowRef<T[]>;
  rowKey: ComputedRef<RowKey<T>>;
  mode: ComputedRef<EditMode>;
  validateEvent: ComputedRef<boolean>;
  history: ComputedRef<boolean>;
  dirtyTracking: ComputedRef<boolean>;
  keysMap: ComputedRef<Map<string, RowLocation<T>>>;
  rowKeyMap: ComputedRef<WeakMap<T, string>>;
}

/** 单元格写值流水线入口，由 store/index.ts 装配后回填到 commands 上。 */
export type SetCellValueCommand<T extends RowData = RowData> = (
  row: T,
  rowIndex: number,
  prop: string,
  value: unknown,
) => void;

/** 绑定了当前 rowKey 配置的字段写入 / 删除入口，是行对象的唯一就地修改点。 */
export type WriteRowFieldCommand<T extends RowData = RowData> = (
  row: T,
  prop: string,
  value: unknown,
) => WriteRowFieldResult;

export type DeleteRowFieldCommand<T extends RowData = RowData> = (
  row: T,
  prop: string,
) => WriteRowFieldResult;

export interface TableCoreContext<T extends RowData = RowData> {
  host: TableHost<T>;
  states: TableCoreStates<T>;
  getRowKey: (row: T) => string;
  /** 写命令在 mutations 装配后绑定；子 store 构造期不应同步调用。 */
  commands: {
    setCellValue: SetCellValueCommand<T> | null;
    writeRowField: WriteRowFieldCommand<T> | null;
    deleteRowField: DeleteRowFieldCommand<T> | null;
  };
}

/** 子 store 在运行期取写命令；构造期误用会在这里显式报错而不是静默失效。 */
export function requireCommand<C>(command: C | null, name: string): C {
  if (!command) {
    throw new Error(`[PlusTable] 内部错误：写命令 ${name} 尚未装配完成。`);
  }
  return command;
}

export function createCoreStates<T extends RowData>(
  host: TableHost<T>,
): Omit<TableCoreStates<T>, 'keysMap' | 'rowKeyMap'> {
  return {
    data: shallowRef<T[]>([]),
    rowKey: computed(() => host.props.rowKey),
    /** 组件外直接建 store（测试 / 复用装配层）时 props 可能没经过 withDefaults，这里兜同一份默认值 */
    mode: computed(() => host.props.mode ?? DEFAULT_PROPS.mode),
    validateEvent: computed(() => host.props.validateEvent ?? DEFAULT_PROPS.validateEvent),
    history: computed(() => host.props.history ?? DEFAULT_PROPS.history),
    dirtyTracking: computed(() => host.props.dirtyTracking ?? DEFAULT_PROPS.dirtyTracking),
  };
}
