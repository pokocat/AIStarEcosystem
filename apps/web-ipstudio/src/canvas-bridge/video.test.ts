// 视频提交层的回归。
//
// 真实事故（v0.176）：用户在面板上选了清晰度、比例、秒数，点发送却报
// 「请提供视频时长」。原因是画布调的是
//   createVideoGenerationTask(config, prompt, images, { signal, videos, audios })
// —— 那几项全在 **config** 里，options 里一个都没有，而这一层只读 options。
// VideoMediaOptions 全是可选字段，所以 typecheck 一声不吭。

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const generateVideoMock = vi.fn();
vi.mock("./api", () => ({
  generateVideo: (...a: unknown[]) => generateVideoMock(...a),
  readVideoJob: vi.fn(),
  currentProjectId: () => "IPP-test",
}));
vi.mock("./models", () => ({
  endpointIdFor: (v?: string) => (v ? `ep-${v}` : undefined),
  videoDurationBoundsFor: () => undefined,
}));

import { createVideoGenerationTask } from "./video";

const cfg = {
  videoSeconds: "8",
  size: "720x1280",
  videoModel: "MiniMax H3",
  videoMode: "frames",
} as never;

beforeEach(() => {
  generateVideoMock.mockReset();
  generateVideoMock.mockResolvedValue({ id: "MVJ-1" });
});

describe("画布视频提交", () => {
  it("面板上选的时长 / 比例 / 模型都要送到服务端", async () => {
    await createVideoGenerationTask(cfg, "让她眨眼", [{ storageKey: "ipstudio_gen/u/a.png" }], {
      // 画布真实的调用形状：只有这三样
      signal: undefined, videos: [], audios: [],
    });
    const [, body] = generateVideoMock.mock.calls[0];
    expect(body.durationSec).toBe(8);
    expect(body.aspectRatio).toBe("9:16");   // 720x1280 → 9:16
    expect(body.model).toBe("ep-MiniMax H3");
    expect(body.refKey).toBe("ipstudio_gen/u/a.png");
  });

  it("options 显式给的值优先于 config", async () => {
    await createVideoGenerationTask(cfg, "x", [], { seconds: "5", aspectRatio: "16:9" });
    const [, body] = generateVideoMock.mock.calls[0];
    expect(body.durationSec).toBe(5);
    expect(body.aspectRatio).toBe("16:9");
  });

  it("比例是 auto 就不传 —— 交给服务端默认，不瞎猜一个塞过去", async () => {
    await createVideoGenerationTask({ ...cfg, size: "auto" } as never, "x", []);
    expect(generateVideoMock.mock.calls[0][1].aspectRatio).toBeUndefined();
  });

  it("真的没有时长时当场说清楚，不让服务端回一句「请提供视频时长」", async () => {
    await expect(
      createVideoGenerationTask({ ...cfg, videoSeconds: "" } as never, "x", []),
    ).rejects.toThrow(/时长/);
    expect(generateVideoMock).not.toHaveBeenCalled();
  });

  it("全能参考模式我们还没有 —— 明说，不悄悄按首帧跑", async () => {
    await expect(
      createVideoGenerationTask({ ...cfg, videoMode: "reference" } as never, "x", []),
    ).rejects.toThrow(/首帧/);
    expect(generateVideoMock).not.toHaveBeenCalled();
  });
});

// 轮询路径必须打在 ip-studio 域自己的接口上。
// v0.177 之前打的是 `/me/material/videos/jobs/{id}` —— 服务端从来没实现过那条路径，
// 先被开通闸判成「该接口尚未登记子产品归属」403，登记了路由也还是 404；
// 而带货线那条同名接口把 app 写死成 celebrity（v0.108 分区），拿它查画布任务只会查不到。
describe("视频任务轮询路径", () => {
  it("打的是 ip-studio 自己的接口，不是带货线那条", async () => {
    const src = readFileSync(join(__dirname, "api.ts"), "utf8");
    // 只看真正发出去的模板字面量，注释里提到旧路径不算（那是在解释为什么不能用它）
    const urls = [...src.matchAll(/apiFetch<[^>]*>\(\s*`([^`]+)`/g)].map((m) => m[1]);
    expect(urls).toContain("/v1/ip-studio/videos/${encodeURIComponent(jobId)}");
    expect(urls.some((u) => u.includes("/me/material/"))).toBe(false);
  });
});

// 名片一键建卡：body 必须给对象。共享 apiFetch 自己会序列化，
// 调用方再 JSON.stringify 一遍就是双重编码 —— 服务端 500，前端只显示
// 「服务器处理请求失败」（v0.178 线上踩过）。
describe("一键建数字名片", () => {
  it("body 传对象，不自己 stringify", async () => {
    const src = readFileSync(join(__dirname, "../api/assets.ts"), "utf8");
    const call = src.slice(src.indexOf("/v1/card/from-avatar"));
    expect(call).toContain("body: { avatarId }");
    expect(call.slice(0, 200)).not.toContain("JSON.stringify");
  });
});
