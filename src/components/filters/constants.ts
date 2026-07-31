/** Filters 单条 schema（与 PlusTable / FormSchema 字段形态对齐的最小子集） */
export interface FilterSchemaField {
  fieldName: string;
  label: string;
  /** 内置组件标识（见 ComponentType / initComponentAdapter）或自定义组件名 */
  component?: string;
  /** 自定义 v-model prop；缺省为 Element Plus 的 modelValue */
  modelPropName?: string;
  componentProps?: Record<string, unknown>;
}
