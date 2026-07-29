<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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

function handleSelect(item: ResolvedMenuItem) {
  if (item.disabled) return;
  item.handler();
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
              @select="handleSelect(item)"
            >
              {{ item.label }}
            </DropdownMenuItem>
            <DropdownMenuSeparator v-if="item.separator" class="ptbl-context-menu__separator" />
          </template>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
