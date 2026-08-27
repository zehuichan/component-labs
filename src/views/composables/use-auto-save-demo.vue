<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAutoSave } from '@/composables';
import DemoApiTable from '@/components/demo/demo-api-table.vue';
import DemoBlock from '@/components/demo/demo-block.vue';
import DemoPage from '@/components/demo/demo-page.vue';

defineOptions({ name: 'UseAutoSaveDemo' });

const SERVER_KEY = 'composables-demo:auto-save-server';

interface FormState {
  title: string;
  note: string;
}

function readServerSnapshot(): FormState | null {
  try {
    const raw = localStorage.getItem(SERVER_KEY);
    if (raw === null) return null;
    return JSON.parse(raw) as FormState;
  } catch {
    return null;
  }
}

const form = ref<FormState>({ title: '草稿标题', note: '' });
const serverSnapshot = ref<FormState | null>(readServerSnapshot());
const enabled = ref(true);
const debounceMs = ref(500);

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!signal) {
      setTimeout(resolve, ms);
      return;
    }

    const abortReason = () =>
      signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
    if (signal.aborted) return reject(abortReason());

    const handleAbort = () => {
      clearTimeout(timer);
      reject(abortReason());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

const { status, lastSavedAt, error, flush, withPaused } = useAutoSave(
  form,
  async (value, signal) => {
    await delay(400, signal);
    const next: FormState = {
      title: value.title,
      note: value.note,
    };
    localStorage.setItem(SERVER_KEY, JSON.stringify(next));
    serverSnapshot.value = next;
  },
  { enabled, debounceMs },
);

const lastSavedLabel = computed(() => {
  if (lastSavedAt.value === null) return '—';
  return new Date(lastSavedAt.value).toLocaleTimeString();
});

const errorLabel = computed(() => {
  if (error.value == null) return '—';
  return error.value instanceof Error ? error.value.message : String(error.value);
});

async function handleFlush() {
  await flush();
}

async function handlePausedEdit() {
  await withPaused(async () => {
    form.value = {
      ...form.value,
      note: `${form.value.note}[paused]`,
    };
    await delay(300);
  });
}
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      监听响应式数据，防抖后串行调用你的
      <code>save</code>，用于「服务端草稿 / 自动保存」。本地草稿请用
      <code>useFormDraft</code>，快捷键请用 <code>useSaveHotkey</code>。
    </template>

    <template #api>
      <DemoApiTable title="Options">
        <tr>
          <td><code>source</code></td>
          <td><code>MaybeRefOrGetter&lt;T&gt;</code></td>
          <td>必填。深度监听的待保存数据。</td>
        </tr>
        <tr>
          <td><code>save</code></td>
          <td>
            <code>(value: T, signal: AbortSignal) =&gt; void | Promise&lt;void&gt;</code>
          </td>
          <td>
            必填。真正落盘/请求；销毁时 signal 会中止。回调内不要调用本实例的
            <code>flush</code> / <code>withPaused</code>。
          </td>
        </tr>
        <tr>
          <td><code>enabled</code></td>
          <td><code>MaybeRefOrGetter&lt;boolean&gt;</code></td>
          <td>默认 <code>true</code>。为 false 时不调度自动保存。</td>
        </tr>
        <tr>
          <td><code>debounceMs</code></td>
          <td><code>MaybeRefOrGetter&lt;number&gt;</code></td>
          <td>默认 <code>2000</code>。变更后多久开始保存。</td>
        </tr>
        <tr>
          <td><code>onSuccess</code></td>
          <td><code>(value: T) =&gt; void</code></td>
          <td>可选。保存成功回调。</td>
        </tr>
        <tr>
          <td><code>onError</code></td>
          <td><code>(error: unknown) =&gt; void</code></td>
          <td>可选。求值 / 持久化 / 控制操作失败时回调。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Returns">
        <tr>
          <td><code>status</code></td>
          <td>
            <code>'idle' | 'pending' | 'saving' | 'saved' | 'error'</code>
          </td>
          <td>当前流水线状态。</td>
        </tr>
        <tr>
          <td><code>lastSavedAt</code></td>
          <td><code>Ref&lt;number | null&gt;</code></td>
          <td>最近一次成功保存的时间戳。</td>
        </tr>
        <tr>
          <td><code>error</code></td>
          <td><code>Ref&lt;unknown | null&gt;</code></td>
          <td>最近一次失败原因。</td>
        </tr>
        <tr>
          <td><code>flush</code></td>
          <td><code>() =&gt; Promise&lt;void&gt;</code></td>
          <td>取消 debounce，立即保存当前已知修订。</td>
        </tr>
        <tr>
          <td><code>withPaused</code></td>
          <td><code>(task) =&gt; Promise&lt;R&gt;</code></td>
          <td>执行期间丢弃自动保存；适合批量灌数据、切路由等。</td>
        </tr>
      </DemoApiTable>
    </template>

    <DemoBlock>
      <template #hint>
        改标题/备注 → 看 <code>status</code> 从 pending → saving → saved；点 Flush 跳过等待；点
        withPaused 编辑时备注会变但不会触发自动保存。 <code>save</code> 目前用
        <code>localStorage</code> 模拟服务端，刷新后快照仍在。
      </template>

      <div class="demo__toolbar">
        <label class="demo__control">
          <span>enabled</span>
          <el-switch v-model="enabled" />
        </label>
        <label class="demo__control">
          <span>debounceMs</span>
          <el-radio-group v-model="debounceMs" size="small">
            <el-radio-button :value="500">500</el-radio-button>
            <el-radio-button :value="1500">1500</el-radio-button>
          </el-radio-group>
        </label>
        <el-button size="small" type="primary" @click="handleFlush"> Flush </el-button>
        <el-button size="small" @click="handlePausedEdit"> withPaused 编辑 </el-button>
      </div>

      <p class="demo__status">
        status: <strong>{{ status }}</strong> · lastSavedAt: {{ lastSavedLabel }} · error:
        {{ errorLabel }}
      </p>

      <div class="demo__panels">
        <el-form label-width="72px" class="demo__form">
          <el-form-item label="标题">
            <el-input v-model="form.title" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="form.note" type="textarea" :rows="4" />
          </el-form-item>
        </el-form>

        <div class="demo__snapshot">
          <div class="demo__snapshot-title">
            服务端快照（localStorage · <code>{{ SERVER_KEY }}</code
            >）
          </div>
          <pre>{{ serverSnapshot ? JSON.stringify(serverSnapshot, null, 2) : '（尚未保存）' }}</pre>
        </div>
      </div>
    </DemoBlock>
  </DemoPage>
</template>
