import { computed } from 'vue';
import { useElementBounding, useWindowSize } from '@vueuse/core';
import { isPlainObject } from 'es-toolkit';
import { ADAPTIVE_DEFAULT_MIN_HEIGHT, ADAPTIVE_DEFAULT_OFFSET_BOTTOM } from '../constants';
import type { AdaptiveConfig, PlusTableResolvedProps, TableHost } from '../table';
import type { RowData } from '../types';

type UseStylesProps<T extends RowData> = Pick<TableHost<T>, 'gridRef' | 'paginationRef'>;

/** 按视口剩余空间计算 el-table 的 height，随窗口与布局变化响应 */
export function useStyles<T extends RowData = RowData>(
  props: PlusTableResolvedProps<T>,
  { gridRef, paginationRef }: UseStylesProps<T>,
) {
  const config = computed<Required<AdaptiveConfig>>(() => {
    const adaptive = props.adaptive;
    const overrides = isPlainObject(adaptive) ? adaptive : {};
    return {
      mode: overrides.mode ?? 'viewport',
      offsetBottom: overrides.offsetBottom ?? ADAPTIVE_DEFAULT_OFFSET_BOTTOM,
      minHeight: overrides.minHeight ?? ADAPTIVE_DEFAULT_MIN_HEIGHT,
    };
  });

  /** container 模式：表格放进卡片/弹窗/分栏等自身高度受限的容器，视口像素运算天然算错 */
  const isContainerMode = computed(() => !!props.adaptive && config.value.mode === 'container');

  /**
   * 关掉 window scroll 监听：它是 capture 阶段挂在 window 上的，表体内部每滚一帧
   * 都会触发两次 getBoundingClientRect 强制回流。视口模式下表格本就占满剩余高度、
   * 页面不该整体滚动，尺寸变化交给 ResizeObserver 与 window resize 即可。
   */
  const boundingOptions = { windowScroll: false } as const;
  const { top: gridTop } = useElementBounding(gridRef, boundingOptions);
  const { height: paginationHeight } = useElementBounding(paginationRef, boundingOptions);
  const { height: windowHeight } = useWindowSize();

  const tableHeight = computed<number | string | undefined>(() => {
    if (!props.adaptive) return undefined;
    if (isContainerMode.value) return '100%';
    const available =
      windowHeight.value - gridTop.value - paginationHeight.value - config.value.offsetBottom;
    return Math.max(available, config.value.minHeight);
  });

  return { tableHeight, isContainerMode };
}

export type UseStylesReturn = ReturnType<typeof useStyles>;
