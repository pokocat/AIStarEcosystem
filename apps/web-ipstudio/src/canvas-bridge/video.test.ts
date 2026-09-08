// 视频提交层的回归。
//
// 真实事故（v0.176）：用户在面板上选了清晰度、比例、秒数，点发送却报
// 「请提供视频时长」。原因是画布调的是
//   createVideoGenerationTask(config, prompt, images, { signal, videos, audios })
// —— 那几项全在 **config** 里，options 里一个都没有，而这一层只读 options。
// VideoMediaOptions 全是可选字段，所以 typecheck 一声不吭。

import { beforeEach, describe, expect, it, vi } from "vitest";

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
