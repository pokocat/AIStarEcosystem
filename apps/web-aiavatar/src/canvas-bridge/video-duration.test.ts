// 视频时长：**显示、保存、提交必须是同一个值**（v0.179）。
//
// v0.176 给滑杆接上了「按模型能力夹区间」，但只夹了显示：旧节点存的 4 秒、
// 切到最短 5 秒的模型之后，屏幕上是 5、提交出去还是 4 —— 服务端 400
// `VIDEO_DURATION_UNSUPPORTED`，而用户明明看到的是 5。上限切换同理（显示 15、提交 30）。
//
// 另外区间要按**节点上选的那个模型**取：`config.model` 才是「节点 > 全局」合并后的结果，
// `videoModel` 永远是全局默认。取错模型 = 按另一个模型的区间去夹这个模型的时长。

import { beforeEach, describe, expect, it, vi } from "vitest";

const boundsMock = vi.fn();
vi.mock("./models", () => ({
  endpointIdFor: (v?: string | null) => (v ? `ep-${v}` : undefined),
  videoDurationBoundsFor: (v?: string | null) => boundsMock(v),
}));
const generateVideoMock = vi.fn();
vi.mock("./api", () => ({
  generateVideo: (...a: unknown[]) => generateVideoMock(...a),
  readVideoJob: vi.fn(),
  currentProjectId: () => "IPP-test",
}));
// i18n 在这条测试里只被 media-size / 面板模块间接引到，node 环境下不需要真实资源
import { effectiveVideoSeconds } from "@/canvas/components/video-settings-panel";
import { createVideoGenerationTask } from "./video";

beforeEach(() => {
  boundsMock.mockReset().mockReturnValue(undefined);
  generateVideoMock.mockReset().mockResolvedValue({ id: "MVJ-1" });
});

describe("有效时长是按哪个模型算的", () => {
  it("用节点上选的模型（config.model），不是全局默认（videoModel）", () => {
    boundsMock.mockImplementation((value: string) => (value === "节点选的" ? { min: 5, max: 15 } : { min: 4, max: 30 }));
    const out = effectiveVideoSeconds({ videoSeconds: "4", model: "节点选的", videoModel: "全局默认" });
    expect(boundsMock).toHaveBeenCalledWith("节点选的");
    expect(out).toMatchObject({ seconds: 5, min: 5, max: 15 });
  });

  it("调用方只有全局 config（没有 model）时才回落 videoModel", () => {
    boundsMock.mockReturnValue({ min: 5, max: 15 });
    effectiveVideoSeconds({ videoSeconds: "8", model: "", videoModel: "全局默认" });
    expect(boundsMock).toHaveBeenCalledWith("全局默认");
  });

  it("拿不到区间就用画布自己的默认范围，不臆造限制", () => {
    boundsMock.mockReturnValue(undefined);
    const out = effectiveVideoSeconds({ videoSeconds: "4", model: "m", videoModel: "" });
    expect(out.seconds).toBe(4);   // 4 在画布默认范围内 → 原样
  });

  it("上限也夹：存着 30 秒、模型最多 15 → 有效值是 15", () => {
    boundsMock.mockReturnValue({ min: 5, max: 15 });
    expect(effectiveVideoSeconds({ videoSeconds: "30", model: "m", videoModel: "" }).seconds).toBe(15);
  });
});

describe("提交时不许悄悄改时长", () => {
  const cfg = { videoSeconds: "4", size: "720x1280", model: "m", videoModel: "", videoMode: "frames" } as never;

  it("超出区间就当场报错并说清区间，不改成 5 秒发出去", async () => {
    // 顺手改成 5 秒 = 在用户没看见的地方动计费时长（PER_SECOND 端点是按秒收费的）
    boundsMock.mockReturnValue({ min: 5, max: 15 });
    await expect(createVideoGenerationTask(cfg, "让她眨眼", [])).rejects.toThrow(/5–15 秒/);
    expect(generateVideoMock).not.toHaveBeenCalled();
  });

  it("在区间内照常提交，秒数原样送出", async () => {
    boundsMock.mockReturnValue({ min: 5, max: 15 });
    await createVideoGenerationTask({ ...cfg, videoSeconds: "8" } as never, "x", []);
    expect(generateVideoMock.mock.calls[0]![1].durationSec).toBe(8);
  });

  it("区间未知（模型候选还没加载）时不拦，交给服务端校验", async () => {
    boundsMock.mockReturnValue(undefined);
    await createVideoGenerationTask(cfg, "x", []);
    expect(generateVideoMock.mock.calls[0]![1].durationSec).toBe(4);
  });
});
