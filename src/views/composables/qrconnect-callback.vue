<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQrconnect } from '@/composables';
import { Button } from '@/ui/button';

defineOptions({ name: 'QrconnectCallback' });

type MockToken = {
  accessToken: string;
  openid: string;
};

/** Playground stub — replace with real backend exchange. */
async function mockExchangeCode(oauthCode: string): Promise<MockToken> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (!oauthCode) throw new Error('missing code');
  const slice = oauthCode.slice(0, 8);
  return {
    accessToken: `mock-access-token-${slice}`,
    openid: `mock-openid-${slice}`,
  };
}

const router = useRouter();
const { code } = useQrconnect();

const exchanging = ref(false);
const token = ref<MockToken | undefined>(undefined);
const exchangeError = ref<string | undefined>(undefined);
let exchangedFor: string | undefined;

watch(
  code,
  async (oauthCode) => {
    if (!oauthCode) return;
    if (exchangedFor === oauthCode) return;
    exchangedFor = oauthCode;

    exchanging.value = true;
    exchangeError.value = undefined;
    try {
      token.value = await mockExchangeCode(oauthCode);
    } catch (error) {
      exchangeError.value = error instanceof Error ? error.message : String(error);
    } finally {
      exchanging.value = false;
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="mx-auto max-w-lg space-y-4 p-8">
    <h1 class="text-xl font-semibold">微信扫码回调</h1>
    <p class="text-sm text-muted-foreground">
      URL 带回
      <code>code</code>
      后在此换票（playground stub）。
    </p>

    <dl class="space-y-2 text-sm">
      <div>
        <dt class="text-muted-foreground">code</dt>
        <dd>
          <code>{{ code ?? '—' }}</code>
        </dd>
      </div>
      <div>
        <dt class="text-muted-foreground">exchanging</dt>
        <dd>
          <code>{{ exchanging }}</code>
        </dd>
      </div>
      <div>
        <dt class="text-muted-foreground">token</dt>
        <dd>
          <code>{{ token ? JSON.stringify(token) : '—' }}</code>
        </dd>
      </div>
      <div v-if="exchangeError">
        <dt class="text-muted-foreground">exchangeError</dt>
        <dd class="text-destructive">
          <code>{{ exchangeError }}</code>
        </dd>
      </div>
    </dl>

    <Button v-if="token" type="button" @click="router.push('/composables/use-qrconnect')">
      返回 demo
    </Button>
  </div>
</template>
