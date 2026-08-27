import { shallowRef, watchEffect, type ShallowRef } from 'vue';
import { defaultWindow, useUrlSearchParams, type ConfigurableWindow } from '@vueuse/core';

const AUTHORIZE_ENDPOINT = 'https://open.weixin.qq.com/connect/oauth2/authorize';

export type Oauth2Scope = 'snsapi_base' | 'snsapi_userinfo';

/** Where `code` is read from once WeChat redirects back. */
export type Oauth2ParamsMode = 'history' | 'hash' | 'hash-params';

export interface UseOauth2Options extends ConfigurableWindow {
  /** Official account AppId. Defaults to `VITE_WECHAT_APPID`. */
  appId?: string;
  /** Authorization scope requested from WeChat. */
  scope?: Oauth2Scope;
  /** Router mode, so hash-routed apps still find `code`. */
  mode?: Oauth2ParamsMode;
}

export interface UseOauth2Return {
  /** `code` from the current URL; `undefined` until WeChat redirects back. */
  code: ShallowRef<string | undefined>;
  /** Leaves for WeChat's authorize endpoint, returning to `redirect`. */
  authorize: (redirect?: string) => void;
}

/**
 * WeChat web OAuth helper.
 *
 * `state` uses `crypto.randomUUID()` (unguessable, per RFC 6749 §10.12)
 * instead of a timestamp. Validate it server-side when exchanging `code`.
 *
 * @example
 * const { code, authorize } = useOauth2()
 * authorize('/login')
 */
export function useOauth2(options: UseOauth2Options = {}): UseOauth2Return {
  const {
    window = defaultWindow,
    appId = import.meta.env.VITE_WECHAT_APPID ?? '',
    scope = 'snsapi_userinfo',
    mode = 'history',
  } = options;

  const params = useUrlSearchParams(mode, { window });
  const code = shallowRef<string | undefined>(undefined);

  watchEffect(() => {
    const value = params.code;
    code.value = typeof value === 'string' ? value : undefined;
  });

  function authorize(redirect?: string): void {
    if (!window) return;
    const { protocol, host, pathname, search } = window.location;
    const nextPath = redirect ? (redirect.startsWith('/') ? redirect : `/${redirect}`) : pathname;
    const redirectUri = `${protocol}//${host}${nextPath}${search}`;
    window.location.href =
      `${AUTHORIZE_ENDPOINT}?appid=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code&scope=${scope}&state=${window.crypto.randomUUID()}#wechat_redirect`;
  }

  return { code, authorize };
}
