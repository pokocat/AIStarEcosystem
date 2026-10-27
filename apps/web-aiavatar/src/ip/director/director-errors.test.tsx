// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App, Modal } from "antd";
import { ApiError } from "@ai-star-eco/api-client";
import type { DirectorClip, DirectorWork } from "@ai-star-eco/types";
import { DirectorAssets } from "./director-assets";
import { DirectorStoryboard } from "./director-storyboard";
import { DirectorApi } from "../api";
import { openStudioFailure, type StudioFailure } from "../studio-errors";

vi.mock("../api", () => ({ DirectorApi: { runTask: vi.fn(), edit: vi.fn(), quote: vi.fn().mockResolvedValue({ items: [] }) }, IpStudioApi: {} }));

// 2026-10-27 用户反馈：删除被片段用着的资产只在页面上挂一行横幅（手机上被资产详情整个挡住），而且找不到解除关联的地方。
// 现在：说清是哪些片段、给「前往」；片段的「关联资产」里能解除这一项；其他操作没做成也弹错误弹窗。
const slot = { candidates: [], adoptedId: null, adoptedBy: null, error: null, pending: [] };
const asset = (id: string, name: string, kind = "character") => ({ id, kind, name, aliases: [], description: "", prompt: "", promptCustom: false, episodeIds: ["e1"], image: { ...slot }, voice: null, rev: 1 });
function clip(id: string, order: number, over: Partial<DirectorClip> = {}): DirectorClip {
  return { id, episodeId: "e1", order, title: `片段标题 ${order}`, summary: "", durationSec: 12, assetIds: [], issues: [], unvoiced: [],
    shots: [{ id: `${id}-s`, durationSec: 12, startSec: 0, endSec: 12, size: "中景", camera: "", action: "", still: "", dialogue: [] }],
    boardPrompt: "", boardPromptCustom: false, videoPrompt: "", videoPromptCustom: false, board: { ...slot }, video: { ...slot }, rev: 1, ...over } as DirectorClip;
}
const ep = { id: "e1", no: 1, title: "掉漆", summary: "", content: "正文", extracted: true, planStale: false, planError: null, pendingPlan: null, rev: 1 };
function work(clips: DirectorClip[]): DirectorWork {
  return { id: "w", title: "作品", revision: 1, createdAt: "", updatedAt: "", idea: "", logline: "", draft: "", draftRev: 1,
    settings: { style: "真人写实", aspectRatio: "9:16", language: "中文", videoModel: null, textModel: null },
    episodes: [ep], assets: [asset("as1", "林夏"), asset("as2", "旧书店", "scene")], clips, pipeline: null, notice: null, textError: null, tasks: [],
    pricing: { textMax: 21, image: 8, mock: false }, videoModels: [], videoLimits: { model: "h3", name: "H3", minSec: 5, maxSec: 15, mock: false, mode: "omni", maxShots: 4 },
    draftEpisodeHeadings: 0, reference: "", referenceRev: 0, pendingSplit: null, canUndoSplit: false } as unknown as DirectorWork;
}
const lines = (speakerId: string) => [{ id: "s", durationSec: 12, startSec: 0, endSec: 12, size: "中景", camera: "", action: "", still: "", dialogue: [{ speakerId, text: "走吧。" }] }];

let setError: ReturnType<typeof vi.fn>, focusClip: ReturnType<typeof vi.fn>;
const props = () => ({ episodeId: "e1", apply: vi.fn(), setError, goTab: vi.fn(), reviewExtract: vi.fn(), openSettings: vi.fn(), pickEpisode: vi.fn(), startPipeline: vi.fn(), focusClip, focus: null });
beforeEach(() => { setError = vi.fn(); focusClip = vi.fn(); vi.mocked(DirectorApi.edit).mockReset(); });
// 静态 Modal 关掉后还有一轮渲染：在测试环境拆掉之前等它做完，否则 React 在没有 window 时报错。
afterEach(async () => { await act(async () => { Modal.destroyAll(); await new Promise(r => setTimeout(r, 50)); }); cleanup(); });

function openAsset(w: DirectorWork) {
  render(<App><DirectorAssets {...props()} work={w}/></App>);
  fireEvent.click(screen.getByRole("button", { name: "查看林夏" }));
}

test("an asset still used by clips is not deleted; the dialog lists the clips and goes to each one", () => {
  openAsset(work([clip("c1", 1, { assetIds: ["as1"] }), clip("c2", 2, { shots: lines("as1") as never })]));
  const refs = screen.getByRole("region", { name: "用在哪些片段" });
  expect(within(refs).getByText("第 1 集 · 片段 1「片段标题 1」")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "删除林夏" }));
  expect(DirectorApi.edit).not.toHaveBeenCalled();
  const failure = setError.mock.calls[0][0] as StudioFailure;
  expect(failure.action).toBe("删除「林夏」");
  render(<>{typeof failure.extra === "function" ? failure.extra(() => {}) : failure.extra}</>);
  const [first, second] = screen.getAllByRole("button", { name: "前往" }).slice(-2);
  fireEvent.click(first);
  expect(focusClip).toHaveBeenLastCalledWith({ clipId: "c1", assetId: "as1", open: "assets" });
  fireEvent.click(second);
  expect(focusClip).toHaveBeenLastCalledWith({ clipId: "c2", assetId: "as1", open: "editor" }, );
});

test("when the page was stale the server's refusal opens the same dialog with the server's clip list", async () => {
  vi.mocked(DirectorApi.edit).mockRejectedValue(new ApiError({ code: "DIRECTOR_ASSET_IN_USE", message: "「林夏」还用在 1 个片段里（第 1 集片段 3），先在这些片段里解除关联再删除",
    details: { clips: [{ clipId: "c9", episodeId: "e1", episodeNo: 1, order: 3, title: "新片段", linked: true, lines: 0 }] } }, 409));
  openAsset(work([]));
  fireEvent.click(screen.getByRole("button", { name: "删除林夏" }));
  fireEvent.click((await screen.findAllByRole("button", { name: /^删\s?除$/ })).at(-1)!); // antd 给两个字的按钮中间加空格
  await vi.waitFor(() => expect(setError).toHaveBeenCalled());
  const failure = setError.mock.calls[0][0] as StudioFailure;
  expect(failure.action).toBe("删除「林夏」");
  render(<>{typeof failure.extra === "function" ? failure.extra(() => {}) : failure.extra}</>);
  expect(screen.getByText("第 1 集 · 片段 3「新片段」")).toBeTruthy();
});

test("the clip's related assets can unlink just that asset after the impact is spelled out", async () => {
  vi.mocked(DirectorApi.edit).mockResolvedValue(work([]) as never);
  const w = work([clip("c1", 1, { assetIds: ["as1", "as2"], shots: lines("as1") as never, board: { ...slot, candidates: [{ id: "b1", key: "k" }] as never, adoptedId: "b1", adoptedBy: "user" } as never })]);
  render(<App><DirectorStoryboard {...props()} work={w} focus={{ clipId: "c1", assetId: "as1", open: "assets", at: 1 }}/></App>);
  const row = await screen.findByRole("button", { name: "从片段 1 解除林夏的关联" });
  expect(row.closest("li")!.className).toContain("is-focused");
  fireEvent.click(row);
  expect(await screen.findByText(/不删除片段，不删除资产，其他片段不受影响/)).toBeTruthy();
  expect(screen.getByText(/这一段已有的分镜图不会删除/)).toBeTruthy();
  expect(screen.getByText(/还有 1 句台词，台词和说话人不变/)).toBeTruthy();
  await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "解除关联" }).at(-1)!); });
  await vi.waitFor(() => expect(DirectorApi.edit).toHaveBeenCalledWith("w", "clip.unlinkAsset", "c1", null, { assetId: "as1" }));
});

test("the shared failure dialog names the action, the reason and the next step, and is opened once", async () => {
  // 导演台工作台遇到冲突会先把作品刷新到最新（refreshed），弹窗才说「已经刷新」
  const failure = { action: "删除片段 2", refreshed: true, error: new ApiError({ code: "DIRECTOR_EDIT_CONFLICT", message: "该项已在其他页面修改" }, 409) };
  act(() => { openStudioFailure(Modal, failure); openStudioFailure(Modal, failure); });
  expect((await screen.findAllByText("删除片段 2 没有完成")).length).toBeGreaterThan(0);
  expect(screen.getAllByText("该项已在其他页面修改").length).toBeGreaterThan(0);
  expect(screen.getByText(/页面已经刷新到最新内容/)).toBeTruthy();
  expect(document.querySelectorAll(".studio-failure-dialog").length).toBe(1);
  // 没刷新过的页面（Studio 其他页面）不能这么说，请用户自己刷新
  act(() => { openStudioFailure(Modal, { action: "保存模板", error: new ApiError({ code: "IP_TEMPLATE_CONFLICT", message: "模板刚被改过" }, 409) }); });
  expect((await screen.findAllByText("保存模板没有完成")).length).toBeGreaterThan(0);
  expect(screen.getByText(/刷新页面看一下最新内容/)).toBeTruthy();
});
