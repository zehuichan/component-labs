import { createApp } from 'vue';

import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import 'modern-normalize/modern-normalize.css';
import 'element-plus/dist/index.css';
import './styles/tailwind.css';

import { initComponentAdapter } from '@/adapter';
import App from './App.vue';
import { router } from './router';

initComponentAdapter();

createApp(App).use(router).use(ElementPlus, { locale: zhCn }).mount('#app');
