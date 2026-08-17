<script setup lang="ts">
import { computed } from 'vue';
import {
  playgroundAds,
  playgroundSponsors,
  SPONSOR_INQUIRY_URL,
  type PlaygroundAd,
  type PlaygroundSponsor,
} from './sponsors';

defineOptions({ name: 'PlaygroundAside' });

const props = defineProps<{
  ads?: readonly PlaygroundAd[];
  sponsors?: readonly PlaygroundSponsor[];
}>();

const ads = computed(() => props.ads ?? playgroundAds);
const sponsors = computed(() => props.sponsors ?? playgroundSponsors);

function monogram(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const ascii = trimmed.match(/[A-Za-z0-9]/g)?.join('') ?? '';
  if (ascii.length >= 2) return ascii.slice(0, 2).toUpperCase();
  return Array.from(trimmed)[0]!.toUpperCase();
}

function sponsorLabel(sponsor: PlaygroundSponsor): string {
  return `${sponsor.name} — ${sponsor.slogan}`;
}
</script>

<template>
  <aside
    class="hidden w-[11.75rem] shrink-0 flex-col gap-7 border-l border-border bg-background px-3.5 pt-8 pb-16 xl:flex"
    aria-label="广告与赞助商"
  >
    <div class="sticky top-8 flex flex-col gap-7">
      <section v-if="ads.length > 0" class="flex flex-col gap-2.5">
        <h2 class="m-0 text-[12px] font-semibold tracking-wide text-muted-foreground">广告</h2>
        <a
          v-for="ad in ads"
          :key="ad.id"
          :href="ad.href"
          target="_blank"
          rel="noopener noreferrer sponsored"
          class="group block overflow-hidden rounded-[var(--radius-xs)] border border-border bg-muted/40 transition-colors hover:border-[color-mix(in_oklab,var(--playground-accent)_45%,var(--border))] hover:bg-muted"
        >
          <img
            v-if="ad.image"
            :src="ad.image"
            :alt="ad.title"
            class="block h-[4.5rem] w-full object-cover"
            loading="lazy"
          />
          <div v-else class="flex flex-col gap-1.5 px-3 py-3">
            <span
              class="text-[13px] font-semibold tracking-tight text-foreground transition-colors group-hover:text-[var(--playground-accent)]"
            >
              {{ ad.title }}
            </span>
            <span class="text-[11.5px] leading-relaxed text-muted-foreground">
              {{ ad.description }}
            </span>
          </div>
        </a>
      </section>

      <section class="flex flex-col gap-2.5">
        <h2 class="m-0 text-[12px] font-semibold tracking-wide text-muted-foreground">赞助商</h2>

        <ul v-if="sponsors.length > 0" class="m-0 flex list-none flex-col gap-2 p-0">
          <li v-for="sponsor in sponsors" :key="sponsor.id">
            <a
              :href="sponsor.href"
              :title="sponsorLabel(sponsor)"
              target="_blank"
              rel="noopener noreferrer sponsored"
              class="group flex items-start gap-2.5 rounded-[var(--radius-xs)] border border-border px-2.5 py-2 transition-colors hover:border-[color-mix(in_oklab,var(--playground-accent)_45%,var(--border))] hover:bg-muted"
            >
              <img
                v-if="sponsor.logo"
                :src="sponsor.logo"
                :alt="sponsor.name"
                class="size-8 shrink-0 rounded-[3px] object-contain"
                loading="lazy"
              />
              <span
                v-else
                class="flex size-8 shrink-0 items-center justify-center rounded-[3px] bg-[var(--brand)] text-[10px] font-semibold tracking-tight text-[var(--brand-on)]"
                aria-hidden="true"
              >
                {{ monogram(sponsor.name) }}
              </span>
              <span class="min-w-0 flex flex-col gap-0.5">
                <span
                  class="truncate text-[12.5px] font-medium text-foreground transition-colors group-hover:text-[var(--playground-accent)]"
                >
                  {{ sponsor.name }}
                </span>
                <span class="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                  {{ sponsor.slogan }}
                </span>
              </span>
            </a>
          </li>
        </ul>

        <a
          :href="SPONSOR_INQUIRY_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="flex flex-col items-center justify-center gap-1 rounded-[var(--radius-xs)] border border-dashed border-border px-3 py-5 text-center transition-colors hover:border-[color-mix(in_oklab,var(--playground-accent)_50%,var(--border))] hover:bg-muted/60"
        >
          <span class="text-[12.5px] font-medium text-foreground">成为赞助商</span>
          <span class="text-[11px] leading-snug text-muted-foreground">支持开源 · 展示品牌</span>
        </a>
      </section>
    </div>
  </aside>
</template>
