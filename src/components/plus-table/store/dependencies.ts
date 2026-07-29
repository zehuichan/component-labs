import { computed, shallowRef } from 'vue';
import { isBoolean, isFunction, isPlainObject, isString } from 'es-toolkit';
import { isSpecialColumn } from '../util';
import type { ComputedRef, ShallowRef } from 'vue';
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

export interface DependencyDeps<T extends RowData = RowData> {
  /** 触发字段反向索引：字段名 → 声明依赖了该字段的叶子数据列（含被列设置隐藏的列） */
  triggerIndex: ComputedRef<ReadonlyMap<string, readonly ColumnNode<T>[]>>;
  setCellValue: SetCellValueCommand<T>;
}

export function useDependencies<T extends RowData = RowData>(
  core: TableCoreContext<T>,
  deps: DependencyDeps<T>,
) {
  /**
   * rowKey → 联动代数。任何经写契约落到该行的字段写入都会推进代数，
   * 让该行已缓存的联动状态整体作废（覆盖回调读取了 triggerFields 之外同行字段的情况，
   * 以及父级传入非响应式行对象、字段写入本身不产生依赖通知的情况）。
   */
  const generations = new Map<string, ShallowRef<number>>();
  /**
   * rowKey → colId → 该格联动状态的 computed。
   *
   * 缓存的是 computed 而不是算好的值：回调是业务侧任意函数，除 triggerFields 外还可能读
   * 别的响应式源（下拉选项 ref、另一行数据等）。由 computed 自己持有依赖集，渲染副作用与
   * 异步校验谁先访问都能拿到正确追踪的结果，不会出现「先算的那一方决定了谁能收到更新」。
   */
  const cache = new Map<string, Map<string, ComputedRef<DependencyState>>>();

  function generationRef(rowKey: string): ShallowRef<number> {
    let generation = generations.get(rowKey);
    if (!generation) {
      generation = shallowRef(0);
      generations.set(rowKey, generation);
    }
    return generation;
  }

  /** 行字段实际写入后调用，使该行联动缓存失效 */
  function bumpDependencyGeneration(rowKey: string): void {
    generationRef(rowKey).value += 1;
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
   * 条目只按 (rowKey, colId) 建一次：行对象与行下标在 computed 内部按 rowKey 现查，
   * 换页 / 重排不必重建 computed，也不会把旧行引用留在缓存里。
   */
  function getDependencyState(row: T, rowIndex: number, node: ColumnNode<T>): DependencyState {
    const column = node.column;
    if (!column.dependencies) return EMPTY_STATE;
    const rowKey = core.getRowKey(row);
    // 游离行引用（已被移出当前数据）直接算一次即返回：不建缓存，免得同 rowKey 的新行命中旧结果
    const resident = core.states.keysMap.value.get(rowKey);
    if (resident?.row !== row) return computeState(row, rowIndex, column, undefined);

    let rowCache = cache.get(rowKey);
    let state = rowCache?.get(node.id);
    if (!state) {
      const generation = generationRef(rowKey);
      state = computed<DependencyState>((previous) => {
        void generation.value;
        const location = core.states.keysMap.value.get(rowKey);
        if (!location) return EMPTY_STATE;
        return computeState(location.row, location.rowIndex, column, previous);
      });
      if (!rowCache) {
        rowCache = new Map();
        cache.set(rowKey, rowCache);
      }
      rowCache.set(node.id, state);
    }
    return state.value;
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
