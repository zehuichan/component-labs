import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWindowStub } from '../helpers/window-stub';

const { getJsApiTicketMock } = vi.hoisted(() => ({
  getJsApiTicketMock: vi.fn(),
}));

vi.mock('@/api/signature', () => ({
  getJsApiTicket: getJsApiTicketMock,
  getAppJsApiTicket: vi.fn(),
}));

const WECHAT_UA = 'Mozilla/5.0 MicroMessenger/8.0.0';

async function loadUseWechat() {
  return import('../../use-wechat/use-wechat');
}

function mockWx(handlers?: {
  onConfig?: (config: Record<string, unknown>) => void;
  readyMode?: 'ready' | 'error';
  errorPayload?: unknown;
}) {
  const readyMode = handlers?.readyMode ?? 'ready';
  return {
    config: vi.fn((config: Record<string, unknown>) => {
      handlers?.onConfig?.(config);
    }),
    ready: vi.fn((fn: () => void) => {
      if (readyMode === 'ready') fn();
    }),
    error: vi.fn((fn: (err: unknown) => void) => {
      if (readyMode === 'error') fn(handlers?.errorPayload ?? new Error('wx error'));
    }),
  };
}

function wechatWindow(wx: WeixinJsSdk, userAgent = WECHAT_UA) {
  return createWindowStub({ wx, navigator: { userAgent } }).window;
}

describe('useWechat', () => {
  beforeEach(() => {
    vi.resetModules();
    getJsApiTicketMock.mockReset();
    vi.stubEnv('VITE_JSSDK_ENABLED', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('does not initialize outside WeChat', async () => {
    const wx = mockWx();
    const mod = await loadUseWechat();

    const { ready } = mod.useWechat({ window: wechatWindow(wx, 'Mozilla/5.0 Chrome/120') });
    await Promise.resolve();
    await Promise.resolve();

    expect(ready.value).toBe(false);
    expect(getJsApiTicketMock).not.toHaveBeenCalled();
    expect(wx.config).not.toHaveBeenCalled();
  });

  it('does not initialize when disabled', async () => {
    vi.stubEnv('VITE_JSSDK_ENABLED', 'false');
    const wx = mockWx();
    const mod = await loadUseWechat();

    const { ready } = mod.useWechat({ window: wechatWindow(wx) });
    await Promise.resolve();
    await Promise.resolve();

    expect(ready.value).toBe(false);
    expect(getJsApiTicketMock).not.toHaveBeenCalled();
    expect(wx.config).not.toHaveBeenCalled();
  });

  it('honours an explicit enabled flag over the env default', async () => {
    vi.stubEnv('VITE_JSSDK_ENABLED', 'false');
    const wx = mockWx();
    getJsApiTicketMock.mockResolvedValue({ timestamp: 1, nonceStr: 'n', signature: 's' });
    const mod = await loadUseWechat();

    const { ready } = mod.useWechat({ window: wechatWindow(wx), enabled: true });
    await vi.waitFor(() => {
      expect(ready.value).toBe(true);
    });
  });

  it('configures wx and sets ready on success', async () => {
    const wx = mockWx({ readyMode: 'ready' });
    getJsApiTicketMock.mockResolvedValue({
      timestamp: 1,
      nonceStr: 'n',
      signature: 's',
    });
    const mod = await loadUseWechat();

    const { ready, wx: sdk } = mod.useWechat({ window: wechatWindow(wx) });
    await vi.waitFor(() => {
      expect(ready.value).toBe(true);
    });

    expect(sdk).toBe(wx);
    expect(getJsApiTicketMock).toHaveBeenCalled();
    expect(wx.config).toHaveBeenCalledWith({
      debug: false,
      timestamp: 1,
      nonceStr: 'n',
      signature: 's',
    });
  });

  it('sets ready false when wx.error fires', async () => {
    const wx = mockWx({ readyMode: 'error' });
    getJsApiTicketMock.mockResolvedValue({
      timestamp: 0,
      nonceStr: '',
      signature: '',
    });
    const mod = await loadUseWechat();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { ready } = mod.useWechat({ window: wechatWindow(wx) });
    await vi.waitFor(() => {
      expect(wx.error).toHaveBeenCalled();
    });
    expect(ready.value).toBe(false);
    errorSpy.mockRestore();
  });

  it('sets ready false when getJsApiTicket rejects', async () => {
    const wx = mockWx({ readyMode: 'ready' });
    getJsApiTicketMock.mockRejectedValue(new Error('api down'));
    const mod = await loadUseWechat();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { ready } = mod.useWechat({ window: wechatWindow(wx) });
    await vi.waitFor(() => {
      expect(errorSpy).toHaveBeenCalled();
    });
    expect(ready.value).toBe(false);
    errorSpy.mockRestore();
  });
});
