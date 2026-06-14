import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkPreviewModal } from "./work-preview-modal";

describe("WorkPreviewModal", () => {
  it("传入 videoUrl 时默认渲染可播放成片", () => {
    render(
      <WorkPreviewModal
        item={{
          title: "世界杯趣玩",
          cover: { from: "#fb923c", to: "#ef4444" },
          coverUrl: "https://cdn.test/cover.jpg",
          videoUrl: "https://cdn.test/clip.mp4",
          ratio: "9:16",
          metaLine: "风格短片 · 1/1 镜 · 今天更新",
          durLabel: "0:06",
        }}
        onClose={() => {}}
        onScript={() => {}}
        onDerive={() => {}}
      />,
    );

    const video = screen.getByLabelText("成片视频") as HTMLVideoElement;
    expect(video.tagName).toBe("VIDEO");
    expect(video.getAttribute("src")).toBe("https://cdn.test/clip.mp4");
    expect(video.getAttribute("poster")).toBe("https://cdn.test/cover.jpg");
    expect(video.controls).toBe(true);
    expect(video.autoplay).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);
  });

  it("紧凑动作模式只展示复刻和下载图标", () => {
    render(
      <WorkPreviewModal
        item={{
          title: "世界杯趣玩",
          cover: { from: "#fb923c", to: "#ef4444" },
          videoUrl: "https://cdn.test/clip.mp4",
          ratio: "9:16",
          metaLine: "风格短片 · 1/1 镜 · 今天更新",
        }}
        compactActions
        scriptLabel="复刻"
        deriveLabel="复刻"
        onClose={() => {}}
        onScript={() => {}}
        onDerive={() => {}}
      />,
    );

    expect(screen.getByLabelText("复刻").tagName).toBe("BUTTON");
    const download = screen.getByLabelText("下载视频") as HTMLAnchorElement;
    expect(download.tagName).toBe("A");
    expect(download.getAttribute("href")).toBe("https://cdn.test/clip.mp4");
    expect(screen.queryByText("编辑视频")).toBeNull();
    expect(screen.queryByText("新建短视频")).toBeNull();
  });
});
