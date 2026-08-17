<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import GithubMark from '@/components/brand/github-mark.vue';
import WorkbenchMark from '@/components/brand/workbench-mark.vue';
import { cn } from '@/utils';
import { inkBandActive } from './site-ink-band';

defineOptions({ name: 'SiteHeader' });

const scrolled = ref(false);

function syncScrolled() {
  scrolled.value = window.scrollY > 8;
}

onMounted(() => {
  if (typeof window === 'undefined') return;
  syncScrolled();
  window.addEventListener('scroll', syncScrolled, { passive: true });
});

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return;
  window.removeEventListener('scroll', syncScrolled);
});
</script>

<template>
  <header
    :class="
      cn(
        'sticky top-0 z-30 border-b transition-colors duration-300',
        inkBandActive && 'dark text-foreground',
        scrolled
          ? 'border-border bg-[var(--site-nav)] backdrop-blur-md supports-[backdrop-filter]:bg-[var(--site-nav)]'
          : 'border-transparent bg-transparent',
      )
    "
  >
    <div class="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-6 px-6">
      <RouterLink
        to="/"
        class="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-foreground"
        aria-label="Workbench 首页"
      >
        <WorkbenchMark />
        <span>Workbench</span>
      </RouterLink>

      <a
        href="https://github.com/zehuichan/workbench"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub repository"
        class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
      >
        <GithubMark class="size-4" />
      </a>
    </div>
  </header>
</template>
