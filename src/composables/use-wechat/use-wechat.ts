import { shallowRef, type ShallowRef } from 'vue';
import { createGlobalState, defaultWindow, type ConfigurableWindow } from '@vueuse/core';
import { getJsApiTicket } from '@/api/signature';

export interface UseWechatOptions extends ConfigurableWindow {
  /** Whether the bootstrap may run. Defaults to `VITE_JSSDK_ENABLED === 'true'`. */
  enabled?: boolean;
}

export interface UseWechatReturn {
  /** True once `wx.ready` fires. */
  ready: ShallowRef<boolean>;
  /** Global `wx`, `undefined` outside the WeChat browser. */
  wx: WeixinJsSdk | undefined;
}

function isWechatBrowser(window: Window | undefined): boolean {
  return /MicroMessenger/i.test(window?.navigator.userAgent ?? '');
}

/**
 * WeChat JSSDK bootstrap (single global `wx.config`).
 *
 * Skips when not inside WeChat, when disabled, or when `window.wx` is absent.
 * Options apply on the first call only — `createGlobalState` memoises the one
 * bootstrap shared by the whole app.
 *
 * @example
 * const { ready, wx } = useWechat()
 * wx?.scanQRCode?.({ needResult: 1, success: console.log })
 */
export const useWechat = createGlobalState((options: UseWechatOptions = {}): UseWechatReturn => {
  const { window = defaultWindow, enabled = import.meta.env.VITE_JSSDK_ENABLED === 'true' } =
    options;

  const ready = shallowRef(false);
  const wx = window?.wx;
  let pending: Promise<void> | null = null;

  async function setup() {
    if (!enabled || !wx || !isWechatBrowser(window)) {
      ready.value = false;
      return;
    }
    if (pending) return pending;

    pending = (async () => {
      try {
        const data = await getJsApiTicket();

        await new Promise<void>((resolve, reject) => {
          wx.config({ debug: false, ...data });
          wx.ready(() => {
            ready.value = true;
            resolve();
          });
          wx.error((err) => {
            ready.value = false;
            pending = null;
            console.error('[wx.config]', err);
            reject(err);
          });
        });
      } catch (error) {
        ready.value = false;
        pending = null;
        console.error('[wx.config]', error);
      }
    })();

    return pending;
  }

  void setup();

  return { ready, wx };
});
