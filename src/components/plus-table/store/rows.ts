import { clamp, cloneDeep } from 'es-toolkit';
import { getCurrentInstance } from 'vue';
import { getRowIdentity, devWarn } from '../util';
import type { TableCoreContext } from './context';
import type { RowData } from '../table/defaults';

/** 行结构操作：全部以新数组经 update:data 回传，父级是唯一数据源 */
export function useRows<T extends RowData = RowData>(core: TableCoreContext<T>) {
  const data = () => core.states.data.value;
  /** setup 期抓一次实例，供运行期判断是否挂了 update:data 监听 */
  const instance = getCurrentInstance();

  function resolveRowKey(row: T): string {
    return getRowIdentity(row, core.states.rowKey.value);
  }

  /** 现有行的 rowKey 已由 core.states.keysMap 建好索引，查重直接命中，不必再全表重算身份。 */
  function assertUniqueRowKey(row: T): void {
    const key = resolveRowKey(row);
    if (core.states.keysMap.value.has(key)) {
      throw new Error(`[PlusTable] insertRow 失败：rowKey="${key}" 已存在，不能插入重复行。`);
    }
  }

  /**
   * 分页场景下 states.data 只是当前页切片：结构操作发出的数组不含其它页，
   * 父级若直接 v-model:data 会丢掉全量。开发期提醒业务改走自管数据源。
   */
  function warnPaginatedStructuralOp(op: string): void {
    if (core.host.props.total === undefined) return;
    devWarn(
      `[PlusTable] ${op} 在分页（props.total 有值）下发出的是当前页数据切片，` +
        '不是全量列表；请在业务侧维护完整数据源，或勿把本次 update:data 直接写回全量 v-model。',
    );
  }

  /** 没有人听 update:data 时结构操作对外是空操作，却仍返回成功值，开发期点破。 */
  function warnMissingUpdateListener(op: string): void {
    const props = instance?.vnode.props;
    if (!props) return;
    if (props['onUpdate:data'] != null) return;
    devWarn(
      `[PlusTable] ${op} 已 emit('update:data')，但当前没有监听者：` +
        '行结构不会落回父级数据源，操作看起来像成功实际无效果。请绑定 v-model:data 或 @update:data。',
    );
  }

  function emitData(list: T[], op: string): void {
    warnPaginatedStructuralOp(op);
    warnMissingUpdateListener(op);
    core.host.emit('update:data', list);
  }

  function insertRow(row: T, index?: number): T {
    assertUniqueRowKey(row);
    const list = [...data()];
    const at = index === undefined ? list.length : clamp(index, 0, list.length);
    list.splice(at, 0, row);
    emitData(list, 'insertRow');
    return row;
  }

  function removeRow(index: number): T | undefined {
    const list = [...data()];
    if (!Number.isInteger(index) || index < 0 || index >= list.length) {
      return undefined;
    }
    const [removed] = list.splice(index, 1);
    emitData(list, 'removeRow');
    return removed;
  }

  function moveRow(from: number, to: number): boolean {
    const list = [...data()];
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 0 ||
      from >= list.length ||
      to < 0 ||
      to >= list.length ||
      from === to
    ) {
      return false;
    }
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved!);
    emitData(list, 'moveRow');
    return true;
  }

  /**
   * 复制行并插到原行之后。
   * patch 必须让实际解析出的 rowKey 唯一，否则拒绝插入。
   */
  function duplicateRow(index: number, patch: Partial<T>): T | undefined {
    const source = data()[index];
    if (!Number.isInteger(index) || !source) return undefined;
    const clone = Object.assign(cloneDeep(source), patch);
    return insertRow(clone, index + 1);
  }

  return {
    insertRow,
    removeRow,
    moveRow,
    duplicateRow,
  };
}
