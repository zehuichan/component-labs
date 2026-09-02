import { computed, defineComponent, h, ref } from 'vue';
import { ElTooltip } from 'element-plus';
import { getCellClasses, getCellView, getEditorWrapperClass } from '../renderers/cell';
import { usePlusTable } from '../tokens';
import type { ComputedRef, PropType, Ref, VNodeChild } from 'vue';
import type { TableColumnCtx } from 'element-plus';
import type { ColumnNode, RowData } from '../types';

/**
 * 单元格纯渲染：全部状态与编辑绑定来自 getCellView 一次性算出的视图模型，
 * 本组件只做「读取视图模型 -> 拼 VNode / 类名」，不触达 editing/current/validation 等内部状态。
 */
export default defineComponent({
  name: 'PlusTableCell',
  props: {
    row: { type: Object as PropType<RowData>, required: true },
    rowIndex: { type: Number, required: true },
    node: { type: Object as PropType<ColumnNode>, required: true },
  },
  setup(props) {
    const table = usePlusTable();

    /**
     * 报错格会成片出现（整表校验一次能点亮成百上千格），每格都常驻一个 ElTooltip
     * 就是成百上千个 popper 实例。这里推迟到首次悬停 / 聚焦才挂载，并接管可见性，
     * 让挂载当帧就展开——用户不必移出再移回。无障碍不依赖它：错误文案始终由
     * 视觉隐藏节点 + aria-describedby 提供。
     *
     * 这套状态本身也按需创建：从没报过错的格子只多一个 null 字段。
     */
    let tooltip: {
      mounted: Ref<boolean>;
      visible: ComputedRef<boolean>;
      triggerProps: Record<string, unknown>;
    } | null = null;

    function errorTooltip() {
      if (tooltip) return tooltip;
      const mounted = ref(false);
      const hovered = ref(false);
      const focused = ref(false);
      tooltip = {
        mounted,
        visible: computed(() => hovered.value || focused.value),
        triggerProps: {
          class: 'ptbl-cell-tooltip-trigger',
          onMouseenter: () => {
            hovered.value = true;
            mounted.value = true;
          },
          onMouseleave: () => {
            hovered.value = false;
          },
          onFocusin: () => {
            focused.value = true;
            mounted.value = true;
          },
          onFocusout: () => {
            focused.value = false;
          },
        },
      };
      return tooltip;
    }

    function renderDisplay(value: unknown, rowIndex: number): VNodeChild {
      const { row, node } = props;
      const column = node.column;
      const slot = column.prop ? table.slots[`cell-${column.prop}`] : undefined;
      if (slot) return slot({ row, rowIndex, column, value });
      if (column.render) {
        return column.render({ row, rowIndex, column, value });
      }
      if (column.formatter) {
        return column.formatter(row, column as TableColumnCtx<RowData>, value, rowIndex);
      }
      return value == null ? '' : String(value);
    }

    return () => {
      const { row, rowIndex, node } = props;
      const column = node.column;
      const prop = column.prop;
      const editorSlot = prop ? table.slots[`editor-${prop}`] : undefined;
      const rowKey = table.getRowKey(row);
      const position = table.resolveCellPosition({
        rowKey,
        colId: node.id,
      });
      const location = {
        rowKey,
        rowIndex: position?.rowIndex ?? rowIndex,
        colIndex: position?.colIndex ?? -1,
      };
      const view = getCellView(table, row, node, location, !!editorSlot);

      const content = view.editing
        ? h('div', { class: getEditorWrapperClass(column.align) }, [
            view.editorSlotProps
              ? editorSlot!(view.editorSlotProps)
              : view.editorBind
                ? h(view.editorBind.component as never, view.editorBind.bind)
                : null,
          ])
        : renderDisplay(view.value, location.rowIndex);

      const errorId = view.error ? table.ids.error(rowKey, node.id) : undefined;
      const children: VNodeChild[] = [content];
      if (view.error) {
        children.push(
          h('span', { id: errorId, class: 'ptbl-visually-hidden' }, view.error.message),
        );
      }

      const cell = h(
        'div',
        {
          id: table.ids.cell(rowKey, node.id),
          class: getCellClasses(view),
          'data-ptbl-col': node.id,
          'aria-current': view.active ? 'true' : undefined,
          'aria-invalid': view.error ? 'true' : undefined,
          'aria-describedby': errorId,
        },
        children,
      );

      if (!view.error) return cell;

      const { mounted, visible, triggerProps } = errorTooltip();
      const trigger = h('div', triggerProps, [cell]);
      return mounted.value
        ? h(
            ElTooltip,
            {
              content: view.error.message,
              placement: 'top',
              effect: 'dark',
              visible: visible.value,
            },
            { default: () => trigger },
          )
        : trigger;
    };
  },
});
