<script setup lang="ts">
import DemoApiTable from '@/components/demo/demo-api-table.vue';
import DemoBlock from '@/components/demo/demo-block.vue';
import DemoCode from '@/components/demo/demo-code.vue';
import DemoPage from '@/components/demo/demo-page.vue';

defineOptions({ name: 'UseOauth2Demo' });

const codeDemo = `import { watch } from 'vue'
import { useOauth2 } from '@/composables'

const { code, authorize } = useOauth2() // 或 useOauth2({ scope: 'snsapi_base' })

// 跳转微信授权；可选 redirect 替换当前 pathname（History）
authorize('/login')

// 回调后 URL 带 ?code=...，code 自动同步
watch(code, (value) => {
  if (!value) return
  // 用 code 换取 access_token / 登录态
})`;
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      微信网页授权（OAuth）。从 URL search 同步
      <code>code</code>，并通过 <code>authorize</code> 跳转微信授权页。workbench 使用 History 路由，
      <code>redirect_uri</code> 不含 hash 路径。需配置 <code>VITE_WECHAT_APPID</code>。
    </template>

    <template #api>
      <DemoApiTable title="UseOauth2Options">
        <tr>
          <td><code>scope</code></td>
          <td><code>'snsapi_base' | 'snsapi_userinfo'</code></td>
          <td>默认 <code>'snsapi_userinfo'</code>。授权作用域。</td>
        </tr>
        <tr>
          <td><code>appId</code></td>
          <td><code>string</code></td>
          <td>默认取 <code>VITE_WECHAT_APPID</code>。</td>
        </tr>
        <tr>
          <td><code>mode</code></td>
          <td><code>'history' | 'hash' | 'hash-params'</code></td>
          <td>默认 <code>'history'</code>。决定回调后从哪一段 query 读 <code>code</code>。</td>
        </tr>
        <tr>
          <td><code>window</code></td>
          <td><code>Window</code></td>
          <td>默认 <code>defaultWindow</code>；SSR 下为 <code>undefined</code> 时自动降级。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="UseOauth2Return">
        <tr>
          <td><code>code</code></td>
          <td><code>ShallowRef&lt;string | undefined&gt;</code></td>
          <td>URL 上的 OAuth <code>code</code>。</td>
        </tr>
        <tr>
          <td><code>authorize</code></td>
          <td><code>(redirect?: string) =&gt; void</code></td>
          <td>跳转微信授权；可选 <code>redirect</code> 替换当前 pathname（History）。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Env">
        <tr>
          <td><code>VITE_WECHAT_APPID</code></td>
          <td><code>string</code></td>
          <td>微信公众号 / 网页应用 AppId。</td>
        </tr>
      </DemoApiTable>
    </template>

    <DemoBlock title="代码演示">
      <template #hint>
        playground 无法真实跳转微信授权，此处仅展示用法。需在微信内置浏览器且配置
        <code>VITE_WECHAT_APPID</code> 后使用。
      </template>
      <DemoCode :code="codeDemo" lang="ts" />
    </DemoBlock>
  </DemoPage>
</template>
