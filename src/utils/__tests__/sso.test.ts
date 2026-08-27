import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getToken, removeToken, TOKEN_KEY } from '../auth';
import { sso } from '../sso';

function stubWindow(href: string) {
  const replace = vi.fn();
  return { window: { location: { href, replace } } as unknown as Window, replace };
}

describe('sso', () => {
  beforeEach(() => {
    removeToken();
  });

  afterEach(() => {
    removeToken();
  });

  it('no-ops when required query keys are missing', () => {
    const { window, replace } = stubWindow('https://example.com/home?from=demo');

    expect(sso({ window })).toBe(false);
    expect(getToken()).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('clears old token, stores SSO payload, and replaces URL', () => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ accessToken: 'old' }));
    const { window, replace } = stubWindow(
      'https://example.com/home?username=sso&roles=admin,editor&accessToken=tok&from=demo',
    );

    expect(sso({ window })).toBe(true);
    expect(getToken()).toEqual({
      accessToken: 'tok',
      username: 'sso',
      roles: ['admin', 'editor'],
    });
    expect(replace).toHaveBeenCalledWith('https://example.com/home?username=sso&from=demo');
  });

  it('supports hash-mode SSO callbacks', () => {
    const { window, replace } = stubWindow(
      'https://example.com/#/permission/page?username=sso&roles=admin&accessToken=eyJ',
    );

    sso({ window });

    expect(getToken()?.accessToken).toBe('eyJ');
    expect(replace).toHaveBeenCalledWith('https://example.com/#/permission/page?username=sso');
  });

  it('reads hash credentials even when the base URL already has a query', () => {
    const { window, replace } = stubWindow(
      'https://example.com/?tenant=acme#/permission/page?username=sso&roles=admin&accessToken=eyJ',
    );

    sso({ window });

    expect(getToken()?.accessToken).toBe('eyJ');
    expect(replace).toHaveBeenCalledWith(
      'https://example.com/?tenant=acme#/permission/page?username=sso',
    );
  });

  it('keeps the hash route intact when credentials arrive in the search string', () => {
    const { window, replace } = stubWindow(
      'https://example.com/?username=sso&roles=admin&accessToken=eyJ#/permission/page?tab=list',
    );

    sso({ window });

    expect(getToken()?.accessToken).toBe('eyJ');
    expect(replace).toHaveBeenCalledWith(
      'https://example.com/?username=sso#/permission/page?tab=list',
    );
  });

  it('bails out without a window (SSR)', () => {
    expect(sso({ window: undefined })).toBe(false);
    expect(getToken()).toBeNull();
  });
});
