import { toRaw } from 'vue';
import { getRowIdentity } from '../utils';
import type { RowData, RowKey } from '../types';

export interface WriteRowFieldResult {
  wrote: boolean;
  oldValue: unknown;
}

interface WriteRowFieldOptions<T extends RowData> {
  rowKey: string;
  rowKeyOption: RowKey<T>;
}

function findDescriptor(target: object, prop: string): PropertyDescriptor | undefined {
  let owner: object | null = target;
  while (owner) {
    const descriptor = Object.getOwnPropertyDescriptor(owner, prop);
    if (descriptor) return descriptor;
    owner = Object.getPrototypeOf(owner);
  }
  return undefined;
}

/**
 * 字符串 rowKey 且身份字段本身是数据属性时，写其它字段不可能改变身份，可跳过克隆探测；
 * 函数式 rowKey 或访问器身份字段（如 get id() { return this.code }）仍必须实探。
 */
function hasPlainRowKeyField<T extends RowData>(raw: object, rowKeyOption: RowKey<T>): boolean {
  if (typeof rowKeyOption !== 'string') return false;
  const descriptor = findDescriptor(raw, rowKeyOption);
  return !!descriptor && 'value' in descriptor;
}

function cloneCandidate<T extends RowData>(raw: object, omitProp?: string): T {
  const descriptors = Object.getOwnPropertyDescriptors(raw) as Record<
    PropertyKey,
    PropertyDescriptor
  >;
  if (omitProp !== undefined) delete descriptors[omitProp];
  return Object.create(Object.getPrototypeOf(raw), descriptors) as T;
}

function assertNotRowKeyField<T extends RowData>(
  action: string,
  verb: string,
  prop: string,
  rowKeyOption: RowKey<T>,
): void {
  if (typeof rowKeyOption === 'string' && prop === rowKeyOption) {
    throw new Error(
      `[PlusTable] ${action} 失败：${verb}字段 "${prop}" 会改变稳定 rowKey，不可修改。`,
    );
  }
}

/**
 * 唯一字段写入点：就地修改行对象，并在写入前校验不会破坏稳定 rowKey。
 * 行必须是可写的普通对象；访问器字段的 setter 可能间接改写身份，一律拒绝。
 */
export function writeRowField<T extends RowData>(
  row: T,
  prop: string,
  value: unknown,
  options: WriteRowFieldOptions<T>,
): WriteRowFieldResult {
  const oldValue = row[prop];
  if (Object.is(oldValue, value)) {
    return { wrote: false, oldValue };
  }

  const { rowKey, rowKeyOption } = options;
  assertNotRowKeyField('writeRowField', '写入', prop, rowKeyOption);

  const raw = toRaw(row);
  const descriptor = findDescriptor(raw, prop);
  if (descriptor && !('value' in descriptor)) {
    throw new Error(
      `[PlusTable] writeRowField 失败：访问器字段 "${prop}" 可能改变稳定 rowKey，不可修改。`,
    );
  }
  if (!hasPlainRowKeyField(raw, rowKeyOption)) {
    const candidate = cloneCandidate<T>(raw);
    Reflect.set(candidate, prop, value);
    if (getRowIdentity(candidate, rowKeyOption) !== rowKey) {
      throw new Error(
        `[PlusTable] writeRowField 失败：写入字段 "${prop}" 会改变稳定 rowKey，不可修改。`,
      );
    }
  }

  (row as RowData)[prop] = value;
  return { wrote: true, oldValue };
}

/**
 * 删除行上多余字段时同样校验不会破坏 rowKey。
 * 用于 cancelRowEdit 按快照回滚时去掉快照中不存在的键。
 */
export function deleteRowField<T extends RowData>(
  row: T,
  prop: string,
  options: WriteRowFieldOptions<T>,
): WriteRowFieldResult {
  if (!(prop in row)) {
    return { wrote: false, oldValue: undefined };
  }
  const oldValue = row[prop];
  const { rowKey, rowKeyOption } = options;
  assertNotRowKeyField('deleteRowField', '删除', prop, rowKeyOption);

  const raw = toRaw(row);
  if (!hasPlainRowKeyField(raw, rowKeyOption)) {
    const candidate = cloneCandidate<T>(raw, prop);
    if (getRowIdentity(candidate, rowKeyOption) !== rowKey) {
      throw new Error(
        `[PlusTable] deleteRowField 失败：删除字段 "${prop}" 会改变稳定 rowKey，不可修改。`,
      );
    }
  }
  delete (row as RowData)[prop];
  return { wrote: true, oldValue };
}
