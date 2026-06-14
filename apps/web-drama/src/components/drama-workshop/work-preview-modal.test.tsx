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

  it("紧凑动作模式只展示发布到创意中心和下载图标", () => {
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
        scriptLabel="发布到创意中心"
        deriveLabel="发布到创意中心"
        onClose={() => {}}
        onScript={() => {}}
        onDerive={() => {}}
      />,
    );

    expect(screen.getByLabelText("发布到创意中心").tagName).toBe("BUTTON");
    const download = screen.getByLabelText("下载视频") as HTMLAnchorElement;
    expect(download.tagName).toBe("A");
    expect(download.getAttribute("href")).toBe("https://cdn.test/clip.mp4");
    const metaRow = screen.getByTestId("compact-preview-meta-row");
    const actions = screen.getByTestId("compact-preview-actions");
    const publish = screen.getByLabelText("发布到创意中心") as HTMLButtonElement;
    expect(metaRow.style.minHeight).toBe("38px");
    expect(actions.contains(download)).toBe(true);
    expect(publish.style.width).toBe("44px");
    expect(publish.style.border).toBe("1px solid var(--line-2)");
    expect(download.style.width).toBe("44px");
    expect(download.style.border).toBe("1px solid var(--line-2)");
    expect(screen.queryByLabelText("复刻")).toBeNull();
    expect(screen.queryByText("编辑视频")).toBeNull();
    expect(screen.queryByText("新建短视频")).toBeNull();
  });
});
