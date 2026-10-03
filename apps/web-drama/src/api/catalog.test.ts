import { beforeEach, describe, expect, it, vi } from "vitest";

// getCatalog 的两种读法（v0.197 第二轮）：
// 默认读法读失败回落 CATALOG_DEFAULTS（只是展示，不阻塞页面）；
// 严格读法读失败抛原始错误 —— 运营页读到什么就可能发布什么，不能拿默认值冒充线上内容。
const apiFetch = vi.fn();
vi.mock("./_client", () => ({
  USE_MOCK: false,
  mockDelay: <T,>(v: T) => Promise.resolve(v),
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

import { CATALOG_DEFAULTS, getCatalog, invalidateCatalog } from "./catalog";

const LIVE_TOPICS = [{ label: "线上热点", idea: "运营配过的" }];

beforeEach(() => {
  apiFetch.mockReset();
  invalidateCatalog();
});

describe("getCatalog", () => {
  it("默认读法：读失败回落内置默认", async () => {
    apiFetch.mockRejectedValue(new Error("HTTP 502"));
    await expect(getCatalog()).resolves.toBe(CATALOG_DEFAULTS);
  });

  it("严格读法：读失败抛原始错误，不回落默认", async () => {
    const err = new Error("Failed to fetch");
    apiFetch.mockRejectedValue(err);
    await expect(getCatalog({ strict: true })).rejects.toBe(err);
  });

  it("同一次请求进行中时，严格读和默认读各拿各的结果", async () => {
    const err = new Error("HTTP 502");
    apiFetch.mockRejectedValue(err);
    const loose = getCatalog();
    const strict = getCatalog({ strict: true });
    expect(apiFetch).toHaveBeenCalledTimes(1);
    await expect(loose).resolves.toBe(CATALOG_DEFAULTS);
    await expect(strict).rejects.toBe(err);
  });

  it("失败不缓存：下一次会重新请求；成功后缓存，后端没配的项照样补默认", async () => {
    apiFetch.mockRejectedValueOnce(new Error("HTTP 502"));
    await expect(getCatalog({ strict: true })).rejects.toBeTruthy();
    apiFetch.mockResolvedValueOnce({ contentTypes: null, templates: null, formats: null, hotTopics: LIVE_TOPICS, ideas: null });
    const got = await getCatalog({ strict: true });
    expect(got.hotTopics).toEqual(LIVE_TOPICS);
    expect(got.ideas).toBe(CATALOG_DEFAULTS.ideas);
    await getCatalog();
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
});
