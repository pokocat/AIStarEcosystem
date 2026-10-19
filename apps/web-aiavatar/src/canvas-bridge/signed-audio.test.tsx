// @vitest-environment jsdom
import { afterEach,describe,expect,it,vi } from "vitest";
import { cleanup,fireEvent,render,waitFor } from "@testing-library/react";
import { SignedAudio } from "./signed-audio";
import { refreshImageUrl } from "./image-storage";
vi.mock("./image-storage",()=>({refreshImageUrl:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe("signed audio recovery",()=>{
  it("retries the actual audio element when signing returns the same URL, without an automatic loop",async()=>{
    vi.mocked(refreshImageUrl).mockResolvedValue('/same.wav');
    const {container,getByRole}=render(<SignedAudio src="/same.wav" storageKey="owned/audio.wav" controls/>);
    const original=container.querySelector('audio')!;fireEvent.error(original);
    await waitFor(()=>expect(container.querySelector('audio')).not.toBe(original));
    expect(container.querySelector('audio')?.getAttribute('src')).toBe('/same.wav');
    fireEvent.error(container.querySelector('audio')!);
    await waitFor(()=>expect(getByRole('button',{name:'音频加载失败 · 重新加载'})).toBeTruthy());
    expect(refreshImageUrl).toHaveBeenCalledOnce();
  });
  it("renews an expired URL by storage key and preserves the media controls",async()=>{
    vi.mocked(refreshImageUrl).mockResolvedValue("/renewed.wav");
    const {container}=render(<SignedAudio src="/expired.wav" storageKey="owned/audio.wav" controls/>);
    fireEvent.error(container.querySelector("audio")!);
    await waitFor(()=>expect(container.querySelector("audio")?.getAttribute("src")).toBe("/renewed.wav"));
    expect(refreshImageUrl).toHaveBeenCalledWith("owned/audio.wav");expect(container.querySelector("audio")?.controls).toBe(true);
  });
  it("shows a manual retry after renewal fails, without an automatic request loop",async()=>{
    vi.mocked(refreshImageUrl).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce("/recovered.wav");
    const {container,getByRole}=render(<SignedAudio src="/expired.wav" storageKey="owned/audio.wav"/>);
    fireEvent.error(container.querySelector("audio")!);
    await waitFor(()=>expect(getByRole("button",{name:"音频加载失败 · 重新加载"})).toBeTruthy());
    expect(refreshImageUrl).toHaveBeenCalledTimes(1);fireEvent.click(getByRole("button"));
    await waitFor(()=>expect(container.querySelector("audio")?.getAttribute("src")).toBe("/recovered.wav"));
    expect(refreshImageUrl).toHaveBeenCalledTimes(2);
  });
});
