import { beforeEach, describe, expect, it, vi } from "vitest";

// §8.0.1 ⑩：钉行为 —— 服务端少给某个单价时按默认值补齐，确认框不出现 undefined / NaN 积分。

const apiFetch = vi.fn();
vi.mock("./_client", () => ({
  USE_MOCK: false,
  mockDelay: <T,>(v: T) => Promise.resolve(v),
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

import { DRAMA_CONFIG_DEFAULTS, getDramaConfig, invalidateDramaConfig } from "./drama-config";

beforeEach(() => {
  apiFetch.mockReset();
  invalidateDramaConfig();
});

describe("getDramaConfig", () => {
  it("服务端没给 interactiveDraft：按默认值补上；给了的照用服务端的", async () => {
    apiFetch.mockResolvedValue({ confirmThreshold: 20, prices: { frame: 4, shortEntry: 12 } });
    const cfg = await getDramaConfig();
    expect(cfg.confirmThreshold).toBe(20);
    expect(cfg.prices.frame).toBe(4);
    expect(cfg.prices.shortEntry).toBe(12);
    expect(cfg.prices.interactiveDraft).toBe(DRAMA_CONFIG_DEFAULTS.prices.interactiveDraft);
  });

  it("服务端给了 interactiveDraft：用服务端的值", async () => {
    apiFetch.mockResolvedValue({ confirmThreshold: 10, prices: { ...DRAMA_CONFIG_DEFAULTS.prices, interactiveDraft: 25 } });
    expect((await getDramaConfig()).prices.interactiveDraft).toBe(25);
  });
});
