import { isFunction } from 'es-toolkit';
import type { Ref } from 'vue';

/**
 * PlusTable 自身的 API 优先，其余成员透传给内部 ElTable。
 * 返回类型里 ElTable 部分是 Partial：ElTable 挂载前透传成员一律是 undefined，
 * 调用方要么等挂载后再用，要么走可选调用。
 */
export function createTableExpose<Local extends object, Table extends object>(
  local: Local,
  tableRef: Readonly<Ref<Table | undefined>>,
): Local & Partial<Table> {
  type Method = (...args: unknown[]) => unknown;
  let boundTable: Table | undefined;
  const boundMethods = new Map<PropertyKey, { source: Method; bound: Method }>();

  return new Proxy(local, {
    get(target, property, receiver) {
      if (Reflect.has(target, property)) {
        return Reflect.get(target, property, receiver);
      }
      const table = tableRef.value;
      if (!table) return undefined;
      if (table !== boundTable) {
        boundTable = table;
        boundMethods.clear();
      }
      const value = Reflect.get(table, property, table);
      if (!isFunction(value)) return value;
      const source = value as Method;
      const cached = boundMethods.get(property);
      if (cached?.source === source) return cached.bound;
      const bound = source.bind(table);
      boundMethods.set(property, { source, bound });
      return bound;
    },
    has(target, property) {
      return (
        Reflect.has(target, property) || (!!tableRef.value && Reflect.has(tableRef.value, property))
      );
    },
  }) as Local & Partial<Table>;
}
