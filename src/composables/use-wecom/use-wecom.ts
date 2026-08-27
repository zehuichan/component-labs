import { shallowRef, type ShallowRef } from 'vue';
import { createGlobalState, defaultWindow, type ConfigurableWindow } from '@vueuse/core';
import * as ww from '@wecom/jssdk';
import { getAppJsApiTicket, getJsApiTicket } from '@/api/signature';

export interface UseWecomOptions extends ConfigurableWindow {
  /** Whether the bootstrap may run. Defaults to `VITE_WW_JSSDK_ENABLED === 'true'`. */
  enabled?: boolean;
  /** Corp id. Defaults to `VITE_WORK_WECHAT_CORP_ID`. */
  corpId?: string;
  /** Agent id. Defaults to `VITE_WORK_WECHAT_AGENT_ID`. */
  agentId?: string;
  /** JSAPIs to register. The playground needs none. */
  jsApiList?: string[];
}

export interface UseWecomReturn {
  /** True only after `onAgentConfigSuccess`. */
  ready: ShallowRef<boolean>;
  /** The `@wecom/jssdk` namespace. */
  ww: typeof ww;
}

function isWecomBrowser(window: Window | undefined): boolean {
  return /wxwork/i.test(window?.navigator.userAgent ?? '');
}

/**
 * WeCom JSSDK bootstrap (single global `ww.register`).
 *
 * Mirrors `useWechat`; the register shape follows `@wecom/jssdk`. Options apply
 * on the first call only — `createGlobalState` memoises the one bootstrap
 * shared by the whole app.
 *
 * @example
 * const { ready, ww } = useWecom()
 * watch(ready, (ok) => {
 *   if (!ok) return
 *   void ww.getLocation({ type: 'gcj02' })
 * })
 */
export const useWecom = createGlobalState((options: UseWecomOptions = {}): UseWecomReturn => {
  const {
    window = defaultWindow,
    enabled = import.meta.env.VITE_WW_JSSDK_ENABLED === 'true',
    corpId = import.meta.env.VITE_WORK_WECHAT_CORP_ID ?? '',
    agentId = import.meta.env.VITE_WORK_WECHAT_AGENT_ID,
    jsApiList = [],
  } = options;

  const ready = shallowRef(false);
  let pending: Promise<void> | null = null;

  async function setup() {
    if (!enabled || !isWecomBrowser(window)) {
      ready.value = false;
      return;
    }
    if (pending) return pending;

    pending = (async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          ww.register({
            corpId,
            agentId,
            jsApiList,
            getConfigSignature: async () => getJsApiTicket(),
            getAgentConfigSignature: async () => getAppJsApiTicket(),
            onConfigFail: (err) => {
              ready.value = false;
              pending = null;
              console.error('[ww.config]', err);
              reject(err);
            },
            onAgentConfigSuccess: () => {
              ready.value = true;
              resolve();
            },
            onAgentConfigFail: (err) => {
              ready.value = false;
              pending = null;
              console.error('[ww.agentConfig]', err);
              reject(err);
            },
          });
        });
      } catch (error) {
        ready.value = false;
        pending = null;
        console.error('[ww.register]', error);
      }
    })();

    return pending;
  }

  void setup();

  return { ready, ww };
});
