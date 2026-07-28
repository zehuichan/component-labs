import type { RuleItem } from 'async-validator';
import type { PlusTableColumn, PlusTableColumnDef } from '../table-column/defaults';

export type RowData = Record<string, any>;

export type RowKey<T extends RowData = RowData> =
  | (keyof T & string)
  /** 函数必须是纯函数，并仅从行字段派生稳定身份；不可依赖对象引用。 */
  | ((row: T) => string | number);

/** 编辑模式：不可编辑 / 单元格 / 整行 / 全表常驻 */
export type EditMode = 'none' | 'cell' | 'row' | 'table';

export type CellRule = RuleItem;

export interface CellError {
  rowKey: string;
  rowIndex: number;
  prop: string;
  message: string;
}

/** 行级上下文：editable / dependencies.componentProps 等回调的最小参数集 */
export interface RowContext<T extends RowData = RowData> {
  row: T;
  rowIndex: number;
}

export interface AdaptiveConfig {
  /** 'viewport'：按视口高度计算（默认，行为不变）；'container'：交给 CSS flex 父级撑满，适合卡片/弹窗等自身高度受限的容器 */
  mode?: 'viewport' | 'container';
  /** 表格底部到视口底部预留的间距，默认 16；仅 viewport 模式生效 */
  offsetBottom?: number;
  /** 计算出的最小高度，默认 200；仅 viewport 模式生效 */
  minHeight?: number;
}

/** 自定义热键的回调上下文，贴合 PlusTable 现有概念（row/rowIndex/prop/column） */
export interface HotkeyContext<T extends RowData = RowData> {
  event: KeyboardEvent;
  rowIndex: number;
  colIndex: number;
  row: T | null;
  prop: string | undefined;
  column: PlusTableColumn<T> | null;
  data: T[];
  /** 移动活动格（不改变编辑态） */
  navigate: (rowDelta: number, colDelta: number) => void;
  /** 对活动格进编；仅 cell 模式有效 */
  startEdit: () => void;
  cancelEdit: () => void;
  /** 写活动格的值，经完整 setCellValue 流水线（联动/校验/脏追踪/历史） */
  setValue: (value: unknown) => void;
  undo: () => void;
  redo: () => void;
}

export interface HotkeyBinding<T extends RowData = RowData> {
  /** 'Ctrl+Shift+Z' 风格组合键字符串，大小写不敏感 */
  key: string;
  /** 返回 false 表示不处理，继续走后续逻辑（其余绑定 / 内置热键） */
  handler: (ctx: HotkeyContext<T>) => void | boolean;
  /** 命中 key 后的附加判定条件 */
  when?: (ctx: HotkeyContext<T>) => boolean;
  /** 默认 true */
  preventDefault?: boolean;
  stopPropagation?: boolean;
  /** true：先于内置热键判定，可完全替换内置行为；false（默认）：内置热键优先，未处理时才轮到 */
  override?: boolean;
}

export interface CellChangePayload<T extends RowData = RowData> {
  row: T;
  rowIndex: number;
  prop: string;
  value: unknown;
  oldValue: unknown;
}

export interface PageChangePayload {
  page: number;
  pageSize: number;
}

export interface ValidateResult {
  valid: boolean;
  errors: CellError[];
}

export interface PlusTableProps<T extends RowData = RowData> {
  /**
   * 行数据源。每行必须是可写的普通对象：不能冻结，参与编辑的字段不能是访问器，
   * 且 rowKey 解析出的身份在行的生命周期内保持不变。
   *
   * 字段编辑走 writeRowField 就地修改行对象，**不会** emit('update:data')；
   * 只有 insertRow / removeRow / moveRow / duplicateRow 这类行结构变更才回传新数组。
   */
  data: T[];
  /**
   * 默认可直接传普通对象数组；如需严格校验 prop 与回调行类型，
   * 可在业务侧显式使用 defineColumns<T>()。
   */
  columns: PlusTableColumnDef[];
  rowKey: RowKey<T>;
  mode?: EditMode;
  /** 是否在单元格变更时自动触发校验；false 时仅 ref.validate() 触发 */
  validateEvent?: boolean;
  /** 是否缓存列设置（显隐 / 顺序 / 列宽）；为 true 时需同时传 `id` 才写入 localStorage */
  cache?: boolean;
  /** 列设置缓存标识，多实例需各自唯一 */
  id?: string;
  adaptive?: boolean | AdaptiveConfig;
  /** 传入即启用分页（服务端驱动，组件不切片） */
  total?: number;
  page?: number;
  pageSize?: number;
  pageSizes?: number[];
  /** 撤销重做，默认 false */
  history?: boolean;
  /** 脏行/脏格追踪，默认 false */
  dirtyTracking?: boolean;
  /** 自定义热键绑定 */
  hotkeys?: HotkeyBinding<T>[];
  /** 自定义热键总开关，不影响内置键盘导航 */
  hotkeyEnabled?: boolean;
}

/**
 * props 默认值的单一来源：table.vue 的 withDefaults 与 store 侧读取兜底都取这里，
 * 免得同一个默认值在组件和 store 各写一遍、改一处漏一处。
 * pageSizes 按 withDefaults 对数组默认值的要求写成工厂函数。
 */
export const DEFAULT_PROPS = {
  mode: 'cell' as EditMode,
  validateEvent: true,
  cache: false,
  adaptive: false,
  page: 1,
  pageSize: 20,
  pageSizes: () => [10, 20, 50, 100],
  history: false,
  dirtyTracking: false,
  hotkeyEnabled: true,
};

export interface PlusTableEmits<T extends RowData = RowData> {
  (e: 'update:data', data: T[]): void;
  (e: 'cell-change', payload: CellChangePayload<T>): void;
  (e: 'update:page', page: number): void;
  (e: 'update:pageSize', pageSize: number): void;
  (e: 'page-change', payload: PageChangePayload): void;
}
