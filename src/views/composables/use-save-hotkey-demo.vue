<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useSaveHotkey } from '@/composables';
import DemoApiTable from '@/components/demo/demo-api-table.vue';
import DemoBlock from '@/components/demo/demo-block.vue';
import DemoPage from '@/components/demo/demo-page.vue';
import SaveHotkeyDialogPanel from './save-hotkey-dialog-panel.vue';

defineOptions({ name: 'UseSaveHotkeyDemo' });

const title = ref('主表单标题');
const enabled = ref(true);
const active = ref(true);
const saveCount = ref(0);
const dialogVisible = ref(false);

const save = () => {
  saveCount.value += 1;
  ElMessage.success(`主表单保存 #${saveCount.value}`);
};

useSaveHotkey(save, { enabled, active });
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      为当前组件注册
      <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>S</kbd>，应与页面「保存」按钮共用
      <code>handler</code>。组件树更深的注册优先；同深度后注册的优先。
      <code>enabled === false</code> 的顶层会挡住下层，而不是穿透。
    </template>

    <template #api>
      <DemoApiTable title="Options">
        <tr>
          <td><code>handler</code></td>
          <td><code>() =&gt; void | Promise&lt;void&gt;</code></td>
          <td>必填。与主保存按钮相同的保存逻辑。</td>
        </tr>
        <tr>
          <td><code>enabled</code></td>
          <td><code>MaybeRefOrGetter&lt;boolean&gt;</code></td>
          <td>默认 <code>true</code>。为 false 时不执行，但仍可能挡住下层注册。</td>
        </tr>
        <tr>
          <td><code>active</code></td>
          <td><code>MaybeRefOrGetter&lt;boolean&gt;</code></td>
          <td>
            默认 <code>true</code>。为 false 时注销本注册（例如对话框未打开、KeepAlive
            失活配合生命周期）。
          </td>
        </tr>
        <tr>
          <td><code>onError</code></td>
          <td><code>(error: unknown) =&gt; void</code></td>
          <td>可选。handler 或谓词求值失败时回调。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Returns">
        <tr>
          <td>—</td>
          <td>—</td>
          <td>
            无返回值。挂载时注册，卸载 /
            <code>onDeactivated</code> 时移除。
          </td>
        </tr>
      </DemoApiTable>
    </template>

    <DemoBlock>
      <template #hint>
        在本页按 Ctrl/Cmd+S 或点「保存」→ 主表单计数增加。打开对话框后再按快捷键 → 触发对话框内
        handler。关掉 enabled/active 可观察主热键失效。
      </template>

      <div class="demo__toolbar">
        <label class="demo__control">
          <span>enabled</span>
          <el-switch v-model="enabled" />
        </label>
        <label class="demo__control">
          <span>active</span>
          <el-switch v-model="active" />
        </label>
        <el-button size="small" type="primary" @click="save">保存</el-button>
        <el-button size="small" @click="dialogVisible = true"> 打开对话框 </el-button>
      </div>

      <p class="demo__status">主表单保存次数：{{ saveCount }}</p>

      <div class="demo__panels">
        <el-form label-width="72px" class="demo__form">
          <el-form-item label="标题">
            <el-input v-model="title" />
          </el-form-item>
        </el-form>

        <div class="demo__panel">
          <div class="demo__panel-title">优先级说明</div>
          <p class="demo__hint demo__hint--tight">
            对话框内的
            <code>SaveHotkeyDialogPanel</code>
            是更深的组件，因此其注册会压过本页。关闭对话框后本页重新成为顶层。
          </p>
        </div>
      </div>
    </DemoBlock>

    <el-dialog v-model="dialogVisible" title="嵌套保存" width="420px">
      <SaveHotkeyDialogPanel v-if="dialogVisible" />
    </el-dialog>
  </DemoPage>
</template>
