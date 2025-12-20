import { createApp } from 'vue';

import App from './App.vue';

// global css
import './assets/design';

import { initComponentAdapter } from './adapter/component';
import { router } from './router'

async function bootstrap() {
  const app = createApp(App);

 await initComponentAdapter();

  app.use(router)
  app.mount('#app');
}

bootstrap();
