import { isBoolean, isFunction, isPlainObject, isString } from 'es-toolkit';
import { isSpecialColumn } from '../util';
import type { ComputedRef } from 'vue';
import type { SetCellValueCommand, TableCoreContext } from './context';
import type { CellRule, RowData } from '../table/defaults';
import type { ColumnNode, DependencyApi, PlusTableColumn } from '../table-column/defaults';

export interface DependencyState {
  disabled: boolean;
  required: boolean;
  rules: CellRule[] | null;
  componentProps: Record<string, unknown>;
}

const EMPTY_PROPS: Record<string, unknown> = {};

const EMPTY_STATE: DependencyState = {
  disabled: false,
  required: false,
  rules: null,
  componentProps: EMPTY_PROPS,
};

const DEPENDENCY_CALLBACK_KEYS = [
  'disabled',
  'required',
  'rules',
  'componentProps',
  'trigger',
] as const;

/**
 * 列配置期断言。归一化（columns.ts 的 normalize）是唯一调用点：配置只在
 * props.columns 变化时重建，取状态 / 广播变更的热路径不再重复校验同一份配置。
 */
export function assertColumnDependencies<T extends RowData = RowData>(
  column: PlusTableColumn<T>,
): void {
  const dependencies: unknown = column.dependencies;
  if (dependencies === undefined) return;
  if (!isPlainObject(dependencies)) {
    throw new TypeError('[PlusTable] column.dependencies 必须是配置对象。');
  }
  if (!column.prop || isSpecialColumn(column) || Boolean(column.children?.length)) {
    throw new TypeError('[PlusTable] dependencies 只能配置在具有非空 prop 的叶子数据列上。');
  }
  if (
    !Array.isArray(dependencies.triggerFields) ||
    dependencies.triggerFields.some((field) => !isString(field) || field.length === 0)
  ) {
    throw new TypeError('[PlusTable] dependencies.triggerFields 必须是字段名数组。');
  }
  for (const key of DEPENDENCY_CALLBACK_KEYS) {
    const callback = dependencies[key];
    if (callback !== undefined && !isFunction(callback)) {
      throw new TypeError(`[PlusTable] dependencies.${key} 必须是函数。`);
    }
  }
}

function isSameProps(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  if (a === b) return true;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => Object.is(a[key], b[key]));
}

function isSameRules(a: CellRule[] | null, b: CellRule[] | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((rule, index) => rule === b[index]);
}

function isSameSignature(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

export interface DependencyDeps<T extends RowData = RowData> {
  /** 触发字段反向索引：字段名 → 声明依赖了该字段的叶子数据列（含被列设置隐藏的列） */
  triggerIndex: ComputedRef<ReadonlyMap<string, readonly ColumnNode<T>[]>>;
  setCellValue: SetCellValueCommand<T>;
}

interface DependencyCacheEntry<T extends RowData = RowData> {
  row: T;
  rowIndex: number;
  generation: number;
  /** 声明的 triggerFields 在本次计算时的取值 */
  signature: unknown[];
  state: DependencyState;
}

export function useDependencies<T extends RowData = RowData>(
  core: TableCoreContext<T>,
  deps: DependencyDeps<T>,
) {
  /**
   * rowKey → 联动代数。任何经写契约落到该行的字段写入都会推进代数，
   * 让该行已缓存的联动状态整体作废（覆盖回调读取了 triggerFields 之外同行字段的情况）。
   */
  const generations = new Map<string, number>();
  /** rowKey → colId → 上一次算出的联动状态及其签名 */
  const cache = new Map<string, Map<string, DependencyCacheEntry<T>>>();

  /** 行字段实际写入后调用，使该行联动缓存失效 */
  function bumpDependencyGeneration(rowKey: string): void {
    generations.set(rowKey, (generations.get(rowKey) ?? 0) + 1);
  }

  /** 数据行身份失效时调用：连同代数一起丢弃，新行不会命中旧行缓存。 */
  function invalidateDependencyRow(rowKey: string): void {
    generations.delete(rowKey);
    cache.delete(rowKey);
  }

  /** 列配置重建时调用：缓存按 colId 寻址，回调被换掉后同名列不能再复用旧结果。 */
  function clearDependencyCache(): void {
    generations.clear();
    cache.clear();
  }

  function makeApi(row: T, rowIndex: number, prop: string): DependencyApi<T> {
    return {
      row,
      rowIndex,
      prop,
      setValue: (targetProp, value) => {
        deps.setCellValue(row, rowIndex, targetProp, value);
      },
    };
  }

  /** 真正重算一次联动状态；返回值类型检查只在这里做，缓存命中时不重复付出。 */
  function computeState(
    row: T,
    rowIndex: number,
    column: PlusTableColumn<T>,
    previous: DependencyState | undefined,
  ): DependencyState {
    const dep = column.dependencies!;
    const api = makeApi(row, rowIndex, column.prop!);
    const disabled = dep.disabled?.(row, api);
    const required = dep.required?.(row, api);
    const rules = dep.rules?.(row, api);
    const componentProps = dep.componentProps?.(row, api);
    if (disabled !== undefined && !isBoolean(disabled)) {
      throw new TypeError('[PlusTable] dependencies.disabled 必须返回 boolean。');
    }
    if (required !== undefined && !isBoolean(required)) {
      throw new TypeError('[PlusTable] dependencies.required 必须返回 boolean。');
    }
    if (rules !== undefined && rules !== null && !Array.isArray(rules)) {
      throw new TypeError('[PlusTable] dependencies.rules 必须返回规则数组、null 或 undefined。');
    }
    if (componentProps !== undefined && !isPlainObject(componentProps)) {
      throw new TypeError('[PlusTable] dependencies.componentProps 必须返回普通对象或 undefined。');
    }

    const next: DependencyState = {
      disabled: disabled ?? false,
      required: required ?? false,
      rules: rules ?? null,
      componentProps: componentProps ?? EMPTY_PROPS,
    };
    if (!previous) return next;
    // 回调每次都返回新对象；等价时复用旧引用，编辑器 componentProps / 规则数组不因重算而抖动
    const sameRules = isSameRules(previous.rules, next.rules);
    const sameProps = isSameProps(previous.componentProps, next.componentProps);
    if (
      sameRules &&
      sameProps &&
      previous.disabled === next.disabled &&
      previous.required === next.required
    ) {
      return previous;
    }
    if (sameRules) next.rules = previous.rules;
    if (sameProps) next.componentProps = previous.componentProps;
    return next;
  }

  /**
   * 渲染 / 校验时取当前联动状态。
   *
   * 缓存签名 =（行对象 + 行下标 + 该行联动代数 + 声明的 triggerFields 取值）。
   * triggerFields 每次都从行上现读：既是签名，也让调用方的渲染副作用继续追踪这些
   * 字段的响应式变化——「只有 triggerFields 变动才影响本列」本就是 ColumnDependencies 的约定。
   */
  function getDependencyState(row: T, rowIndex: number, node: ColumnNode<T>): DependencyState {
    const column = node.column;
    const dep = column.dependencies;
    if (!dep) return EMPTY_STATE;
    const rowKey = core.getRowKey(row);
    const generation = generations.get(rowKey) ?? 0;
    const signature = dep.triggerFields.map((field) => row[field]);
    let rowCache = cache.get(rowKey);
    const cached = rowCache?.get(node.id);
    if (
      cached &&
      cached.row === row &&
      cached.rowIndex === rowIndex &&
      cached.generation === generation &&
      isSameSignature(cached.signature, signature)
    ) {
      return cached.state;
    }
    const state = computeState(row, rowIndex, column, cached?.state);
    if (!rowCache) {
      rowCache = new Map();
      cache.set(rowKey, rowCache);
    }
    rowCache.set(node.id, { row, rowIndex, generation, signature, state });
    return state;
  }

  /** 当前同步触发链中已处理的 rowKey -> props，防止 trigger 互相 setValue 造成死循环 */
  let chain: Map<string, Set<string>> | null = null;

  /** 字段提交后只广播给反向索引里声明了该字段的列，执行 trigger 副作用 */
  function notifyFieldChange(row: T, rowIndex: number, changedProp: string) {
    const dependents = deps.triggerIndex.value.get(changedProp);
    if (!dependents?.length) return;
    const rowKey = core.getRowKey(row);
    const isRoot = chain === null;
    if (isRoot) chain = new Map();
    let props = chain!.get(rowKey);
    if (!props) {
      props = new Set();
      chain!.set(rowKey, props);
    }
    if (props.has(changedProp)) return;
    props.add(changedProp);
    try {
      for (const node of dependents) {
        const dep = node.column.dependencies;
        if (!dep?.trigger) continue;
        dep.trigger(row, makeApi(row, rowIndex, node.column.prop!));
      }
    } finally {
      if (isRoot) chain = null;
    }
  }

  return {
    getDependencyState,
    notifyFieldChange,
    bumpDependencyGeneration,
    invalidateDependencyRow,
    clearDependencyCache,
  };
}
