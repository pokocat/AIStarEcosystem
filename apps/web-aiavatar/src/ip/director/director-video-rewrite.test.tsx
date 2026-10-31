// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ClipVideo } from "./director-output";
import { DirectorApi } from "../api";

vi.mock("../api", () => ({ DirectorApi: { runTask: vi.fn(), edit: vi.fn(), quote: vi.fn() }, IpStudioApi: {} }));
afterEach(cleanup);

// H3 提交前把中文视频提示词改写成官方英文写法：报价只含视频，改写另扣少量积分要说清；改写进行中不能再点生成。
const slot = { candidates: [], adoptedId: null, adoptedBy: null, pending: [], error: null };
const clip: any = { id: "cl1", title: "通道对话", durationSec: 12, issues: [], unvoiced: [], shots: [], assetIds: [],
  board: { candidates: [{ id: "b1", key: "k" }], adoptedId: "b1", adoptedBy: "user" }, video: slot, videoPromptRewrite: "needed" };
const work = (tasks: any[] = []): any => ({ id: "w1", tasks, pricing: { mock: false }, videoLimits: { mode: "omni" } });

test("the price is the video only and says the prompt rewrite costs a little extra", () => {
  render(<ClipVideo work={work()} clip={clip} quote={{ credits: 480, error: null }} apply={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByText(/12 秒，约 480 积分，另需少量积分优化提示词/)).toBeTruthy();
});

test("no rewrite note once the English prompt is ready", () => {
  render(<ClipVideo work={work()} clip={{ ...clip, videoPromptRewrite: "ready" }} quote={{ credits: 480, error: null }} apply={vi.fn()} setError={vi.fn()}/>);
  expect(screen.queryByText(/优化提示词/)).toBeNull();
});

test("while the prompt is being rewritten the clip says so and cannot be generated again", () => {
  render(<ClipVideo work={work([{ id: "IPR-1", target: "videoPrompt:cl1", status: "running" }])} clip={clip} quote={{ credits: 480, error: null }} apply={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByText(/正在优化提示词，完成后自动开始生成视频/)).toBeTruthy();
  expect((screen.getByRole("button", { name: /生成片段视频/ }) as HTMLButtonElement).disabled).toBe(true);
});

test("a draft with notes asks which prompt to use instead of generating straight away", () => {
  const reviewed = { ...clip, videoPromptRewrite: "review", videoPromptEn: { at: "2026-10-27T01:00:00Z", text: "subject_definitions: ...", usable: true,
    warnings: ["第 3 句台词「难受？」模型漏了，已补在第 2 镜末尾"] } };
  render(<ClipVideo work={work()} clip={reviewed} quote={{ credits: 480, error: null }} apply={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByText("优化稿有需要留意的地方")).toBeTruthy();
  expect(screen.getByText("第 3 句台词「难受？」模型漏了，已补在第 2 镜末尾")).toBeTruthy();
  expect((screen.getByRole("button", { name: /生成片段视频/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("button", { name: "用优化稿生成" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "用原文生成" })).toBeTruthy();
});

test("the original Chinese is always one click away and the choice is sent with the task", async () => {
  vi.mocked(DirectorApi.quote).mockResolvedValue({ items: [{ clipId: "cl1", credits: 480, error: null }] } as never);
  vi.mocked(DirectorApi.runTask).mockResolvedValue({} as never);
  render(<ClipVideo work={work()} clip={clip} quote={{ credits: 480, error: null }} apply={vi.fn()} setError={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button", { name: "按原文生成" }));
  await vi.waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalled());
  expect(vi.mocked(DirectorApi.runTask).mock.calls[0][1]).toMatchObject({ type: "video", targetId: "cl1", options: { promptChoice: "original" } });
});
