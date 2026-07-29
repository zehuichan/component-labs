/** 菜单壳消费的已解析项：disabled / handler 已收敛为静态值 */
export interface ResolvedMenuItem {
  key: string;
  label: string;
  disabled?: boolean;
  /** 该项之后画分隔线 */
  separator?: boolean;
  handler: () => void;
}

export interface ContextMenuExpose {
  open: (event: MouseEvent, items: ResolvedMenuItem[]) => void;
}
