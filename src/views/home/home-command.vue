<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { CheckIcon, CopyIcon } from '@lucide/vue';

defineOptions({ name: 'HomeCommand' });

const props = defineProps<{ command: string }>();

const copied = ref(false);
let resetTimer: ReturnType<typeof setTimeout> | undefined;

async function copy() {
  try {
    await navigator.clipboard?.writeText(props.command);
  } catch {
    return;
  }

  copied.value = true;
  clearTimeout(resetTimer);
  resetTimer = setTimeout(() => (copied.value = false), 1600);
}

onBeforeUnmount(() => clearTimeout(resetTimer));
</script>

<template>
  <div
    class="flex items-start gap-3 rounded-md border border-border bg-[var(--code-canvas)] px-3 py-2.5"
  >
    <code
      class="min-w-0 flex-1 font-mono text-[12.5px] leading-relaxed break-all text-[var(--paper)]"
    >
      <span class="mr-1.5 select-none text-[var(--playground-accent)]">$</span>{{ props.command }}
    </code>

    <button
      type="button"
      class="flex size-6 shrink-0 items-center justify-center rounded-sm text-[var(--paper)]/55 transition-colors hover:bg-white/10 hover:text-[var(--paper)]"
      :aria-label="copied ? '已复制' : `复制命令 ${props.command}`"
      @click="copy"
    >
      <CheckIcon v-if="copied" class="size-3.5" aria-hidden="true" />
      <CopyIcon v-else class="size-3.5" aria-hidden="true" />
    </button>
  </div>
</template>
