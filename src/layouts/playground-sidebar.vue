<script setup lang="ts">
import { useRoute } from 'vue-router';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/ui/sidebar';

defineOptions({ name: 'PlaygroundSidebar' });

export interface PlaygroundNavLink {
  to: string;
  label: string;
  badge?: string;
}

export interface PlaygroundNavGroup {
  name: string;
  links: PlaygroundNavLink[];
}

defineProps<{
  groups: PlaygroundNavGroup[];
}>();

const route = useRoute();
</script>

<template>
  <Sidebar
    collapsible="none"
    class="h-full shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
  >
    <SidebarContent class="scrollbar-thin gap-6 overflow-y-auto px-3 py-5">
      <SidebarGroup v-for="group in groups" :key="group.name" class="p-0">
        <SidebarGroupLabel class="mb-2 h-auto px-3 text-[13px] font-semibold text-foreground">
          {{ group.name }}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu class="gap-0.5">
            <SidebarMenuItem v-for="link in group.links" :key="link.to">
              <SidebarMenuButton
                as-child
                :is-active="route.path === link.to"
                class="h-9 cursor-pointer rounded-md px-3 text-[13.5px] text-muted-foreground hover:bg-muted hover:text-foreground data-active:bg-transparent data-active:font-medium data-active:text-[var(--playground-accent)] data-active:hover:bg-muted data-active:hover:text-[var(--playground-accent)]"
              >
                <RouterLink :to="link.to">
                  <span>{{ link.label }}</span>
                  <span
                    v-if="link.badge"
                    class="shrink-0 rounded-full bg-[#d4ebea] px-1.5 py-px text-[10px] font-medium tracking-wide text-[var(--playground-accent)] lowercase dark:bg-[#0b6e6e40] dark:text-[var(--playground-accent)]"
                  >
                    {{ link.badge }}
                  </span>
                </RouterLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  </Sidebar>
</template>
