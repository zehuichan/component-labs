/**
 * PlusTable 编辑器解析：从全局组件表取组件，叠本地 trigger / modelProp / componentProps。
 */
import { isFunction, isPlainObject, isString } from 'es-toolkit';
import type { Component } from 'vue';

import { useGlobalShareState, type ComponentType } from '@/adapter';

/** @deprecated 使用 ComponentType；保留别名以兼容既有导出 */
export type BuiltinEditorType = ComponentType;

export interface EditorAdapter {
  component: Component;
  /** 提交时机：blur=失焦提交（文本类）；change=变更即提交（选择类） */
  trigger: 'blur' | 'change';
}

/** 表格编辑提交时机（组件本身在 adapter/component 注册） */
export const EDITOR_TRIGGER = {
  checkbox: 'change',
  'date-picker': 'change',
  input: 'blur',
  'input-number': 'blur',
  select: 'change',
  switch: 'change',
  textarea: 'blur',
  'time-picker': 'change',
} as const satisfies Record<ComponentType, 'blur' | 'change'>;

/** 派生视图：组件来自全局表，trigger 本地 */
export function getEditorRegistry(): Record<ComponentType, EditorAdapter> {
  const components = useGlobalShareState().getComponents();
  const result = {} as Record<ComponentType, EditorAdapter>;
  for (const key of Object.keys(EDITOR_TRIGGER) as ComponentType[]) {
    const component = components[key];
    if (component) {
      result[key] = { component, trigger: EDITOR_TRIGGER[key] };
    }
  }
  return result;
}

/** 兼容旧名：惰性代理到 getEditorRegistry() */
export const EDITOR_REGISTRY = new Proxy({} as Record<ComponentType, EditorAdapter>, {
  get(_target, prop: string | symbol) {
    if (typeof prop !== 'string') return undefined;
    return getEditorRegistry()[prop as ComponentType];
  },
  has(_target, prop: string | symbol) {
    if (typeof prop !== 'string') return false;
    return Object.hasOwn(useGlobalShareState().getComponents(), prop);
  },
  ownKeys() {
    return Object.keys(useGlobalShareState().getComponents());
  },
  getOwnPropertyDescriptor(_target, prop) {
    if (typeof prop !== 'string' || !Object.hasOwn(useGlobalShareState().getComponents(), prop)) {
      return undefined;
    }
    return {
      enumerable: true,
      configurable: true,
      value: getEditorRegistry()[prop as ComponentType],
    };
  },
});

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
  trigger: 'blur' | 'change';
  modelProp: string;
}

function isComponentType(name: string): name is ComponentType {
  return Object.hasOwn(EDITOR_TRIGGER, name);
}

/**
 * 与 vben FormField 一致：string → 查全局组件表；否则直接当自定义组件。
 */
function resolveComponent(
  component: ColumnComponent | undefined,
  modelProp = 'modelValue',
): Pick<ResolvedEditor, 'component' | 'trigger' | 'modelProp'> {
  if (component === undefined || isString(component)) {
    const name: ComponentType = isString(component) ? (component as ComponentType) : 'input';
    if (isString(component) && !isComponentType(component)) {
      throw new TypeError(`[adapter] 未知的 component="${component}"。`);
    }
    const registered = useGlobalShareState().getComponents()[name];
    if (!registered) {
      throw new TypeError(`[adapter] 组件 "${name}" 尚未注册，请先调用 initComponentAdapter()。`);
    }
    return {
      component: registered,
      trigger: EDITOR_TRIGGER[name],
      modelProp,
    };
  }
  return { component, trigger: 'blur', modelProp };
}

/** 把 component / componentProps 归一化为可直接渲染的描述 */
export function resolveEditor<T extends RowData = RowData>(
  fields: EditorColumnFields<T> | undefined,
  ctx: RowContext<T>,
): ResolvedEditor {
  const base = resolveComponent(fields?.component, fields?.modelProp ?? 'modelValue');
  const configProps = fields?.componentProps;
  const resolvedProps = isFunction(configProps) ? configProps(ctx) : configProps;
  if (resolvedProps !== undefined && !isPlainObject(resolvedProps)) {
    throw new TypeError(
      '[adapter] componentProps 必须是普通对象，函数式 componentProps 也必须返回普通对象。',
    );
  }
  return {
    component: base.component,
    componentProps: { ...(resolvedProps ?? {}) },
    trigger: base.trigger,
    modelProp: base.modelProp,
  };
}

/**
 * 「选中即输入」时把首个可打印字符转换为编辑器草稿。
 * 返回 undefined 表示该编辑器不种入字符，仅进入编辑态。
 */
export function typedCharToDraft<T extends RowData = RowData>(
  fields: EditorColumnFields<T> | undefined,
  char: string,
): unknown {
  const { component } = resolveComponent(fields?.component);
  const components = useGlobalShareState().getComponents();
  if (component === components.input) return char;
  if (component === components['input-number']) {
    return /^[0-9]$/.test(char) ? Number(char) : undefined;
  }
  return undefined;
}
