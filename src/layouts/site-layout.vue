<script setup lang="ts">
import SiteFooter from './site-footer.vue';
import SiteHeader from './site-header.vue';

defineOptions({ name: 'SiteLayout' });
</script>

<template>
  <div class="flex min-h-svh flex-col bg-[var(--site-canvas)] text-foreground">
    <SiteHeader />
    <main class="flex-1">
      <router-view />
    </main>
    <SiteFooter />
  </div>
</template>
