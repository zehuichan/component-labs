import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getToken, removeToken, TOKEN_KEY } from '../auth';
import { sso } from '../sso';

describe('sso', () => {
  beforeEach(() => {
    removeToken();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    removeToken();
    window.history.replaceState({}, '', '/');
  });

  it('no-ops when required query keys are missing', () => {
    const replace = vi.fn();
    vi.stubGlobal('location', {
      href: 'https://example.com/home?from=demo',
      replace,
    });

    sso();

    expect(getToken()).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('clears old token, stores SSO payload, and replaces URL', () => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ accessToken: 'old' }));

    const replace = vi.fn();
    vi.stubGlobal('location', {
      href: 'https://example.com/home?username=sso&roles=admin,editor&accessToken=tok&from=demo',
      replace,
    });

    sso();

    expect(getToken()).toEqual({
      accessToken: 'tok',
      username: 'sso',
      roles: ['admin', 'editor'],
    });
    expect(replace).toHaveBeenCalledWith('https://example.com/home?username=sso&from=demo');
  });

  it('supports hash-mode SSO callbacks', () => {
    const replace = vi.fn();
    vi.stubGlobal('location', {
      href: 'https://example.com/#/permission/page?username=sso&roles=admin&accessToken=eyJ',
      replace,
    });

    sso();

    expect(getToken()?.accessToken).toBe('eyJ');
    expect(replace).toHaveBeenCalledWith('https://example.com/#/permission/page?username=sso');
  });
});
