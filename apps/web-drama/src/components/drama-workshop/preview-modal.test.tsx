import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { PreviewModal } from "./preview-modal";

describe("PreviewModal", () => {
  it("传入 previewVideo 时静音自动播放且不暴露播放控件", () => {
    vi.useFakeTimers();
    const play = vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

    const { container } = render(
      <PreviewModal
        item={{
          cover: { from: "#111827", to: "#f97316", src: "https://cdn.test/poster.jpg" },
          previewVideo: "https://cdn.test/example.mp4",
          title: "叙事驱动的美学视频",
          cat: "风格短片",
          desc: "用于创作以美学为基础的短片。",
          coverLabel: "效果预览 · 同题材成片片段",
        }}
        onClose={() => {}}
      />,
    );

    const video = screen.getByLabelText("风格短片范例视频") as HTMLVideoElement;
    expect(video.tagName).toBe("VIDEO");
    expect(video.getAttribute("src")).toBe("https://cdn.test/example.mp4");
    expect(video.autoplay).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.playsInline).toBe(true);
    expect(video.controls).toBe(false);
    expect(video.getAttribute("controlsList")).toContain("nodownload");
    expect(video.style.pointerEvents).toBe("none");
    expect(container.querySelector('path[d="M4 2.5v9l7.5-4.5z"]')).toBeNull();
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(play).toHaveBeenCalled();

    play.mockRestore();
    vi.useRealTimers();
  });

  it("无节拍时使用调用方传入的动态估算，不再显示固定 60-80 集", () => {
    render(
      <PreviewModal
        item={{
          cover: { from: "#111827", to: "#f97316" },
          title: "单亲妈妈的奋斗史",
          cat: "都市励志",
          desc: "真实改编向励志短剧。",
          estimate: "AI 估算 · 24 集 · 每集约 75 秒 · 成片约 30 分钟,开拍后给出完整估时大纲",
        }}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText(/24 集/)).toBeTruthy();
    expect(screen.queryByText(/60-80 集/)).toBeNull();
  });

  // v0.197：多集模板「做同款」新建不花积分 —— 不传 cost 就不该挂钻石、点了直接执行；
  // 单条模板扣开拍费 —— 传了 cost 才挂钻石。此前多集也传 cost:0，按钮上照样挂钻石，看着像要扣钱。
  it("不传 cost 的动作不挂积分标记、点了直接执行；传 cost 的挂积分标记", () => {
    const free = vi.fn();
    render(
      <PreviewModal
        item={{ cover: { from: "#111827", to: "#f97316" }, title: "某模板", desc: "说明" }}
        onClose={() => {}}
        actions={[
          { label: "免费动作", onClick: free },
          { label: "扣费动作", cost: 10, confirm: async () => true, onClick: () => {} },
        ]}
      />,
    );
    const freeBtn = screen.getByRole("button", { name: /免费动作/ });
    expect(freeBtn.querySelector(".credit-mark")).toBeNull();
    fireEvent.click(freeBtn);
    expect(free).toHaveBeenCalledTimes(1);
    const paidBtn = screen.getByRole("button", { name: /扣费动作/ });
    expect(paidBtn.querySelector(".credit-mark")).not.toBeNull();
  });

  // v0.197：扣费确认由调用方给（单条模板做同款走共享的 confirmShortStart），弹窗自己不再弹通用确认。
  // 契约：confirm 返回 true 才执行 onClick，返回 false 不执行。
  it("扣积分的动作先走调用方的 confirm：确认才执行，取消不执行", async () => {
    const onYes = vi.fn();
    const onNo = vi.fn();
    const confirmYes = vi.fn(async () => true);
    const confirmNo = vi.fn(async () => false);
    render(
      <PreviewModal
        item={{ cover: { from: "#111827", to: "#f97316" }, title: "某模板", desc: "说明" }}
        onClose={() => {}}
        actions={[
          { label: "确认的动作", cost: 30, confirm: confirmYes, onClick: onYes },
          { label: "取消的动作", cost: 30, confirm: confirmNo, onClick: onNo },
        ]}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /确认的动作/ }));
    });
    expect(confirmYes).toHaveBeenCalledTimes(1);
    expect(onYes).toHaveBeenCalledTimes(1);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /取消的动作/ }));
    });
    expect(confirmNo).toHaveBeenCalledTimes(1);
    expect(onNo).not.toHaveBeenCalled();
  });

  it("没有范例视频、调用方也没给标签时，封面上不挂标签", () => {
    const { container } = render(
      <PreviewModal item={{ cover: { from: "#111827", to: "#f97316" }, title: "某模板", desc: "说明" }} onClose={() => {}} />,
    );
    expect(container.querySelectorAll(".thumb-label").length).toBe(0);
  });

  it("关闭按钮有读屏名", () => {
    render(<PreviewModal item={{ cover: { from: "#111827", to: "#f97316" }, title: "某模板", desc: "说明" }} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "关闭" })).toBeTruthy();
  });
});
