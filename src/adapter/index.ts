/**
 * 组件适配层入口：UI 库组件注册与全局共享状态。
 * 表格编辑解析（resolveEditor / trigger）见 `@/components/plus-table/adapter`。
 */

export {
  initComponentAdapter,
  useGlobalShareState,
  type ComponentPropsMap,
  type ComponentType,
} from './component';
