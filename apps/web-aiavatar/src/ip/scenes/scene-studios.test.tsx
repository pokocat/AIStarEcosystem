// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { IpProject } from "@ai-star-eco/types";
// 用服务端那份真目录（ipstudio/scenes.json），不另写样本。
const SCENES = JSON.parse(readFileSync(join(__dirname, "../../../../server/src/main/resources/ipstudio/scenes.json"), "utf8"));

const api = vi.hoisted(() => ({
  push: vi.fn(), failure: vi.fn(),
  uploadImage: vi.fn(), listProjects: vi.fn(), createProject: vi.fn(), updateProject: vi.fn(), getProject: vi.fn(), listScenes: vi.fn(), composeScene: vi.fn(),
  fetchModels: vi.fn(), readRun: vi.fn(), cancelRun: vi.fn(), capabilities: vi.fn(), submit: vi.fn(), importMedia: vi.fn(), videoModels: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push, replace: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, ...p }: any) => <a {...p}>{children}</a> }));
vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => null }));
vi.mock("@/components/hub/ui", () => ({ HubTabBar: () => null }));
vi.mock("../api", () => ({ IpStudioApi: { uploadImage: api.uploadImage, listProjects: api.listProjects, createProject: api.createProject, updateProject: api.updateProject, getProject: api.getProject,
  listScenes: api.listScenes, composeScene: api.composeScene } }));
vi.mock("@/canvas-bridge/api", () => ({ fetchModels: api.fetchModels, readRun: api.readRun, cancelRun: api.cancelRun, fetchStudioVideoModels: api.videoModels }));
vi.mock("@/canvas-bridge/studio-api", () => ({ studioCapabilities: api.capabilities, submitStudioRun: api.submit, importStudioMedia: api.importMedia }));
vi.mock("@/canvas-bridge/studio-image-file", () => ({ prepareStudioImageUpload: async (f: File) => f }));
vi.mock("../studio-errors", async importOriginal => ({ ...(await importOriginal<typeof import("../studio-errors")>()), useStudioFailure: () => api.failure, studioErrorMetadata: () => ({}) }));
vi.mock("../library-reference-picker", () => ({ LibraryReferencePicker: () => null }));
vi.mock("../studio-select", () => ({ StudioSelect: ({ label, value, onChange, options }: any) =>
  <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select> }));
import { SceneImageStudio } from "./scene-image-studio";
import { SceneVideoStudio } from "./scene-video-studio";

const doc = { nodes: [], connections: [], viewport: { x: 0, y: 0, k: 1 } };
const project = (patch: Partial<IpProject> = {}): IpProject => ({ id: "IPP-1", name: "x", status: "draft", createdAt: "", updatedAt: "", doc, runs: {}, runsById: {}, docVersion: "v1", ...patch });

beforeEach(() => {
  api.listScenes.mockResolvedValue(SCENES);
  api.listProjects.mockResolvedValue([]);
  api.createProject.mockImplementation(async ({ name, sceneId }: { name: string; sceneId?: string }) => project({ name, sceneId }));
  api.updateProject.mockImplementation(async (_id: string, { doc: next }: { doc: IpProject["doc"] }) => project({ doc: next, docVersion: "v2" }));
  api.uploadImage.mockResolvedValue({ key: "ipstudio/source/u/p.jpg", url: "blob:p", fileName: "p.jpg" });
  api.fetchModels.mockResolvedValue({ image: [{ endpointId: "ep-img", name: "图片模型", isDefault: true, creditCost: 8, billingUnit: "per_call", capability: null }], video: [] });
  api.capabilities.mockResolvedValue({ mock: false, operations: [], imageCost: 8, textCost: 1, videoCost: null });
  api.submit.mockResolvedValue({ id: "IPR-1", status: "running", output: {} });
  api.readRun.mockResolvedValue({ id: "IPR-1", status: "done", output: { candidates: [{ key: "ipstudio_gen/out.jpg", url: "https://cdn/out.jpg" }] } });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState(null, "", "/"); });

const upload = (input: HTMLInputElement, name = "p.jpg") => fireEvent.change(input, { target: { files: [new File(["x"], name, { type: "image/jpeg" })] } });

test("图片：没放必填参考图时按钮直接写缺什么；放好后先把请求写进画布再提交，描述是场景描述加补充要求，结果回到页面", async () => {
  window.history.replaceState(null, "", "/image?scene=white-background");
  await act(async () => { render(<SceneImageStudio/>); });
  const go = () => screen.getByRole("button", { name: "立即生成图片" }) as HTMLButtonElement;
  await waitFor(() => expect(go().textContent).toContain("先放商品图"));
  expect(go().disabled).toBe(true);
  // 一大段场景描述不摆出来：只有场景标签和补充要求输入框。
  expect(screen.queryByRole("textbox", { name: "完整描述" })).toBeNull();
  fireEvent.change(screen.getByRole("textbox", { name: "补充要求" }), { target: { value: "45 度角" } });
  api.composeScene.mockResolvedValue({ text: "服务端拼好的白底图描述\n补充要求：45 度角" });

  await act(async () => { upload(document.querySelector('.scene-ref-row input[type="file"]')!); });
  await waitFor(() => expect(go().textContent).toContain("预计 8 积分"));
  await act(async () => { fireEvent.click(go()); });
  // 描述由服务端按场景拼：只交场景编号、补充要求和放了图的位置。
  expect(api.composeScene).toHaveBeenCalledWith({ kind: "image", sceneId: "white-background", text: "45 度角", filled: [0] });
  expect(api.createProject).toHaveBeenCalledWith({ name: "商品白底图", sceneId: "white-background" });
  const request = api.submit.mock.calls[0][1];
  expect(request).toMatchObject({ operation: "image", aspectRatio: "1:1", count: 1, model: "ep-img", maxCost: 8,
    references: [{ storageKey: "ipstudio/source/u/p.jpg", role: "character" }] });
  expect(request.prompt).toBe("服务端拼好的白底图描述\n补充要求：45 度角");
  // 提交之前那次保存里已经有这条请求：网断了也能按原请求确认，不会换个编号重复扣费。
  const saved = api.updateProject.mock.calls[0][1].doc;
  expect(saved.nodes.find((n: any) => n.id === request.nodeId)?.metadata?.studio?.request).toEqual(request);
  expect(api.updateProject.mock.invocationCallOrder[0]).toBeLessThan(api.submit.mock.invocationCallOrder[0]);
  await waitFor(() => expect(screen.getByRole("img", { name: /商品白底图第 1 张/ })).toBeTruthy(), { timeout: 4000 });
  expect(api.submit).toHaveBeenCalledTimes(1);
});

// 照线上 H3 的形状：5–15 秒、全能参考（图 ≤9、声音 ≤3）、出片前会改写描述。
const limit = (mediaType: string, maxCount: number) => ({ mediaType, maxCount, maxBytes: 1e8, formats: [], minDurationSec: null, maxDurationSec: null });
const H3 = { endpointId: "ep-h3", name: "H3", isDefault: true, selectableById: true, supportsPromptOptimization: true, batchCounts: [1],
  contract: { minSeconds: 5, maxSeconds: 15, promptMaxChars: 7000, seedMax: 100,
    tiers: [{ tier: "768p", canvases: [{ aspectRatio: "9:16", width: 432, height: 768, outputSizeCode: null }, { aspectRatio: "16:9", width: 768, height: 432, outputSizeCode: null }] }],
    modes: [{ mode: "t2v", needsFirstFrame: false, needsLastFrame: false, frameImage: null, references: null },
      { mode: "universal_reference_video", needsFirstFrame: false, needsLastFrame: false, frameImage: null,
        references: { image: limit("image", 9), video: limit("video", 1), audio: limit("audio", 3), maxImagesWithVideo: 4, maxTotal: 12, minVisual: 1, maxAudioTotalSec: 30 } }] },
  pricing: { perSecond: { t2v: { "768p": 40 }, universal_reference_video: { "768p": 40 } }, freeRefImages: 9, extraRefImagePerSecond: 0, promptOptimizationPerCall: 0 } };

test("视频：编导看商品图写脚本（请求先存进画布、带图）；用这个脚本生成时按模型时长报价，图按顺序交给全能参考", async () => {
  window.history.replaceState(null, "", "/video?scene=ecom-talking");
  api.capabilities.mockResolvedValue({ mock: false, operations: [], imageCost: 8, textCost: 1, videoCost: null,
    textModels: [{ endpointId: "ep-qwen", name: "Qwen", isDefault: true, supportsVision: true, tokenPricing: { inputCreditsPerK: 1, outputCreditsPerK: 1, maxInputTokens: 1, maxOutputTokens: 1, maxCost: 21 } }] });
  api.videoModels.mockResolvedValue([H3]);
  api.composeScene.mockResolvedValue({ text: "服务端拼好的写脚本要求" });
  api.importMedia.mockResolvedValue({ key: "ipstudio/media/u/p.jpg", url: "blob:p", mediaType: "image", mimeType: "image/jpeg", bytes: 1, fileName: "p.jpg", width: 800, height: 800 });
  const script = "镜头1（0–3秒）：图1 的精华放在洗手台上；台词：干皮看过来";
  api.submit.mockImplementation(async (_p: string, r: any) => ({ id: r.operation === "text" ? "IPR-s" : "IPR-v", status: "running", output: {} }));
  api.readRun.mockImplementation(async (id: string) => id === "IPR-s"
    ? { id, status: "done", kind: "studio-text", inputs: api.submit.mock.calls[0][1], output: { textRevision: { summary: "先讲干皮的烦恼", content: script } } }
    : { id, status: "running", output: {} });
  await act(async () => { render(<SceneVideoStudio/>); });
  const send = () => screen.getByRole("button", { name: "让编导写脚本" }) as HTMLButtonElement;
  await waitFor(() => expect(screen.getByText("先放商品图")).toBeTruthy());
  expect(send().disabled).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: "想做的视频" }), { target: { value: "保湿精华，不黏腻" } });
  await act(async () => { upload(document.querySelector('.scene-media-row input[type="file"]')!); });
  expect(api.createProject).toHaveBeenCalledWith({ name: "口播带货 · 保湿精华", sceneId: "ecom-talking" });
  // 默认 25 秒超过模型上限：一次出片按模型最长 15 秒写，更长的交给助手分段做。
  expect(screen.getByText(/当前模型一条最长 15 秒/)).toBeTruthy();
  await waitFor(() => expect(send().disabled).toBe(false));
  await act(async () => { fireEvent.click(send()); });

  expect(api.composeScene).toHaveBeenCalledWith(expect.objectContaining({ kind: "video-script", sceneId: "ecom-talking", text: "保湿精华，不黏腻",
    imageTitles: ["商品图 1"], duration: 15, ratio: "9:16", language: "中文" }));
  const textRequest = api.submit.mock.calls[0][1];
  expect(textRequest).toMatchObject({ operation: "text", prompt: "服务端拼好的写脚本要求", textEdit: { content: "" }, readVisuals: true, model: "ep-qwen", maxCost: 21 });
  const saved = api.updateProject.mock.calls[0][1].doc;
  const image = saved.nodes.find((n: any) => n.title === "商品图 1");
  expect(textRequest.contextNodeIds).toEqual([image.id]);
  expect(saved.nodes.find((n: any) => n.id === textRequest.nodeId)?.metadata?.studio?.request).toEqual(textRequest);
  expect(api.updateProject.mock.invocationCallOrder[0]).toBeLessThan(api.submit.mock.invocationCallOrder[0]);

  const use = await screen.findByRole("button", { name: "用这个脚本生成" }, { timeout: 4000 });
  expect(screen.getByText(/干皮看过来/)).toBeTruthy();
  await act(async () => { fireEvent.click(use); });
  expect((screen.getByRole("textbox", { name: "视频脚本" }) as HTMLTextAreaElement).value).toBe(script);
  fireEvent.click(screen.getByRole("button", { name: "10 秒" }));
  const go = screen.getByRole("button", { name: "立即生成视频" }) as HTMLButtonElement;
  await waitFor(() => expect(go.textContent).toContain("预计 400 积分"));
  await act(async () => { fireEvent.click(go); });
  const videoRequest = api.submit.mock.calls[1][1];
  expect(videoRequest).toMatchObject({ operation: "video", prompt: script, durationSec: 10, aspectRatio: "9:16", count: 1, model: "ep-h3", maxCost: 400,
    video: { mode: "universal_reference_video", resolutionTier: "768p", rewrite: "auto", references: [{ mediaType: "image", key: "ipstudio/media/u/p.jpg" }] } });
  expect(await screen.findByText(/正在生成，一般要几分钟/)).toBeTruthy();
});

test("视频：爆款复刻要先拉片，仍交给画布里的创作助手（带场景的方法、自动发出）", async () => {
  window.history.replaceState(null, "", "/video?scene=recreation");
  api.videoModels.mockResolvedValue([H3]);
  api.composeScene.mockResolvedValue({ text: "服务端拼好的话", skillKey: "reference-video-recreation" });
  api.importMedia.mockResolvedValue({ key: "ipstudio/media/u/v.mp4", url: "blob:v", mediaType: "video", mimeType: "video/mp4", bytes: 1, fileName: "v.mp4" });
  await act(async () => { render(<SceneVideoStudio/>); });
  const send = () => screen.getByRole("button", { name: "交给创作助手" }) as HTMLButtonElement;
  await waitFor(() => expect(screen.getByText("先放参考视频")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "添加参考视频" }));
  await act(async () => { fireEvent.change(document.querySelector('.scene-media-row input[type="file"]')!, { target: { files: [new File(["x"], "v.mp4", { type: "video/mp4" })] } }); });
  fireEvent.change(screen.getByRole("textbox", { name: "想做的视频" }), { target: { value: "换成我的面霜" } });
  await waitFor(() => expect(send().disabled).toBe(false));
  await act(async () => { fireEvent.click(send()); });
  expect(api.composeScene).toHaveBeenCalledWith(expect.objectContaining({ kind: "video", sceneId: "recreation", text: "换成我的面霜", videoTitle: "参考视频" }));
  const saved = api.updateProject.mock.calls.at(-1)![1].doc;
  expect(saved.assistantConversations[0].metadata).toMatchObject({ studioStart: "assistant", studioSkill: "reference-video-recreation", prompt: "服务端拼好的话" });
  expect(api.push).toHaveBeenCalledWith("/projects/IPP-1?start=assistant&send=1");
  expect(api.submit).not.toHaveBeenCalled();
});

test("图片：从「最近」或地址栏带草稿号进来，打开那张草稿并接着看它的结果", async () => {
  window.history.replaceState(null, "", "/image?scene=face-turnaround&draft=IPP-9");
  const row = { id: "n1", type: "image", title: "脸部三视图", position: { x: 0, y: 0 }, width: 10, height: 10,
    metadata: { status: "success", images: [{ id: "IPR-9", status: "success", storageKey: "k", content: "https://cdn/r.jpg" }],
      studio: { kind: "shot", request: { clientRequestId: "c", nodeId: "n1", operation: "image", prompt: "以图1为准", aspectRatio: "16:9", count: 1 } } } };
  api.getProject.mockResolvedValue(project({ id: "IPP-9", name: "随便改的名字", sceneId: "face-turnaround", doc: { ...doc, nodes: [row] } as IpProject["doc"] }));
  await act(async () => { render(<SceneImageStudio/>); });
  await waitFor(() => expect(api.getProject).toHaveBeenCalledWith("IPP-9"));
  expect(await screen.findByRole("img", { name: /脸部三视图第 1 张/ })).toBeTruthy();
  expect(window.location.search).toContain("draft=IPP-9");
});
