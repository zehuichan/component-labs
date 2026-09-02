/**
 * PlusTable 编辑器解析：从全局组件表取组件，叠本地 trigger / modelProp / componentProps。
 */
import { isFunction, isPlainObject, isString } from 'es-toolkit';
import type { Component } from 'vue';

import { useGlobalShareState, type ComponentType } from '@/adapter';

/** 提交时机：blur=失焦提交（文本类）；change=变更即提交（选择类） */
export type EditorTrigger = 'blur' | 'change';

/** 内置编辑器的提交时机（组件本身在 adapter/component 注册） */
const EDITOR_TRIGGER = {
  checkbox: 'change',
  'date-picker': 'change',
  input: 'blur',
  'input-number': 'blur',
  select: 'change',
  switch: 'change',
  textarea: 'blur',
  'time-picker': 'change',
} as const satisfies Record<ComponentType, EditorTrigger>;

/** 通用行数据；与 PlusTable RowData 结构对齐 */
type RowData = Record<string, any>;

/** 编辑器解析上下文；与 PlusTable RowContext 结构对齐 */
interface RowContext<T extends RowData = RowData> {
  row: T;
  rowIndex: number;
}

/** 编辑控件：内置标识或自定义 Vue 组件 */
export type ColumnComponent = ComponentType | Component;

export interface EditorColumnFields<T extends RowData = RowData> {
  /**
   * 编辑控件；editable 且未配置时默认 input。
   * 内置标识见 ComponentType，或传入自定义 Vue 组件。
   */
  component?: ColumnComponent;
  /** 透传给编辑控件的 props；dependencies.componentProps 覆盖同名项 */
  componentProps?: Record<string, unknown> | ((ctx: RowContext<T>) => Record<string, unknown>);
  /** 自定义组件的 v-model prop 名，默认 modelValue */
  modelProp?: string;
}

export interface ResolvedEditor {
  component: Component;
  /** 列 componentProps（包装层默认 props 已在 adapter/component 内）；
   * dependencies.componentProps 覆盖同名项由渲染层负责，不在此处合并 */
  componentProps: Record<string, unknown>;
  trigger: EditorTrigger;
  modelProp: string;
}

function isComponentType(name: string): name is ComponentType {
  return Object.hasOwn(EDITOR_TRIGGER, name);
}

/** 与 vben FormField 一致：string → 查全局组件表，未注册 / 未知名称直接报错。 */
function resolveBuiltin(name: string): Component {
  if (!isComponentType(name)) {
    throw new TypeError(`[adapter] 未知的 component="${name}"。`);
  }
  const registered = useGlobalShareState().getComponents()[name];
  if (!registered) {
    throw new TypeError(`[adapter] 组件 "${name}" 尚未注册，请先调用 initComponentAdapter()。`);
  }
  return registered;
}

/** 把 component / componentProps 归一化为可直接渲染的描述 */
export function resolveEditor<T extends RowData = RowData>(
  fields: EditorColumnFields<T> | undefined,
  ctx: RowContext<T>,
): ResolvedEditor {
  const component = fields?.component ?? 'input';
  const configProps = fields?.componentProps;
  const resolvedProps = isFunction(configProps) ? configProps(ctx) : configProps;
  if (resolvedProps !== undefined && !isPlainObject(resolvedProps)) {
    throw new TypeError(
      '[adapter] componentProps 必须是普通对象，函数式 componentProps 也必须返回普通对象。',
    );
  }
  const modelProp = fields?.modelProp ?? 'modelValue';
  const componentProps = { ...resolvedProps };
  if (isString(component)) {
    const builtin = resolveBuiltin(component);
    return { component: builtin, componentProps, trigger: EDITOR_TRIGGER[component], modelProp };
  }
  return { component, componentProps, trigger: 'blur', modelProp };
}

/**
 * 「选中即输入」时把首个可打印字符转换为编辑器草稿。
 * 返回 undefined 表示该编辑器不种入字符，仅进入编辑态。
 */
export function typedCharToDraft<T extends RowData = RowData>(
  fields: EditorColumnFields<T> | undefined,
  char: string,
): unknown {
  const component = fields?.component ?? 'input';
  if (component === 'input') return char;
  if (component === 'input-number') return /^[0-9]$/.test(char) ? Number(char) : undefined;
  return undefined;
}
