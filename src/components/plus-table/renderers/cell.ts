import { nextTick } from 'vue';
import { resolveEditor } from '../adapter';
import { resolveEditable } from '../utils';
import type { CellView, EditorBinding, EditorSlotProps } from '../cell';
import type { DependencyState } from '../composables/use-dependencies';
import type { PlusTableContext } from '../tokens';
import type { ColumnNode, EditMode, PlusTableColumn, RowData } from '../types';

/** 编辑器绑定所需的单元格上下文；prop 已由调用方确认非空 */
interface EditorContext<T extends RowData = RowData> {
  table: PlusTableContext<T>;
  row: T;
  rowIndex: number;
  rowKey: string;
  column: PlusTableColumn<T>;
  prop: string;
  mode: EditMode;
}

interface CellRenderLocation {
  rowKey: string;
  rowIndex: number;
  colIndex: number;
}

/**
 * 单元格取值 + 写入策略：cell 模式读写草稿仓；row/table 模式下 wantsBuffer 时草稿仓缓冲、
 * 失焦提交，否则 setValue 即时写值。editor-${prop} 插槽与内置/自定义编辑器共用此策略。
 */
export function getCellBinding<T extends RowData = RowData>(
  ctx: EditorContext<T>,
  wantsBuffer: boolean,
) {
  const { table, row, rowIndex, rowKey, prop, mode } = ctx;
  const isCellMode = mode === 'cell';
  const useBuffer = !isCellMode && wantsBuffer;
  const draft = isCellMode || useBuffer ? table.getDraft(rowKey, prop) : null;
  // cell 模式编辑器只看草稿；缓冲模式有草稿才用草稿，否则与直写模式一样读行字段
  const value = draft && (isCellMode || draft.has) ? draft.value : row[prop];
  const setValue = (next: unknown) => {
    if (isCellMode || useBuffer) table.setDraft(rowKey, prop, next);
    else table.setCellValue(row, rowIndex, prop, next);
  };
  const flush = () => {
    if (useBuffer) table.flushDraft(row, rowIndex, rowKey, prop);
  };
  return { value, setValue, flush };
}

export function getEditorSlotProps<T extends RowData = RowData>(
  ctx: EditorContext<T>,
): EditorSlotProps<T> {
  const { table, row, rowIndex, column, mode } = ctx;
  // 插槽是完全自定义的内容，PlusTable 不假设失焦语义，也不做缓冲——commit/cancel 留给业务侧自行接线
  const { value, setValue } = getCellBinding(ctx, false);
  const commit = () => {
    if (mode === 'cell') table.commitEdit();
    else if (mode === 'row') table.clearRowEditingCell(false);
  };
  const cancel = () => {
    if (mode === 'cell') table.cancelEdit();
    else if (mode === 'row') table.clearRowEditingCell(false);
  };
  return { row, rowIndex, column, value, setValue, commit, cancel };
}

export function getEditorBinding<T extends RowData = RowData>(
  ctx: EditorContext<T>,
  depState: DependencyState | undefined,
): EditorBinding {
  const { table, row, rowIndex, column, mode } = ctx;
  const isCellMode = mode === 'cell';
  const resolved = resolveEditor(column, { row, rowIndex });
  const modelProp = resolved.modelProp;
  const { value, setValue, flush } = getCellBinding(ctx, resolved.trigger === 'blur');

  const bind: Record<string, unknown> = {
    ...resolved.componentProps,
    ...(depState?.componentProps ?? {}),
    [modelProp]: value,
    [`onUpdate:${modelProp}`]: (next: unknown) => {
      setValue(next);
      if (resolved.trigger === 'change') {
        if (isCellMode) {
          table.commitEdit();
          // select/date/switch 等常挂到 body 的浮层上；卸掉编辑器后焦点不在 grid，
          // 需交回网格才能继续方向键导航（Enter/Esc 路径已有 focusGrid）
          void nextTick(() => table.focusGrid());
        } else if (mode === 'row') {
          table.clearRowEditingCell();
          void nextTick(() => table.focusGrid());
        }
      }
    },
    onBlur: () => {
      // cell 模式失焦统一走 commitEdit：change 型编辑器选值时已经 commitEdit 过（此时是安全空操作）
      if (isCellMode) {
        table.commitEdit();
        return;
      }
      flush();
      if (mode === 'row') {
        table.clearRowEditingCell();
      }
    },
  };

  return { component: resolved.component, bind };
}

/** 供渲染层消费的单元格视图模型；hasEditorSlot 由调用方（已持有 slots）传入，避免两套编辑绑定都白算一遍 */
export function getCellView<T extends RowData = RowData>(
  table: PlusTableContext<T>,
  row: T,
  node: ColumnNode<T>,
  location: CellRenderLocation,
  hasEditorSlot: boolean,
): CellView<T> {
  const { rowKey, rowIndex, colIndex } = location;
  const column = node.column;
  const prop = column.prop;
  const value = prop ? row[prop] : undefined;
  const mode = table.props.mode;

  const inGrid = colIndex >= 0;
  const active = inGrid && table.isCurrentRef(rowKey, node.id);
  const error = prop ? table.getCellError(row, prop) : undefined;

  const depState = column.dependencies ? table.getDependencyState(row, rowIndex, node) : undefined;
  const rawEditable = mode !== 'none' && !!prop && resolveEditable(row, rowIndex, column);
  const disabled = rawEditable && !!depState?.disabled;
  const editable = inGrid && rawEditable && !disabled;
  const editing =
    inGrid &&
    (mode === 'table'
      ? editable
      : mode === 'row'
        ? table.isRowEditing(row) && editable
        : mode === 'cell'
          ? table.isEditingRef(rowKey, node.id)
          : false);
  // 动态必填：联动算出来的必填状态格内即时可见，不必等提交校验失败才发现
  const required = !!column.required || !!depState?.required;
  const dirty = !!prop && table.isCellDirty(rowKey, prop);

  let editorBind: EditorBinding | null = null;
  let editorSlotProps: EditorSlotProps<T> | null = null;
  if (editing && prop) {
    const ctx: EditorContext<T> = { table, row, rowIndex, rowKey, column, prop, mode };
    if (hasEditorSlot) editorSlotProps = getEditorSlotProps(ctx);
    else editorBind = getEditorBinding(ctx, depState);
  }

  return {
    value,
    editing,
    editable,
    active,
    disabled,
    required,
    dirty,
    error,
    mode,
    editorBind,
    editorSlotProps,
  };
}

export function getCellClasses(view: CellView) {
  return [
    'ptbl-cell',
    {
      'ptbl-cell--active': view.active && !view.editing,
      'ptbl-cell--editing': view.editing,
      // cell 模式编辑中：单元格蓝框是唯一边框（编辑器内部去边框）
      'ptbl-cell--editing-focus': view.editing && view.mode === 'cell',
      // row 模式整行进编：编辑器平时无边框，仅聚焦格高亮
      'ptbl-cell--editing-quiet': view.editing && view.mode === 'row',
      'ptbl-cell--editable': view.editable && !view.editing && view.mode === 'cell',
      'ptbl-cell--disabled': view.disabled,
      'ptbl-cell--error': !!view.error,
      'ptbl-cell--required': view.required,
      'ptbl-cell--dirty': view.dirty,
    },
  ];
}

export function getEditorWrapperClass(
  align: string | undefined,
): (string | Record<string, boolean>)[] {
  return ['ptbl-cell__editor', align ? `ptbl-cell__editor--${align}` : ''];
}
