// @vitest-environment jsdom
//
// 真渲染参数面板，验证「夹过的时长会回写」这个 effect 真的跑（v0.179）。
// 纯函数那侧在 video-duration.test.ts；这里测的是 React 那一步 ——
// v0.176 的缺陷恰恰是「算对了但没写回去」，纯函数测不出来。
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const boundsMock = vi.fn();
const geometryMock = vi.fn();
vi.mock("@/canvas-bridge/models", () => ({
  videoDurationBoundsFor: (v?: string | null) => boundsMock(v),
  videoGeometryFor: (v?: string | null) => geometryMock(v),
  endpointIdFor: (v?: string | null) => v,
}));

import { effectiveVideoGeometry, VideoSettingsPanel } from "@/canvas/components/video-settings-panel";
import { CanvasVideoSettingsPopover } from "@/canvas/components/canvas/canvas-video-settings-popover";
import { canvasThemes } from "@/canvas/lib/canvas-theme";
import type { AiConfig } from "@/canvas-bridge/config-store";

beforeEach(() => { boundsMock.mockReset(); geometryMock.mockReset(); });

const cfg = (over: Partial<AiConfig>) => ({
  videoSeconds: "4", vquality: "720", size: "720x1280", videoMode: "frames",
  model: "节点选的", videoModel: "全局默认", ...over,
}) as AiConfig;

describe("参数面板：夹过的时长要回写", () => {
  it("存 4 秒、模型最短 5 秒 → 打开面板就把 5 写回 config", () => {
    boundsMock.mockReturnValue({ min: 5, max: 15 });
    const onConfigChange = vi.fn();
    render(<VideoSettingsPanel config={cfg({})} onConfigChange={onConfigChange} theme={canvasThemes.light} />);
    expect(onConfigChange).toHaveBeenCalledWith("videoSeconds", "5");
  });

  it("已经在区间内就不写（免得白白触发一次自动保存）", () => {
    boundsMock.mockReturnValue({ min: 5, max: 15 });
    const onConfigChange = vi.fn();
    render(<VideoSettingsPanel config={cfg({ videoSeconds: "8" })} onConfigChange={onConfigChange} theme={canvasThemes.light} />);
    expect(onConfigChange.mock.calls.filter(([k]) => k === "videoSeconds")).toHaveLength(0);
  });
});

// 收起状态（popover 没打开）：这一行显示的必须是**存着的那个值** ——
// 也就是现在点发送真会送出去的时长。夹 + 回写只在面板打开时发生，
// 所以没打开过的节点显示「有效值」就是骗人（显示 5、提交 4、然后被服务端拒）。
describe("参数按钮收起状态", () => {
  it("显示存着的 4 秒（不是夹过的 5 秒），并标出「这样发会被拒」", () => {
    boundsMock.mockReturnValue({ min: 5, max: 15 });
    const { container } = render(
      <CanvasVideoSettingsPopover config={cfg({ videoSeconds: "4" })} onConfigChange={vi.fn()} />,
    );
    const text = container.textContent || "";
    expect(text).toContain("4s");
    expect(text).not.toContain("5s");
    expect(text).toContain("⚠");
    // 为什么会被拒、怎么改，放悬浮说明里（可视文案受宽度限制，不塞长句）
    expect(container.querySelector("button")?.getAttribute("title")).toMatch(/只接 5–15 秒/);
  });

  it("在区间内就照常显示，不加记号", () => {
    boundsMock.mockReturnValue({ min: 5, max: 15 });
    const { container } = render(
      <CanvasVideoSettingsPopover config={cfg({ videoSeconds: "8" })} onConfigChange={vi.fn()} />,
    );
    expect(container.textContent).toContain("8s");
    expect(container.textContent).not.toContain("⚠");
  });

  it("面板没打开时不许悄悄回写 config（回写是用户打开面板才发生的事）", () => {
    boundsMock.mockReturnValue({ min: 5, max: 15 });
    const onConfigChange = vi.fn();
    render(<CanvasVideoSettingsPopover config={cfg({ videoSeconds: "4" })} onConfigChange={onConfigChange} />);
    expect(onConfigChange).not.toHaveBeenCalled();
  });
});


// ── 画幅（v0.184）────────────────────────────────────────────────────────────
//
// 时长超区间会被服务端**拒**；画幅选不了却是被**悄悄换掉** —— 用户选 720p·3:4，
// 聚算按 768p·portrait 出，回来 768×1376，全程不报错。所以面板不能再把
// 兑现不了的档位摆出来给人选。
describe("参数面板：画幅按模型真正能出的来", () => {
  it("只渲染这个模型能出的清晰度与比例，并把选不了的值夹回去写回 config", () => {
    boundsMock.mockReturnValue({ min: 5, max: 15 });
    geometryMock.mockReturnValue({ resolutions: ["768"], ratios: ["16:9", "9:16"] });
    const onConfigChange = vi.fn();
    const { container } = render(
      <VideoSettingsPanel config={cfg({ vquality: "720", size: "720x960" })} onConfigChange={onConfigChange} theme={canvasThemes.light} />,
    );
    const text = container.textContent || "";
    expect(text).toContain("768p");
    expect(text).not.toContain("480p");
    expect(text).not.toContain("1080p");
    // 3:4 这个模型出不了 —— 不该还摆在那儿
    expect(text).not.toContain("3:4");
    expect(text).toContain("9:16");
    // 夹过要回写，否则屏幕上是一回事、提交是另一回事
    expect(onConfigChange).toHaveBeenCalledWith("vquality", "768");
    expect(onConfigChange).toHaveBeenCalledWith("size", expect.stringMatching(/^768x/));
  });

  it("竖的仍然落到竖的（3:4 → 9:16，不是一律回到第一个 16:9）", () => {
    boundsMock.mockReturnValue({ min: 5, max: 15 });
    geometryMock.mockReturnValue({ resolutions: ["768"], ratios: ["16:9", "9:16"] });
    const g = effectiveVideoGeometry({ vquality: "720", size: "720x960", model: "m", videoModel: "m" } as AiConfig);
    expect(g.ratio).toBe("9:16");
    expect(g.resolution).toBe("768");
  });

  it("拿不到能力（模型没加载 / 协议不受限）就保留完整选项，不臆造限制", () => {
    boundsMock.mockReturnValue(undefined);
    geometryMock.mockReturnValue(undefined);
    const onConfigChange = vi.fn();
    const { container } = render(
      <VideoSettingsPanel config={cfg({ vquality: "720", size: "720x960" })} onConfigChange={onConfigChange} theme={canvasThemes.light} />,
    );
    const text = container.textContent || "";
    expect(text).toContain("480p");
    expect(text).toContain("1080p");
    expect(text).toContain("3:4");
    expect(onConfigChange.mock.calls.filter(([k]) => k === "vquality")).toHaveLength(0);
  });
});

describe("参数按钮收起状态：画幅兑现不了要如实说", () => {
  it("存着 720p·3:4、模型只出 768p 横竖 → 标出「实际会按 9:16 出」", () => {
    boundsMock.mockReturnValue({ min: 5, max: 15 });
    geometryMock.mockReturnValue({ resolutions: ["768"], ratios: ["16:9", "9:16"] });
    const { container } = render(
      <CanvasVideoSettingsPopover config={cfg({ videoSeconds: "8", vquality: "720", size: "720x960" })} onConfigChange={vi.fn()} />,
    );
    const button = container.querySelector("button");
    // 按钮上仍显示**存着的**值（那才是现在点发送会送出去的），但要带记号 + 说明
    expect(button?.textContent).toContain("720p");
    expect(button?.getAttribute("title")).toContain("实际会按 9:16 出");
    expect(button?.textContent).toContain("⚠");
  });
});
