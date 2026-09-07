// canvas-bridge 的单元测试。
//
// 测的都是「错了不会报错、只会表现得很怪」的地方：
//   · 同一张图被下载回来又传一遍（多花一次钱、多一份对象）
//   · 签名过期后图裂，或者反过来把好地址擦成空串
//   · 生成失败被当成「成功但没有图」
//   · 项目还没加载完就自动保存，把服务端上真正的内容覆盖成空

import { beforeEach, describe, expect, it, vi } from "vitest";

const signKeysMock = vi.fn();
const uploadMock = vi.fn();

vi.mock("./api", () => ({
  signKeys: (...args: unknown[]) => signKeysMock(...args),
  uploadImage: (...args: unknown[]) => uploadMock(...args),
  currentProjectId: () => "IPP-test",
  setCurrentProjectId: vi.fn(),
  generate: vi.fn(),
  readRun: vi.fn(),
}));

import {
  collectImageStorageKeys, rememberUploaded, resolveImageUrl, uploadImage,
} from "./image-storage";

beforeEach(() => {
  signKeysMock.mockReset();
  uploadMock.mockReset();
  vi.useRealTimers();
});

describe("图片存储：已在 OSS 上的图不重复上传", () => {
  it("生成层登记过的地址，uploadImage 直接返回原记录", async () => {
    const record = {
      url: "https://cdn.test/a.png?sig=1",
      storageKey: "ipstudio_gen/u1/a.png",
      width: 768, height: 1024, bytes: 100, mimeType: "image/png",
    };
    rememberUploaded(record.url, record);

    const got = await uploadImage(record.url);

    expect(got).toBe(record);
    // 关键：不能再传一遍。画布的流程是「拿到图 → uploadImage 存起来」，
    // 而我们的图出生就在 OSS 上 —— 不短路就是每张成图都下载回来原样再传一次。
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("没登记过的地址仍然照常上传", async () => {
    uploadMock.mockResolvedValue({ key: "ipstudio_gen/u1/new.png", url: "https://cdn.test/new.png", fileName: "new.png" });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true, blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
    }) as unknown as typeof fetch;

    const got = await uploadImage("https://example.com/somewhere-else.png");

    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(got.storageKey).toBe("ipstudio_gen/u1/new.png");
  });
});

describe("签名地址：过期要换新的，换不到也别把好地址擦掉", () => {
  it("第一次问服务端，之后走缓存", async () => {
    signKeysMock.mockResolvedValue({ "k/1": "https://cdn.test/1?sig=a" });

    const first = await resolveImageUrl("k/1");
    const second = await resolveImageUrl("k/1");

    expect(first).toBe("https://cdn.test/1?sig=a");
    expect(second).toBe(first);
    expect(signKeysMock).toHaveBeenCalledTimes(1);
  });

  it("服务端签不出来时返回 fallback，而不是空串", async () => {
    // 空串会让 img 渲染成破图图标 —— 用户以为图丢了。
    // 保留旧地址至少还有机会命中浏览器缓存。
    signKeysMock.mockResolvedValue({});
    const url = await resolveImageUrl("k/missing", "https://cdn.test/old?sig=stale");
    expect(url).toBe("https://cdn.test/old?sig=stale");
  });

  it("网络抖动不该让画布上的图消失", async () => {
    signKeysMock.mockRejectedValue(new Error("network down"));
    const url = await resolveImageUrl("k/flaky", "https://cdn.test/old?sig=stale");
    expect(url).toBe("https://cdn.test/old?sig=stale");
  });

  it("没有 key 时直接给 fallback，不去打服务端", async () => {
    const url = await resolveImageUrl(undefined, "placeholder.png");
    expect(url).toBe("placeholder.png");
    expect(signKeysMock).not.toHaveBeenCalled();
  });
});

describe("收集存储键（清理与统计用）", () => {
  it("能从嵌套结构里把所有 storageKey 找出来", () => {
    const keys = collectImageStorageKeys({
      nodes: [
        { metadata: { storageKey: "a" } },
        { metadata: { images: [{ storageKey: "b" }, { storageKey: "c" }] } },
        { metadata: { prompt: "没有图的节点" } },
      ],
    });
    expect([...keys].sort()).toEqual(["a", "b", "c"]);
  });

  it("空值不炸", () => {
    expect(collectImageStorageKeys(null).size).toBe(0);
    expect(collectImageStorageKeys(undefined).size).toBe(0);
  });
});
