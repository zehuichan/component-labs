import { computed, ref } from 'vue';
import { devWarn } from '../util';
import type { TableCoreContext, WriteRowFieldCommand } from './context';
import type { RowData } from '../table/defaults';

/** 撤销重做栈上限（组件内部常量，不对外暴露） */
const HISTORY_STACK_LIMIT = 50;

export interface HistoryChangeRecord {
  rowKey: string;
  prop: string;
  oldValue: unknown;
  newValue: unknown;
}

/** undo/redo 后实际生效的变更，带上现场解析出的行引用与下标，供外层 emit cell-change / markDirty */
export interface AppliedHistoryChange<T extends RowData = RowData> extends HistoryChangeRecord {
  row: T;
  rowIndex: number;
}

type HistoryEntry = HistoryChangeRecord[];

/**
 * 撤销重做栈。条目按 rowKey 寻址（不是 rowIndex）——insertRow/removeRow/moveRow
 * 或换页都会让数组下标错位，只有 rowKey 在行结构变化后仍能对回正确的行。
 *
 * 覆盖范围：仅单元格字段写入（含一次写值触发的联动级联，合并为同一原子单元）。
 * 行结构操作（insert / remove / move / duplicate）不入栈；remove 还会摘掉该行历史。
 */
export interface HistoryDeps<T extends RowData = RowData> {
  writeRowField: WriteRowFieldCommand<T>;
}

export function useHistory<T extends RowData = RowData>(
  core: TableCoreContext<T>,
  deps: HistoryDeps<T>,
) {
  const states = {
    undoStack: ref<HistoryEntry[]>([]),
    redoStack: ref<HistoryEntry[]>([]),
  };

  const canUndo = computed(() => enabled() && states.undoStack.value.length > 0);
  const canRedo = computed(() => enabled() && states.redoStack.value.length > 0);

  /** 入栈总次数（含已被上限挤掉的条目），供调用方标记一段区间后回滚该区间 */
  let pushCount = 0;
  /** 批次累积中的变更；非 null 期间 pushChange 只累积不入栈 */
  let batch: HistoryChangeRecord[] | null = null;

  function enabled(): boolean {
    return core.states.history.value;
  }

  function commitEntries(entries: HistoryEntry): void {
    if (entries.length === 0) return;
    pushCount += 1;
    states.undoStack.value.push(entries);
    if (states.undoStack.value.length > HISTORY_STACK_LIMIT) {
      states.undoStack.value.shift();
    }
    states.redoStack.value = [];
  }

  /** 记一条变更；row 模式一次提交可传多条，作为一个原子撤销单元 */
  function pushChange(change: HistoryChangeRecord | HistoryChangeRecord[]): void {
    if (!enabled()) return;
    const entries = Array.isArray(change) ? change : [change];
    if (entries.length === 0) return;
    if (batch) {
      batch.push(...entries);
      return;
    }
    commitEntries(entries);
  }

  /**
   * 把回调内的多次 pushChange 并成一个原子撤销单元：一次单元格写值连带其联动级联、
   * 一次行提交的多个字段，用户看到的都是一个动作，撤销也该是一步。
   * 嵌套调用并入外层批次；回调抛错时已累积的变更照样入栈，不让历史与行对象脱节。
   */
  function withHistoryBatch<R>(run: () => R): R {
    if (!enabled() || batch) return run();
    const collected: HistoryChangeRecord[] = [];
    batch = collected;
    try {
      return run();
    } finally {
      batch = null;
      commitEntries(collected);
    }
  }

  function getPushCount(): number {
    return pushCount;
  }

  /**
   * 丢弃最近 count 次入栈里属于该行的变更（row 模式取消编辑用）。
   * 入栈只追加在栈尾、超限时从栈首丢弃，所以「最近 count 次」就是栈尾的 count 条。
   */
  function dropRecentRowChanges(rowKey: string, count: number): void {
    if (count <= 0) return;
    const stack = states.undoStack.value;
    const from = Math.max(0, stack.length - count);
    const kept = stack
      .slice(from)
      .map((entries) => entries.filter((change) => change.rowKey !== rowKey))
      .filter((entries) => entries.length > 0);
    states.undoStack.value = [...stack.slice(0, from), ...kept];
  }

  /**
   * 行身份失效时 rowLifecycle 已把对应条目摘掉，这里再遇到找不到的 rowKey 属于状态不同步：
   * 跳过该条并告警，不让整批撤销 / 重做失败。
   * 只把真正写进去的变更算作已生效：值本就相同时不该让外层 emit 一次没发生的 cell-change。
   */
  function applyEntries(
    entries: HistoryEntry,
    direction: 'undo' | 'redo',
  ): AppliedHistoryChange<T>[] {
    const keysMap = core.states.keysMap.value;
    const applied: AppliedHistoryChange<T>[] = [];
    for (const change of entries) {
      const found = keysMap.get(change.rowKey);
      if (!found) {
        devWarn(
          `[PlusTable] ${direction === 'undo' ? '撤销' : '重做'}跳过：rowKey="${change.rowKey}" 对应的行已不存在。`,
        );
        continue;
      }
      const value = direction === 'undo' ? change.oldValue : change.newValue;
      if (!deps.writeRowField(found.row, change.prop, value).wrote) continue;
      applied.push({ ...change, row: found.row, rowIndex: found.rowIndex });
    }
    return applied;
  }

  function undo(): AppliedHistoryChange<T>[] {
    if (!enabled()) return [];
    const entries = states.undoStack.value.at(-1);
    if (!entries) return [];
    const applied = applyEntries(entries, 'undo');
    states.undoStack.value.pop();
    states.redoStack.value.push(entries);
    return applied;
  }

  function redo(): AppliedHistoryChange<T>[] {
    if (!enabled()) return [];
    const entries = states.redoStack.value.at(-1);
    if (!entries) return [];
    const applied = applyEntries(entries, 'redo');
    states.redoStack.value.pop();
    states.undoStack.value.push(entries);
    return applied;
  }

  function clearHistory(): void {
    states.undoStack.value = [];
    states.redoStack.value = [];
  }

  /** 数据行身份失效时调用：从 undo / redo 中移除该 rowKey 的变更，保留同批次其他行。 */
  function invalidateHistoryRow(rowKey: string): void {
    const filter = (stack: HistoryEntry[]) =>
      stack
        .map((entries) => entries.filter((change) => change.rowKey !== rowKey))
        .filter((entries) => entries.length > 0);
    states.undoStack.value = filter(states.undoStack.value);
    states.redoStack.value = filter(states.redoStack.value);
  }

  return {
    canUndo,
    canRedo,
    pushChange,
    withHistoryBatch,
    getPushCount,
    dropRecentRowChanges,
    undo,
    redo,
    clearHistory,
    invalidateHistoryRow,
    states,
  };
}

export type HistoryApi<T extends RowData = RowData> = Omit<
  ReturnType<typeof useHistory<T>>,
  'invalidateHistoryRow' | 'getPushCount' | 'dropRecentRowChanges'
>;
