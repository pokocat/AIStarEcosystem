// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { IpRun } from "@ai-star-eco/types";
import type { VideoStudioModel } from "@ai-star-eco/types/video-studio";
import { StudioFrameIntentDialog, StudioVideoRewriteDetail } from "./studio-video-prompt-notes";
import { StudioVideoControls } from "./studio-video-controls";
import { studioVideoSettings, type StudioVideoDraft } from "@/canvas-bridge/studio-video";
import { StudioTaskList } from "./studio-task-list";
vi.mock("./studio-errors", () => ({ reportStudioError: vi.fn(), studioRunError: (r: IpRun) => r.errorMessage }));
afterEach(cleanup);

const modes = [{ mode: "t2v", label: "文生视频" }, { mode: "i2v", label: "首帧", needsFirstFrame: true },
  { mode: "first_last_frame_video", label: "首尾帧", needsFirstFrame: true, needsLastFrame: true },
  { mode: "universal_reference_video", label: "全能参考", references: { image: { maxCount: 9 }, video: { maxCount: 1 }, audio: { maxCount: 3 }, maxTotal: 12 } }];
const h3 = { endpointId: "h3", supportsPromptOptimization: true, contract: { modes, tiers: [{ tier: "768p" }] } } as unknown as VideoStudioModel;
const other = { ...h3, endpointId: "other", supportsPromptOptimization: false } as VideoStudioModel;
const PROMPT = "老周：等等？你说这片地要拆了，我怎么一点风声都没听到。表情：“等等”时愣住。";
const REWRITTEN = "Lao Zhou freezes and says (S1) <d>[Chinese]等等</d>. He spreads his hands.";
const run = (candidates: NonNullable<IpRun["output"]["videoCandidates"]>): IpRun => ({ id: "r1", projectId: "p", nodeId: "n", kind: "studio-video",
  status: "done", stage: "视频生成完成", pct: 100, cost: 320, createdAt: "2026-10-20T07:39:51Z", inputs: { prompt: PROMPT } as IpRun["inputs"],
  output: { videoCandidates: candidates } });
const done = (index: number, prompt?: string) => ({ index, jobId: `j${index}`, status: "done" as const, pct: 100, durationSec: 8,
  promptRewrite: { state: "done" as const, ...(prompt ? { prompt } : {}) } });

test.each([false, true, undefined])("smart optimization reflects a saved keepPrompt=%s and toggles the submitted option", (keepPrompt) => {
  const submitted = vi.fn();
  function Host() {
    const [draft, setDraft] = useState<StudioVideoDraft>({ mode: "t2v", tier: "768p", keepPrompt });
    return <><StudioVideoControls model={h3} draft={draft} onChange={setDraft} nodes={[]} referenceIds={[]} onReferences={vi.fn()} onLibrary={vi.fn()} section="settings"/>
      <button onClick={() => submitted(studioVideoSettings(draft.mode, draft.tier, [], undefined, undefined, draft.keepPrompt))}>生成</button></>;
  }
  const { container } = render(<Host/>);
  const checkbox = screen.getByRole("checkbox", { name: "智能优化" }) as HTMLInputElement;
  expect(checkbox.checked).toBe(!keepPrompt);
  expect(screen.getByText("由模型端自动优化提示词，可自行选择是否开启。")).toBeDefined();
  expect(container.textContent).not.toMatch(/按原文生成|台词|删掉|改写/);
  fireEvent.click(screen.getByRole("button", { name: "生成" }));
  expect(submitted.mock.lastCall?.[0].optimizePrompt).toBe(keepPrompt ? false : undefined);
  fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole("button", { name: "生成" }));
  expect(submitted.mock.lastCall?.[0].optimizePrompt).toBe(keepPrompt ? undefined : false);
});

test("models without automatic optimization do not show the option", () => {
  render(<StudioVideoControls model={other} draft={{ mode: "t2v", tier: "768p" }} onChange={vi.fn()} nodes={[]} referenceIds={[]} onReferences={vi.fn()} onLibrary={vi.fn()} section="settings"/>);
  expect(screen.queryByRole("checkbox", { name: "智能优化" })).toBeNull();
});

test("the run input view shows what each take was generated from", () => {
  render(<StudioVideoRewriteDetail run={run([done(0, REWRITTEN), { ...done(1), promptRewrite: { state: "off" } }])}/>);
  expect(screen.getByText("候选 1 · 智能优化结果")).toBeDefined();
  expect(screen.getByText(REWRITTEN)).toBeDefined();
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByText("候选 2 · 智能优化 · 已关闭")).toBeDefined();
});

test("a completed optimization without returned content is not shown as an available result", () => {
  render(<StudioVideoRewriteDetail run={run([done(0)])}/>);
  expect(screen.getByText("智能优化 · 未返回内容")).toBeDefined();
  expect(screen.queryByText("智能优化结果")).toBeNull();
});

test("a model or older job without a rewrite report shows nothing extra", () => {
  const { container } = render(<StudioVideoRewriteDetail run={run([{ index: 0, jobId: "j", status: "done", pct: 100, durationSec: 8 }])}/>);
  expect(container.textContent).toBe("");
});

test("the task list omits dialogue rewrite warnings", () => {
  const props = { runs: [run([done(0, REWRITTEN)])], nodes: [], unconfirmed: [], loading: false, busy: false, hasMore: false, refreshErrors: {},
    titleFor: () => "视频", onInput: vi.fn(), onLocate: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn(), onReload: vi.fn(), onMore: vi.fn() };
  render(<StudioTaskList {...props}/>);
  expect(screen.queryByText(/台词|删掉|改写描述/)).toBeNull();
});

test("frame question: three explicit answers; the offer names the mode that holds the pictures", () => {
  const onChoose = vi.fn();
  const intent = { mentions: ["图1", "图2", "首帧", "尾帧"], pictures: 2, first: true, last: true, needed: 2, bound: 0, hasFirst: false, lastFrameIgnored: false };
  const { rerender } = render(<StudioFrameIntentDialog intent={intent} model={h3} canvasImages={0} onChoose={onChoose}/>);
  expect(screen.getByText("描述里提到了图片，这次没有用上图片")).toBeDefined();
  expect(screen.getByText(/「图1」「图2」「首帧」「尾帧」写在描述里只是文字/)).toBeDefined();
  expect(screen.getByText("画布上还没有图片，可以先上传，或从人物库里选。")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "改用「首尾帧」选图片" }));
  fireEvent.click(screen.getByRole("button", { name: "仍按文字生成" }));
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(onChoose.mock.calls.map(call => call[0])).toEqual(["bind", "text", "cancel"]);

  const three = { mentions: ["图1", "图2", "图3"], pictures: 3, first: false, last: false, needed: 3, bound: 0, hasFirst: false, lastFrameIgnored: false };
  rerender(<StudioFrameIntentDialog intent={three} model={h3} canvasImages={3} onChoose={onChoose}/>);
  expect(screen.getByRole("button", { name: "改用「全能参考」选图片" })).toBeDefined();
  const onlyLast = { mentions: ["图1", "尾帧"], pictures: 1, first: false, last: true, needed: 1, bound: 0, hasFirst: false, lastFrameIgnored: false };
  rerender(<StudioFrameIntentDialog intent={onlyLast} model={h3} canvasImages={3} onChoose={onChoose}/>);
  expect(screen.getByRole("button", { name: "改用「首尾帧」选图片" })).toBeDefined();
  expect(screen.getByText(/还需要再选一张首帧图/)).toBeDefined();
});
