// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { downloadMedia } from "@/canvas-bridge/download-media";
import { DirectorApi } from "../api";
import { ClipVideo, EpisodeOutput } from "./director-output";

vi.mock("../api", () => ({ DirectorApi: { runTask: vi.fn(), uploadMusic: vi.fn(), quote: vi.fn() }, IpStudioApi: {} }));
vi.mock("./director-shared", async importOriginal => ({ ...(await importOriginal<typeof import("./director-shared")>()), chooseDirectorBilling: vi.fn(async () => ({ type: "personal" })) }));
vi.mock("@/canvas-bridge/download-media", () => ({ downloadMedia: vi.fn() }));
vi.mock("@/canvas-bridge/signed-audio", () => ({ SignedAudio: () => <audio/> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const ep: any = { id: "e1", no: 3 };
const shot = (text: string) => ({ id: "s", durationSec: 5, startSec: 0, endSec: 5, size: "", camera: "", action: "", still: "", dialogue: text ? [{ speakerId: null, text }] : [] });
const clip = (id: string, text: string): any => ({ id, episodeId: "e1", order: 1, title: "", durationSec: 65, shots: [shot(text)],
  video: { adoptedId: "m", adoptedBy: "user", adoptedCheck: "current", candidates: [{ id: "m", key: "k", url: "/k.mp4" }], error: null } });
const work = (clips: any[], exports: any[] = [], tasks: any[] = []): any => ({ id: "w", title: "作品", clips, exports, tasks, assets: [], settings: { aspectRatio: "9:16" } });

test("exporting asks only three things, each with a default, and the defaults give a captioned cut", async () => {
  const apply = vi.fn();
  vi.mocked(DirectorApi.runTask).mockResolvedValue(work([]) as never);
  render(<EpisodeOutput work={work([clip("a", "你好世界")])} ep={ep} apply={apply} setError={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button", { name: "导出整集" }));
  const dialog = within(screen.getByRole("dialog", { name: "导出第 3 集" }));
  expect(dialog.getByText(/共 1 段视频，约 1 分 5 秒/)).toBeTruthy();
  expect(dialog.getByText(/根据 1 句台词自动生成/)).toBeTruthy();
  expect((dialog.getByRole("switch", { name: "自动添加字幕" }) as HTMLButtonElement).getAttribute("aria-checked")).toBe("true");
  expect((dialog.getByRole("radio", { name: /与片段一致/ }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(dialog.getByRole("button", { name: "开始导出" }));
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledOnce());
  expect(vi.mocked(DirectorApi.runTask).mock.calls[0][1]).toMatchObject({ type: "export", targetId: "e1", options: { captions: true } });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(apply).toHaveBeenCalledOnce();
});

test("the choices travel with the request, and music is uploaded before the export starts", async () => {
  vi.mocked(DirectorApi.runTask).mockResolvedValue(work([]) as never);
  vi.mocked(DirectorApi.uploadMusic).mockResolvedValue({ key: "owned/song.mp3", url: null, fileName: "轻音乐.mp3", durationSec: 90 });
  const { container } = render(<EpisodeOutput work={work([clip("a", "你好")])} ep={ep} apply={vi.fn()} setError={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button", { name: "导出整集" }));
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.click(dialog.getByRole("switch", { name: "自动添加字幕" }));
  fireEvent.click(dialog.getByRole("radio", { name: /1080P/ }));
  expect(dialog.getByText(/选择 1080P 不会让画面变得更清楚/)).toBeTruthy();
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["x"], "轻音乐.mp3", { type: "audio/mpeg" })] } });
  await waitFor(() => expect(dialog.getByText("轻音乐.mp3")).toBeTruthy());
  fireEvent.click(dialog.getByRole("button", { name: "开始导出" }));
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledOnce());
  expect(vi.mocked(DirectorApi.runTask).mock.calls[0][1].options).toEqual({ captions: false, quality: "1080p", musicStorageKey: "owned/song.mp3", musicName: "轻音乐.mp3" });
  expect(container).toBeTruthy();
});

test("an episode with no dialogue says so instead of offering captions", () => {
  render(<EpisodeOutput work={work([clip("a", "")])} ep={ep} apply={vi.fn()} setError={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button", { name: "导出整集" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText("本集没有台词，不会添加字幕。")).toBeTruthy();
  expect((dialog.getByRole("switch", { name: "自动添加字幕" }) as HTMLButtonElement).disabled).toBe(true);
});

test("a finished export offers the download right there and says how the captions were made", () => {
  const done = { id: "x", episodeId: "e1", episodeNo: 3, status: "done", key: "out.mp4", url: "/out.mp4", durationSec: 65, error: null, createdAt: "2026-11-07T00:00:00Z",
    clips: [{ clipId: "a", candidateId: "m" }], captionStatus: "estimated", captionCount: 9 };
  render(<EpisodeOutput work={work([clip("a", "你好")], [done])} ep={ep} apply={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByRole("button", { name: "下载成片" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "重新导出" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "导出整集" })).toBeNull();
  expect(screen.getByText("第 3 集已导出，时长 1 分 5 秒。已添加 9 条字幕。时间按镜头估算，个别句子可能略有偏差；不合适可以改为不添加字幕，重新导出。")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "观看成片" }));
  expect(screen.getByRole("dialog", { name: "第 3 集成片" }).querySelector("video")?.getAttribute("src")).toBe("/out.mp4");
});

test("exporting again starts from last time's settings, and closing the dialog keeps what was chosen", () => {
  const done = { id: "x", episodeId: "e1", episodeNo: 3, status: "done", key: "out.mp4", url: "/out.mp4", durationSec: 65, error: null, createdAt: "2026-11-07T00:00:00Z",
    clips: [{ clipId: "a", candidateId: "m" }], captions: false, quality: "1080p", musicStorageKey: "owned/song.mp3", musicName: "轻音乐.mp3" };
  render(<EpisodeOutput work={work([clip("a", "你好")], [done])} ep={ep} apply={vi.fn()} setError={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button", { name: "重新导出" }));
  let dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByRole("switch", { name: "自动添加字幕" }).getAttribute("aria-checked")).toBe("false");
  expect((dialog.getByRole("radio", { name: /1080P/ }) as HTMLInputElement).checked).toBe(true);
  expect(dialog.getByText("轻音乐.mp3")).toBeTruthy();
  fireEvent.click(dialog.getByRole("switch", { name: "自动添加字幕" }));
  fireEvent.click(dialog.getByRole("button", { name: "取消" }));
  fireEvent.click(screen.getByRole("button", { name: "重新导出" }));
  dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByRole("switch", { name: "自动添加字幕" }).getAttribute("aria-checked")).toBe("true");
});

test("a failed export says the clips are safe, and videos made with old settings are called out", () => {
  const failed = { id: "x", episodeId: "e1", episodeNo: 3, status: "failed", key: null, durationSec: null, error: "合成失败", createdAt: "2026-11-07T00:00:00Z", clips: [] };
  const old = clip("a", "你好"); old.video.adoptedCheck = "outdated";
  render(<EpisodeOutput work={work([old], [failed])} ep={ep} apply={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByText("上次导出失败：合成失败。片段不受影响，可重新导出。")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "导出整集" }));
  expect(within(screen.getByRole("dialog")).getByText(/是按旧设置生成的，导出将使用当前版本/)).toBeTruthy();
});

test("videos still waiting for confirmation do not block the export: the dialog says they will be confirmed with it", async () => {
  const pending = clip("a", "你好"); pending.video.adoptedBy = "auto";
  vi.mocked(DirectorApi.runTask).mockClear();
  render(<EpisodeOutput work={work([pending])} ep={ep} apply={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByRole("button", { name: "去确认（1）" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "导出整集" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText(/还有 1 段视频没有确认，开始导出后将一并确认/)).toBeTruthy();
  fireEvent.click(dialog.getByRole("button", { name: "开始导出" }));
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledOnce());
  expect(vi.mocked(DirectorApi.runTask).mock.calls[0][1].options).toMatchObject({ confirmPending: true });
});

test("a clip with no video still blocks the export, and the button next to it goes there", () => {
  const none = clip("a", "你好"); none.video = { ...none.video, adoptedId: null, adoptedBy: null, candidates: [] };
  render(<EpisodeOutput work={work([none])} ep={ep} apply={vi.fn()} setError={vi.fn()}/>);
  expect((screen.getByRole("button", { name: "导出整集" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("button", { name: "去生成视频（1）" })).toBeTruthy();
});

test("the download comes first once finished, reacts straight away, and cannot be clicked twice", async () => {
  const done = { id: "x", episodeId: "e1", episodeNo: 3, status: "done", key: "out.mp4", url: "/out.mp4", durationSec: 65, error: null, createdAt: "2026-11-07T00:00:00Z", clips: [{ clipId: "a", candidateId: "m" }] };
  let finish!: () => void;
  vi.mocked(downloadMedia).mockClear();
  vi.mocked(downloadMedia).mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  const { container } = render(<EpisodeOutput work={work([clip("a", "你好")], [done])} ep={ep} apply={vi.fn()} setError={vi.fn()}/>);
  const names = [...container.querySelectorAll(".director-output > button, .director-output-records > button")].map(b => b.textContent);
  expect(names.indexOf("下载成片")).toBeLessThan(names.indexOf("重新导出"));
  fireEvent.click(screen.getByRole("button", { name: "下载成片" }));
  const preparing = screen.getByRole("button", { name: "正在准备下载" }) as HTMLButtonElement;
  expect(preparing.disabled).toBe(true);
  fireEvent.click(preparing);
  expect(downloadMedia).toHaveBeenCalledOnce();
  finish();
  await waitFor(() => expect(screen.getByText("已开始下载，可在浏览器的下载列表中查看。")).toBeTruthy());
});

test("turning captions off changes what the dialog says", () => {
  render(<EpisodeOutput work={work([clip("a", "你好")])} ep={ep} apply={vi.fn()} setError={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button", { name: "导出整集" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText(/根据 1 句台词自动生成/)).toBeTruthy();
  fireEvent.click(dialog.getByRole("switch", { name: "自动添加字幕" }));
  expect(dialog.getByText("这次不添加字幕。")).toBeTruthy();
});

test("while exporting it says how long to expect and that the page can be left", () => {
  const w = work([clip("a", "你好")]);
  w.tasks = [{ id: "t", target: "export:e1", status: "running", stage: null, cost: 0 }];
  render(<EpisodeOutput work={w} ep={ep} apply={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByText(/通常需要几分钟。可以离开此页面，完成后在这里下载/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "导出整集" })).toBeNull();
});

test("regenerating a video that already exists says what it costs first; confirming the video is kept apart", async () => {
  const c = clip("a", "你好"); c.issues = []; c.voiced = []; c.unvoiced = []; c.order = 1;
  c.board = { adoptedId: "b", adoptedBy: "user", candidates: [] };
  c.video = { ...c.video, adoptedBy: "auto", pending: [] };
  const w = { ...work([c]), pricing: { mock: false }, videoLimits: { mode: "reference" } };
  vi.mocked(DirectorApi.quote).mockResolvedValue({ items: [{ credits: 600 }] } as never);
  vi.mocked(DirectorApi.runTask).mockResolvedValue(w as never);
  const { container } = render(<ClipVideo work={w} clip={c} quote={{ credits: 600, error: null }} apply={vi.fn()} setError={vi.fn()}/>);
  const names = [...container.querySelectorAll(".director-video-actions button")].map(b => b.textContent);
  expect(names).toContain("重新生成视频");
  // 确认单独一行，和要花钱的按钮不挨着。
  expect(names).not.toContain("确认使用");
  expect(within(container.querySelector(".director-video-confirm") as HTMLElement).getByRole("button", { name: "确认使用" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "重新生成视频" }));
  expect(DirectorApi.runTask).not.toHaveBeenCalled();
  expect(screen.getByRole("group", { name: "确认重新生成" }).textContent).toContain("约 600 积分");
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(DirectorApi.runTask).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "重新生成视频" }));
  fireEvent.click(screen.getByRole("button", { name: "确定重新生成" }));
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledOnce());
});

test("every button that would spend money on another version asks first", async () => {
  const c = clip("a", "你好"); c.issues = []; c.voiced = []; c.unvoiced = []; c.order = 1;
  c.board = { adoptedId: "b", adoptedBy: "user", candidates: [] };
  c.video = { ...c.video, adoptedBy: "user", pending: [] };
  c.videoPromptRewrite = "original";
  const w = { ...work([c]), pricing: { mock: false }, videoLimits: { mode: "reference" } };
  vi.mocked(DirectorApi.quote).mockResolvedValue({ items: [{ credits: 600 }] } as never);
  vi.mocked(DirectorApi.runTask).mockClear();
  vi.mocked(DirectorApi.runTask).mockResolvedValue(w as never);
  render(<ClipVideo work={w} clip={c} quote={{ credits: 600, error: null }} apply={vi.fn()} setError={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button", { name: "用智能优化重新生成" }));
  expect(DirectorApi.runTask).not.toHaveBeenCalled();
  expect(screen.getByRole("group", { name: "确认重新生成" }).textContent).toContain("优化另需少量积分");
  fireEvent.click(screen.getByRole("button", { name: "确定重新生成" }));
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledOnce());
  expect(vi.mocked(DirectorApi.runTask).mock.calls[0][1].options).toEqual({ promptChoice: "optimized" });
});

test("the voice note opens the voice setting right here, and says what it takes afterwards", () => {
  const before = clip("a", "你好"); before.issues = []; before.voiced = []; before.unvoiced = ["林夏"]; before.order = 1;
  before.board = { adoptedId: "b", adoptedBy: "user", candidates: [] };
  before.video = { candidates: [], adoptedId: null, adoptedBy: null, pending: [], error: null };
  const w = { ...work([before]), pricing: { mock: false }, videoLimits: { mode: "reference" }, assets: [{ id: "lx", kind: "character", name: "林夏", description: "", image: { candidates: [], adoptedId: null } }] };
  const onAssets = vi.fn();
  const { rerender } = render(<ClipVideo work={w} clip={before} quote={{ credits: 600, error: null }} apply={vi.fn()} setError={vi.fn()} onAssets={onAssets}/>);
  fireEvent.click(screen.getByRole("button", { name: "设置音色" }));
  expect(onAssets).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: /林夏/ })).toBeTruthy();
  const after = { ...before, video: { candidates: [{ id: "m", key: "k", url: "/k.mp4" }], adoptedId: "m", adoptedBy: "user", pending: [], error: null } };
  rerender(<ClipVideo work={w} clip={after} quote={{ credits: 600, error: null }} apply={vi.fn()} setError={vi.fn()} onAssets={onAssets}/>);
  expect(screen.getByText("林夏 未设置音色。设置后需要重新生成视频才会生效。")).toBeTruthy();
});

test("the voice note falls back to the assets page when the character can't be found", () => {
  const c = clip("a", "你好"); c.issues = []; c.voiced = []; c.unvoiced = ["林夏"]; c.order = 1;
  c.board = { adoptedId: "b", adoptedBy: "user", candidates: [] };
  c.video = { candidates: [], adoptedId: null, adoptedBy: null, pending: [], error: null };
  const onAssets = vi.fn();
  render(<ClipVideo work={{ ...work([c]), pricing: { mock: false }, videoLimits: { mode: "reference" } }} clip={c} quote={{ credits: 600, error: null }} apply={vi.fn()} setError={vi.fn()} onAssets={onAssets}/>);
  fireEvent.click(screen.getByRole("button", { name: "设置音色" }));
  expect(onAssets).toHaveBeenCalledOnce();
});

test("a regenerated video that isn't in use yet is announced, and can be switched to or declined", () => {
  localStorage.clear();
  const c = clip("a", "你好"); c.issues = []; c.voiced = []; c.unvoiced = []; c.order = 1;
  c.board = { adoptedId: "b", adoptedBy: "user", candidates: [] };
  c.video = { candidates: [{ id: "v1", key: "k1", url: "/1.mp4" }, { id: "v2", key: "k2", url: "/2.mp4" }], adoptedId: "v1", adoptedBy: "user", pending: [], error: null };
  const w = { ...work([c]), pricing: { mock: false }, videoLimits: { mode: "reference" } };
  const onPickVideo = vi.fn();
  const view = render(<ClipVideo work={w} clip={c} quote={{ credits: 600, error: null }} apply={vi.fn()} setError={vi.fn()} onPickVideo={onPickVideo}/>);
  expect(screen.getByText("第 2 版视频已生成。现在用的还是第 1 版。")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "换成第 2 版" }));
  expect(onPickVideo).toHaveBeenCalledWith("v2");
  fireEvent.click(screen.getByRole("button", { name: "保留第 1 版" }));
  expect(screen.queryByText(/第 2 版视频已生成/)).toBeNull();
  // 记住了，再打开也不提示；又生成一版才提示。
  view.unmount();
  const next = render(<ClipVideo work={w} clip={c} quote={{ credits: 600, error: null }} apply={vi.fn()} setError={vi.fn()} onPickVideo={onPickVideo}/>);
  expect(screen.queryByText(/第 2 版视频已生成/)).toBeNull();
  const third = { ...c, video: { ...c.video, candidates: [...c.video.candidates, { id: "v3", key: "k3", url: "/3.mp4" }] } };
  next.rerender(<ClipVideo work={w} clip={third} quote={{ credits: 600, error: null }} apply={vi.fn()} setError={vi.fn()} onPickVideo={onPickVideo}/>);
  expect(screen.getByText("第 3 版视频已生成。现在用的还是第 1 版。")).toBeTruthy();
});

test("the download note goes away when a new export starts", async () => {
  const done = { id: "x", episodeId: "e1", episodeNo: 3, status: "done", key: "out.mp4", url: "/out.mp4", durationSec: 65, error: null, createdAt: "2026-11-07T00:00:00Z", clips: [{ clipId: "a", candidateId: "m" }] };
  vi.mocked(downloadMedia).mockResolvedValue(undefined);
  const { rerender } = render(<EpisodeOutput work={work([clip("a", "你好")], [done])} ep={ep} apply={vi.fn()} setError={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button", { name: "下载成片" }));
  await waitFor(() => expect(screen.getByText("已开始下载，可在浏览器的下载列表中查看。")).toBeTruthy());
  rerender(<EpisodeOutput work={work([clip("a", "你好")], [{ ...done, status: "running", id: "y" }], [{ id: "t", target: "export:e1", status: "running", stage: null, cost: 0 }])} ep={ep} apply={vi.fn()} setError={vi.fn()}/>);
  expect(screen.queryByText("已开始下载，可在浏览器的下载列表中查看。")).toBeNull();
});

test("with a video already there, picking a draft in review can still be confirmed, and the choice goes with the request", async () => {
  const c = clip("a", "你好"); c.issues = []; c.voiced = []; c.unvoiced = []; c.order = 1;
  c.board = { adoptedId: "b", adoptedBy: "user", candidates: [] };
  c.video = { ...c.video, adoptedBy: "user", pending: [] };
  c.videoPromptRewrite = "review"; c.videoPromptEn = { text: "x", at: "2026-11-07T00:00:00Z", warnings: ["提示"], usable: true };
  const w = { ...work([c]), pricing: { mock: false }, videoLimits: { mode: "reference" } };
  vi.mocked(DirectorApi.quote).mockResolvedValue({ items: [{ credits: 600 }] } as never);
  vi.mocked(DirectorApi.runTask).mockClear();
  vi.mocked(DirectorApi.runTask).mockResolvedValue(w as never);
  render(<ClipVideo work={w} clip={c} quote={{ credits: 600, error: null }} apply={vi.fn()} setError={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button", { name: "用原来的版本" }));
  const group = screen.getByRole("group", { name: "确认重新生成" });
  expect(group.textContent).not.toContain("优化另需少量积分");
  const ok = within(group).getByRole("button", { name: "确定重新生成" }) as HTMLButtonElement;
  expect(ok.disabled).toBe(false);
  fireEvent.click(ok);
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledOnce());
  expect(vi.mocked(DirectorApi.runTask).mock.calls[0][1].options).toEqual({ promptChoice: "original" });
});

test("clips still generating are not reported as missing, and export waits for them", () => {
  const busyClip = clip("a", "你好"); busyClip.video = { candidates: [], adoptedId: null, adoptedBy: null, pending: [{ stage: "排队中" }], error: null };
  render(<EpisodeOutput work={work([busyClip])} ep={ep} apply={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByText("1 段视频生成中")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /去生成视频/ })).toBeNull();
  expect((screen.getByRole("button", { name: "导出整集" }) as HTMLButtonElement).disabled).toBe(true);
});

test("once the export button has scrolled away, the next-step bar never calls an outdated video finished", () => {
  class Away { constructor(private readonly report: (entries: { isIntersecting: boolean }[]) => void) {} observe() { this.report([{ isIntersecting: false }]); } disconnect() {} unobserve() {} }
  vi.stubGlobal("IntersectionObserver", Away);
  try {
    const c = clip("a", "你好"); c.order = 1;
    c.video = { candidates: [{ id: "m", key: "k", url: "/k.mp4" }], adoptedId: "m", adoptedBy: "user", adoptedCheck: "outdated", pending: [], error: null };
    const { container } = render(<EpisodeOutput work={work([c])} ep={ep} apply={vi.fn()} setError={vi.fn()}/>);
    const bar = container.querySelector(".director-next-bar")!;
    expect(bar.textContent).toContain("1 段视频需要更新");
    expect(bar.textContent).not.toContain("视频都好了");
  } finally { vi.unstubAllGlobals(); }
});
