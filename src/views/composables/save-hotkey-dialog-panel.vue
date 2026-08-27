<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useSaveHotkey } from '@/composables';

defineOptions({ name: 'SaveHotkeyDialogPanel' });

const count = ref(0);

const save = () => {
  count.value += 1;
  ElMessage.success(`对话框保存 #${count.value}`);
};

useSaveHotkey(save);
</script>

<template>
  <div>
    <p>对话框内 Ctrl/Cmd+S（保存次数：{{ count }}）</p>
    <el-button type="primary" size="small" @click="save">保存</el-button>
  </div>
</template>
