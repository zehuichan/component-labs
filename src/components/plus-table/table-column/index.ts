import { defineComponent, h } from 'vue';
import { ElTableColumn } from 'element-plus';
import { omit } from 'es-toolkit';
import { usePlusTable } from '../tokens';
import { isNativeRenderColumn } from '../util';
import PlusTableCell from '../table-cell';
import type { PropType, VNodeChild } from 'vue';
import type { RowData } from '../table/defaults';
import type { ColumnNode, PlusTableColumn } from './defaults';

const PLUS_TABLE_COLUMN_PROPS = [
  'component',
  'componentProps',
  'modelProp',
  'editable',
  'rules',
  'required',
  'dependencies',
  'render',
  'visible',
  'children',
  'columnKey',
] as const;

/** 过滤掉不透传给 el-table-column 的 PlusTable 扩展属性，其余原生 TableColumnCtx 属性直接透传 */
function nativeProps(column: PlusTableColumn): Record<string, unknown> {
  return omit(column, PLUS_TABLE_COLUMN_PROPS);
}

/**
 * 递归渲染列（多级表头 children），叶子列承载 PlusTableCell；
 * 原生特殊列（selection/index/expand）交给 el-table 原生渲染；operation（操作列）仍走 PlusTableCell。
 */
export default defineComponent({
  name: 'PlusTableColumnNode',
  props: {
    node: { type: Object as PropType<ColumnNode<any>>, required: true },
  },
  setup(props) {
    const table = usePlusTable();

    function renderHeader(column: PlusTableColumn): VNodeChild {
      const headerSlot = column.prop ? table.slots[`header-${column.prop}`] : undefined;
      return h(
        'span',
        {
          class: ['ptbl-header-cell', { 'ptbl-header-cell--required': column.required }],
        },
        headerSlot ? headerSlot({ column }) : (column.label ?? column.prop ?? ''),
      );
    }

    function renderNode(node: ColumnNode, index: number): VNodeChild {
      const column = node.column;

      if (node.children?.length) {
        return h(
          ElTableColumn,
          {
            /**
             * index 进 key：顺序变化时强制重挂载，确保 el-table store 的列序与渲染一致。
             * subtreeKey 是列视图构建期算好的可见叶子 id 指纹，子树变化时一并重挂整组，
             * 让 el-table 的列注册跟上——它是兜底，不承诺零重挂。
             */
            key: `${index}:${node.id}:${node.subtreeKey ?? ''}`,
            ...nativeProps(column),
            columnKey: node.id,
          },
          {
            header: () => renderHeader(column),
            default: () => {
              // 分组 slot 由 el-table-column 内部渲染器执行，闭包里的 children 只是普通数组。
              // 读一次列视图，把该渲染副作用挂到视图重建上，子列显隐 / 排序才能推动 slot 重跑。
              void table.store.states.originColumns.value;
              return node.children!.map((child, i) => renderNode(child, i));
            },
          },
        );
      }

      // 原生特殊列（selection/index/expand）：不接管 default/header slot，勾选框/序号/展开图标由 el-table 自行渲染
      if (isNativeRenderColumn(column)) {
        return h(ElTableColumn, {
          key: `${index}:${node.id}`,
          ...nativeProps(column),
          columnKey: node.id,
          width: table.store.states.widthMap.value[node.id] ?? column.width,
        });
      }

      return h(
        ElTableColumn,
        {
          key: `${index}:${node.id}`,
          // header-dragend 调宽时用 columnKey 找回叶子列
          ...nativeProps(column),
          columnKey: node.id,
          width: table.store.states.widthMap.value[node.id] ?? column.width,
        },
        {
          header: () => renderHeader(column),
          default: (scope: { row: RowData; $index: number }) =>
            scope.$index >= 0
              ? h(PlusTableCell, {
                  row: scope.row,
                  rowIndex: scope.$index,
                  node,
                })
              : null,
        },
      );
    }

    return () => renderNode(props.node, 0);
  },
});
