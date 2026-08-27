<script setup lang="ts">
import DemoApiTable from '@/components/demo/demo-api-table.vue';
import DemoBlock from '@/components/demo/demo-block.vue';
import DemoCode from '@/components/demo/demo-code.vue';
import DemoPage from '@/components/demo/demo-page.vue';

defineOptions({ name: 'UseWecomDemo' });

const codeDemo = `import { watch } from 'vue'
import { useWecom } from '@/composables'

const { ready, ww } = useWecom()

watch(ready, (ok) => {
  if (!ok) return
  void ww.getLocation({ type: 'gcj02' })
})`;
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      企微 JSSDK 初始化（结构对齐
      <code>useWechat</code>：<code>createGlobalState</code> + pending；配置走
      <code>@wecom/jssdk</code> 的 <code>ww.register</code>）。 <code>ready</code> 仅在
      <code>onAgentConfigSuccess</code> 后为 <code>true</code>。非企微环境或
      <code>VITE_WW_JSSDK_ENABLED !== 'true'</code> 时跳过。签名暂走 <code>getJsApiTicket</code> /
      <code>getAppJsApiTicket</code>。
    </template>

    <template #api>
      <DemoApiTable title="UseWecomOptions（仅首次调用生效）">
        <tr>
          <td><code>enabled</code></td>
          <td><code>boolean</code></td>
          <td>默认 <code>VITE_WW_JSSDK_ENABLED === 'true'</code>。</td>
        </tr>
        <tr>
          <td><code>corpId</code></td>
          <td><code>string</code></td>
          <td>默认取 <code>VITE_WORK_WECHAT_CORP_ID</code>。</td>
        </tr>
        <tr>
          <td><code>agentId</code></td>
          <td><code>string</code></td>
          <td>默认取 <code>VITE_WORK_WECHAT_AGENT_ID</code>。</td>
        </tr>
        <tr>
          <td><code>jsApiList</code></td>
          <td><code>string[]</code></td>
          <td>默认空数组；传入需要的 JSAPI。</td>
        </tr>
        <tr>
          <td><code>window</code></td>
          <td><code>Window</code></td>
          <td>默认 <code>defaultWindow</code>；UA 判定从这里读。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="UseWecomReturn">
        <tr>
          <td><code>ready</code></td>
          <td><code>ShallowRef&lt;boolean&gt;</code></td>
          <td><code>onAgentConfigSuccess</code> 之后为 <code>true</code>。</td>
        </tr>
        <tr>
          <td><code>ww</code></td>
          <td><code>typeof import('@wecom/jssdk')</code></td>
          <td><code>@wecom/jssdk</code> 命名空间；可直接调其 JSAPI。</td>
        </tr>
      </DemoApiTable>
    </template>

    <DemoBlock title="代码演示">
      <template #hint>
        playground 非企微环境且签名仍为 stub，无法交互演示；此处仅展示用法。需企微内置浏览器（UA 含
        <code>wxwork</code>）、 <code>VITE_WW_JSSDK_ENABLED=true</code>，并配置 corp/agent。
      </template>
      <DemoCode :code="codeDemo" lang="ts" />
    </DemoBlock>
  </DemoPage>
</template>
