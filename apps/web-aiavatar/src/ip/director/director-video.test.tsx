// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { DirectorVideo } from "./director-video";
import { refreshImageUrl } from "@/canvas-bridge/image-storage";

vi.mock("@/canvas-bridge/image-storage", () => ({ refreshImageUrl: vi.fn() }));
const media = { id: "v1", key: "owned/one.mp4", url: "/one.mp4?signature=1" };
let play: ReturnType<typeof vi.spyOn>;
let pause: ReturnType<typeof vi.spyOn>;
let load: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  load = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.mocked(refreshImageUrl).mockResolvedValue("/one.mp4?signature=renewed");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.resetAllMocks(); });
const element = () => document.querySelector("video")!;
function position(video: HTMLVideoElement, paused = false) {
  video.currentTime = 6.25;
  video.playbackRate = 1.5;
  Object.defineProperty(video, "paused", { configurable: true, value: paused });
  Object.defineProperty(video, "duration", { configurable: true, value: 13.675 });
}

test("polling for the same asset preserves source, playback position and the fullscreen element", () => {
  const { rerender } = render(<DirectorVideo media={media} controls autoPlay/>);
  const video = element(); position(video);
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: video });
  try {
    for (let i = 2; i <= 6; i++) rerender(<DirectorVideo media={{ ...media, url: `/one.mp4?signature=${i}` }} controls autoPlay/>);
    expect(element()).toBe(video);
    expect(document.fullscreenElement).toBe(video);
    expect(video.getAttribute("src")).toBe(media.url);
    expect(video.currentTime).toBe(6.25);
    expect(load).not.toHaveBeenCalled();
    expect(refreshImageUrl).not.toHaveBeenCalled();
  } finally { Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null }); }
});

test("changing version or storage key updates the source on the same video element", () => {
  const { rerender } = render(<DirectorVideo media={media}/>);
  const video = element();
  rerender(<DirectorVideo media={{ id: "v2", key: "owned/two.mp4", url: "/two.mp4" }}/>);
  expect(element()).toBe(video);
  expect(video.getAttribute("src")).toBe("/two.mp4");
  rerender(<DirectorVideo media={{ id: "v2", key: "owned/replaced.mp4", url: "/replaced.mp4" }}/>);
  expect(video.getAttribute("src")).toBe("/replaced.mp4");
});

test("a URL arriving after the asset's initial empty response becomes playable", () => {
  const { rerender } = render(<DirectorVideo media={{ ...media, url: null }}/>);
  rerender(<DirectorVideo media={media}/>);
  expect(element().getAttribute("src")).toBe(media.url);
});

test("a failed source is re-signed once and resumes position and speed without remounting", async () => {
  const { rerender } = render(<DirectorVideo media={media} controls autoPlay/>);
  const video = element(); position(video);
  fireEvent.error(video);
  await waitFor(() => expect(video.getAttribute("src")).toContain("renewed"));
  expect(refreshImageUrl).toHaveBeenCalledExactlyOnceWith(media.key);
  expect(element()).toBe(video);
  video.currentTime = 0; video.playbackRate = 1;
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(6.25);
  expect(video.playbackRate).toBe(1.5);
  expect(play).toHaveBeenCalledOnce();
  rerender(<DirectorVideo media={{ ...media, url: "/one.mp4?signature=poll" }} controls autoPlay/>);
  expect(video.getAttribute("src")).toContain("renewed");
});

test("renewal preserves an intentional pause, even when the preview normally autoplays", async () => {
  const { rerender } = render(<DirectorVideo media={media} autoPlay/>);
  const video = element(); position(video, true);
  fireEvent.error(video);
  await waitFor(() => expect(video.getAttribute("src")).toContain("renewed"));
  expect(video.autoplay).toBe(false);
  fireEvent.loadedMetadata(video);
  expect(pause).toHaveBeenCalledOnce();
  expect(play).not.toHaveBeenCalled();
  expect(video.currentTime).toBe(6.25);
  rerender(<DirectorVideo media={{ ...media, url: "/poll.mp4" }} autoPlay/>);
  expect(video.autoplay).toBe(false);
  expect(play).not.toHaveBeenCalled();
});

test("duplicate errors during signing do not submit duplicate requests, and a second failure offers manual retry", async () => {
  let finish!: (url: string) => void;
  vi.mocked(refreshImageUrl).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<DirectorVideo media={media}/>);
  fireEvent.error(element()); fireEvent.error(element());
  expect(refreshImageUrl).toHaveBeenCalledOnce();
  await act(async () => finish("/renewed.mp4"));
  fireEvent.error(element());
  expect(refreshImageUrl).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "视频加载失败，重新加载" }));
  await waitFor(() => expect(refreshImageUrl).toHaveBeenCalledTimes(2));
});

test("a rejected renewal offers retry and retains the original playback position", async () => {
  vi.mocked(refreshImageUrl).mockRejectedValueOnce(new Error("network"));
  render(<DirectorVideo media={media}/>);
  const video = element(); position(video);
  fireEvent.error(video);
  await screen.findByRole("button", { name: "视频加载失败，重新加载" });
  video.currentTime = 0;
  fireEvent.click(screen.getByRole("button", { name: "视频加载失败，重新加载" }));
  await waitFor(() => expect(video.getAttribute("src")).toContain("renewed"));
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(6.25);
});

test("a late renewal cannot replace another version, which can renew independently", async () => {
  let finish!: (url: string) => void;
  vi.mocked(refreshImageUrl).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { rerender } = render(<DirectorVideo media={media} autoPlay/>);
  position(element(), true); fireEvent.error(element());
  rerender(<DirectorVideo media={{ id: "v2", key: "two.mp4", url: "/two.mp4" }} autoPlay/>);
  expect(element().autoplay).toBe(true);
  await act(async () => finish("/obsolete.mp4"));
  expect(element().getAttribute("src")).toBe("/two.mp4");
  vi.mocked(refreshImageUrl).mockResolvedValueOnce("/two-renewed.mp4");
  fireEvent.error(element());
  await waitFor(() => expect(element().getAttribute("src")).toBe("/two-renewed.mp4"));
});

test("an unchanged renewal URL explicitly reloads without replacing the video", async () => {
  vi.mocked(refreshImageUrl).mockResolvedValue(media.url);
  render(<DirectorVideo media={media}/>);
  const video = element(); position(video);
  fireEvent.error(video);
  await waitFor(() => expect(load).toHaveBeenCalledOnce());
  expect(element()).toBe(video);
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(6.25);
});

test("a late renewal is ignored after unmount", async () => {
  let finish!: (url: string) => void;
  vi.mocked(refreshImageUrl).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { unmount } = render(<DirectorVideo media={media}/>);
  fireEvent.error(element()); unmount();
  await act(async () => finish("/late.mp4"));
  expect(document.querySelector("video")).toBeNull();
  expect(load).not.toHaveBeenCalled();
});
