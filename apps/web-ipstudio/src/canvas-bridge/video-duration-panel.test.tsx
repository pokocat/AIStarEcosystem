// @vitest-environment jsdom
//
// 真渲染参数面板，验证「夹过的时长会回写」这个 effect 真的跑（v0.179）。
// 纯函数那侧在 video-duration.test.ts；这里测的是 React 那一步 ——
// v0.176 的缺陷恰恰是「算对了但没写回去」，纯函数测不出来。
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const boundsMock = vi.fn();
vi.mock("@/canvas-bridge/models", () => ({
  videoDurationBoundsFor: (v?: string | null) => boundsMock(v),
  endpointIdFor: (v?: string | null) => v,
}));

import { VideoSettingsPanel } from "@/canvas/components/video-settings-panel";
import { CanvasVideoSettingsPopover } from "@/canvas/components/canvas/canvas-video-settings-popover";
import { canvasThemes } from "@/canvas/lib/canvas-theme";
import type { AiConfig } from "@/canvas-bridge/config-store";

beforeEach(() => boundsMock.mockReset());

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
