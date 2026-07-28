import type { VNodeChild } from 'vue';
import type { TableColumnCtx } from 'element-plus';
import type { EditorColumnFields } from '../adapter';
import type { CellRule, RowContext, RowData } from '../table/defaults';

export interface DependencyApi<T extends RowData = RowData> {
  row: T;
  rowIndex: number;
  /** 声明该 dependencies 的列字段 */
  prop: string;
  /** 写本行其他字段（会继续触发联动与校验流水线） */
  setValue: (prop: string, value: unknown) => void;
}

/** vben form 风格的字段联动配置（values 换成当前行数据） */
export interface ColumnDependencies<T extends RowData = RowData> {
  /** 仅这些字段变动时触发 trigger 副作用 */
  triggerFields: string[];
  /** 动态禁用本格编辑 */
  disabled?: (row: T, api: DependencyApi<T>) => boolean;
  /** 动态必填 */
  required?: (row: T, api: DependencyApi<T>) => boolean;
  /** 动态校验规则（与列静态 rules 合并） */
  rules?: (row: T, api: DependencyApi<T>) => CellRule[] | null | undefined;
  /** 动态编辑器参数（如下拉选项）；覆盖列静态 componentProps 同名项 */
  componentProps?: (row: T, api: DependencyApi<T>) => Record<string, unknown>;
  /** 依赖字段变更时的副作用，经 api.setValue 改本行其他字段 */
  trigger?: (row: T, api: DependencyApi<T>) => void;
}

/** 单元格级上下文：render 回调参数，在行上下文基础上附带列与当前值 */
export interface CellContext<T extends RowData = RowData> extends RowContext<T> {
  column: PlusTableColumn<T>;
  value: unknown;
}

export type SpecialColumnType = 'index' | 'selection' | 'expand' | 'operation';

/** 数据列与特殊列共有的字段，不单独对外使用 */
interface PlusTableColumnBase<T extends RowData = RowData>
  extends Partial<Omit<TableColumnCtx<T>, 'children' | 'prop' | 'type'>>, EditorColumnFields<T> {
  /** 多级表头，组节点只需 label */
  children?: PlusTableColumn<T>[];
  /** 单元格是否可编辑 */
  editable?: boolean | ((ctx: RowContext<T>) => boolean);
  required?: boolean;
  rules?: CellRule[];
  dependencies?: ColumnDependencies<T>;
  /** 展示态自定义渲染，优先级高于 formatter */
  render?: (ctx: CellContext<T>) => VNodeChild;
  /** 初始是否可见（列设置） */
  visible?: boolean;
}

/** 数据列 / 分组表头：prop 取自行字段名 */
export interface PlusTableDataColumn<T extends RowData = RowData> extends PlusTableColumnBase<T> {
  prop?: keyof T & string;
  type?: undefined;
}

/**
 * 特殊列：勾选框 / 序号 / 展开由 el-table 原生渲染，operation 走 PlusTableCell。
 * 它们不绑定行字段，prop 只用作列 id 与 cell-${prop} 插槽名。
 */
export interface PlusTableSpecialColumn<
  T extends RowData = RowData,
> extends PlusTableColumnBase<T> {
  prop?: string;
  type: SpecialColumnType;
}

/**
 * 列配置：继承 el-table-column 的 TableColumnCtx，width/align/fixed/sortable/formatter 等原生属性
 * 直接可用（含 type: 'index' | 'selection' | 'expand' 特殊列原生直通）。
 * 编辑控件字段（component / componentProps / modelProp）对齐 vben FormSchema。
 */
export type PlusTableColumn<T extends RowData = RowData> =
  PlusTableDataColumn<T> | PlusTableSpecialColumn<T>;

/**
 * 默认列配置路径：允许直接传普通对象数组，不要求业务侧声明行类型或调用辅助函数。
 * 配置合法性仍由 useColumns 在运行时统一校验。
 *
 * 需要 prop / 回调参数的严格类型检查时，可选用 PlusTableColumn<T> 或 defineColumns<T>()。
 */
export type PlusTableColumnDef<_T extends RowData = RowData> = Record<string, any> & {
  children?: PlusTableColumnDef<_T>[];
};

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

/** 归一化后的列节点（列设置 / 渲染共用） */
export interface ColumnNode<T extends RowData = RowData> {
  id: string;
  column: PlusTableColumn<T>;
  children?: ColumnNode<T>[];
  /**
   * 分组节点在列视图构建期算好的子树可见叶子 id 指纹，供渲染层做重挂载 key。
   * 归一化树上的节点没有这个字段，只有 buildColumnView 产出的分组节点带。
   */
  subtreeKey?: string;
}
