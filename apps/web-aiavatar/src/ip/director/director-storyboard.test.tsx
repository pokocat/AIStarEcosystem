// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DirectorClip, DirectorMedia, DirectorWork } from "@ai-star-eco/types";
import { DirectorStoryboard } from "./director-storyboard";
import { DirectorApi } from "../api";
import { App } from "antd";

vi.mock("../api", () => ({ DirectorApi: { edit: vi.fn(), quote: vi.fn(), runTask: vi.fn() } }));
vi.mock("./director-script-reference", () => ({ ScriptReference: ({ ep, onCollapse }: { ep: { no: number }; onCollapse?: () => void }) => <section aria-label={`第 ${ep.no} 集剧本`}>{onCollapse && <button type="button" onClick={onCollapse}>收起</button>}</section> }));
vi.mock("./director-output", () => ({ ClipVideo: () => null, EpisodeOutput: () => null }));

const media = (id: string): DirectorMedia => ({ id, key: `k-${id}`, url: `https://cdn.test/${id}.mp4`, runId: null, source: "generated", createdAt: "2026-10-29T00:00:00Z" });

function clip(adoptedId: string, adoptedBy: "user" | "auto" = "user"): DirectorClip {
  return {
    id: "c1", episodeId: "e1", order: 1, title: "雨夜", summary: "", durationSec: 12, assetIds: [], shots: [],
    boardPrompt: "", boardPromptCustom: false, videoPrompt: "", videoPromptCustom: false,
    board: { candidates: [media("b1")], adoptedId: "b1", adoptedBy: "user", error: null },
    video: { candidates: [media("v1"), media("v2"), media("v3")], adoptedId, adoptedBy, error: null },
    issues: [], unvoiced: [], rev: 1,
  };
}

function work(c: DirectorClip): DirectorWork {
  return {
    id: "w", title: "作品", revision: 1, createdAt: "2026-10-29T00:00:00Z", updatedAt: "2026-10-29T00:00:00Z",
    idea: "", logline: "", draft: "", draftRev: 0,
    settings: { style: "真人写实", aspectRatio: "9:16", language: "中文", videoModel: null, textModel: null },
    episodes: [{ id: "e1", no: 1, title: "第一集", summary: "", content: "", extracted: true, planStale: false, planError: null, pendingPlan: null, rev: 1 }],
    assets: [], clips: [c], pipeline: null, notice: null, textError: null, tasks: [],
    pricing: { textMax: 2, image: 16, mock: false }, videoModels: [], videoLimits: null, textModelMode: "fixed", textModels: [],
  } as DirectorWork;
}

function Page({ initial }: { initial: DirectorWork }) {
  const [w, setW] = useState(initial);
  return <DirectorStoryboard work={w} episodeId="e1" apply={setW} setError={() => {}} goTab={() => {}}
    reviewExtract={() => {}} openSettings={() => {}} pickEpisode={() => {}}/>;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(DirectorApi.quote).mockResolvedValue({ items: [] } as never);
  vi.mocked(DirectorApi.edit).mockImplementation(async (_w, _op, _target, _rev, data) =>
    work(clip((data as { candidateId: string }).candidateId)));
});
afterEach(cleanup);

function workWithReferences() {
  const c = clip("v2");
  // 复现客户作品：关联先加餐馆、后加静儿，服务端按角色、场景提交。
  c.assetIds = ["restaurant", "jing"];
  c.boardRefs = [
    { assetId: "jing", label: "图1", name: "静儿·工作装", key: "jing-form", url: "https://cdn.test/jing-form.png" },
    { assetId: "restaurant", label: "图2", name: "静儿打工的餐馆", key: "restaurant", url: "https://cdn.test/restaurant.png" },
    { assetId: "restaurant", label: "图3", name: "静儿打工的餐馆·反打", key: "reverse", url: "https://cdn.test/reverse.png" },
  ];
  c.videoRefs = [{ assetId: null, label: "图1", name: "分镜图", key: "b1", url: "https://cdn.test/b1.png" },
    ...c.boardRefs.map((r, i) => ({ ...r, label: `图${i + 2}` }))];
  const w = work(c);
  const asset = (id: string, kind: "character" | "scene", name: string) => ({ id, kind, name, description: "", aliases: [], episodeIds: [], prompt: "", promptCustom: false, rev: 1, voice: null,
    image: { candidates: [media(id)], adoptedId: id, adoptedBy: "user" as const, error: null } });
  w.assets = [asset("restaurant", "scene", "静儿打工的餐馆"), asset("jing", "character", "静儿")];
  return w;
}

test("storyboard reference images show the server order, exact form and scene view beside the prompt", () => {
  render(<Page initial={workWithReferences()}/>);
  const stack = screen.getByRole("button", { name: /关联资产/ });
  expect(within(stack).getAllByRole("img").map(img => img.getAttribute("alt"))).toEqual([
    "图2 静儿·工作装", "图3 静儿打工的餐馆", "图4 静儿打工的餐馆·反打",
  ]);
  fireEvent.click(screen.getByRole("button", { name: /^分镜图/ }));
  const refs = screen.getByRole("region", { name: "分镜图参考图片" });
  expect(within(refs).getAllByRole("img").map(img => img.getAttribute("alt"))).toEqual([
    "图1 静儿·工作装", "图2 静儿打工的餐馆", "图3 静儿打工的餐馆·反打",
  ]);
  expect(within(refs).getAllByRole("img")[0].getAttribute("src")).toBe("https://cdn.test/jing-form.png");
});

test("video reference images start with the board and keep asset controls in that order", () => {
  render(<Page initial={workWithReferences()}/>);
  fireEvent.click(screen.getByRole("button", { name: /关联资产/ }));
  const refs = screen.getByRole("region", { name: "视频参考图片" });
  expect(within(refs).getAllByRole("img").map(img => img.getAttribute("alt"))).toEqual([
    "图1 分镜图", "图2 静儿·工作装", "图3 静儿打工的餐馆", "图4 静儿打工的餐馆·反打",
  ]);
  const drawer = screen.getByRole("dialog", { name: "关联资产" });
  expect(within(drawer).getAllByRole("button", { name: /解除.*关联/ }).map(b => b.getAttribute("aria-label"))).toEqual([
    "从片段 1 解除静儿的关联", "从片段 1 解除静儿打工的餐馆的关联",
  ]);
});

test("a first-frame model sends only the board, and the card still shows the linked assets", () => {
  const w = workWithReferences();
  w.clips[0].videoRefs = [{ assetId: null, label: "首帧", name: "分镜图", key: "b1", url: "https://cdn.test/b1.png" }];
  render(<Page initial={w}/>);
  const stack = screen.getByRole("button", { name: /关联资产/ });
  expect(within(stack).getAllByRole("img").map(img => img.getAttribute("alt"))).toEqual([
    "图1 静儿·工作装", "图2 静儿打工的餐馆", "图3 静儿打工的餐馆·反打",
  ]);
});

test("voice-only assets have no image reference, and the card still shows their initial", () => {
  const w = workWithReferences();
  w.clips[0].boardRefs = [];
  w.clips[0].videoRefs = [{ assetId: null, label: "图1", name: "分镜图", key: "b1", url: "https://cdn.test/b1.png" }];
  w.assets.forEach(a => { a.image.adoptedId = null; });
  render(<Page initial={w}/>);
  const stack = screen.getByRole("button", { name: /关联资产/ });
  expect(stack.querySelector(".director-avatar-stack")!.children.length).toBe(2);
});

test("a missing image keeps its numbered place instead of renumbering later references", () => {
  const w = workWithReferences();
  w.clips[0].boardRefs![0] = { assetId: "jing", name: "静儿", label: "图1", key: null };
  render(<Page initial={w}/>);
  fireEvent.click(screen.getByRole("button", { name: /^分镜图/ }));
  const refs = screen.getByRole("region", { name: "分镜图参考图片" });
  expect(within(refs).getAllByRole("listitem")[0].textContent).toBe("缺少图片图1静儿");
  expect(within(refs).getAllByRole("img")[0].getAttribute("alt")).toBe("图2 静儿打工的餐馆");
});

test("clicking another video version on the card adopts it at once and opens it, with no separate adopt button", async () => {
  render(<Page initial={work(clip("v2"))}/>);
  const versions = screen.getByRole("group", { name: "视频版本" });
  fireEvent.click(within(versions).getByRole("button", { name: "3" }));
  expect(DirectorApi.edit).toHaveBeenCalledWith("w", "clip.adoptVideo", "c1", null, { candidateId: "v3" });
  expect(await screen.findByRole("button", { name: "视频 3 · 正在使用" })).toBeTruthy();
  expect(screen.getByText("点击某一版，即设为此片段的视频。")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "采用这一版" })).toBeNull();
});

test("picking another storyboard image in the board dialog adopts it at once, with no separate adopt button", async () => {
  const c = clip("v2");
  c.board = { candidates: [media("b1"), media("b2")], adoptedId: "b2", adoptedBy: "auto", error: null };
  vi.mocked(DirectorApi.edit).mockImplementation(async (_w, _op, _target, _rev, data) =>
    work({ ...c, board: { ...c.board, adoptedId: (data as { candidateId: string }).candidateId, adoptedBy: "user" } }));
  render(<Page initial={work(c)}/>);
  fireEvent.click(screen.getByRole("button", { name: /^分镜图/ }));
  const dialog = await screen.findByRole("dialog", { name: "分镜图 · 片段 1" });
  expect(within(dialog).getByText("点击某一版，即设为此片段的分镜图。")).toBeTruthy();
  expect(within(dialog).queryByRole("button", { name: "采用这一版" })).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "第 1 版" }));
  expect(DirectorApi.edit).toHaveBeenCalledWith("w", "clip.adoptBoard", "c1", null, { candidateId: "b1" });
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "第 1 版 · 正在使用" }).getAttribute("aria-pressed")).toBe("true"));
});

test("switching versions inside the video drawer adopts the picked one; re-picking the adopted one sends nothing", async () => {
  render(<Page initial={work(clip("v2"))}/>);
  fireEvent.click(screen.getByRole("button", { name: "播放片段 1 的视频" }));
  fireEvent.click(await screen.findByRole("button", { name: "视频 2 · 正在使用" }));
  expect(DirectorApi.edit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "视频 1" }));
  expect(DirectorApi.edit).toHaveBeenCalledWith("w", "clip.adoptVideo", "c1", null, { candidateId: "v1" });
  await waitFor(() => expect(screen.getByRole("button", { name: "视频 1 · 正在使用" }).getAttribute("aria-pressed")).toBe("true"));
  expect(screen.queryByRole("button", { name: "采用这一版" })).toBeNull();
});

test("each episode script icon opens its overlay without blocking the page and restores focus", () => {
  document.documentElement.dataset.layout = "desktop";
  render(<Page initial={work(clip("v2"))}/>);
  expect(screen.queryByRole("region", { name: "第 1 集剧本" })).toBeNull();
  expect(within(screen.getByRole("navigation", { name: "分集" })).queryByRole("tab")).toBeNull();
  const dock = screen.getByRole("button", { name: "查看第 1 集剧本" });
  expect(within(screen.getByRole("navigation", { name: "分集" })).getByRole("button", { name: "查看第 1 集剧本" })).toBe(dock);
  expect(dock.closest("li")).toBeTruthy();
  expect(dock.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(dock);
  const script = screen.getByRole("region", { name: "第 1 集剧本" });
  expect(script.closest(".director-script-panel")?.className).toContain("is-open");
  // 不是弹窗：页面照常能点。
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(dock.getAttribute("aria-expanded")).toBe("true");
  // 收起后焦点回到当前集右侧的剧本图标。
  fireEvent.click(within(script).getByRole("button", { name: "收起" }));
  expect(screen.queryByRole("region", { name: "第 1 集剧本" })).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看第 1 集剧本" }));
  // 点片段上的「对照剧本」也能打开，Esc 收起。
  fireEvent.click(screen.getByRole("button", { name: "对照剧本" }));
  expect(screen.getByRole("region", { name: "第 1 集剧本" })).toBeTruthy();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("region", { name: "第 1 集剧本" })).toBeNull();
  delete document.documentElement.dataset.layout;
});

test("opening another episode script leaves the current storyboard selected and returns focus to that episode icon", () => {
  const w = work(clip("v2"));
  w.episodes.push({ ...w.episodes[0], id: "e2", no: 2, title: "第二集", content: "第二集的正文" });
  render(<Page initial={w}/>);
  const other = screen.getByRole("button", { name: "查看第 2 集剧本" });
  fireEvent.click(other);
  expect(screen.getByRole("region", { name: "第 2 集剧本" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: /第 1 集.*第一集/ })).toBeTruthy();
  expect(other.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "查看第 1 集剧本" }));
  expect(screen.getByRole("region", { name: "第 1 集剧本" })).toBeTruthy();
  expect(other.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(other);
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("region", { name: "第 2 集剧本" })).toBeNull();
  expect(document.activeElement).toBe(other);
});

test("on the phone layout the script opens the same way", () => {
  render(<Page initial={work(clip("v2"))}/>);
  fireEvent.click(screen.getByRole("button", { name: "对照剧本" }));
  expect(screen.getByRole("region", { name: "第 1 集剧本" }).closest(".director-script-panel")).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("when a new script cannot replace the current one the reason is visible next to the button", async () => {
  const w = work(clip("v1"));
  w.episodes[0].pendingPlan = { clips: [] } as never;
  render(<Page initial={w}/>);
  expect(await screen.findByRole("button", { name: "换成新版本" })).toHaveProperty("disabled", true);
  expect(screen.getByText("请先删除已有分镜图或视频的片段，才能换成新版本")).toBeTruthy();
});

test("batch video generation skips clips that already have a video unless asked, so nobody pays twice by selecting all", async () => {
  vi.mocked(DirectorApi.quote).mockResolvedValue({ items: [{ targetId: "c1", credits: 600, error: null }] } as never);
  render(<App><Page initial={work(clip("v2"))}/></App>);
  await waitFor(() => expect(DirectorApi.quote).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("checkbox", { name: "全选" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "批量生成视频" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "批量生成视频" }));
  expect((await screen.findAllByText("选中的片段都已有视频")).length).toBeGreaterThan(0);
  expect(screen.getByText(/已有视频，不重新生成/)).toBeTruthy();
  expect(DirectorApi.runTask).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "已有视频的片段也重新生成" }));
  expect(await screen.findByText(/已有视频的片段将生成新版本并再次扣费/)).toBeTruthy();
});

function noVideoYet(extra: Partial<DirectorClip>): DirectorClip {
  const c = clip("");
  return { ...c, video: { candidates: [], adoptedId: null, adoptedBy: null, error: null }, ...extra };
}

test("the batch confirm says prompt optimisation costs extra, because it is charged on top of the quoted price", async () => {
  vi.mocked(DirectorApi.quote).mockResolvedValue({ items: [{ targetId: "c1", credits: 600, error: null }] } as never);
  render(<App><Page initial={work(noVideoYet({ videoPromptRewrite: "needed" }))}/></App>);
  await waitFor(() => expect(DirectorApi.quote).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("checkbox", { name: "全选" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "批量生成视频" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "批量生成视频" }));
  expect(await screen.findByText(/优化另需少量积分/)).toBeTruthy();
});

test("a clip waiting for the user's choice between prompt versions is left out of the batch, with the reason", async () => {
  vi.mocked(DirectorApi.quote).mockResolvedValue({ items: [{ targetId: "c1", credits: 600, error: null }] } as never);
  render(<App><Page initial={work(noVideoYet({ videoPromptRewrite: "review" }))}/></App>);
  await waitFor(() => expect(DirectorApi.quote).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("checkbox", { name: "全选" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "批量生成视频" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "批量生成视频" }));
  expect(await screen.findByText(/优化后的版本待选择/)).toBeTruthy();
  expect(DirectorApi.runTask).not.toHaveBeenCalled();
});

test("vertical GPT boards show their own 4K price and submit that approved amount", async () => {
  const w = work(clip("v2"));
  w.pricing.boardImage = 55;
  w.boardImage = { endpointId: "gpt-high", name: "GPT Image 2 4K", size: "2160x3840", creditCost: 55 };
  vi.mocked(DirectorApi.runTask).mockResolvedValue(w);
  render(<App><Page initial={w}/></App>);
  fireEvent.click(screen.getByRole("button", { name: /^分镜图/ }));
  const dialog = await screen.findByRole("dialog", { name: "分镜图 · 片段 1" });
  expect(within(dialog).getByText(/GPT Image 2 4K · 2160×3840 · 9:16/)).toBeTruthy();
  expect(within(dialog).getByText(/每张.*55/)).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "重新生成" }));
  expect(within(dialog).getByRole("group", { name: "确认重新生成" }).textContent).toContain("55");
  fireEvent.click(within(dialog).getByRole("button", { name: "确定重新生成" }));
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledWith("w", expect.objectContaining({ type: "board", maxCost: 55 })));
});

test("board batch quotes use the board price rather than the asset image price", async () => {
  const w = work(clip("v2"));
  w.pricing.boardImage = 55;
  render(<App><Page initial={w}/></App>);
  fireEvent.click(screen.getByRole("checkbox", { name: "全选" }));
  fireEvent.click(screen.getByRole("button", { name: "批量生成分镜图" }));
  expect(await screen.findByText(/55 积分/)).toBeTruthy();
  expect(DirectorApi.runTask).not.toHaveBeenCalled();
});

test("once a storyboard image exists, regenerating is the secondary button and asks before spending", async () => {
  render(<App><Page initial={work(clip("v2"))}/></App>);
  fireEvent.click(screen.getByRole("button", { name: /^分镜图/ }));
  const dialog = await screen.findByRole("dialog", { name: "分镜图 · 片段 1" });
  expect(within(dialog).getByRole("button", { name: "完成" }).className).toContain("ip-brand-button");
  const regenerate = within(dialog).getByRole("button", { name: "重新生成" });
  expect(regenerate.className).toContain("ip-brand-secondary");
  fireEvent.click(regenerate);
  expect(DirectorApi.runTask).not.toHaveBeenCalled();
  expect(within(dialog).getByRole("group", { name: "确认重新生成" }).textContent).toContain("现有版本会保留");
  fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
  expect(within(dialog).queryByRole("group", { name: "确认重新生成" })).toBeNull();
});

test("the storyboard prompt stays folded with the plain note until someone has changed it", async () => {
  render(<App><Page initial={work(clip("v2"))}/></App>);
  fireEvent.click(screen.getByRole("button", { name: /^分镜图/ }));
  const dialog = await screen.findByRole("dialog", { name: "分镜图 · 片段 1" });
  const fold = within(dialog).getByText("查看或修改提示词").closest("details") as HTMLDetailsElement;
  expect(fold.open).toBe(false);
  expect(dialog.textContent).not.toMatch(/宫格|景别/);
});

test("polling new signatures does not restart the open clip preview or replace its fullscreen element", () => {
  const props = { episodeId: "e1", apply: vi.fn(), setError: vi.fn(), goTab: vi.fn(), reviewExtract: vi.fn(), openSettings: vi.fn(), pickEpisode: vi.fn() };
  const { rerender } = render(<DirectorStoryboard {...props} work={work(clip("v2"))}/>);
  fireEvent.click(screen.getByRole("button", { name: "播放片段 1 的视频" }));
  const video = screen.getByRole("dialog", { name: "视频" }).querySelector("video")!;
  video.currentTime = 4.5;
  const src = video.getAttribute("src");
  const next = work(clip("v2")); next.revision++;
  next.clips[0].video.candidates.forEach(m => { m.url += "?renewed=1"; });
  rerender(<DirectorStoryboard {...props} work={next}/>);
  expect(screen.getByRole("dialog", { name: "视频" }).querySelector("video")).toBe(video);
  expect(video.getAttribute("src")).toBe(src);
  expect(video.currentTime).toBe(4.5);
});
