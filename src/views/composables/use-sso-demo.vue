<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DemoApiTable from '@/components/demo/demo-api-table.vue';
import DemoBlock from '@/components/demo/demo-block.vue';
import DemoCode from '@/components/demo/demo-code.vue';
import DemoPage from '@/components/demo/demo-page.vue';
import { getToken, type TokenInfo } from '@/utils/auth';

defineOptions({ name: 'UseSsoDemo' });

const token = ref<TokenInfo | null>(null);
const CREDENTIALS = 'username=sso&roles=admin&accessToken=eyJhbGciOiJIUzUxMiJ9.demo';
const samplePath = computed(() => `${location.origin}/?${CREDENTIALS}`);
const hashSamplePath = computed(() => `${location.origin}/#/home?${CREDENTIALS}`);

onMounted(() => {
  token.value = getToken();
});

const usage = `// main.ts — 挂载前显式调用
import { sso } from '@/utils/sso'

sso()
createApp(App).use(router).mount('#app')

// 带齐三参的 URL 会被识别为 SSO 回调（history 与 hash 模式都支持）：
// ${samplePath.value}
// ${hashSamplePath.value}`;
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      简版前端 SSO：URL 同时带
      <code>username</code>、<code>roles</code>、<code>accessToken</code>
      时，清空旧会话、写入本地，并用
      <code>location.replace</code> 去掉敏感参数。history / hash 两种路由模式都支持，凭证在哪一段
      query 就只清理哪一段。<code>main.ts</code> 里挂载前调用一次 <code>sso()</code> 即可。
    </template>

    <template #api>
      <DemoApiTable title="URL 参数（必须齐全）">
        <tr>
          <td><code>username</code></td>
          <td><code>string</code></td>
          <td>用户名；清理后会留在地址栏。</td>
        </tr>
        <tr>
          <td><code>roles</code></td>
          <td><code>string</code></td>
          <td>角色，逗号/空格分隔；写入本地后从 URL 删除。</td>
        </tr>
        <tr>
          <td><code>accessToken</code></td>
          <td><code>string</code></td>
          <td>访问令牌；写入本地后从 URL 删除。</td>
        </tr>
      </DemoApiTable>
    </template>

    <DemoBlock title="当前本地 token">
      <template #hint>
        用下方链接新开一页触发 SSO；回来刷新本页即可看到
        <code>localStorage['authorized-token']</code>。
      </template>
      <p class="mb-3 break-all font-mono text-xs">
        <a class="text-primary underline" :href="samplePath" target="_blank" rel="noreferrer">{{
          samplePath
        }}</a>
      </p>
      <p class="mb-3 break-all font-mono text-xs">
        <a class="text-primary underline" :href="hashSamplePath" target="_blank" rel="noreferrer">{{
          hashSamplePath
        }}</a>
      </p>
      <pre class="overflow-x-auto rounded-md bg-muted p-3 text-xs">{{
        token ? JSON.stringify(token, null, 2) : 'null'
      }}</pre>
    </DemoBlock>

    <DemoBlock title="用法">
      <DemoCode :code="usage" lang="ts" />
    </DemoBlock>
  </DemoPage>
</template>
