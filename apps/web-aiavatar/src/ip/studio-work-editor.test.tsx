// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createContext, useContext, useState } from "react";
import type { StudioWorkDraft } from "@ai-star-eco/types/ip-studio-workflow";
import type { CanvasConnection, CanvasNodeData } from "@/canvas/types/canvas";
import { StudioWorkEditor } from "./studio-work-editor";

vi.mock("@/canvas-bridge/signed-video", () => ({ SignedVideo: ({ storageKey, ...p }: any) => <video data-key={storageKey} {...p}/> }));
vi.mock("@/canvas-bridge/signed-audio", () => ({ SignedAudio: ({ storageKey, ...p }: any) => <audio data-key={storageKey} {...p}/> }));
vi.mock("./studio-errors", () => ({ StudioErrorNotice: ({ error }: any) => <p role="alert">{String(error)}</p>, studioNodeError: () => "合成失败" }));
vi.mock("antd", () => {
  const Input = ({ children, ...p }: any) => <input {...p}/>; Input.TextArea = (p: any) => <textarea {...p}/>;
  const RadioContext = createContext<any>(undefined);
  const Radio = ({ value, children }: any) => { const group = useContext(RadioContext);
    return <label><input type="radio" checked={group?.value === value} onChange={() => group?.onChange({ target: { value } })}/>{children}</label>; };
  Radio.Group = ({ value, onChange, children }: any) => <RadioContext.Provider value={{ value, onChange }}><div role="radiogroup">{children}</div></RadioContext.Provider>;
  return { Input, Radio,
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

function Host({ nodes, connections = [], clips, works = [], draft: initial = baseDraft, spies = {}, extra = {} }:
  { nodes: CanvasNodeData[]; connections?: CanvasConnection[]; clips?: CanvasNodeData[]; works?: CanvasNodeData[]; draft?: StudioWorkDraft; extra?: Record<string, unknown>; spies?: Record<string, any> }) {
  const [draft, setDraft] = useState(initial);
  const [all, setAll] = useState(nodes);
  const list = (clips || all.filter(n => n.type === "video")).map(c => all.find(n => n.id === c.id)!);
  return <StudioWorkEditor nodes={all} connections={connections} clips={list} multiEpisode={false} draft={draft} onDraftChange={c => setDraft(d => ({ ...d, ...c }))}
    onIncludeClip={(id, includeInWork) => setAll(current => current.map(n => n.id === id ? { ...n, metadata: { ...n.metadata, studio: { ...n.metadata!.studio!, includeInWork } } } : n))}
    onMoveClip={spies.move || (() => undefined)} works={works} busy={false} locked={false}
    onAssemble={spies.assemble || (() => undefined)} onDownload={async () => undefined} onAddClips={() => undefined} onCreateVideo={() => undefined}
    onOpenStoryboard={() => undefined} onMakeVoice={spies.voice || (() => undefined)}
    onOpenAdvanced={spies.openAdvanced || (() => undefined)} onDropAdvanced={spies.dropAdvanced || (() => undefined)} advancedAvailable={spies.advancedAvailable ?? true} {...extra}/>;
}
const assembleButton = () => screen.getByRole("button", { name: "导出成片" }) as HTMLButtonElement;

// 2026-10-19 user report (爆款复刻): the uploaded original was ticked and would be stitched in front of the recreated clip.
test("the original a recreation copies starts outside the cut, says why, and can be put back", () => {
  const assemble = vi.fn();
  render(<Host nodes={[source, take("t1", "5")]} connections={[{ id: "e", fromNodeId: "src", toNodeId: "t1" }]} spies={{ assemble }}/>);
  const original = screen.getByRole("checkbox", { name: "将「原片」加入成片" }) as HTMLInputElement;
  expect(original.checked).toBe(false);
  expect(screen.getByText("其他片段据此生成，默认不加入成片。")).toBeTruthy();
  expect((screen.getByRole("checkbox", { name: "将「AI 生成的片段」加入成片" }) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByText("已选 1/2 段 · 共 5 秒")).toBeTruthy();
  fireEvent.click(original);
  expect(screen.getByText("已选 2/2 段 · 共 11 秒")).toBeTruthy();
  fireEvent.click(assembleButton()); expect(assemble).toHaveBeenCalledOnce();
});

test("a voiceover longer than the cut blocks assembly before the user waits for it; a shorter one says where it goes quiet", () => {
  render(<Host nodes={[take("t1", "5"), take("t2", "4"), voice("long", "14"), voice("short", "6")]}/>);
  fireEvent.change(screen.getByRole("combobox", { name: "人物声音" }), { target: { value: "long.m4a" } });
  expect(screen.getByText("配音 14 秒，长于成片 5 秒，无法导出。请更换较短的配音，或加入更多片段。")).toBeTruthy();
  expect(assembleButton().disabled).toBe(true);
  expect(within(document.querySelector(".studio-work-actions")!).getByText("配音长于成片，无法导出")).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "人物声音" }), { target: { value: "short.m4a" } });
  expect(screen.getByText("配音短于成片 3 秒，结尾部分将没有声音。")).toBeTruthy();
  expect(assembleButton().disabled).toBe(false);
});

test("the browser's reading of the file replaces the stored length", () => {
  render(<Host nodes={[take("t1", "8")]}/>);
  expect(screen.getByText("已选 1/1 段 · 共 8 秒")).toBeTruthy();
  const thumb = screen.getByRole("button", { name: "预览：AI 生成的片段" }).querySelector("video")!;
  Object.defineProperty(thumb, "duration", { value: 5.04 }); Object.defineProperty(thumb, "videoWidth", { value: 1280 }); Object.defineProperty(thumb, "videoHeight", { value: 720 });
  fireEvent.loadedMetadata(thumb);
  expect(screen.getByText("已选 1/1 段 · 共 5 秒")).toBeTruthy();
  // 提示的措辞在 studio-work-clips.test.ts「letterbox hints」里测；这里只钉「读到画面尺寸后提示出现」
  expect(screen.getByText(/留黑边/)).toBeTruthy();
});

test("manual captions: one row per clip with the times already filled in, and a caption past the end is caught", () => {
  render(<Host nodes={[take("t1", "5"), take("t2", "4")]} draft={{ ...baseDraft, captionMode: "manual" }}/>);
  expect(assembleButton().disabled).toBe(true);
  const value = (name: string) => (screen.getByRole("textbox", { name }) as HTMLInputElement).value;
  expect([value("第 1 条字幕开始时间（秒）"), value("第 1 条字幕结束时间（秒）"), value("第 2 条字幕开始时间（秒）"), value("第 2 条字幕结束时间（秒）")]).toEqual(["0", "5", "5", "9"]);
  // 字幕问题的判定与措辞在 studio-work-clips.test.ts「caption problems match」；这里只钉导出按钮被它拦住
  fireEvent.change(screen.getByRole("textbox", { name: "第 1 条字幕文字" }), { target: { value: "第一句" } });
  expect(assembleButton().disabled).toBe(false);
  // 没写字的那段不算字幕，行还在，可以接着填。
  expect(screen.getByRole("textbox", { name: "第 2 条字幕文字" })).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox", { name: "第 2 条字幕文字" }), { target: { value: "第二句" } });
  fireEvent.change(screen.getByRole("textbox", { name: "第 2 条字幕结束时间（秒）" }), { target: { value: "12" } });
  expect(assembleButton().disabled).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: "第 2 条字幕结束时间（秒）" }), { target: { value: "9" } });
  expect(assembleButton().disabled).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "添加一条字幕" }));
  expect(screen.getByRole("textbox", { name: "第 3 条字幕文字" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "删除第 3 条字幕" }));
  expect(screen.queryByRole("textbox", { name: "第 3 条字幕文字" })).toBeNull();
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
  expect(screen.queryByRole("combobox", { name: "人物声音" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "生成配音" }));
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
  fireEvent.click(screen.getByRole("button", { name: "从第 1 段开始预览" }));
  expect(stage().dataset.key).toBe("t1.mp4");
});

test("clicking a clip that is not in the cut shows it alone, clearly marked", () => {
  render(<Host nodes={[source, take("t1", "5")]} connections={[{ id: "e", fromNodeId: "src", toNodeId: "t1" }]}/>);
  fireEvent.click(screen.getByRole("button", { name: "预览：原片" }));
  expect((document.querySelector(".studio-work-stage video") as HTMLVideoElement).dataset.key).toBe("src.mp4");
  expect(screen.getByText("正在单独预览「原片」，此片段未加入成片。")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "返回成片预览" }));
  expect((document.querySelector(".studio-work-stage video") as HTMLVideoElement).dataset.key).toBe("t1.mp4");
});

test("finished works are listed newest first", () => {
  const work = (id: string, title: string) => video(id, { studio: { kind: "work" } }, title);
  render(<Host nodes={[take("t1", "5")]} clips={[take("t1", "5")]} works={[work("w1", "第一次合成"), work("w2", "第二次合成")]}/>);
  const titles = [...document.querySelectorAll(".studio-work-result h4")].map(h => h.textContent);
  expect(titles).toEqual(["第二次合成", "第一次合成"]);
});

// 2026-10-19：一键成片之外可以打开高级编辑（Twick）；改过之后以高级编辑为准，一键成片的按钮让位。
test("advanced editing opens from the cut page, and once used it takes over until the user drops it", () => {
  const openAdvanced = vi.fn(), dropAdvanced = vi.fn();
  const { unmount } = render(<Host nodes={[take("t1", "5")]} spies={{ openAdvanced }}/>);
  fireEvent.click(screen.getByRole("button", { name: "高级编辑" }));
  expect(openAdvanced).toHaveBeenCalledOnce();
  unmount();
  render(<Host nodes={[take("t1", "5")]} spies={{ openAdvanced, dropAdvanced }}
    draft={{ ...baseDraft, advanced: { engine: "twick", savedAt: "2026-10-19T03:04:05Z", project: { tracks: [], version: 1 } } }}/>);
  // 不用再进编辑室，直接按存档导出。
  expect((screen.getByRole("button", { name: "导出成片" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("heading", { name: "将导出的内容" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: /选择片段/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "继续高级编辑" }));
  expect(openAdvanced).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "放弃高级编辑的修改" }));
  expect(dropAdvanced).toHaveBeenCalledOnce();
});

test("on a phone the advanced editor is offered but says it needs a computer", () => {
  render(<Host nodes={[take("t1", "5")]} spies={{ advancedAvailable: false }}/>);
  const button = screen.getByRole("button", { name: "高级编辑" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(button.title).toBe("高级编辑仅支持电脑版");
  expect(screen.getByText("高级编辑仅支持电脑版")).toBeTruthy();
});

test("captions are automatic by default: nothing to fill in, and the cut can be assembled right away", () => {
  render(<Host nodes={[take("t1", "5")]}/>);
  expect((screen.getByRole("radio", { name: /自动生成/ }) as HTMLInputElement).checked).toBe(true);
  expect(screen.queryByRole("textbox", { name: "第 1 条字幕文字" })).toBeNull();
  expect(assembleButton().disabled).toBe(false);
  expect(screen.getByText(/字幕在导出时自动生成/)).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: /手动填写/ }));
  expect(screen.getByRole("textbox", { name: "第 1 条字幕文字" })).toBeTruthy();
  expect(assembleButton().disabled).toBe(true);
  expect(within(document.querySelector(".studio-work-actions")!).getByText("请填写字幕，或选择不添加")).toBeTruthy();
});

test("an audio on the canvas can be background music, but not the same one as the voiceover", () => {
  render(<Host nodes={[take("t1", "5"), voice("short", "3"), voice("song", "30")]}/>);
  fireEvent.change(screen.getByRole("combobox", { name: "背景音乐" }), { target: { value: "song.m4a" } });
  expect(screen.getByText(/人物说话时，音乐会自动压低/)).toBeTruthy();
  expect(within(screen.getByRole("combobox", { name: "人物声音" })).queryByRole("option", { name: /song/ })).toBeNull();
  // 选好后看得出是哪首，能试听，能移除；预览也会一起放。
  expect(screen.getByRole("button", { name: "移除背景音乐" })).toBeTruthy();
  expect(document.querySelectorAll(".studio-work-music audio")).toHaveLength(1);
  expect(document.querySelectorAll("audio.studio-work-voice[loop]")).toHaveLength(1);
  expect(screen.getByText(/并同步播放背景音乐/)).toBeTruthy();
});

test("uploaded music stays out of the voice list, generated speech stays out of the music list", () => {
  const song = voice("song", "30"); song.metadata = { ...song.metadata, studio: { kind: "audio" as const, audioRole: "music" as const } };
  const speech = voice("speech", "3"); speech.metadata = { ...speech.metadata, studio: { kind: "audio" as const, speechRequest: {} as never } };
  render(<Host nodes={[take("t1", "5"), song, speech]}/>);
  const voices = within(screen.getByRole("combobox", { name: "人物声音" }));
  expect(voices.queryByRole("option", { name: /song/ })).toBeNull();
  expect(voices.getByRole("option", { name: /speech/ })).toBeTruthy();
  const musics = within(screen.getByRole("combobox", { name: "背景音乐" }));
  expect(musics.getByRole("option", { name: /song/ })).toBeTruthy();
  expect(musics.queryByRole("option", { name: /speech/ })).toBeNull();
});

test("music over the size limit is refused before uploading", () => {
  const onUploadMusic = vi.fn();
  render(<Host nodes={[take("t1", "5")]} extra={{ onUploadMusic }}/>);
  const big = new File(["x"], "大文件.mp3", { type: "audio/mpeg" });
  Object.defineProperty(big, "size", { value: 26 * 1024 * 1024 });
  fireEvent.change(screen.getByLabelText("选择背景音乐文件"), { target: { files: [big] } });
  expect(onUploadMusic).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toContain("超过 25 MB");
});

test("downloading a finished cut shows it is working and says where the file went", async () => {
  let finish!: () => void;
  const onDownload = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const work = { ...take("w1", "5"), id: "w1", metadata: { ...take("w1", "5").metadata, status: "success", content: "/w.mp4", storageKey: "w.mp4", studio: { kind: "work" as const } } };
  render(<Host nodes={[take("t1", "5")]} works={[work]} extra={{ onDownload }}/>);
  fireEvent.click(screen.getByRole("button", { name: "下载成片" }));
  expect(screen.getByRole("button", { name: "正在准备下载" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "正在准备下载" }));
  expect(onDownload).toHaveBeenCalledOnce();
  finish();
  await vi.waitFor(() => expect(screen.getByText("已开始下载，可在浏览器的下载列表中查看。")).toBeTruthy());
});

test("a finished cut says what happened to its captions", () => {
  const work = { ...take("w1", "5"), id: "w1", metadata: { ...take("w1", "5").metadata, status: "success", content: "/w.mp4", storageKey: "w.mp4",
    studio: { kind: "work" as const, captions: { status: "unavailable" as const, cues: [] } } } };
  render(<Host nodes={[take("t1", "5")]} works={[work]}/>);
  expect(screen.getByText("语音识别暂不可用，这次未添加字幕。需要字幕可以手动填写，再重新导出。")).toBeTruthy();
});

test("when recognition is not available, automatic captions cannot be picked and the default is none", () => {
  render(<Host nodes={[take("t1", "5")]} extra={{ captionRecognition: false }}/>);
  const auto = screen.getByRole("radio", { name: /自动生成/ }) as HTMLInputElement;
  expect(auto.checked).toBe(false);
  expect(screen.getByText("暂不可用")).toBeTruthy();
  expect(screen.queryByText(/推荐。导出时根据说话声生成/)).toBeNull();
  expect((screen.getByRole("radio", { name: "不添加" }) as HTMLInputElement).checked).toBe(true);
  expect(assembleButton().disabled).toBe(false);
});

test("the warning about captions being burned in says how to undo it", () => {
  render(<Host nodes={[take("t1", "5")]} extra={{ captionRecognition: true }}/>);
  expect(screen.getByText(/导出后无法单独去除；如需去掉，改为「不添加」后重新导出，原片段不受影响/)).toBeTruthy();
});

test("music can be uploaded even when the canvas has no audio", async () => {
  const onUploadMusic = vi.fn().mockResolvedValue(undefined);
  render(<Host nodes={[take("t1", "5")]} extra={{ onUploadMusic }}/>);
  fireEvent.change(screen.getByLabelText("选择背景音乐文件"), { target: { files: [new File(["x"], "轻音乐.mp3", { type: "audio/mpeg" })] } });
  await vi.waitFor(() => expect(onUploadMusic).toHaveBeenCalledOnce());
});

test("once the cut lives in the advanced editor, the one-click settings step aside", () => {
  render(<Host nodes={[take("t1", "5")]} draft={{ ...baseDraft, advanced: { engine: "twick", savedAt: "2026-10-19T03:04:05Z", project: { tracks: [], version: 1 } } }}/>);
  expect(screen.queryByRole("radio", { name: /自动生成/ })).toBeNull();
  expect(screen.getByRole("button", { name: "继续高级编辑" })).toBeTruthy();
  // 片段和顺序以高级编辑为准：这里不再给能改却不生效的控件。
  expect(screen.getByText(/这是高级编辑中保存的版本/)).toBeTruthy();
  expect(screen.queryByRole("checkbox", { name: /加入成片/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /上移|下移/ })).toBeNull();
  expect(screen.queryByRole("group", { name: "成片画幅" })).toBeNull();
});

test("once the cut lives in the advanced editor it can be exported from here, also on a phone", () => {
  const onExportAdvanced = vi.fn();
  render(<Host nodes={[take("t1", "5")]} spies={{ advancedAvailable: false }} extra={{ onExportAdvanced }}
    draft={{ ...baseDraft, advanced: { engine: "twick", savedAt: "2026-10-19T03:04:05Z", project: { tracks: [], version: 1 } } }}/>);
  fireEvent.click(screen.getByRole("button", { name: "导出成片" }));
  expect(onExportAdvanced).toHaveBeenCalledOnce();
  expect((screen.getByRole("button", { name: "继续高级编辑" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/继续修改需要用电脑打开/)).toBeTruthy();
});

test("when recognition is not available the page says this cut has no captions", () => {
  render(<Host nodes={[take("t1", "5")]} extra={{ captionRecognition: false }}/>);
  expect(screen.getByText("自动字幕暂不可用，这次成片没有字幕。需要字幕请选择手动填写。")).toBeTruthy();
  expect(screen.getByText(/这次成片没有字幕$/)).toBeTruthy();
});

test("a saved advanced cut says what will be exported", () => {
  const project = { version: 1, tracks: [{ id: "t", name: "视频", type: "video", elements: [
    { id: "a", type: "video", s: 0, e: 6, props: { src: "", time: 0 }, metadata: { storageKey: "a.mp4" } },
    { id: "b", type: "video", s: 6, e: 10, props: { src: "", time: 0 }, metadata: { storageKey: "b.mp4" } }] }] };
  render(<Host nodes={[take("t1", "5"), voice("song", "30")]} extra={{ onExportAdvanced: () => undefined }}
    draft={{ ...baseDraft, musicStorageKey: "song.m4a", advanced: { engine: "twick", savedAt: "2026-10-19T03:04:05Z", project, size: { width: 720, height: 1280 }, autoCaptions: true } as never }}/>);
  expect(screen.getByText("2 段视频，共 10 秒")).toBeTruthy();
  expect(screen.getByText("背景音乐：配音 song；字幕：导出时自动生成")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "将导出的内容" })).toBeTruthy();
  expect(screen.queryByText("片段之间", { exact: false })).toBeNull();
});

test("after saving in the advanced editor, background music can still be added from this page", async () => {
  const onUploadMusic = vi.fn().mockResolvedValue(undefined);
  render(<Host nodes={[take("t1", "5")]} extra={{ onUploadMusic, onExportAdvanced: () => undefined }}
    draft={{ ...baseDraft, advanced: { engine: "twick", savedAt: "2026-10-19T03:04:05Z", project: { tracks: [], version: 1 } } }}/>);
  fireEvent.change(screen.getByLabelText("选择背景音乐文件"), { target: { files: [new File(["x"], "轻音乐.mp3", { type: "audio/mpeg" })] } });
  await vi.waitFor(() => expect(onUploadMusic).toHaveBeenCalledOnce());
});

test("a saved cut with a gap says the gap exports as black and where to fix it", () => {
  const project = { version: 1, tracks: [{ id: "t", name: "视频", type: "video", elements: [
    { id: "a", type: "video", s: 0, e: 5, props: { src: "", time: 0 }, metadata: { storageKey: "a.mp4" } },
    { id: "b", type: "video", s: 7, e: 10, props: { src: "", time: 0 }, metadata: { storageKey: "b.mp4" } }] }] };
  render(<Host nodes={[take("t1", "5")]} extra={{ onExportAdvanced: () => undefined }}
    draft={{ ...baseDraft, advanced: { engine: "twick", savedAt: "2026-10-19T03:04:05Z", project, size: { width: 720, height: 1280 }, autoCaptions: true } as never }}/>);
  expect(screen.getByText(/片段之间有 2 秒空白，导出后是黑屏/)).toBeTruthy();
});
