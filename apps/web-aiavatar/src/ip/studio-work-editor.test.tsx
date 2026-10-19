// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import type { StudioWorkDraft } from "@ai-star-eco/types/ip-studio-workflow";
import type { CanvasConnection, CanvasNodeData } from "@/canvas/types/canvas";
import { StudioWorkEditor } from "./studio-work-editor";

vi.mock("@/canvas-bridge/signed-video", () => ({ SignedVideo: ({ storageKey, ...p }: any) => <video data-key={storageKey} {...p}/> }));
vi.mock("@/canvas-bridge/signed-audio", () => ({ SignedAudio: ({ storageKey, ...p }: any) => <audio data-key={storageKey} {...p}/> }));
vi.mock("./studio-errors", () => ({ StudioErrorNotice: ({ error }: any) => <p role="alert">{String(error)}</p>, studioNodeError: () => "合成失败" }));
vi.mock("antd", () => {
  const Input = ({ children, ...p }: any) => <input {...p}/>; Input.TextArea = (p: any) => <textarea {...p}/>;
  return { Input,
    Button: ({ loading, type, ...p }: any) => <button {...p} disabled={loading || p.disabled}>{p.children}</button>,
    Checkbox: ({ children, ...p }: any) => <label><input type="checkbox" {...p}/>{children}</label>,
    Select: ({ options, value, onChange, ...p }: any) => <select aria-label={p["aria-label"]} value={value} onChange={e => onChange(e.target.value)}>
      {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select> };
});
afterEach(cleanup);

const video = (id: string, metadata: Partial<NonNullable<CanvasNodeData["metadata"]>> = {}, title = "视频"): CanvasNodeData =>
  ({ id, type: "video" as never, title, position: { x: 0, y: 0 }, width: 320, height: 420, metadata: { status: "success", storageKey: `${id}.mp4`, content: `/${id}.mp4`, ...metadata } });
const source = video("src", { durationMs: 6000 });
const take = (id: string, seconds: string, extra: Record<string, unknown> = {}) => video(id, { seconds, prompt: `${id} prompt`, studio: { kind: "shot", includeInWork: true, runId: id, ...extra } });
const voice = (id: string, seconds: string): CanvasNodeData =>
  ({ id, type: "audio" as never, title: `配音 ${id}`, position: { x: 0, y: 0 }, width: 300, height: 150, metadata: { status: "success", storageKey: `${id}.m4a`, content: `/${id}.m4a`, seconds } });
const baseDraft: StudioWorkDraft = { aspectRatio: "9:16", packagingEnabled: false, brand: "", title: "", cta: "", captionText: "" };

function Host({ nodes, connections = [], clips, works = [], draft: initial = baseDraft, spies = {} }:
  { nodes: CanvasNodeData[]; connections?: CanvasConnection[]; clips?: CanvasNodeData[]; works?: CanvasNodeData[]; draft?: StudioWorkDraft; spies?: Record<string, any> }) {
  const [draft, setDraft] = useState(initial);
  const [all, setAll] = useState(nodes);
  const list = (clips || all.filter(n => n.type === "video")).map(c => all.find(n => n.id === c.id)!);
  return <StudioWorkEditor nodes={all} connections={connections} clips={list} multiEpisode={false} draft={draft} onDraftChange={c => setDraft(d => ({ ...d, ...c }))}
    onIncludeClip={(id, includeInWork) => setAll(current => current.map(n => n.id === id ? { ...n, metadata: { ...n.metadata, studio: { ...n.metadata!.studio!, includeInWork } } } : n))}
    onMoveClip={spies.move || (() => undefined)} works={works} busy={false} locked={false}
    onAssemble={spies.assemble || (() => undefined)} onDownload={() => undefined} onAddClips={() => undefined} onCreateVideo={() => undefined}
    onOpenStoryboard={() => undefined} onMakeVoice={spies.voice || (() => undefined)}/>;
}
const assembleButton = () => screen.getByRole("button", { name: "合成作品" }) as HTMLButtonElement;

// 2026-10-19 user report (爆款复刻): the uploaded original was ticked and would be stitched in front of the recreated clip.
test("the original a recreation copies starts outside the cut, says why, and can be put back", () => {
  const assemble = vi.fn();
  render(<Host nodes={[source, take("t1", "5")]} connections={[{ id: "e", fromNodeId: "src", toNodeId: "t1" }]} spies={{ assemble }}/>);
  const original = screen.getByRole("checkbox", { name: "把「原片」放进成片" }) as HTMLInputElement;
  expect(original.checked).toBe(false);
  expect(screen.getByText("其他片段是照着它做的，默认不放进成片。")).toBeTruthy();
  expect((screen.getByRole("checkbox", { name: "把「AI 生成的片段」放进成片" }) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByText("已选 1/2 段 · 共 5 秒")).toBeTruthy();
  fireEvent.click(original);
  expect(screen.getByText("已选 2/2 段 · 共 11 秒")).toBeTruthy();
  fireEvent.click(assembleButton()); expect(assemble).toHaveBeenCalledOnce();
});

test("a voiceover longer than the cut blocks assembly before the user waits for it; a shorter one says where it goes quiet", () => {
  render(<Host nodes={[take("t1", "5"), take("t2", "4"), voice("long", "14"), voice("short", "6")]}/>);
  fireEvent.change(screen.getByRole("combobox", { name: "成片音轨" }), { target: { value: "long.m4a" } });
  expect(screen.getByText("配音 14 秒，比成片长 5 秒，合成不了。换一条短一点的配音，或者多放几段片段。")).toBeTruthy();
  expect(assembleButton().disabled).toBe(true);
  expect(within(document.querySelector(".studio-work-actions")!).getByText("配音比成片长，合成不了")).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "成片音轨" }), { target: { value: "short.m4a" } });
  expect(screen.getByText("配音比成片短 3 秒，最后这一段没有声音。")).toBeTruthy();
  expect(assembleButton().disabled).toBe(false);
});

test("the browser's reading of the file replaces the stored length", () => {
  render(<Host nodes={[take("t1", "8")]}/>);
  expect(screen.getByText("已选 1/1 段 · 共 8 秒")).toBeTruthy();
  const thumb = screen.getByRole("button", { name: "预览：AI 生成的片段" }).querySelector("video")!;
  Object.defineProperty(thumb, "duration", { value: 5.04 }); Object.defineProperty(thumb, "videoWidth", { value: 1280 }); Object.defineProperty(thumb, "videoHeight", { value: 720 });
  fireEvent.loadedMetadata(thumb);
  expect(screen.getByText("已选 1/1 段 · 共 5 秒")).toBeTruthy();
  expect(screen.getByText("横屏画面，成片里上下会留黑边")).toBeTruthy();
});

test("captions get times from the clips, and a caption past the end is caught", () => {
  render(<Host nodes={[take("t1", "5"), take("t2", "4")]} draft={{ ...baseDraft, packagingEnabled: true }}/>);
  expect(assembleButton().disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "按片段填好时间" }));
  const box = screen.getByRole("textbox", { name: "成片字幕时间与文字" }) as HTMLTextAreaElement;
  expect(box.value).toBe("0-5: \n5-9: ");
  expect(screen.getAllByText("第 1 条字幕还没写内容").length).toBeGreaterThan(0);
  fireEvent.change(box, { target: { value: "0-5: 第一句\n5-12: 第二句" } });
  expect(screen.getAllByText("第 2 条字幕结束在 12 秒，成片只有 9 秒").length).toBeGreaterThan(0);
  expect(assembleButton().disabled).toBe(true);
  fireEvent.change(box, { target: { value: "0-5: 第一句\n5-9: 第二句" } });
  expect(assembleButton().disabled).toBe(false);
  expect((screen.getByRole("button", { name: "按片段填好时间" }) as HTMLButtonElement).disabled).toBe(true);
});

test("dragging moves a clip; arrows stay for keyboard use", () => {
  const move = vi.fn();
  render(<Host nodes={[take("a", "5"), take("b", "4"), take("c", "3")]} spies={{ move }}/>);
  const rows = document.querySelectorAll(".studio-work-clip");
  fireEvent.dragStart(rows[0], { dataTransfer: { setData: () => undefined, effectAllowed: "" } });
  fireEvent.dragOver(rows[2]); fireEvent.drop(rows[2]);
  expect(move).toHaveBeenCalledWith(0, 2);
  fireEvent.click(screen.getByRole("button", { name: "片段 2 下移" }));
  expect(move).toHaveBeenLastCalledWith(1, 2);
  expect((screen.getByRole("button", { name: "片段 1 上移" }) as HTMLButtonElement).disabled).toBe(true);
});

test("clips of different episodes cannot be dragged or stepped across each other", () => {
  const move = vi.fn();
  render(<Host nodes={[take("a", "5", { episodeNo: 1 }), take("b", "4", { episodeNo: 2 })]} spies={{ move }}/>);
  expect((screen.getByRole("button", { name: "片段 1 下移" }) as HTMLButtonElement).disabled).toBe(true);
  const rows = document.querySelectorAll(".studio-work-clip");
  fireEvent.dragStart(rows[0], { dataTransfer: { setData: () => undefined, effectAllowed: "" } });
  fireEvent.dragOver(rows[1]); fireEvent.drop(rows[1]);
  expect(move).not.toHaveBeenCalled();
});

test("without any voiceover the editor offers to make one instead of an empty list", () => {
  const voiceSpy = vi.fn();
  render(<Host nodes={[take("t1", "5")]} spies={{ voice: voiceSpy }}/>);
  expect(screen.queryByRole("combobox", { name: "成片音轨" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "去做一条配音" }));
  expect(voiceSpy).toHaveBeenCalledOnce();
});

test("the preview plays the chosen clips back to back and shows captions on the cut's clock", () => {
  render(<Host nodes={[take("t1", "5"), take("t2", "4")]} draft={{ ...baseDraft, packagingEnabled: true, brand: "声量", captionText: "0-5: 第一句\n5-9: 第二句" }}/>);
  const stage = () => document.querySelector(".studio-work-stage video") as HTMLVideoElement;
  expect(stage().dataset.key).toBe("t1.mp4");
  expect(document.querySelector(".studio-work-overlay")?.textContent).toContain("声量");
  expect(document.querySelector(".studio-work-overlay-caption")?.textContent).toBe("第一句");
  fireEvent.ended(stage());
  expect(stage().dataset.key).toBe("t2.mp4");
  expect(document.querySelector(".studio-work-overlay-caption")?.textContent).toBe("第二句");
  expect(screen.getByText("00:05 / 00:09")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "从第 1 段开始看" }));
  expect(stage().dataset.key).toBe("t1.mp4");
});

test("clicking a clip that is not in the cut shows it alone, clearly marked", () => {
  render(<Host nodes={[source, take("t1", "5")]} connections={[{ id: "e", fromNodeId: "src", toNodeId: "t1" }]}/>);
  fireEvent.click(screen.getByRole("button", { name: "预览：原片" }));
  expect((document.querySelector(".studio-work-stage video") as HTMLVideoElement).dataset.key).toBe("src.mp4");
  expect(screen.getByText("正在单独看「原片」，它不在成片里。")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "回到成片预览" }));
  expect((document.querySelector(".studio-work-stage video") as HTMLVideoElement).dataset.key).toBe("t1.mp4");
});

test("finished works are listed newest first", () => {
  const work = (id: string, title: string) => video(id, { studio: { kind: "work" } }, title);
  render(<Host nodes={[take("t1", "5")]} clips={[take("t1", "5")]} works={[work("w1", "第一次合成"), work("w2", "第二次合成")]}/>);
  const titles = [...document.querySelectorAll(".studio-work-result h4")].map(h => h.textContent);
  expect(titles).toEqual(["第二次合成", "第一次合成"]);
});
