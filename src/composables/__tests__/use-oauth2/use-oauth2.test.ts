import { effectScope, type EffectScope } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOauth2 } from '../../use-oauth2/use-oauth2';
import { createWindowStub } from '../helpers/window-stub';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('useOauth2', () => {
  let scope: EffectScope;

  beforeEach(() => {
    scope = effectScope();
    vi.stubEnv('VITE_WECHAT_APPID', 'wx-test-appid');
  });

  afterEach(() => {
    scope.stop();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function run(search: string, options: Parameters<typeof useOauth2>[0] = {}) {
    const stub = createWindowStub({
      location: {
        protocol: 'https:',
        host: 'example.com',
        pathname: '/app/home',
        search,
        hash: '',
        origin: 'https://example.com',
        href: `https://example.com/app/home${search}`,
      },
    });
    const result = scope.run(() => useOauth2({ window: stub.window, ...options }));
    if (!result) throw new Error('scope did not return useOauth2');
    return { ...result, navigate: stub.navigate };
  }

  it('syncs code from the URL search params', () => {
    const { code } = run('?code=oauth-code-1&from=demo');
    expect(code.value).toBe('oauth-code-1');
  });

  it('leaves code undefined before the callback lands', () => {
    const { code } = run('?from=demo');
    expect(code.value).toBeUndefined();
  });

  it('authorize redirects with history redirect_uri (no hash path)', () => {
    const { authorize, navigate } = run('?from=demo', { scope: 'snsapi_base' });
    authorize();

    expect(navigate).toHaveBeenCalledTimes(1);
    const url = String(navigate.mock.calls[0]?.[0]);
    expect(url).toContain('https://open.weixin.qq.com/connect/oauth2/authorize?');
    expect(url).toContain('appid=wx-test-appid');
    expect(url).toContain('response_type=code');
    expect(url).toContain('scope=snsapi_base');
    expect(url).toContain('#wechat_redirect');
    expect(url.match(/state=([^&#]+)/)?.[1]).toMatch(UUID_PATTERN);

    const redirectUri = decodeURIComponent(url.match(/redirect_uri=([^&]+)/)?.[1] ?? '');
    expect(redirectUri).toBe('https://example.com/app/home?from=demo');
    expect(redirectUri.includes('#')).toBe(false);
  });

  it('authorize(redirect) replaces pathname', () => {
    const { authorize, navigate } = run('?from=demo');
    authorize('/login');

    const url = String(navigate.mock.calls[0]?.[0]);
    const redirectUri = decodeURIComponent(url.match(/redirect_uri=([^&]+)/)?.[1] ?? '');
    expect(redirectUri).toBe('https://example.com/login?from=demo');
  });

  it('honours an explicit appId over the env default', () => {
    const { authorize, navigate } = run('', { appId: 'wx-explicit' });
    authorize();

    expect(String(navigate.mock.calls[0]?.[0])).toContain('appid=wx-explicit');
  });
});
