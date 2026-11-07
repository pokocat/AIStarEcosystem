// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ClipVideo, EpisodeOutput } from "./director-output";
import { DirectorApi } from "../api";

vi.mock("../api", () => ({ DirectorApi: { runTask: vi.fn(), edit: vi.fn(), quote: vi.fn() }, IpStudioApi: {} }));
afterEach(cleanup);

// H3 提交前把中文视频提示词改写成官方英文写法：报价只含视频，改写另计费要说清；改写进行中不能再点生成。
const slot = { candidates: [], adoptedId: null, adoptedBy: null, pending: [], error: null };
const clip: any = { id: "cl1", title: "通道对话", durationSec: 12, issues: [], unvoiced: [], shots: [], assetIds: [],
  board: { candidates: [{ id: "b1", key: "k" }], adoptedId: "b1", adoptedBy: "user" }, video: slot, videoPromptRewrite: "needed" };
const work = (tasks: any[] = []): any => ({ id: "w1", tasks, pricing: { mock: false }, videoLimits: { mode: "omni" } });

test("the price is the video only and says the prompt rewrite is billed by usage", () => {
  render(<ClipVideo work={work()} clip={clip} quote={{ credits: 480, error: null }} apply={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByText(/12 秒，约 480 积分。优化提示词按实际用量另计。/)).toBeTruthy();
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
  expect(screen.getByText("优化稿有需要注意的问题")).toBeTruthy();
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

// 2026-10-31：优化稿超长时能重新优化（只出稿、不出视频），每条视频写清用的是哪份稿。
test("a draft that is too long can be re-optimised, which only writes a new draft", async () => {
  vi.mocked(DirectorApi.runTask).mockClear().mockResolvedValue({} as never);
  const tooLong = { ...clip, videoPromptRewrite: "review", videoPromptEn: { at: "2026-10-31T05:03:03Z", text: "subject_definitions: ...", usable: false,
    warnings: ["优化稿超过 7000 字符，H3 收不下，请重新优化或按原文生成"] } };
  render(<ClipVideo work={work()} clip={tooLong} quote={{ credits: 480, error: null }} apply={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByText("优化稿过长，超出视频模型限制")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "用优化稿生成" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "重新优化" }));
  await vi.waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalled());
  const body = vi.mocked(DirectorApi.runTask).mock.calls[0][1];
  expect(body).toMatchObject({ type: "video-prompt", targetId: "cl1" });
  expect(body).not.toHaveProperty("maxCost");
});

test("after choosing the original, a too-long draft offers re-optimising instead of switching back to it", () => {
  const chose = { ...clip, videoPromptRewrite: "original", videoPromptEn: { at: "2026-10-31T05:03:03Z", usable: false } };
  render(<ClipVideo work={work()} clip={chose} quote={{ credits: 480, error: null }} apply={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByRole("button", { name: "重新优化" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "改回智能优化" })).toBeNull();
});

test("a draft-only rewrite does not promise to start the video", () => {
  render(<ClipVideo work={work([{ id: "IPR-2", target: "videoPrompt:cl1", status: "running", draftOnly: true }])} clip={clip} quote={{ credits: 480, error: null }} apply={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByText(/正在重新优化提示词，完成后可选择使用哪一份/)).toBeTruthy();
  expect(screen.queryByText(/完成后自动开始生成视频/)).toBeNull();
});

test("the adopted video says which prompt it was made from and what that draft cost", () => {
  const made = { ...clip, videoPromptRewrite: "review", video: { ...slot, adoptedId: "v1", adoptedBy: "user",
    candidates: [{ id: "v1", key: "k/v.mp4", runId: null, source: "generated", createdAt: "2026-10-31T05:04:31Z",
      promptUsed: "original", promptReason: "too_long", draftState: "too_long", rewriteCost: 12 }] } };
  render(<ClipVideo work={work()} clip={made} quote={{ credits: 480, error: null }} apply={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByText("此视频使用中文原文提示词（优化稿过长，未使用），优化消耗 12 积分")).toBeTruthy();
});

test("the export button says beside it why it cannot be used", () => {
  const ep: any = { id: "e1", no: 1 };
  const missing = { ...clip, episodeId: "e1", order: 1 };
  render(<EpisodeOutput work={{ ...work(), title: "作品", clips: [missing], exports: [], settings: { aspectRatio: "9:16" } }} ep={ep} apply={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByRole("button", { name: "导出整集" })).toHaveProperty("disabled", true);
  expect(screen.getByText("1 个片段缺少视频")).toBeTruthy();
});
