<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DemoApiTable from '@/components/demo/demo-api-table.vue';
import DemoBlock from '@/components/demo/demo-block.vue';
import DemoCode from '@/components/demo/demo-code.vue';
import DemoPage from '@/components/demo/demo-page.vue';
import { getToken, type TokenInfo } from '@/utils/auth';

defineOptions({ name: 'UseSsoDemo' });

const token = ref<TokenInfo | null>(null);
const samplePath = computed(
  () => `${location.origin}/?username=sso&roles=admin&accessToken=eyJhbGciOiJIUzUxMiJ9.demo`,
);

onMounted(() => {
  token.value = getToken();
});

const usage = `// main.ts — 引入即执行，无需再调
import '@/utils/sso'

// 带齐三参的 URL 会被识别为 SSO 回调：
// ${samplePath.value}`;
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      简版前端 SSO：URL 同时带
      <code>username</code>、<code>roles</code>、<code>accessToken</code>
      时，清空旧会话、写入本地，并用
      <code>location.replace</code> 去掉敏感参数。用法与 vue-pure-admin 一致——
      <code>main.ts</code> 里 <code>import '@/utils/sso'</code> 即可。
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
      <pre class="overflow-x-auto rounded-md bg-muted p-3 text-xs">{{
        token ? JSON.stringify(token, null, 2) : 'null'
      }}</pre>
    </DemoBlock>

    <DemoBlock title="用法">
      <DemoCode :code="usage" lang="ts" />
    </DemoBlock>
  </DemoPage>
</template>
