// @vitest-environment jsdom
import { afterEach,describe,expect,it,vi } from "vitest";
import { cleanup,fireEvent,render,waitFor } from "@testing-library/react";
import { SignedVideo } from "./signed-video";
import { refreshImageUrl } from "./image-storage";
vi.mock("./image-storage",()=>({refreshImageUrl:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe("signed video recovery",()=>{
  it("retries the actual media element when signing returns the same URL, without an automatic loop",async()=>{
    vi.mocked(refreshImageUrl).mockResolvedValue('/same.mp4');
    const {container,getByRole}=render(<SignedVideo src="/same.mp4" storageKey="owned/video.mp4" controls/>);
    const original=container.querySelector('video')!;fireEvent.error(original);
    await waitFor(()=>expect(container.querySelector('video')).not.toBe(original));
    expect(container.querySelector('video')?.getAttribute('src')).toBe('/same.mp4');
    fireEvent.error(container.querySelector('video')!);
    await waitFor(()=>expect(getByRole('button',{name:'视频加载失败 · 重新加载'})).toBeTruthy());
    expect(refreshImageUrl).toHaveBeenCalledOnce();
  });
  it("renews an expired URL by storage key and preserves the media controls",async()=>{
    vi.mocked(refreshImageUrl).mockResolvedValue("/renewed.mp4");
    const {container}=render(<SignedVideo src="/expired.mp4" storageKey="owned/video.mp4" controls/>);
    fireEvent.error(container.querySelector("video")!);
    await waitFor(()=>expect(container.querySelector("video")?.getAttribute("src")).toBe("/renewed.mp4"));
    expect(refreshImageUrl).toHaveBeenCalledWith("owned/video.mp4");expect(container.querySelector("video")?.controls).toBe(true);
  });
  it("shows a manual retry after renewal fails, without an automatic request loop",async()=>{
    vi.mocked(refreshImageUrl).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce("/recovered.mp4");
    const {container,getByRole}=render(<SignedVideo src="/expired.mp4" storageKey="owned/video.mp4"/>);
    fireEvent.error(container.querySelector("video")!);
    await waitFor(()=>expect(getByRole("button",{name:"视频加载失败 · 重新加载"})).toBeTruthy());
    expect(refreshImageUrl).toHaveBeenCalledTimes(1);fireEvent.click(getByRole("button"));
    await waitFor(()=>expect(container.querySelector("video")?.getAttribute("src")).toBe("/recovered.mp4"));
    expect(refreshImageUrl).toHaveBeenCalledTimes(2);
  });
});
