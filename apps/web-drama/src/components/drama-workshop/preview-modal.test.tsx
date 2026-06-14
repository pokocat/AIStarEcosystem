import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
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
});
