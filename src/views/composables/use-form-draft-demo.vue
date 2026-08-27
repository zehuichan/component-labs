<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useFormDraft } from '@/composables';
import DemoApiTable from '@/components/demo/demo-api-table.vue';
import DemoBlock from '@/components/demo/demo-block.vue';
import DemoPage from '@/components/demo/demo-page.vue';

defineOptions({ name: 'UseFormDraftDemo' });

const DRAFT_KEY = 'composables-demo:form-draft';

interface FormState {
  name: string;
  email: string;
  remark: string;
}

const defaults: FormState = { name: '', email: '', remark: '' };
const form = ref<FormState>({ ...defaults });
const enabled = ref(true);

const { error, isPending, restore, clear, flush } = useFormDraft(form, DRAFT_KEY, {
  enabled,
  defaults,
  debounceMs: 500,
});

const errorLabel = computed(() => {
  if (error.value == null) return '—';
  return error.value instanceof Error ? error.value.message : String(error.value);
});

function handleRestore() {
  const ok = restore();
  ElMessage[ok ? 'success' : 'info'](ok ? '已恢复草稿' : '无草稿可恢复');
}

function handleClear() {
  clear();
  ElMessage.success('已清除草稿');
}

function handleFlush() {
  const ok = flush();
  ElMessage[ok ? 'success' : 'warning'](ok ? '已立即写入' : '未写入');
}
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      把表单对象 debounce 写入
      <code>localStorage</code>，用于崩溃/刷新后恢复。
      <strong>恢复必须显式调用</strong>
      <code>restore()</code>，避免本地草稿静默覆盖服务端数据。
    </template>

    <template #api>
      <DemoApiTable title="Options">
        <tr>
          <td><code>form</code></td>
          <td><code>Ref&lt;T&gt;</code></td>
          <td>必填。可变表单状态，须为可 JSON 序列化的普通对象。</td>
        </tr>
        <tr>
          <td><code>key</code></td>
          <td><code>MaybeRefOrGetter&lt;string&gt;</code></td>
          <td>必填。完整 storage key。key 变化不会自动迁移旧数据。</td>
        </tr>
        <tr>
          <td><code>enabled</code></td>
          <td><code>MaybeRefOrGetter&lt;boolean&gt;</code></td>
          <td>默认 <code>true</code>。为 false 时不写入。</td>
        </tr>
        <tr>
          <td><code>defaults</code></td>
          <td><code>MaybeRefOrGetter&lt;Partial&lt;T&gt;&gt;</code></td>
          <td>可选。Restore 时浅合并到底层（草稿覆盖其上）。</td>
        </tr>
        <tr>
          <td><code>debounceMs</code></td>
          <td><code>MaybeRefOrGetter&lt;number&gt;</code></td>
          <td>默认 <code>500</code>。变更后多久写入。</td>
        </tr>
        <tr>
          <td><code>onError</code></td>
          <td><code>(error: unknown) =&gt; void</code></td>
          <td>可选。key / 序列化 / storage 失败回调。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Returns">
        <tr>
          <td><code>isPending</code></td>
          <td><code>Ref&lt;boolean&gt;</code></td>
          <td>是否仍在 debounce 等待写入。</td>
        </tr>
        <tr>
          <td><code>error</code></td>
          <td><code>Ref&lt;unknown | null&gt;</code></td>
          <td>最近一次失败原因。</td>
        </tr>
        <tr>
          <td><code>restore</code></td>
          <td><code>() =&gt; boolean</code></td>
          <td>读取当前 key 的草稿并浅合并进 form；无草稿返回 false。</td>
        </tr>
        <tr>
          <td><code>clear</code></td>
          <td><code>() =&gt; boolean</code></td>
          <td>删除当前 key 的草稿。</td>
        </tr>
        <tr>
          <td><code>flush</code></td>
          <td><code>() =&gt; boolean</code></td>
          <td>取消 debounce，立即写入当前 form。</td>
        </tr>
        <tr>
          <td><code>withPaused</code></td>
          <td><code>(task) =&gt; Promise&lt;R&gt;</code></td>
          <td>执行期间忽略 form 变更，不调度写入。</td>
        </tr>
      </DemoApiTable>
    </template>

    <DemoBlock>
      <template #hint>
        编辑表单 → 等 debounce 或点 Flush → 刷新页面 → 点 Restore 回填。Clear 后 Restore
        会提示无草稿。当前 key：
        <code>{{ DRAFT_KEY }}</code>
      </template>

      <div class="demo__toolbar">
        <label class="demo__control">
          <span>enabled</span>
          <el-switch v-model="enabled" />
        </label>
        <el-button size="small" type="primary" @click="handleRestore"> Restore </el-button>
        <el-button size="small" @click="handleFlush">Flush</el-button>
        <el-button size="small" @click="handleClear">Clear</el-button>
      </div>

      <p class="demo__status">
        isPending: <strong>{{ isPending }}</strong> · error: {{ errorLabel }}
      </p>

      <div class="demo__panels">
        <el-form label-width="72px" class="demo__form">
          <el-form-item label="姓名">
            <el-input v-model="form.name" />
          </el-form-item>
          <el-form-item label="邮箱">
            <el-input v-model="form.email" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="form.remark" type="textarea" :rows="4" />
          </el-form-item>
        </el-form>

        <div class="demo__panel">
          <div class="demo__panel-title">当前 form</div>
          <pre class="demo__pre">{{ JSON.stringify(form, null, 2) }}</pre>
        </div>
      </div>
    </DemoBlock>
  </DemoPage>
</template>
