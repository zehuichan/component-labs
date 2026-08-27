import { effectScope, type EffectScope } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQrconnect } from '../../use-qrconnect/use-qrconnect';
import { createWindowStub } from '../helpers/window-stub';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('useQrconnect', () => {
  let scope: EffectScope;

  beforeEach(() => {
    scope = effectScope();
    vi.stubEnv('VITE_WECHAT_OPEN_APPID', 'wx-open-test');
    vi.stubEnv('VITE_WECHAT_QR_REDIRECT_PATH', '/auth/wechat');
  });

  afterEach(() => {
    scope.stop();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function run(pathname: string, search: string, options: Parameters<typeof useQrconnect>[0] = {}) {
    const stub = createWindowStub({
      location: {
        protocol: 'https:',
        host: 'example.com',
        pathname,
        search,
        hash: '',
        origin: 'https://example.com',
        href: `https://example.com${pathname}${search}`,
      },
    });
    const result = scope.run(() => useQrconnect({ window: stub.window, ...options }));
    if (!result) throw new Error('scope did not return useQrconnect');
    return { ...result, navigate: stub.navigate };
  }

  it('syncs code from the URL search params', () => {
    const { code } = run('/auth/wechat', '?code=oauth-code-1&state=any-state');
    expect(code.value).toBe('oauth-code-1');
  });

  it('authorize redirects to qrconnect with history redirect_uri', () => {
    const { authorize, navigate } = run('/login', '');
    authorize();

    expect(navigate).toHaveBeenCalledTimes(1);
    const url = String(navigate.mock.calls[0]?.[0]);
    expect(url).toContain('https://open.weixin.qq.com/connect/qrconnect?');
    expect(url).toContain('appid=wx-open-test');
    expect(url).toContain('response_type=code');
    expect(url).toContain('scope=snsapi_login');
    expect(url).toContain('#wechat_redirect');
    expect(url.match(/state=([^&#]+)/)?.[1]).toMatch(UUID_PATTERN);

    const redirectUri = decodeURIComponent(url.match(/redirect_uri=([^&]+)/)?.[1] ?? '');
    expect(redirectUri).toBe('https://example.com/auth/wechat');
    expect(redirectUri.includes('#')).toBe(false);
  });

  it('authorize(redirect) replaces redirect_uri pathname', () => {
    const { authorize, navigate } = run('/login', '');
    authorize('/custom/callback');

    const url = String(navigate.mock.calls[0]?.[0]);
    const redirectUri = decodeURIComponent(url.match(/redirect_uri=([^&]+)/)?.[1] ?? '');
    expect(redirectUri).toBe('https://example.com/custom/callback');
  });

  it('honours an explicit redirectPath over the env default', () => {
    const { authorize, navigate } = run('/login', '', { redirectPath: '/sso/landing' });
    authorize();

    const url = String(navigate.mock.calls[0]?.[0]);
    const redirectUri = decodeURIComponent(url.match(/redirect_uri=([^&]+)/)?.[1] ?? '');
    expect(redirectUri).toBe('https://example.com/sso/landing');
  });
});
