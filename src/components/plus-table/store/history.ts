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

  function enabled(): boolean {
    return core.states.history.value;
  }

  /** 记一条变更；row 模式一次提交可传多条，作为一个原子撤销单元 */
  function pushChange(change: HistoryChangeRecord | HistoryChangeRecord[]): void {
    if (!enabled()) return;
    const entries = Array.isArray(change) ? change : [change];
    if (entries.length === 0) return;
    states.undoStack.value.push(entries);
    if (states.undoStack.value.length > HISTORY_STACK_LIMIT) {
      states.undoStack.value.shift();
    }
    states.redoStack.value = [];
  }

  /**
   * 行身份失效时 rowLifecycle 已把对应条目摘掉，这里再遇到找不到的 rowKey 属于状态不同步：
   * 跳过该条并告警，不让整批撤销 / 重做失败。
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
      deps.writeRowField(found.row, change.prop, value);
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
    undo,
    redo,
    clearHistory,
    invalidateHistoryRow,
    states,
  };
}

export type HistoryApi<T extends RowData = RowData> = Omit<
  ReturnType<typeof useHistory<T>>,
  'invalidateHistoryRow'
>;
