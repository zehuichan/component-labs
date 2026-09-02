/** 菜单壳消费的已解析项：disabled / handler 已收敛为静态值 */
export interface ResolvedMenuItem {
  key: string;
  label: string;
  disabled?: boolean;
  /** 该项之后画分隔线 */
  separator?: boolean;
  /**
   * 选中时是否关闭并执行 handler；默认 true。
   * false 时仅 preventDefault，由 `#context-menu-item-${key}` 插槽内主动处理。
   */
  closeOnSelect?: boolean;
  handler: () => void;
  /**
   * 打开时冻结的插槽作用域（ContextMenuContext 字段；不含 close，由壳注入）。
   * 用宽松记录类型避免 ResolvedMenuItem 与行泛型耦合。
   */
  slotProps?: Record<string, unknown>;
}

/** PlusTableContextMenu 对宿主暴露的能力 */
export interface ContextMenuExpose {
  open: (event: MouseEvent, items: ResolvedMenuItem[]) => void;
}
