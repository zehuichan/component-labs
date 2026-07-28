<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { SidebarInset, SidebarProvider } from '@/ui/sidebar';
import PlaygroundHeader from './playground-header.vue';
import PlaygroundSidebar from './playground-sidebar.vue';
import '@/styles/index.scss';

defineOptions({ name: 'PlaygroundLayout' });

type CategoryKey = 'components' | 'composables' | 'packages';

interface CategoryConfig {
  key: CategoryKey;
  groups: readonly string[];
}

const categories: readonly CategoryConfig[] = [
  { key: 'components', groups: ['PlusTable', 'ERP 场景'] },
  { key: 'composables', groups: ['Form', 'WeChat'] },
  { key: 'packages', groups: [] },
];

const route = useRoute();
const router = useRouter();
const activeCategory = ref<CategoryKey>('components');

function groupRoutes(group: string) {
  return router
    .getRoutes()
    .filter((item) => item.meta.group === group)
    .sort((left, right) => Number(left.meta.order) - Number(right.meta.order));
}

function categoryForGroup(group: unknown): CategoryKey | undefined {
  if (typeof group !== 'string') return undefined;
  return categories.find((category) => category.groups.includes(group))?.key;
}

const navGroups = computed(() => {
  const groups = categories.find((category) => category.key === activeCategory.value)?.groups ?? [];

  return groups.map((group) => ({
    name: group,
    links: groupRoutes(group).map((item) => ({
      to: item.path,
      label: String(item.meta.title),
      badge: typeof item.meta.badge === 'string' ? item.meta.badge : undefined,
    })),
  }));
});

watch(
  () => route.meta.group,
  (group) => {
    const category = categoryForGroup(group);
    if (category) activeCategory.value = category;
  },
  { immediate: true },
);

function selectCategory(key: string): void {
  const category = categories.find((item) => item.key === key);
  if (!category) return;

  const firstRoute = category.groups.flatMap(groupRoutes)[0];
  if (!firstRoute) return;

  activeCategory.value = category.key;
  if (route.path !== firstRoute.path) void router.push(firstRoute.path);
}
</script>

<template>
  <div class="flex h-svh flex-col overflow-hidden bg-background">
    <PlaygroundHeader
      :categories="[...categories]"
      :active-category="activeCategory"
      @select="selectCategory"
    />
    <SidebarProvider class="flex-1 overflow-hidden !min-h-0">
      <PlaygroundSidebar :groups="navGroups" />
      <SidebarInset class="min-h-0 min-w-0 overflow-hidden bg-background">
        <div class="scrollbar-thin h-full overflow-y-auto px-10 pt-8 pb-16">
          <router-view />
        </div>
      </SidebarInset>
    </SidebarProvider>
  </div>
</template>
