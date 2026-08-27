<script setup lang="ts">
import DemoApiTable from '@/components/demo/demo-api-table.vue';
import DemoBlock from '@/components/demo/demo-block.vue';
import DemoCode from '@/components/demo/demo-code.vue';
import DemoPage from '@/components/demo/demo-page.vue';

defineOptions({ name: 'UseWechatDemo' });

const codeDemo = `import { watch } from 'vue'
import { useWechat } from '@/composables'

const { ready, wx } = useWechat()

watch(ready, (ok) => {
  if (!ok) return
  wx?.scanQRCode?.({ needResult: 1, success: console.log })
})`;
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      微信 JSSDK 初始化（<code>createGlobalState</code>，全局只
      <code>wx.config</code> 一次）。非微信环境或
      <code>VITE_JSSDK_ENABLED !== 'true'</code> 时跳过。签名暂走 <code>getJsApiTicket</code>。
    </template>

    <template #api>
      <DemoApiTable title="UseWechatOptions（仅首次调用生效）">
        <tr>
          <td><code>enabled</code></td>
          <td><code>boolean</code></td>
          <td>默认 <code>VITE_JSSDK_ENABLED === 'true'</code>。</td>
        </tr>
        <tr>
          <td><code>window</code></td>
          <td><code>Window</code></td>
          <td>默认 <code>defaultWindow</code>；UA 判定与 <code>wx</code> 都从这里读。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="UseWechatReturn">
        <tr>
          <td><code>ready</code></td>
          <td><code>ShallowRef&lt;boolean&gt;</code></td>
          <td><code>wx.ready</code> 之后为 <code>true</code>。</td>
        </tr>
        <tr>
          <td><code>wx</code></td>
          <td><code>WeixinJsSdk | undefined</code></td>
          <td><code>window.wx</code> 引用；未注入脚本时为 <code>undefined</code>。</td>
        </tr>
      </DemoApiTable>
    </template>

    <DemoBlock title="代码演示">
      <template #hint>
        playground 非微信环境且 JSSDK 配置仍为
        stub，无法交互演示；此处仅展示用法。需微信内置浏览器、
        <code>VITE_JSSDK_ENABLED=true</code>，并注入 <code>window.wx</code>。
      </template>
      <DemoCode :code="codeDemo" lang="ts" />
    </DemoBlock>
  </DemoPage>
</template>
