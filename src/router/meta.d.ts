import 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    group?: string;
    order?: number;
    badge?: string;
  }
}

export {};
