/**
 * 通用组件适配层：把 Element Plus 组件注册到全局共享状态，
 * 供 Filters、PlusTable、后续 Form 等共用。
 */

import type {
  CheckboxProps,
  DatePickerProps,
  InputNumberProps,
  InputProps,
  SwitchProps,
  TimePickerDefaultProps,
} from 'element-plus';
import type { Component } from 'vue';

import { createGlobalState } from '@vueuse/core';
import {
  ElCheckbox,
  ElDatePicker,
  ElInput,
  ElInputNumber,
  ElSelectV2,
  ElSwitch,
  ElTimePicker,
} from 'element-plus';
import { defineComponent, h, ref, shallowRef } from 'vue';

export type ComponentType =
  | 'checkbox'
  | 'date-picker'
  | 'input'
  | 'input-number'
  | 'select'
  | 'switch'
  | 'textarea'
  | 'time-picker';

/** 与 ComponentType 一一对应，便于 Schema 上 component + componentProps 联动提示 */
export interface ComponentPropsMap {
  checkbox: CheckboxProps;
  'date-picker': DatePickerProps;
  input: InputProps;
  'input-number': InputNumberProps;
  select: Record<string, unknown>;
  switch: SwitchProps;
  textarea: InputProps;
  'time-picker': Partial<TimePickerDefaultProps>;
}

type ComponentsState = Partial<Record<ComponentType, Component>>;

/**
 * 对标 george `globalShareState`：用 VueUse createGlobalState 共享组件表。
 */
export const useGlobalShareState = createGlobalState(() => {
  const components = shallowRef<ComponentsState>({});

  function setComponents(value: ComponentsState) {
    components.value = value;
  }

  function getComponents(): ComponentsState {
    return components.value;
  }

  return { components, setComponents, getComponents };
});

const DEFAULT_PLACEHOLDER = {
  input: '请输入',
  select: '请选择',
} as const;

/**
 * 包装组件：默认 placeholder + 默认 props，并透传 expose。
 */
function withDefaultPlaceholder(
  component: Component,
  type: keyof typeof DEFAULT_PLACEHOLDER,
  componentProps: Record<string, unknown> = {},
) {
  return defineComponent({
    name:
      typeof component === 'object' && component && 'name' in component
        ? String(component.name)
        : undefined,
    inheritAttrs: false,
    setup(_props, { attrs, expose, slots }) {
      const placeholder = (attrs.placeholder as string | undefined) ?? DEFAULT_PLACEHOLDER[type];
      const innerRef = ref();
      expose(
        new Proxy(
          {},
          {
            get: (_target, key) => innerRef.value?.[key],
            has: (_target, key) => key in (innerRef.value || {}),
          },
        ),
      );
      return () => h(component, { ...componentProps, placeholder, ...attrs, ref: innerRef }, slots);
    },
  });
}

/**
 * 注册内置组件到全局共享状态。应用启动时调用一次。
 */
export function initComponentAdapter() {
  const components: ComponentsState = {
    checkbox: ElCheckbox,
    'date-picker': ElDatePicker,
    input: withDefaultPlaceholder(ElInput, 'input'),
    // 默认关闭加减按钮：点击 controls 会打断内部 input 失焦，cell 模式无法靠 blur 退出编辑态
    'input-number': withDefaultPlaceholder(ElInputNumber, 'input', { controls: false }),
    select: withDefaultPlaceholder(ElSelectV2, 'select'),
    switch: ElSwitch,
    textarea: withDefaultPlaceholder(ElInput, 'input', {
      type: 'textarea',
      autosize: true,
    }),
    'time-picker': ElTimePicker,
  };

  useGlobalShareState().setComponents(components);
}
