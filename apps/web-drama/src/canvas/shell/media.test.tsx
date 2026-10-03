import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// 签名过期换新（CanvasImage / CanvasVideo）：断请求次数、请求参数和 src，不断界面文案之外的东西（§8.0.1 ⑩）。
// 例外：「图片加载失败」是这里要验的行为本身（换不到时必须明说，不能留一张裂图）。

const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), signAssets: vi.fn() }));
vi.mock("@/api/canvas", () => ({ CanvasApi: api }));

import { CanvasDocProvider } from "@/canvas/core/use-canvas-doc";
import { __resetCanvasMediaForTest, CanvasImage, CanvasVideo } from "./media";

const inCanvas = ({ children }: { children: React.ReactNode }) => <CanvasDocProvider canvasId="dcv_1">{children}</CanvasDocProvider>;

describe("CanvasImage / CanvasVideo 换新地址", () => {
  beforeEach(() => {
    __resetCanvasMediaForTest();
    api.get.mockReset();
    api.signAssets.mockReset();
    api.get.mockReturnValue(new Promise(() => {})); // 文档加载与否不影响换新（只要 canvasId）
  });

  it("两张图同时失败只发一次请求；换新后 src 变成新地址", async () => {
    api.signAssets.mockResolvedValue({ urls: { "k/a.png": "https://new/a.png", "k/b.png": "https://new/b.png" } });
    render(
      <>
        <CanvasImage asset={{ key: "k/a.png", url: "https://old/a.png" }} alt="甲" />
        <CanvasImage asset={{ key: "k/b.png", url: "https://old/b.png" }} alt="乙" />
      </>,
      { wrapper: inCanvas },
    );
    fireEvent.error(screen.getByAltText("甲"));
    fireEvent.error(screen.getByAltText("乙"));
    await waitFor(() => expect(screen.getByAltText("甲").getAttribute("src")).toBe("https://new/a.png"));
    expect(screen.getByAltText("乙").getAttribute("src")).toBe("https://new/b.png");
    expect(api.signAssets).toHaveBeenCalledTimes(1);
    expect(api.signAssets.mock.calls[0][0]).toBe("dcv_1");
    expect([...api.signAssets.mock.calls[0][1]].sort()).toEqual(["k/a.png", "k/b.png"]);
  });

  it("换来的地址还失败：不再请求，显示「图片加载失败」", async () => {
    api.signAssets.mockResolvedValue({ urls: { "k/a.png": "https://new/a.png" } });
    render(<CanvasImage asset={{ key: "k/a.png", url: "https://old/a.png" }} alt="甲" />, { wrapper: inCanvas });
    fireEvent.error(screen.getByAltText("甲"));
    await waitFor(() => expect(screen.getByAltText("甲").getAttribute("src")).toBe("https://new/a.png"));
    fireEvent.error(screen.getByAltText("甲"));
    await waitFor(() => expect(screen.getByText("图片加载失败")).toBeTruthy());
    expect(api.signAssets).toHaveBeenCalledTimes(1);
  });

  it("换来的地址成功加载过、之后又过期：还能再换一次（限制的是同一个地址连续失败，不是一生一次）", async () => {
    api.signAssets
      .mockResolvedValueOnce({ urls: { "k/a.png": "https://new1/a.png" } })
      .mockResolvedValueOnce({ urls: { "k/a.png": "https://new2/a.png" } });
    render(<CanvasImage asset={{ key: "k/a.png", url: "https://old/a.png" }} alt="甲" />, { wrapper: inCanvas });
    fireEvent.error(screen.getByAltText("甲"));
    await waitFor(() => expect(screen.getByAltText("甲").getAttribute("src")).toBe("https://new1/a.png"));
    fireEvent.load(screen.getByAltText("甲"));
    fireEvent.error(screen.getByAltText("甲")); // 一个小时后又过期了
    await waitFor(() => expect(screen.getByAltText("甲").getAttribute("src")).toBe("https://new2/a.png"));
    expect(api.signAssets).toHaveBeenCalledTimes(2);
  });

  it("换不到（不是本人的 key）：显示「图片加载失败」", async () => {
    api.signAssets.mockResolvedValue({ urls: {} });
    render(<CanvasImage asset={{ key: "k/x.png", url: "https://old/x.png" }} alt="甲" />, { wrapper: inCanvas });
    fireEvent.error(screen.getByAltText("甲"));
    await waitFor(() => expect(screen.getByText("图片加载失败")).toBeTruthy());
  });

  it("换到的新地址按画布缓存复用：之后再挂上的同一张图直接用新地址，不再请求", async () => {
    api.signAssets.mockResolvedValue({ urls: { "k/a.png": "https://new/a.png" } });
    const { rerender } = render(<CanvasImage asset={{ key: "k/a.png", url: "https://old/a.png" }} alt="甲" />, { wrapper: inCanvas });
    fireEvent.error(screen.getByAltText("甲"));
    await waitFor(() => expect(screen.getByAltText("甲").getAttribute("src")).toBe("https://new/a.png"));
    rerender(
      <>
        <CanvasImage asset={{ key: "k/a.png", url: "https://old/a.png" }} alt="甲" />
        <CanvasImage asset={{ key: "k/a.png", url: "https://old/a.png" }} alt="丙" />
      </>,
    );
    expect(screen.getByAltText("丙").getAttribute("src")).toBe("https://new/a.png");
    expect(api.signAssets).toHaveBeenCalledTimes(1);
  });

  it("不在画布里（没有 canvasId）：出错不换新，直接显示占位", async () => {
    render(<CanvasImage asset={{ key: "k/a.png", url: "https://old/a.png" }} alt="甲" />);
    fireEvent.error(screen.getByAltText("甲"));
    await waitFor(() => expect(screen.getByText("图片加载失败")).toBeTruthy());
    expect(api.signAssets).not.toHaveBeenCalled();
  });

  it("没有 asset：显示占位（缺省中性占位，传了就用传的）", () => {
    const { container, rerender } = render(<CanvasImage asset={null} alt="甲" className="x" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".cv-media-ph.x")).not.toBeNull();
    rerender(<CanvasImage asset={undefined} alt="甲" placeholder={<span>待生成</span>} />);
    expect(screen.getByText("待生成")).toBeTruthy();
  });

  it("视频出错：视频和封面的 key 一次请求换新", async () => {
    api.signAssets.mockResolvedValue({ urls: { "k/v.mp4": "https://new/v.mp4", "k/p.png": "https://new/p.png" } });
    const { container } = render(
      <CanvasVideo version={{ key: "k/v.mp4", url: "https://old/v.mp4" }} poster={{ key: "k/p.png", url: "https://old/p.png" }} />,
      { wrapper: inCanvas },
    );
    fireEvent.error(container.querySelector("video")!);
    await waitFor(() => expect(container.querySelector("video")?.getAttribute("src")).toBe("https://new/v.mp4"));
    expect(container.querySelector("video")?.getAttribute("poster")).toBe("https://new/p.png");
    expect(api.signAssets).toHaveBeenCalledTimes(1);
    expect([...api.signAssets.mock.calls[0][1]].sort()).toEqual(["k/p.png", "k/v.mp4"]);
  });
});
