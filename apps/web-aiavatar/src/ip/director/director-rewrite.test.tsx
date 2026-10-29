// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App, ConfigProvider } from "antd";
import type { DirectorClip, DirectorTask, DirectorWork } from "@ai-star-eco/types";
import { DirectorStoryboard } from "./director-storyboard";
import { DirectorScript } from "./director-script";
import { DirectorApi } from "../api";

vi.mock("../api", () => ({ DirectorApi: { runTask: vi.fn(), edit: vi.fn(), quote: vi.fn().mockResolvedValue({ items: [] }) }, IpStudioApi: {} }));

// 分镜页：整集「重写分镜脚本」和片段上的「重写」都只改文字；改之前说清范围和会被替换的手改内容；不能重写时点了也说原因。
const slot = { candidates: [], adoptedId: null, adoptedBy: null, error: null, pending: [] };
function clip(id: string, order: number, over: Partial<DirectorClip> = {}): DirectorClip {
  return { id, episodeId: "e1", order, title: `片段标题 ${order}`, summary: "", durationSec: 12, assetIds: [], issues: [], unvoiced: [],
    shots: [{ id: `${id}-s`, durationSec: 12, startSec: 0, endSec: 12, size: "中景", camera: "", action: "", still: "", dialogue: [] }],
    boardPrompt: "", boardPromptCustom: false, videoPrompt: "视频提示词", videoPromptCustom: false, board: { ...slot }, video: { ...slot }, rev: 1, ...over } as DirectorClip;
}
const ep = { id: "e1", no: 1, title: "掉漆", summary: "", content: "正文", extracted: true, planStale: false, planError: null, pendingPlan: null, rev: 1 };
function work(over: Partial<DirectorWork> = {}): DirectorWork {
  return {
    id: "w", title: "作品", revision: 1, createdAt: "2026-10-27T00:00:00Z", updatedAt: "2026-10-27T00:00:00Z",
    idea: "", logline: "", draft: "", draftRev: 1, settings: { style: "真人写实", aspectRatio: "9:16", language: "中文", videoModel: null, textModel: null },
    episodes: [ep], assets: [], clips: [clip("c1", 1, { board: { ...slot, candidates: [{ id: "b1", key: "k" }] as never, adoptedId: "b1", adoptedBy: "user" } }), clip("c2", 2, { videoPromptCustom: true })],
    pipeline: null, notice: null, textError: null, tasks: [], pricing: { textMax: 21, image: 8, mock: false }, videoModels: [],
    videoLimits: { model: "h3", name: "MiniMax H3", minSec: 5, maxSec: 15, mock: false, mode: "omni", maxShots: 4 },
    draftEpisodeHeadings: 0, reference: "", referenceRev: 0, pendingSplit: null, canUndoSplit: false, ...over,
  } as DirectorWork;
}
const noop = () => {};
const props = { episodeId: "e1", apply: vi.fn(), setError: vi.fn(), goTab: noop, reviewExtract: noop, openSettings: noop, pickEpisode: noop, startPipeline: noop };
const show = (w: DirectorWork) => render(<ConfigProvider theme={{ token: { motion: false } }}><App><DirectorStoryboard {...props} work={w}/></App></ConfigProvider>);
const task = (target: string): DirectorTask => ({ id: "IPR-1", target, status: "running", stage: null, cost: 0, errorMessage: null, createdAt: "2026-10-27T00:00:00Z" });

beforeEach(() => { vi.mocked(DirectorApi.runTask).mockReset().mockResolvedValue(work() as never); });
afterEach(cleanup);

test("the episode rewrite keeps the clips by default and cannot re-split clips that already have media", async () => {
  show(work());
  fireEvent.click(screen.getByRole("button", { name: /重写分镜脚本/ }));
  const dialog = screen.getByRole("dialog", { name: "重写第 1 集分镜脚本" });
  expect(within(dialog).getByText(/不会出图、不会生成视频，其他集不受影响/)).toBeTruthy();
  const [keep, resplit] = within(dialog).getAllByRole("radio") as HTMLInputElement[];
  expect(keep.checked).toBe(true);
  expect(resplit.disabled).toBe(true);
  expect(within(dialog).getByText(/片段 1 已有分镜图或视频，重新切分会丢掉它们/)).toBeTruthy();
  expect(within(dialog).getByText("片段 2 手改过的视频提示词会换成新写的")).toBeTruthy();
  // 文字任务不展示不确定的积分数字，只说按实际用量结算。
  expect(within(dialog).getByText(/^按实际用量结算/)).toBeTruthy();
  expect(within(dialog).queryByText(/\d+ 积分/)).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: /开始重写/ }));
  await vi.waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalled());
  expect(vi.mocked(DirectorApi.runTask).mock.calls[0][1]).toMatchObject({ type: "reshoot", targetId: "e1", maxCost: 21 });
  expect(vi.mocked(DirectorApi.runTask).mock.calls[0][1]).not.toHaveProperty("options");
});

test("without media the episode can be re-split, which is the old full rewrite", async () => {
  show(work({ clips: [clip("c1", 1), clip("c2", 2)] }));
  fireEvent.click(screen.getByRole("button", { name: /重写分镜脚本/ }));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getAllByRole("radio")[1]);
  fireEvent.click(within(dialog).getByRole("button", { name: /开始重写/ }));
  await vi.waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalled());
  expect(vi.mocked(DirectorApi.runTask).mock.calls[0][1]).toMatchObject({ type: "plan", targetId: "e1" });
});

test("a single clip is rewritten on its own after the impact is spelled out", async () => {
  show(work());
  const card = screen.getAllByRole("article")[1];
  fireEvent.click(within(card).getByRole("button", { name: /^重写$/ }));
  expect((await screen.findAllByText("重写片段 2 的分镜脚本？")).length).toBeGreaterThan(0);
  expect(screen.getByText(/只改这一段的文字，不会出图、不会生成视频，其他片段不变/)).toBeTruthy();
  expect(screen.getByText("片段 2 手改过的视频提示词会换成新写的")).toBeTruthy();
  expect(screen.getByText("按实际用量结算")).toBeTruthy();
  expect(screen.queryByText(/\d+ 积分/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /开始重写/ }));
  await vi.waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalled());
  expect(vi.mocked(DirectorApi.runTask).mock.calls[0][1]).toMatchObject({ type: "reshoot", targetId: "e1", options: { clipIds: ["c2"] } });
});

test("a clip that cannot be rewritten says why instead of doing nothing", async () => {
  show(work({ tasks: [task("board:c1")] }));
  fireEvent.click(within(screen.getAllByRole("article")[0]).getByRole("button", { name: /^重写$/ }));
  expect(await screen.findByText("分镜图生成中，完成后再重写")).toBeTruthy();
  expect(DirectorApi.runTask).not.toHaveBeenCalled();
});

test("while a clip is rewritten the card says so and the episode rewrite waits", async () => {
  show(work({ tasks: [task("reshoot:c2")] }));
  const card = screen.getAllByRole("article")[1];
  expect(within(card).getByText("AI 正在重写片段 2 的分镜脚本")).toBeTruthy();
  expect(within(card).queryByRole("button", { name: /^重写$/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /重写分镜脚本/ }));
  expect(await screen.findByText("片段 2 正在重写，完成后再重写整集")).toBeTruthy();
});

test("a rewrite that came back after the user edited the clip waits for a choice", async () => {
  vi.mocked(DirectorApi.edit).mockResolvedValue(work() as never);
  const pending = { runId: "IPR-1", at: "2026-10-27T00:00:00Z", title: "新", summary: "", assetIds: [], shots: [{ durationSec: 4, size: "", camera: "", action: "", still: "", dialogue: [] }] };
  show(work({ clips: [clip("c1", 1, { pendingShots: pending })] }));
  expect(screen.getByText(/重写期间你改过这一段，新写的版本（1 个镜头）没有覆盖现有内容/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "换成新版本" }));
  await vi.waitFor(() => expect(DirectorApi.edit).toHaveBeenCalledWith("w", "clip.usePendingShots", "c1", null));
});

test("the episode summary is a multi-line box that keeps line breaks", () => {
  const summary = "第一行很长很长的摘要。\n第二行。";
  // 当前集默认展开。
  render(<DirectorScript {...props} work={work({ episodes: [{ ...ep, summary }] })}/>);
  const box = screen.getByRole("textbox", { name: "本集摘要" }) as HTMLTextAreaElement;
  expect(box.tagName).toBe("TEXTAREA");
  expect(box.value).toBe(summary);
});
