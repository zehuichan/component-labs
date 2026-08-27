<script setup lang="ts">
import DemoApiTable from '@/components/demo/demo-api-table.vue';
import DemoBlock from '@/components/demo/demo-block.vue';
import DemoCode from '@/components/demo/demo-code.vue';
import DemoPage from '@/components/demo/demo-page.vue';

defineOptions({ name: 'UseQrconnectDemo' });

const loginDemo = `import { useQrconnect } from '@/composables'

// 登录页：整页跳转 qrconnect（固定回调 /auth/wechat）
const { authorize } = useQrconnect()
authorize('/auth/wechat')`;

const callbackDemo = `import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQrconnect } from '@/composables'

// 中间页本地 stub（不要放进 composable）
async function mockExchangeCode(code: string) {
  await new Promise((r) => setTimeout(r, 300))
  if (!code) throw new Error('missing code')
  return {
    accessToken: \`mock-access-token-\${code.slice(0, 8)}\`,
    openid: \`mock-openid-\${code.slice(0, 8)}\`,
  }
}

// 中间页 /auth/wechat：读 code → 换票
const router = useRouter()
const { code } = useQrconnect()

watch(
  code,
  async (oauthCode) => {
    if (!oauthCode) return
    const token = await mockExchangeCode(oauthCode) // → 真实后端
    console.log(token)
    await router.push('/composables/use-qrconnect')
  },
  { immediate: true },
)`;
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      微信开放平台网站应用扫码登录（
      <code>qrconnect</code>
      /
      <code>snsapi_login</code>
      ）。用法与
      <code>useOauth2</code>
      同款：同步 URL
      <code>code</code>
      ，
      <code>authorize</code>
      整页跳转。默认回调
      <code>/auth/wechat</code>
      。需配置
      <code>VITE_WECHAT_OPEN_APPID</code>
      。
    </template>

    <template #api>
      <DemoApiTable title="UseQrconnectOptions">
        <tr>
          <td><code>appId</code></td>
          <td><code>string</code></td>
          <td>默认取 <code>VITE_WECHAT_OPEN_APPID</code>。</td>
        </tr>
        <tr>
          <td><code>redirectPath</code></td>
          <td><code>string</code></td>
          <td>
            <code>authorize()</code>
            未传参时的回调 path，默认取
            <code>VITE_WECHAT_QR_REDIRECT_PATH</code>
            ，再退回
            <code>/auth/wechat</code>
            。
          </td>
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

      <DemoApiTable title="UseQrconnectReturn">
        <tr>
          <td><code>code</code></td>
          <td><code>ShallowRef&lt;string | undefined&gt;</code></td>
          <td>URL 上的 OAuth <code>code</code>。</td>
        </tr>
        <tr>
          <td><code>authorize</code></td>
          <td><code>(redirect?: string) =&gt; void</code></td>
          <td>
            跳转
            <code>qrconnect</code>
            ；可选
            <code>redirect</code>
            作为
            <code>redirect_uri</code>
            path（默认
            <code>/auth/wechat</code>
            ）。
          </td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Env">
        <tr>
          <td><code>VITE_WECHAT_OPEN_APPID</code></td>
          <td><code>string</code></td>
          <td>网站应用 AppId（扫码登录）。</td>
        </tr>
        <tr>
          <td><code>VITE_WECHAT_QR_REDIRECT_PATH</code></td>
          <td><code>string</code></td>
          <td>
            <code>authorize()</code>
            未传参时的默认回调 path。
          </td>
        </tr>
      </DemoApiTable>
    </template>

    <DemoBlock title="代码演示 · 登录页">
      <template #hint>
        playground 无法真实扫码。配置
        <code>VITE_WECHAT_OPEN_APPID</code>
        后，
        <code>authorize</code>
        会整页跳转开放平台扫码页。
      </template>
      <DemoCode :code="loginDemo" lang="ts" />
    </DemoBlock>

    <DemoBlock title="代码演示 · 中间页">
      <template #hint>
        对应路由
        <code>/auth/wechat</code>
        （见
        <code>qrconnect-callback.vue</code>
        ）。本地可访问
        <code>/auth/wechat?code=demo</code>
        验证换票流程。
      </template>
      <DemoCode :code="callbackDemo" lang="ts" />
    </DemoBlock>
  </DemoPage>
</template>
