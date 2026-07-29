<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowDown, ArrowUp, GripVertical, RotateCcw } from '@lucide/vue';
import { ElButton, ElCheckbox, ElDrawer, ElInputNumber } from 'element-plus';
import { usePlusTable } from '../tokens';
import type { SettingItem } from '../store/columns';

defineOptions({ name: 'PlusTableColumnSettings' });

const table = usePlusTable();

const items = computed(() => table.store.settingItems.value);
const leafItems = computed(() => items.value.filter((item) => !item.isGroup));
const visibleColumnCount = computed(() => leafItems.value.filter((item) => item.checked).length);

const drawerVisible = ref(false);

function openDrawer() {
  drawerVisible.value = true;
}

function handleToggle(id: string, checked: boolean | string | number) {
  const item = items.value.find((it) => it.id === id);
  if (item?.disabled) return;
  table.store.toggleColumnVisible(id, !!checked);
}

/** 无固定列宽（含覆盖层里的强制自动）时返回 undefined，输入框留空表示自动宽度 */
function columnWidth(item: SettingItem): number | undefined {
  const widths = table.store.states.widthMap.value;
  const raw =
    item.id in widths ? widths[item.id] : table.store.getColumnById(item.id)?.column.width;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

function handleWidthChange(item: SettingItem, width: number | null | undefined) {
  if (item.isGroup) return;
  // 清空输入（el-input-number 发 null）= 写入强制自动，压过列配置里的 width
  const next = width === null || width === undefined || !Number.isFinite(width) || width <= 0;
  table.store.setColumnWidth(item.id, next ? null : width);
}

function siblings(item: SettingItem): SettingItem[] {
  return items.value.filter((candidate) => candidate.parentId === item.parentId);
}

function canMove(item: SettingItem, direction: -1 | 1): boolean {
  if (item.disabled) return false;
  const list = siblings(item);
  const index = list.findIndex((candidate) => candidate.id === item.id);
  return index >= 0 && !!list[index + direction];
}

function move(item: SettingItem, direction: -1 | 1) {
  const list = siblings(item);
  const index = list.findIndex((candidate) => candidate.id === item.id);
  const target = list[index + direction];
  if (index < 0 || !target || item.disabled) return;
  table.store.updateColumnOrder(item.id, target.id, direction < 0 ? 'before' : 'after');
}

const dragItem = ref<SettingItem | null>(null);
const dropTargetId = ref<string | null>(null);
const dropPosition = ref<'before' | 'after'>('before');

function canDropOn(item: SettingItem): boolean {
  return (
    !!dragItem.value &&
    !dragItem.value.disabled &&
    !item.disabled &&
    dragItem.value.id !== item.id &&
    dragItem.value.parentId === item.parentId
  );
}

function handleDragStart(event: DragEvent, item: SettingItem) {
  if (item.disabled) {
    event.preventDefault();
    return;
  }
  dragItem.value = item;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    // Firefox 必须 setData 才会启动拖拽
    event.dataTransfer.setData('text/plain', item.id);
    // 拖拽源是手柄，预览图仍取整行
    const row = (event.currentTarget as HTMLElement).closest('li');
    if (row) event.dataTransfer.setDragImage(row, 16, row.offsetHeight / 2);
  }
}

function handleDragOver(event: DragEvent, item: SettingItem) {
  if (!canDropOn(item)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  dropPosition.value = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  dropTargetId.value = item.id;
}

function handleDrop(event: DragEvent, item: SettingItem) {
  if (!canDropOn(item)) return;
  event.preventDefault();
  table.store.updateColumnOrder(dragItem.value!.id, item.id, dropPosition.value);
  handleDragEnd();
}

function handleDragEnd() {
  dragItem.value = null;
  dropTargetId.value = null;
}

defineExpose({ openDrawer });
</script>

<template>
  <el-drawer
    v-model="drawerVisible"
    class="ptbl-column-settings-drawer"
    title="列设置"
    direction="rtl"
    size="min(380px, 92vw)"
    :with-header="false"
  >
    <div class="ptbl-column-settings">
      <div class="ptbl-column-settings__summary">
        <div class="ptbl-column-settings__summary-row">
          <h2 class="ptbl-column-settings__summary-title">列设置</h2>
          <span class="ptbl-column-settings__summary-count" aria-live="polite">
            已显示 {{ visibleColumnCount }} / {{ leafItems.length }}
          </span>
        </div>
        <p>勾选控制显示，拖动排序或输入数值调整列宽</p>
      </div>

      <ul class="ptbl-column-settings__list">
        <li
          v-for="item in items"
          :key="item.id"
          class="ptbl-column-settings__item"
          :class="{
            'is-dragging': dragItem?.id === item.id,
            'is-drop-before': dropTargetId === item.id && dropPosition === 'before',
            'is-drop-after': dropTargetId === item.id && dropPosition === 'after',
            'is-disabled': item.disabled,
            'is-group': item.isGroup,
          }"
          :style="{ '--ptbl-column-level': item.level }"
          @dragover="handleDragOver($event, item)"
          @drop="handleDrop($event, item)"
        >
          <span
            class="ptbl-column-settings__handle"
            aria-hidden="true"
            :draggable="!item.disabled"
            :title="item.disabled ? undefined : '拖动调整顺序'"
            @dragstart="handleDragStart($event, item)"
            @dragend="handleDragEnd"
          >
            <GripVertical :size="16" />
          </span>
          <el-checkbox
            :model-value="item.checked"
            :indeterminate="item.indeterminate"
            :disabled="item.disabled"
            @change="handleToggle(item.id, $event)"
          >
            {{ item.title }}
          </el-checkbox>
          <label v-if="!item.isGroup" class="ptbl-column-settings__width">
            <el-input-number
              :model-value="columnWidth(item)"
              :min="40"
              :max="2000"
              :controls="false"
              size="small"
              placeholder="自动"
              :aria-label="`${item.title}列宽，留空为自动宽度`"
              @change="handleWidthChange(item, $event)"
            >
              <template #suffix v-if="columnWidth(item) !== undefined">
                <span>px</span>
              </template>
            </el-input-number>
          </label>
          <span class="ptbl-column-settings__moves">
            <el-button
              text
              circle
              size="small"
              :disabled="!canMove(item, -1)"
              :aria-label="`上移列“${item.title}”`"
              :title="`上移列“${item.title}”`"
              @click="move(item, -1)"
            >
              <ArrowUp :size="14" />
            </el-button>
            <el-button
              text
              circle
              size="small"
              :disabled="!canMove(item, 1)"
              :aria-label="`下移列“${item.title}”`"
              :title="`下移列“${item.title}”`"
              @click="move(item, 1)"
            >
              <ArrowDown :size="14" />
            </el-button>
          </span>
        </li>
      </ul>
    </div>

    <template #footer>
      <div class="ptbl-column-settings__footer">
        <el-button @click="table.store.resetSettings()"> 恢复默认 </el-button>
        <el-button type="primary" @click="drawerVisible = false">完成</el-button>
      </div>
    </template>
  </el-drawer>
</template>
