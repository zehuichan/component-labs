import { reactive } from 'vue';
import Schema from 'async-validator';
import { isString } from 'es-toolkit';
import { devWarn } from '../util';
import type { ComputedRef } from 'vue';
import type { ValidateError } from 'async-validator';
import type { TableCoreContext } from './context';
import type { DependencyState } from './dependencies';
import type { CellError, CellRule, RowData, ValidateResult } from '../table/defaults';
import type { ColumnNode } from '../table-column/defaults';

const staleValidation = Symbol('stale-validation');
type CellValidationResult = CellError | null | typeof staleValidation;

/** 全表校验的并发上限：行之间互不依赖，串行只会把 IO 型规则的耗时线性叠加 */
const VALIDATE_ROW_CONCURRENCY = 4;

/** 单行重校验被更新的输入连续抢占的次数上限，超过即放弃重试，避免死循环 */
const MAX_STALE_RETRIES = 5;

/** 排在所有可见列之后：被列设置隐藏的列没有 colIndex，错误汇总里沉底 */
const HIDDEN_COL_INDEX = Number.MAX_SAFE_INTEGER;

/** 纯静态规则的 Schema 缓存条目；signature 变化即说明列配置被换过，需要重建 */
interface StaticSchemaEntry {
  signature: readonly unknown[];
  schema: Schema;
}

interface CellRuleBuild {
  rules: CellRule[];
  /** 联动没有追加 required / rules 时，这批规则完全由列静态配置决定，Schema 可缓存复用 */
  isStatic: boolean;
  signature: unknown[];
}

function isSameSignature(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

export interface ValidationDeps<T extends RowData = RowData> {
  /** 归一化后的全部叶子数据列；隐藏列同样参与校验 */
  allColumns: ComputedRef<ColumnNode<T>[]>;
  /** 当前可见叶子列，仅用于把首个错误滚动到视野内 */
  columns: ComputedRef<ColumnNode<T>[]>;
  getColumnsByProp: (prop: string) => readonly ColumnNode<T>[];
  getDependencyState: (row: T, rowIndex: number, node: ColumnNode<T>) => DependencyState;
  setCurrentCell: (rowIndex: number, colIndex: number, scroll?: boolean) => void;
}

export function useValidation<T extends RowData = RowData>(
  core: TableCoreContext<T>,
  deps: ValidationDeps<T>,
) {
  /** rowKey -> prop -> 单元格错误 */
  const errors = reactive(new Map<string, Map<string, CellError>>());

  /** rowKey -> prop -> 最新一次发起校验的版本号；异步 resolve 时非最新版本的结果直接丢弃，避免旧结果覆盖新结果。 */
  const versions = new Map<string, Map<string, number>>();
  /** 全局单调递增，行版本表清除后也不会复用旧校验的版本号。 */
  let nextVersion = 0;
  const rowValidationTails = new WeakMap<T, Promise<void>>();

  function bumpVersion(rowKey: string, prop: string): number {
    let propVersions = versions.get(rowKey);
    if (!propVersions) {
      propVersions = new Map();
      versions.set(rowKey, propVersions);
    }
    const next = ++nextVersion;
    propVersions.set(prop, next);
    return next;
  }

  function isLatestVersion(rowKey: string, prop: string, version: number): boolean {
    return versions.get(rowKey)?.get(prop) === version;
  }

  function setCellError(error: CellError): void {
    let rowErrors = errors.get(error.rowKey);
    if (!rowErrors) {
      rowErrors = reactive(new Map<string, CellError>());
      errors.set(error.rowKey, rowErrors);
    }
    rowErrors.set(error.prop, error);
  }

  function deleteCellError(rowKey: string, prop: string): void {
    const rowErrors = errors.get(rowKey);
    if (!rowErrors?.delete(prop)) return;
    if (rowErrors.size === 0) errors.delete(rowKey);
  }

  function getCellError(row: T, prop: string): CellError | undefined {
    return errors.get(core.getRowKey(row))?.get(prop);
  }

  /** prop → 首个可导航（可见）叶子列的下标；隐藏列的字段不在表里 */
  function getVisibleColIndexes(): Map<string, number> {
    const colIndexes = new Map<string, number>();
    deps.columns.value.forEach((node: ColumnNode<T>, colIndex: number) => {
      const prop = node.column.prop;
      if (prop && !colIndexes.has(prop)) colIndexes.set(prop, colIndex);
    });
    return colIndexes;
  }

  /**
   * 只读访问器：供业务侧渲染自定义错误汇总面板。
   * 按视觉顺序（行下标 → 列下标）返回，错误列表与用户在表格里看到的从上到下、
   * 从左到右一致；首个元素就是 validate() 要滚过去的那一格。
   */
  function getErrors(): CellError[] {
    const colIndexes = getVisibleColIndexes();
    const result: CellError[] = [];
    for (const rowErrors of errors.values()) {
      result.push(...rowErrors.values());
    }
    const colIndexOf = (error: CellError) => colIndexes.get(error.prop) ?? HIDDEN_COL_INDEX;
    return result.sort(
      (a, b) =>
        a.rowIndex - b.rowIndex || colIndexOf(a) - colIndexOf(b) || a.prop.localeCompare(b.prop),
    );
  }

  /** prop → 纯静态规则的 Schema */
  const staticSchemas = new Map<string, StaticSchemaEntry>();

  function buildCellRules(
    row: T,
    rowIndex: number,
    nodes: readonly ColumnNode<T>[],
  ): CellRuleBuild {
    const rules: CellRule[] = [];
    const signature: unknown[] = [];
    let isStatic = true;
    for (const node of nodes) {
      const column = node.column;
      const depState = deps.getDependencyState(row, rowIndex, node);
      const dynamicRules = depState.rules?.length ? depState.rules : null;
      if (depState.required || dynamicRules) isStatic = false;
      if (column.required || depState.required) {
        rules.push({
          required: true,
          message: `${column.label ?? column.prop}不能为空`,
        });
      }
      if (column.rules?.length) rules.push(...column.rules);
      if (dynamicRules) rules.push(...dynamicRules);
      signature.push(node.id, column.required, column.label, column.rules);
    }
    return { rules, isStatic, signature };
  }

  /**
   * 规则全部来自列静态配置时复用同一个 Schema：Schema 构造要把规则展开成校验器链，
   * 而静态列配置在 props.columns 不变期间产出的规则完全一致。联动追加了 required /
   * rules 的单元格逐行不同，仍每次新建。
   */
  function getSchema(prop: string, build: CellRuleBuild): Schema {
    if (!build.isStatic) return new Schema({ [prop]: build.rules });
    const cached = staticSchemas.get(prop);
    if (cached && isSameSignature(cached.signature, build.signature)) return cached.schema;
    const schema = new Schema({ [prop]: build.rules });
    staticSchemas.set(prop, { signature: build.signature, schema });
    return schema;
  }

  async function validateCellNodes(
    row: T,
    rowIndex: number,
    nodes: readonly ColumnNode<T>[],
  ): Promise<CellValidationResult> {
    const prop = nodes[0]?.column.prop;
    if (!prop) return null;
    const rowKey = core.getRowKey(row);
    const version = bumpVersion(rowKey, prop);
    const build = buildCellRules(row, rowIndex, nodes);

    /** 非最新版本（被后一次输入触发的校验抢先）或该行已被移除时，结果作废；否则返回校验时行的最新下标 */
    const resolveCurrentRowIndex = (): number | null | typeof staleValidation => {
      if (!isLatestVersion(rowKey, prop, version)) return staleValidation;
      const location = core.states.keysMap.value.get(rowKey);
      return location?.row === row ? location.rowIndex : null;
    };

    if (!build.rules.length) {
      deleteCellError(rowKey, prop);
      return null;
    }
    try {
      // source 传整行，规则中的自定义 validator 可做跨字段校验。
      await getSchema(prop, build).validate(row, {
        first: true,
        suppressWarning: true,
        suppressValidatorError: true,
      });
      const currentIndex = resolveCurrentRowIndex();
      if (currentIndex === staleValidation) return staleValidation;
      if (currentIndex === null) return null;
      deleteCellError(rowKey, prop);
      return null;
    } catch (err) {
      const currentIndex = resolveCurrentRowIndex();
      if (currentIndex === staleValidation) return staleValidation;
      if (currentIndex === null) return null;
      const validateErrors = (err as { errors?: ValidateError[] })?.errors;
      const message = validateErrors?.[0]?.message;
      if (!isString(message)) throw err;
      const cellError: CellError = {
        rowKey,
        rowIndex: currentIndex,
        prop,
        message,
      };
      setCellError(cellError);
      return cellError;
    }
  }

  async function validateCell(row: T, rowIndex: number, prop: string): Promise<CellError | null> {
    if (!Number.isInteger(rowIndex) || core.states.data.value[rowIndex] !== row) {
      throw new RangeError(`[PlusTable] validateCell 失败：第 ${rowIndex} 行与当前数据不匹配。`);
    }
    const nodes = deps.getColumnsByProp(prop);
    if (!nodes.length) return null;
    const result = await validateCellNodes(row, rowIndex, nodes);
    return result === staleValidation ? null : result;
  }

  /**
   * 整行校验。行内某格在校验期间又被编辑（结果作废）时重来一轮，取一份自洽的行结果；
   * 持续被抢占说明输入一直没停，重试到上限就带着已拿到的错误返回，不再空转。
   */
  async function validateStableRow(row: T): Promise<CellError[]> {
    let results: CellValidationResult[] = [];
    for (let attempt = 0; attempt <= MAX_STALE_RETRIES; attempt++) {
      const currentIndex = core.states.keysMap.value.get(core.getRowKey(row))?.rowIndex;
      if (currentIndex === undefined || core.states.data.value[currentIndex] !== row) {
        return [];
      }
      const props = new Set(
        deps.allColumns.value
          .map((node: ColumnNode<T>) => node.column.prop)
          .filter((prop): prop is string => !!prop),
      );
      results = await Promise.all(
        [...props].map((prop) => validateCellNodes(row, currentIndex, deps.getColumnsByProp(prop))),
      );
      if (!results.includes(staleValidation)) {
        return results.filter((result): result is CellError => result !== null);
      }
    }
    devWarn(
      `[PlusTable] 行校验连续 ${MAX_STALE_RETRIES + 1} 次被更新的输入抢占，已放弃重试；` +
        '本次结果可能不完整，后续编辑会重新触发校验。',
    );
    return results.filter(
      (result): result is CellError => result !== null && result !== staleValidation,
    );
  }

  async function validateRow(rowIndex: number): Promise<CellError[]> {
    if (!Number.isInteger(rowIndex)) {
      throw new RangeError(`[PlusTable] validateRow 失败：行下标 ${rowIndex} 不是整数。`);
    }
    const row = core.states.data.value[rowIndex];
    if (!row) {
      throw new RangeError(`[PlusTable] validateRow 失败：行下标 ${rowIndex} 超出有效范围。`);
    }

    const previous = rowValidationTails.get(row);
    const operation = (async () => {
      if (previous) await previous;
      return validateStableRow(row);
    })();
    const tail = operation.then(
      () => undefined,
      () => undefined,
    );
    rowValidationTails.set(row, tail);
    void tail.then(() => {
      if (rowValidationTails.get(row) === tail) rowValidationTails.delete(row);
    });
    return operation;
  }

  /**
   * 全表校验；默认滚动并激活到视觉上的首个错误格（错误列被列设置隐藏时找不到 colIndex，跳过滚动）。
   * 行之间没有先后依赖，用固定大小的协程池并发跑，异步规则不再逐行排队。
   */
  async function validate(scrollToFirstError = true): Promise<ValidateResult> {
    const rows = [...core.states.data.value];
    let cursor = 0;
    const runWorker = async (): Promise<void> => {
      while (cursor < rows.length) {
        const row = rows[cursor++]!;
        const rowKey = core.getRowKey(row);
        const current = core.states.keysMap.value.get(rowKey);
        if (current?.row === row) await validateRow(current.rowIndex);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(VALIDATE_ROW_CONCURRENCY, rows.length) }, runWorker),
    );

    const canonicalErrors = getErrors();
    if (scrollToFirstError && canonicalErrors.length) {
      const first = canonicalErrors[0]!;
      const colIndex = getVisibleColIndexes().get(first.prop);
      if (colIndex !== undefined) deps.setCurrentCell(first.rowIndex, colIndex);
    }
    return { valid: canonicalErrors.length === 0, errors: canonicalErrors };
  }

  function clearValidate(): void {
    errors.clear();
    versions.clear();
  }

  /** 数据行身份失效时调用：清错误与版本表，使该行所有在飞校验结果作废。 */
  function invalidateValidationRow(rowKey: string): void {
    errors.delete(rowKey);
    versions.delete(rowKey);
  }

  function invalidateColumnProps(props: Iterable<string>): void {
    const removed = new Set(props);
    if (!removed.size) return;
    for (const prop of removed) staticSchemas.delete(prop);
    for (const [rowKey, rowErrors] of errors) {
      for (const prop of removed) rowErrors.delete(prop);
      if (!rowErrors.size) errors.delete(rowKey);
    }
    for (const [rowKey, propVersions] of versions) {
      for (const prop of removed) propVersions.delete(prop);
      if (!propVersions.size) versions.delete(rowKey);
    }
  }

  function clearRowValidate(row: T): void {
    invalidateValidationRow(core.getRowKey(row));
  }

  /** 行顺序变化后，只重算仍存续错误的公开 rowIndex；身份失效由统一行生命周期先行清理。 */
  function reindexValidationErrors(): void {
    const keysMap = core.states.keysMap.value;
    for (const [rowKey, rowErrors] of errors) {
      const rowIndex = keysMap.get(rowKey)?.rowIndex;
      if (rowIndex === undefined) continue;
      for (const [prop, error] of rowErrors) {
        if (error.rowIndex !== rowIndex) {
          rowErrors.set(prop, { ...error, rowIndex });
        }
      }
    }
  }

  return {
    getCellError,
    getErrors,
    validateCell,
    validateRow,
    validate,
    clearValidate,
    clearRowValidate,
    invalidateValidationRow,
    invalidateColumnProps,
    reindexValidationErrors,
  };
}
