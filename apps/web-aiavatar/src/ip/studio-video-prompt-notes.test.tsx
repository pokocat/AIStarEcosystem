// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { IpRun } from "@ai-star-eco/types";
import type { VideoStudioModel } from "@ai-star-eco/types/video-studio";
import { StudioFrameIntentDialog, StudioVideoPromptNote, StudioVideoRewriteDetail, studioComposerTake, studioFrameModeFor } from "./studio-video-prompt-notes";
import { StudioTaskList } from "./studio-task-list";
vi.mock("./studio-errors", () => ({ reportStudioError: vi.fn(), studioRunError: (r: IpRun) => r.errorMessage }));
afterEach(cleanup);

const modes = [{ mode: "t2v", label: "文生视频" }, { mode: "i2v", label: "首帧", needsFirstFrame: true },
  { mode: "first_last_frame_video", label: "首尾帧", needsFirstFrame: true, needsLastFrame: true }];
const h3 = { endpointId: "h3", supportsPromptOptimization: true, contract: { modes } } as unknown as VideoStudioModel;
const other = { ...h3, endpointId: "other", supportsPromptOptimization: false } as VideoStudioModel;
const PROMPT = "老周：等等？你说这片地要拆了，我怎么一点风声都没听到。表情：“等等”时愣住。";
const REWRITTEN = "Lao Zhou freezes and says (S1) <d>[Chinese]等等</d>. He spreads his hands.";
const run = (candidates: NonNullable<IpRun["output"]["videoCandidates"]>): IpRun => ({ id: "r1", projectId: "p", nodeId: "n", kind: "studio-video",
  status: "done", stage: "视频生成完成", pct: 100, cost: 320, createdAt: "2026-10-20T07:39:51Z", inputs: { prompt: PROMPT } as IpRun["inputs"],
  output: { videoCandidates: candidates } });
const done = (index: number, prompt?: string) => ({ index, jobId: `j${index}`, status: "done" as const, pct: 100, durationSec: 8,
  promptRewrite: { state: "done" as const, ...(prompt ? { prompt } : {}) } });

test("before a run: recognised lines and the option to keep the text, only for models that rewrite", () => {
  const { rerender, container } = render(<StudioVideoPromptNote model={h3} prompt={PROMPT} keepPrompt={false}/>);
  expect(container.textContent).toContain("识别到1句台词：「老周：等等？你说这片地要拆了，我怎么一点风声都没听到」");
  expect(container.textContent).toContain("勾选「按原文生成」");
  rerender(<StudioVideoPromptNote model={h3} prompt={PROMPT} keepPrompt/>);
  expect(container.textContent).toBe("");
  rerender(<StudioVideoPromptNote model={other} prompt={PROMPT} keepPrompt={false}/>);
  expect(container.textContent).toBe("");
  rerender(<StudioVideoPromptNote model={h3} prompt="一只猫在窗台上打盹" keepPrompt={false}/>);
  expect(container.textContent).toBe("");
});

test("after a run: the lines the vendor dropped, said as after-the-fact, with the real description one click away", () => {
  const take = studioComposerTake(run([done(0, REWRITTEN)]), "r1");
  const onShow = vi.fn();
  render(<StudioVideoPromptNote model={h3} prompt={PROMPT} keepPrompt={false} lastTake={take} onShowRewrite={onShow}/>);
  expect(screen.getByRole("status").textContent).toContain("上次出片前，模型改写描述时没有保留台词「你说这片地要拆了」「我怎么一点风声都没听到」");
  fireEvent.click(screen.getByRole("button", { name: "看模型实际用的描述" }));
  expect(onShow).toHaveBeenCalledOnce();
});

test("the composer reads the adopted take, else the first take that reports a rewrite", () => {
  const twoTakes = run([done(0, "He says (S1) <d>[Chinese]等等？你说这片地要拆了，我怎么一点风声都没听到</d>"), done(1, REWRITTEN)]);
  expect(studioComposerTake(twoTakes, "r1:1")?.lost).toHaveLength(1);
  expect(studioComposerTake(twoTakes, "r1")?.lost).toEqual([]);
  expect(studioComposerTake(twoTakes, undefined)?.index).toBe(0);
  expect(studioComposerTake({ ...twoTakes, kind: "studio-image" }, "r1")).toBeUndefined();
});

test("the run input view shows what each take was generated from", () => {
  render(<StudioVideoRewriteDetail run={run([done(0, REWRITTEN), { ...done(1), promptRewrite: { state: "off" } }])}/>);
  expect(screen.getByText("候选 1 · 模型实际用的描述")).toBeDefined();
  expect(screen.getByText(REWRITTEN)).toBeDefined();
  expect(screen.getByRole("status").textContent).toContain("老周：「你说这片地要拆了」「我怎么一点风声都没听到」（只留下了「等等」）");
  expect(screen.getByText("候选 2 · 按原文生成")).toBeDefined();
});

test("a model or older job without a rewrite report shows nothing extra", () => {
  const { container } = render(<StudioVideoRewriteDetail run={run([{ index: 0, jobId: "j", status: "done", pct: 100, durationSec: 8 }])}/>);
  expect(container.textContent).toBe("");
});

test("the task list points out a take that lost lines", () => {
  const props = { runs: [run([done(0, REWRITTEN)])], nodes: [], unconfirmed: [], loading: false, busy: false, hasMore: false, refreshErrors: {},
    titleFor: () => "视频", onInput: vi.fn(), onLocate: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn(), onReload: vi.fn(), onMore: vi.fn() };
  render(<StudioTaskList {...props}/>);
  expect(screen.getByText("出片前模型改写描述时删掉了部分台词，可在「查看输入」里对照")).toBeDefined();
});

test("frame question: three explicit answers, and the switch target never invents a mode", () => {
  const onChoose = vi.fn();
  const intent = { mentions: ["图1", "图2", "首帧", "尾帧"], needed: 2, bound: 0, lastFrameIgnored: false };
  render(<StudioFrameIntentDialog intent={intent} model={h3} canvasImages={0} onChoose={onChoose}/>);
  expect(screen.getByText("描述里提到了图片，这次没有用上图片")).toBeDefined();
  expect(screen.getByText(/「图1」「图2」「首帧」「尾帧」写在描述里只是文字/)).toBeDefined();
  expect(screen.getByText("画布上还没有图片，可以先上传，或从人物库里选。")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "改用「首尾帧」选图片" }));
  fireEvent.click(screen.getByRole("button", { name: "仍按文字生成" }));
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(onChoose.mock.calls.map(call => call[0])).toEqual(["bind", "text", "cancel"]);

  expect(studioFrameModeFor(h3, { ...intent, needed: 1 })?.mode).toBe("i2v");
  const textOnly = { ...h3, contract: { modes: [modes[0]] } } as unknown as VideoStudioModel;
  expect(studioFrameModeFor(textOnly, intent)).toBeUndefined();
});
