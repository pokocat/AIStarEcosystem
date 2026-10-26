// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ClipVideo } from "./director-output";

vi.mock("../api", () => ({ DirectorApi: { runTask: vi.fn(), edit: vi.fn(), quote: vi.fn() }, IpStudioApi: {} }));
afterEach(cleanup);

// H3 提交前把中文视频提示词改写成官方英文写法：报价只含视频，改写另扣少量积分要说清；改写进行中不能再点生成。
const slot = { candidates: [], adoptedId: null, adoptedBy: null, pending: [], error: null };
const clip: any = { id: "cl1", title: "通道对话", durationSec: 12, issues: [], unvoiced: [], shots: [], assetIds: [],
  board: { candidates: [{ id: "b1", key: "k" }], adoptedId: "b1", adoptedBy: "user" }, video: slot, videoPromptRewrite: "needed" };
const work = (tasks: any[] = []): any => ({ id: "w1", tasks, pricing: { mock: false }, videoLimits: { mode: "omni" } });

test("the price is the video only and says the prompt rewrite costs a little extra", () => {
  render(<ClipVideo work={work()} clip={clip} quote={{ credits: 480, error: null }} apply={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByText(/12 秒，约 480 积分，另需少量积分改写提示词/)).toBeTruthy();
});

test("no rewrite note once the English prompt is ready", () => {
  render(<ClipVideo work={work()} clip={{ ...clip, videoPromptRewrite: "ready" }} quote={{ credits: 480, error: null }} apply={vi.fn()} setError={vi.fn()}/>);
  expect(screen.queryByText(/改写提示词/)).toBeNull();
});

test("while the prompt is being rewritten the clip says so and cannot be generated again", () => {
  render(<ClipVideo work={work([{ id: "IPR-1", target: "videoPrompt:cl1", status: "running" }])} clip={clip} quote={{ credits: 480, error: null }} apply={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByText(/正在把提示词改写成英文，完成后自动开始生成视频/)).toBeTruthy();
  expect((screen.getByRole("button", { name: /生成片段视频/ }) as HTMLButtonElement).disabled).toBe(true);
});
