import { createApp } from 'vue';

import App from './App.vue';

// global css
import './assets/design';

import { router } from './router'

function bootstrap() {
  const app = createApp(App);

  app.use(router)
  app.mount('#app');
}

bootstrap();
