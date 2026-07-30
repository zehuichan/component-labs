<script setup lang="ts">
import { computed, ref, watch, type VNodeChild } from 'vue';
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useForwardExpose,
} from 'reka-ui';
import { usePlusTable } from '../tokens';
import type { ResolvedMenuItem } from './types';

defineOptions({ name: 'PlusTableContextMenu' });

const table = usePlusTable();

const open = ref(false);
const point = ref({ x: 0, y: 0 });
const items = ref<ResolvedMenuItem[]>([]);

const virtualStyled = computed(() => ({
  position: 'fixed' as const,
  left: `${point.value.x}px`,
  top: `${point.value.y}px`,
  width: 0,
  height: 0,
  pointerEvents: 'none' as const,
}));

const virtualContentKey = computed(() => `vt-${point.value.x}-${point.value.y}`);

const { forwardRef } = useForwardExpose();

function openMenu(event: MouseEvent, nextItems: ResolvedMenuItem[]) {
  if (!nextItems.length) return;
  event.preventDefault();
  items.value = nextItems;
  point.value = { x: event.clientX, y: event.clientY };
  open.value = true;
}

function closeMenu() {
  open.value = false;
}

function handleSelect(item: ResolvedMenuItem, event: Event) {
  if (item.disabled) {
    event.preventDefault();
    return;
  }
  // 对齐 editor 插槽：交互项由插槽自行 commit/close，壳不自动关
  if (item.closeOnSelect === false) {
    event.preventDefault();
    return;
  }
  item.handler();
}

/**
 * 与 cell-${prop} / editor-${prop} 一致：有同名插槽则渲染插槽，否则回退 label。
 * close 由壳注入，对应 EditorSlotProps.commit / cancel。
 */
function itemContent(item: ResolvedMenuItem): () => VNodeChild {
  return () => {
    const slot = table.slots[`context-menu-item-${item.key}`];
    if (slot && item.slotProps) {
      return slot({ ...item.slotProps, close: closeMenu });
    }
    return item.label;
  };
}

watch(open, (value) => {
  if (!value) table.store.focusGrid();
});

defineExpose({ open: openMenu });
</script>

<template>
  <DropdownMenuRoot v-model:open="open" :modal="false">
    <DropdownMenuTrigger :ref="forwardRef" as="span" :style="virtualStyled" />
    <DropdownMenuPortal>
      <DropdownMenuContent
        :key="virtualContentKey"
        class="ptbl-context-menu"
        side="bottom"
        align="start"
        :side-offset="0"
        @close-auto-focus.prevent
      >
        <DropdownMenuGroup>
          <template v-for="(item, index) in items" :key="item.key || `${item.label}-${index}`">
            <DropdownMenuItem
              class="ptbl-context-menu__item"
              :disabled="item.disabled"
              @select="(event) => handleSelect(item, event)"
            >
              <component :is="itemContent(item)" />
            </DropdownMenuItem>
            <DropdownMenuSeparator v-if="item.separator" class="ptbl-context-menu__separator" />
          </template>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
