// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DirectorClip, DirectorMedia, DirectorWork } from "@ai-star-eco/types";
import { DirectorStoryboard } from "./director-storyboard";
import { DirectorApi } from "../api";

vi.mock("../api", () => ({ DirectorApi: { edit: vi.fn(), quote: vi.fn() } }));
vi.mock("./director-script-reference", () => ({ ScriptReference: ({ ep }: { ep: { no: number } }) => <section aria-label={`第 ${ep.no} 集剧本`}/> }));
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
  expect(await screen.findByRole("button", { name: "视频 3 · 采用中" })).toBeTruthy();
  expect(screen.getByText("点哪一版，这个片段就用哪一版。")).toBeTruthy();
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
  expect(within(dialog).getByText("点哪一张，这个片段就用哪一张。")).toBeTruthy();
  expect(within(dialog).queryByRole("button", { name: "采用这一版" })).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "第 1 版" }));
  expect(DirectorApi.edit).toHaveBeenCalledWith("w", "clip.adoptBoard", "c1", null, { candidateId: "b1" });
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "第 1 版 · 采用中" }).getAttribute("aria-pressed")).toBe("true"));
});

test("switching versions inside the video drawer adopts the picked one; re-picking the adopted one sends nothing", async () => {
  render(<Page initial={work(clip("v2"))}/>);
  fireEvent.click(screen.getByRole("button", { name: "播放片段 1 的视频" }));
  fireEvent.click(await screen.findByRole("button", { name: "视频 2 · 采用中" }));
  expect(DirectorApi.edit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "视频 1" }));
  expect(DirectorApi.edit).toHaveBeenCalledWith("w", "clip.adoptVideo", "c1", null, { candidateId: "v1" });
  await waitFor(() => expect(screen.getByRole("button", { name: "视频 1 · 采用中" }).getAttribute("aria-pressed")).toBe("true"));
  expect(screen.queryByRole("button", { name: "采用这一版" })).toBeNull();
});

test("the script sits inside the episode next to its clips: the sidebar only lists episodes, and the toggle collapses it", () => {
  document.documentElement.dataset.layout = "desktop";
  window.localStorage.clear();
  render(<Page initial={work(clip("v2"))}/>);
  const script = screen.getByRole("region", { name: "第 1 集剧本" });
  expect(script.closest(".director-storyboard")).toBeTruthy();
  expect(within(screen.getByRole("navigation", { name: "分集" })).queryByRole("tab")).toBeNull();
  const toggle = screen.getByRole("button", { name: "本集剧本" });
  fireEvent.click(toggle);
  expect(screen.queryByRole("region", { name: "第 1 集剧本" })).toBeNull();
  // 点片段上的「对照剧本」重新展开，不用先去找开关。
  fireEvent.click(screen.getByRole("button", { name: "对照剧本" }));
  expect(screen.getByRole("region", { name: "第 1 集剧本" })).toBeTruthy();
  delete document.documentElement.dataset.layout;
});

test("on the phone layout the script opens in a sheet, not beside the clips", () => {
  window.localStorage.clear();
  render(<Page initial={work(clip("v2"))}/>);
  fireEvent.click(screen.getByRole("button", { name: "对照剧本" }));
  expect(screen.getByRole("dialog", { name: "本集剧本" })).toBeTruthy();
});
