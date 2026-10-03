import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { WorkPreviewModal } from "./work-preview-modal";

// §8.0.1 ⑩：断结构和行为，不断可视文案。按钮文案由调用方传入（scriptLabel / deriveLabel），
// 测试里用自己传的那个字符串去找，界面默认文案怎么改都不影响这里。
const BASE = {
  title: "世界杯趣玩",
  cover: { from: "#fb923c", to: "#ef4444" },
  ratio: "9:16",
  metaLine: "风格短片 · 1 镜 · 更新于 2026-09-28 10:00:00",
};

describe("WorkPreviewModal", () => {
  it("传入 videoUrl 时默认渲染可播放成片", () => {
    const { container } = render(
      <WorkPreviewModal
        item={{ ...BASE, coverUrl: "https://cdn.test/cover.jpg", videoUrl: "https://cdn.test/clip.mp4", durLabel: "0:06" }}
        onClose={() => {}}
        onScript={() => {}}
        onDerive={() => {}}
      />,
    );

    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video).not.toBeNull();
    expect(video.getAttribute("src")).toBe("https://cdn.test/clip.mp4");
    expect(video.getAttribute("poster")).toBe("https://cdn.test/cover.jpg");
    expect(video.controls).toBe(true);
    expect(video.autoplay).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);
    expect(screen.queryByTestId("preview-no-video")).toBeNull();
  });

  it("没有成片时不渲染 video，也不放假的播放 / 加载动画", () => {
    const { container } = render(
      <WorkPreviewModal item={BASE} onClose={() => {}} onScript={() => {}} onDerive={() => {}} />,
    );
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByTestId("preview-no-video")).toBeTruthy();
    // 旧实现点封面会切到一个转圈的「播放中」状态 —— 什么都没在播，属于假状态
    expect(container.querySelector('[style*="drama-spin"]')).toBeNull();
  });

  it("紧凑动作模式：只有发布（带可见文字）和下载两个动作，下载直链到成片", () => {
    const onScript = vi.fn();
    render(
      <WorkPreviewModal
        item={{ ...BASE, videoUrl: "https://cdn.test/clip.mp4" }}
        compactActions
        scriptLabel="发布按钮-测试"
        deriveLabel="衍生按钮-测试"
        onClose={() => {}}
        onScript={onScript}
        onDerive={() => {}}
      />,
    );

    const actions = screen.getByTestId("compact-preview-actions");
    const controls = [...within(actions).queryAllByRole("button"), ...within(actions).queryAllByRole("link")];
    expect(controls).toHaveLength(2);

    const publish = within(actions).getByRole("button", { name: /发布按钮-测试/ });
    fireEvent.click(publish);
    expect(onScript).toHaveBeenCalledTimes(1);

    const download = within(actions).getByRole("link") as HTMLAnchorElement;
    expect(download.getAttribute("href")).toBe("https://cdn.test/clip.mp4");
    expect(download.hasAttribute("download")).toBe(true);

    // 紧凑模式不出现「衍生」类大按钮
    expect(screen.queryByRole("button", { name: /衍生按钮-测试/ })).toBeNull();
  });

  it("紧凑动作模式没有成片时，下载按钮禁用", () => {
    render(
      <WorkPreviewModal
        item={BASE}
        compactActions
        scriptLabel="发布按钮-测试"
        onClose={() => {}}
        onScript={() => {}}
        onDerive={() => {}}
      />,
    );
    const actions = screen.getByTestId("compact-preview-actions");
    expect(within(actions).queryByRole("link")).toBeNull();
    const buttons = within(actions).getAllByRole("button") as HTMLButtonElement[];
    expect(buttons).toHaveLength(2);
    expect(buttons.filter((b) => b.disabled)).toHaveLength(1);
  });

  it("完整模式：两个主动作回调各自触发；传了 onExtract 才出现发布按钮；关闭键可点", () => {
    const onScript = vi.fn();
    const onDerive = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <WorkPreviewModal
        item={BASE}
        scriptLabel="打开-测试"
        deriveLabel="新建-测试"
        extractLabel="发布-测试"
        onClose={onClose}
        onScript={onScript}
        onDerive={onDerive}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /打开-测试/ }));
    fireEvent.click(screen.getByRole("button", { name: /新建-测试/ }));
    expect(onScript).toHaveBeenCalledTimes(1);
    expect(onDerive).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /发布-测试/ })).toBeNull();

    const onExtract = vi.fn();
    rerender(
      <WorkPreviewModal
        item={BASE}
        scriptLabel="打开-测试"
        deriveLabel="新建-测试"
        extractLabel="发布-测试"
        onClose={onClose}
        onScript={onScript}
        onDerive={onDerive}
        onExtract={onExtract}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /发布-测试/ }));
    expect(onExtract).toHaveBeenCalledTimes(1);

    // 关闭键：图标按钮必须有可读名称（读屏 / 测试都靠它），不绑具体文案，只要求非空
    const dialog = screen.getByRole("dialog");
    const closeBtn = within(dialog)
      .getAllByRole("button")
      .find((b) => b.getAttribute("aria-label") && !b.textContent?.trim());
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn!);
    expect(onClose).toHaveBeenCalled();
  });
});
