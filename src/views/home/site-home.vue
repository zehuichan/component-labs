<script setup lang="ts">
import HomeCapabilities from './home-capabilities.vue';
import HomeCta from './home-cta.vue';
import HomeHero from './home-hero.vue';
import HomeStart from './home-start.vue';
import HomeStories from './home-stories.vue';

defineOptions({ name: 'SiteHome' });
</script>

<template>
  <div>
    <HomeHero />
    <HomeCapabilities />
    <HomeStories />
    <HomeStart />
    <HomeCta />
  </div>
</template>
