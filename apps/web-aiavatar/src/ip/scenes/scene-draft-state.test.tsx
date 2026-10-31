// @vitest-environment jsdom
// 场景页的创作条件存进草稿（2026-10-30 审查 G01–G04、N01–N03 的回归）：
//   打开草稿只放回了参考图和比例，补充要求、选项、模型、张数、台词语言、改了一半的脚本都丢了；
//   「用这段描述再做」把拼好的整段话当描述，再生成时选项又拼一遍；换场景按位置带参考图，新面孔进了服装图；
//   改稿时选项悄悄回到默认值；比例、时长换成模型支持的值也不说一声；成功的视频只能下载。
// 服务端用一份内存草稿库：保存了什么，重新打开读到的就是什么。
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { IpProject, IpProjectDoc } from "@ai-star-eco/types";

const SCENES = JSON.parse(readFileSync(join(__dirname, "../../../../server/src/main/resources/ipstudio/scenes.json"), "utf8"));

const api = vi.hoisted(() => ({
  push: vi.fn(), failure: vi.fn(),
  uploadImage: vi.fn(), listProjects: vi.fn(), createProject: vi.fn(), updateProject: vi.fn(), getProject: vi.fn(), listScenes: vi.fn(), composeScene: vi.fn(),
  fetchModels: vi.fn(), readRun: vi.fn(), cancelRun: vi.fn(), capabilities: vi.fn(), submit: vi.fn(), importMedia: vi.fn(), videoModels: vi.fn(), signKeys: vi.fn(),
}));
// 和 Next 一样：地址参数从 useSearchParams 读（页面改地址用 history.replaceState，下次渲染读到新的）。
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push, replace: vi.fn() }), useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock("next/link", () => ({ default: ({ children, ...p }: any) => <a {...p}>{children}</a> }));
vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => null }));
vi.mock("@/components/hub/ui", () => ({ HubTabBar: () => null }));
vi.mock("../api", () => ({ IpStudioApi: { uploadImage: api.uploadImage, listProjects: api.listProjects, createProject: api.createProject, updateProject: api.updateProject, getProject: api.getProject,
  listScenes: api.listScenes, composeScene: api.composeScene } }));
vi.mock("@/canvas-bridge/api", () => ({ fetchModels: api.fetchModels, readRun: api.readRun, cancelRun: api.cancelRun, fetchStudioVideoModels: api.videoModels, signKeys: api.signKeys }));
vi.mock("@/canvas-bridge/studio-api", () => ({ studioCapabilities: api.capabilities, submitStudioRun: api.submit, importStudioMedia: api.importMedia }));
vi.mock("@/canvas-bridge/studio-image-file", () => ({ prepareStudioImageUpload: async (f: File) => f }));
vi.mock("../studio-errors", async importOriginal => ({ ...(await importOriginal<typeof import("../studio-errors")>()), useStudioFailure: () => api.failure, studioErrorMetadata: () => ({}) }));
vi.mock("../library-reference-picker", () => ({ LibraryReferencePicker: () => null }));
vi.mock("../studio-select", () => ({ StudioSelect: ({ label, value, onChange, options }: any) =>
  <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select> }));
import { SceneImageStudio } from "./scene-image-studio";
import { SceneVideoStudio } from "./scene-video-studio";
import { addScriptNode, addVideoRow, patchNode } from "./scene-drafts";
import { chooseUpload, openRecent, openSpec, optionGroup, pickScene, setDuration } from "./scene-test-helpers";

const EMPTY: IpProjectDoc = { nodes: [], connections: [], viewport: { x: 0, y: 0, k: 1 } };
/** 内存里的草稿库：版本号每存一次加一，读到的就是最后存的。 */
const store = new Map<string, IpProject>();
const put = (p: Partial<IpProject> & { id: string }) => {
  const row: IpProject = { name: p.id, status: "draft", createdAt: "", updatedAt: "2026-10-30", doc: EMPTY, runs: {}, runsById: {}, docVersion: "v1", ...p } as IpProject;
  store.set(row.id, row); return row;
};
const saves = (id: string) => api.updateProject.mock.calls.filter(c => c[0] === id).length;

beforeEach(() => {
  store.clear();
  api.listScenes.mockResolvedValue(SCENES);
  api.listProjects.mockImplementation(async () => [...store.values()].map(p => ({ id: p.id, name: p.name, sceneId: p.sceneId, updatedAt: p.updatedAt, createdAt: p.createdAt })));
  api.getProject.mockImplementation(async (id: string) => structuredClone(store.get(id)));
  api.createProject.mockImplementation(async ({ name, sceneId }: { name: string; sceneId?: string }) => put({ id: "IPP-A", name, sceneId }));
  api.updateProject.mockImplementation(async (id: string, { doc }: { doc: IpProjectDoc }) => {
    const old = store.get(id)!;
    return put({ ...old, doc: structuredClone(doc), docVersion: `v${Number(old.docVersion.slice(1)) + 1}` });
  });
  api.uploadImage.mockResolvedValue({ key: "ipstudio/source/u/p.jpg", url: "blob:p", fileName: "p.jpg" });
  api.fetchModels.mockResolvedValue({ image: [{ endpointId: "ep-img", name: "图片模型", isDefault: true, creditCost: 8, billingUnit: "per_call", capability: null }], video: [] });
  api.capabilities.mockResolvedValue({ mock: false, operations: [], imageCost: 8, textCost: 1, videoCost: null,
    textModels: [{ endpointId: "text", name: "Text", isDefault: true, supportsVision: true, tokenPricing: { maxCost: 21 } }] });
  api.videoModels.mockResolvedValue([]);
  api.composeScene.mockResolvedValue({ text: "test image" });
  api.submit.mockResolvedValue({ id: "run-A", status: "running", output: {} });
  api.readRun.mockResolvedValue({ id: "run-A", status: "running", output: {} });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState(null, "", "/"); });

const upload = (input: Element, name = "p.jpg") => fireEvent.change(input, { target: { files: [new File(["x"], name, { type: "image/jpeg" })] } });
const refInput = () => document.querySelector('.scene-media-row input[type="file"]')!;
const continueLink = () => screen.queryByRole("link", { name: "在画布中继续" })?.getAttribute("href");
const heading = () => document.querySelector(".scene-composer-head strong")?.textContent;
const pressed = (group: string, name: string) => within(optionGroup(group)).getByRole("button", { name }).getAttribute("aria-pressed");
const videoSpec = () => screen.getByRole("button", { name: /^视频规格：/ }).textContent;
const text = (name: string) => (screen.getByRole("textbox", { name }) as HTMLTextAreaElement).value;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
async function open(Page: typeof SceneImageStudio, url: string) {
  window.history.replaceState(null, "", url);
  await act(async () => { render(<Page/>); });
}

// ── AI 图片 ───────────────────────────────────────────────────────────────
async function generateWhiteBackground() {
  await open(SceneImageStudio, "/image?scene=white-background");
  await act(async () => { upload(refInput()); });
  fireEvent.click(within(optionGroup("拍摄角度")).getByRole("button", { name: "俯拍" }));
  fireEvent.change(screen.getByRole("textbox", { name: "补充要求" }), { target: { value: "平放" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "生成图片" })); });
  await waitFor(() => expect(api.submit).toHaveBeenCalled());
}

test("image: what is on the page is kept in the draft; reopening it brings back the supplement, the option, the count and the photo", async () => {
  await generateWhiteBackground();
  // 生成之后接着改、还没再生成的，也记进草稿。
  fireEvent.change(screen.getByRole("textbox", { name: "补充要求" }), { target: { value: "平放，阴影淡一点" } });
  openSpec();
  fireEvent.click(within(screen.getByRole("group", { name: "图片设置" })).getByRole("button", { name: "2 张" }));
  await waitFor(() => expect(store.get("IPP-A")!.doc.sceneImageState?.supplement).toBe("平放，阴影淡一点"), { timeout: 3000 });
  expect(store.get("IPP-A")!.doc.sceneImageState).toMatchObject({ sceneId: "white-background", options: { angle: "top" }, count: 2,
    slots: [{ key: "ipstudio/source/u/p.jpg" }] });

  cleanup();
  await open(SceneImageStudio, "/image?scene=white-background&draft=IPP-A");
  await waitFor(() => expect(text("补充要求")).toBe("平放，阴影淡一点"));
  expect(pressed("拍摄角度", "俯拍")).toBe("true");
  expect(screen.getByRole("button", { name: /图片设置/ }).textContent).toContain("2 张");
  expect(screen.getByRole("img", { name: "商品图" })).toBeTruthy();
});

test("image: 「重新编辑」 puts back that time's conditions, and the description is assembled once, not with the options twice", async () => {
  await generateWhiteBackground();
  fireEvent.click(within(optionGroup("拍摄角度")).getByRole("button", { name: "正面" }));
  fireEvent.change(screen.getByRole("textbox", { name: "补充要求" }), { target: { value: "换个说法" } });
  fireEvent.click(await screen.findByRole("button", { name: "重新编辑" }));
  expect(text("补充要求")).toBe("平放");
  expect(pressed("拍摄角度", "俯拍")).toBe("true");
  // 以前把拼好的整段话塞进「完整描述」，再生成时选项和补充要求又拼一遍。
  expect(screen.queryByRole("textbox", { name: "完整描述" })).toBeNull();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "生成图片" })); });
  expect(api.composeScene).toHaveBeenLastCalledWith({ kind: "image", sceneId: "white-background", text: "平放", filled: [0], options: { angle: "top" } });
});

test("image: 「重新编辑」 says what it put back, moves the cursor to the input, and 撤销 brings back what was being edited", async () => {
  await generateWhiteBackground();
  fireEvent.click(within(optionGroup("拍摄角度")).getByRole("button", { name: "正面" }));
  fireEvent.change(screen.getByRole("textbox", { name: "补充要求" }), { target: { value: "换个说法" } });
  fireEvent.click(await screen.findByRole("button", { name: "重新编辑" }));
  expect(screen.getByText(/这次的设置放回来了，改好再生成/)).toBeTruthy();
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "补充要求" })));
  fireEvent.click(screen.getByRole("button", { name: "撤销" }));
  expect(text("补充要求")).toBe("换个说法");
  expect(pressed("拍摄角度", "正面")).toBe("true");
  expect(screen.queryByText(/放回来了/)).toBeNull();
});

test("image: switching scenes from the list leaves the open draft, and coming back reopens it", async () => {
  await generateWhiteBackground();
  await waitFor(() => expect(continueLink()).toBe("/projects/IPP-A"));
  pickScene("商品使用");
  await waitFor(() => expect(heading()).toBe("商品使用"));
  // 草稿属于白底图：离开它，新场景的条件不会写进它。商品图同名，跟着走。
  expect(continueLink()).toBeUndefined();
  expect(screen.getByRole("img", { name: "商品图" })).toBeTruthy();
  pickScene("商品白底图");
  await waitFor(() => expect(continueLink()).toBe("/projects/IPP-A"));
  expect(store.get("IPP-A")!.doc.sceneImageState?.sceneId).toBe("white-background");
});

test("image: switching scenes carries a photo only into a slot with the same name, never into a slot for something else", async () => {
  api.uploadImage.mockResolvedValueOnce({ key: "model.jpg", url: "blob:model", fileName: "model.jpg" })
    .mockResolvedValueOnce({ key: "face.jpg", url: "blob:face", fileName: "face.jpg" });
  await open(SceneImageStudio, "/image?scene=face-swap");
  await chooseUpload("模特图");
  await act(async () => { upload(refInput()); });
  await chooseUpload("新面孔");
  await act(async () => { upload(refInput()); });
  expect(screen.getByRole("img", { name: "新面孔" })).toBeTruthy();
  pickScene("服装上身");
  await waitFor(() => expect(heading()).toBe("服装上身"));
  // 模特图还是模特图；新面孔不会被当成服装图（以前按位置带）。
  expect((screen.getByRole("img", { name: "模特图" }) as HTMLImageElement).src).toContain("blob:model");
  expect(screen.getByRole("button", { name: "添加服装图" })).toBeTruthy();
});

test("image: just opening an old draft saves nothing, so it does not jump to the top of 最近", async () => {
  const ref = { id: "ref", type: "image", title: "人物照片", position: { x: 0, y: 0 }, width: 10, height: 10,
    metadata: { storageKey: "ref.jpg", content: "https://cdn/ref.jpg", origin: "upload", status: "success" } };
  const row = { id: "n1", type: "image", title: "脸部三视图", position: { x: 0, y: 400 }, width: 10, height: 10,
    metadata: { status: "success", images: [{ id: "r", status: "success", storageKey: "k", content: "https://cdn/r.jpg" }],
      studio: { kind: "shot", request: { clientRequestId: "c", nodeId: "n1", operation: "image", prompt: "以图1为准", aspectRatio: "16:9", count: 1,
        references: [{ storageKey: "ref.jpg", role: "character" }] } } } };
  put({ id: "IPP-L", name: "old", sceneId: "face-turnaround", doc: { ...EMPTY, nodes: [row, ref] as never } });
  await open(SceneImageStudio, "/image?scene=face-turnaround&draft=IPP-L");
  expect(await screen.findByRole("img", { name: "人物照片" })).toBeTruthy();
  await act(async () => { await wait(900); });
  expect(saves("IPP-L")).toBe(0);
  expect(api.signKeys).not.toHaveBeenCalled();
});

test("image: a photo kept in the draft but not on the canvas gets a fresh address when the draft is opened", async () => {
  api.signKeys.mockResolvedValue({ "lib.jpg": "https://cdn/lib-fresh.jpg" });
  put({ id: "IPP-S", name: "s", sceneId: "white-background", doc: { ...EMPTY,
    sceneImageState: { sceneId: "white-background", supplement: "", options: {}, slots: [{ key: "lib.jpg", name: "资产库的图" }], count: 1 } } });
  await open(SceneImageStudio, "/image?scene=white-background&draft=IPP-S");
  expect(((await screen.findByRole("img", { name: "商品图" })) as HTMLImageElement).src).toBe("https://cdn/lib-fresh.jpg");
  expect(api.signKeys).toHaveBeenCalledWith(["lib.jpg"]);
});

test("image: when the model cannot make the scene's ratio the page says what it will make instead", async () => {
  api.fetchModels.mockResolvedValue({ image: [{ endpointId: "ep-img", name: "图片模型", isDefault: true, creditCost: 8, billingUnit: "per_call",
    capability: { imageRatios: ["1:1"], imageSizes: [], imageBatchCounts: [1] } }], video: [] });
  await open(SceneImageStudio, "/image?scene=face-turnaround");
  expect(await screen.findByText("这个模型出不了 16:9，会按 1:1 出")).toBeTruthy();
});

// ── AI 视频 ───────────────────────────────────────────────────────────────
const limit = (mediaType: string, maxCount: number) => ({ mediaType, maxCount, maxBytes: 1e8, formats: [], minDurationSec: null, maxDurationSec: null });
const H3 = { endpointId: "ep-h3", name: "H3", isDefault: true, selectableById: true, supportsPromptOptimization: false, batchCounts: [1],
  contract: { minSeconds: 5, maxSeconds: 15, promptMaxChars: 7000, seedMax: 100,
    tiers: [{ tier: "768p", canvases: [{ aspectRatio: "9:16", width: 432, height: 768, outputSizeCode: null }, { aspectRatio: "16:9", width: 768, height: 432, outputSizeCode: null }] }],
    modes: [{ mode: "t2v", needsFirstFrame: false, needsLastFrame: false, frameImage: null, references: null },
      { mode: "universal_reference_video", needsFirstFrame: false, needsLastFrame: false, frameImage: null,
        references: { image: limit("image", 9), video: limit("video", 1), audio: limit("audio", 3), maxImagesWithVideo: 4, maxTotal: 12, minVisual: 1, maxAudioTotalSec: 30 } }] },
  pricing: { perSecond: { t2v: { "768p": 40 }, universal_reference_video: { "768p": 40 } }, freeRefImages: 9, extraRefImagePerSecond: 0, promptOptimizationPerCall: 0 } };
const productNode = { id: "product", type: "image", title: "商品图 1", position: { x: 100, y: 400 }, width: 100, height: 100,
  metadata: { storageKey: "product.jpg", content: "https://cdn/product.jpg", origin: "upload", mimeType: "image/jpeg", status: "success" } };
/** 编导写好的一版脚本（照 addScriptNode 的形状），写的时候选了「只拍商品、专业讲解」。 */
function withScript(doc: IpProjectDoc) {
  const made = addScriptNode(doc, { ask: "保湿精华", revision: false, prompt: "写脚本", materialIds: ["product"], imageIds: ["product"],
    duration: 15, ratio: "9:16", language: "英文", options: { presenter: "product", tone: "expert" } });
  return { id: made.nodeId, doc: patchNode(made.doc, made.nodeId, n => ({ ...n, metadata: { ...n.metadata, status: "success", content: "第1镜（0–5 秒）：精华放在洗手台上" } })) };
}
beforeEach(() => { api.videoModels.mockResolvedValue([H3]); });

test("video: the unsent line and the options are kept in the draft and come back when it is opened again", async () => {
  put({ id: "IPP-V", name: "v", sceneId: "ecom-talking", doc: { ...EMPTY, nodes: [productNode] as never } });
  await open(SceneVideoStudio, "/video?scene=ecom-talking&draft=IPP-V");
  fireEvent.click(within(optionGroup("出镜方式")).getByRole("button", { name: "只拍商品" }));
  fireEvent.change(screen.getByRole("textbox", { name: "想做的视频" }), { target: { value: "保湿精华，不黏腻" } });
  await waitFor(() => expect(store.get("IPP-V")!.doc.sceneVideoState).toMatchObject({ text: "保湿精华，不黏腻", options: { presenter: "product" } }), { timeout: 3000 });

  cleanup();
  await open(SceneVideoStudio, "/video?scene=ecom-talking&draft=IPP-V");
  await waitFor(() => expect(text("想做的视频")).toBe("保湿精华，不黏腻"));
  expect(pressed("出镜方式", "只拍商品")).toBe("true");
});

test("video: revising a script after reopening the draft keeps the options and the language that version was written with", async () => {
  const { doc } = withScript({ ...EMPTY, nodes: [productNode] as never });
  put({ id: "IPP-V", name: "v", sceneId: "ecom-talking", doc });
  api.composeScene.mockResolvedValue({ text: "改脚本" });
  await open(SceneVideoStudio, "/video?scene=ecom-talking&draft=IPP-V");
  // 打开写过脚本的草稿先看到编导那一页；选项在编辑框那一页的规格里。
  fireEvent.click((await screen.findAllByRole("button", { name: "回到编辑" }))[0]);
  await waitFor(() => expect(pressed("出镜方式", "只拍商品")).toBe("true"));
  expect(pressed("语气", "专业讲解")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "AI 编导" }));
  fireEvent.change(screen.getByRole("textbox", { name: "想改哪里" }), { target: { value: "口语一点" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "让编导改" })); });
  // 以前重开草稿后选项回到默认值（真人讲解、像朋友推荐），改出来的那版拍法就变了。
  expect(api.composeScene).toHaveBeenCalledWith(expect.objectContaining({ kind: "video-script", revision: "口语一点", language: "英文",
    options: { presenter: "product", tone: "expert" } }));
});

test("video: leaving a draft for another scene and coming back reopens that draft; matching photos go along, others are left out with a note", async () => {
  put({ id: "IPP-V", name: "v", sceneId: "ecom-talking", doc: { ...EMPTY, nodes: [productNode] as never } });
  await open(SceneVideoStudio, "/video?scene=ecom-talking&draft=IPP-V");
  await waitFor(() => expect(continueLink()).toBe("/projects/IPP-V"));
  // 促销转化也是商品图：带过去。
  pickScene("促销转化");
  await waitFor(() => expect(heading()).toBe("促销转化"));
  expect(continueLink()).toBeUndefined();
  expect(screen.getByRole("button", { name: "移除商品图 1" })).toBeTruthy();
  // 门店发现要的是门店照片：商品图不带过去，并且说一声。
  pickScene("门店发现");
  await waitFor(() => expect(heading()).toBe("门店发现"));
  expect(screen.queryByRole("button", { name: "移除商品图 1" })).toBeNull();
  expect(screen.getByText("商品图在「门店发现」用不上，先收起来了，回「促销转化」还在")).toBeTruthy();
  // 说明是灰字单独一行，不占卡点那行：卡点照样说缺什么。
  expect([...document.querySelectorAll(".scene-hint")].map(p => p.textContent)).toEqual(expect.arrayContaining(["先放门店照片", expect.stringContaining("先收起来了")]));
  // 回到促销转化：刚才没发的素材还在。
  pickScene("促销转化");
  await waitFor(() => expect(heading()).toBe("促销转化"));
  expect(screen.getByRole("button", { name: "移除商品图 1" })).toBeTruthy();
  // 回到口播带货：重新打开离开时的那份草稿。
  pickScene("口播带货");
  await waitFor(() => expect(continueLink()).toBe("/projects/IPP-V"));
  expect(heading()).toBe("口播带货");
});

test("video: a finished video can be made again from its own script and settings; an edit left in 「生成视频」 comes back after reopening", async () => {
  const script = withScript({ ...EMPTY, nodes: [productNode] as never });
  const made = addVideoRow(script.doc, { title: "口播带货 · 10 秒", prompt: "出片前改过的脚本", scriptId: script.id, refIds: ["product"],
    video: { mode: "universal_reference_video", resolutionTier: "768p", references: [{ mediaType: "image", key: "product.jpg" }] } as never,
    durationSec: 10, aspectRatio: "9:16", model: "ep-h3", maxCost: 400 });
  const doc = patchNode(made.doc, made.nodeId, n => ({ ...n, metadata: { ...n.metadata, status: "success", content: "https://cdn/v.mp4" } }));
  put({ id: "IPP-V", name: "v", sceneId: "ecom-talking", doc });
  await open(SceneVideoStudio, "/video?scene=ecom-talking&draft=IPP-V");
  fireEvent.click(await screen.findByRole("button", { name: "重新编辑" }));
  expect(text("视频脚本")).toBe("出片前改过的脚本");
  expect(videoSpec()).toContain("10 秒");

  fireEvent.change(screen.getByRole("textbox", { name: "视频脚本" }), { target: { value: "再改一处" } });
  await waitFor(() => expect(store.get("IPP-V")!.doc.sceneVideoState?.edit).toEqual({ scriptId: script.id, prompt: "再改一处" }), { timeout: 3000 });
  cleanup();
  await open(SceneVideoStudio, "/video?scene=ecom-talking&draft=IPP-V");
  await waitFor(() => expect(text("视频脚本")).toBe("再改一处"));
  expect(videoSpec()).toContain("10 秒");
});

test("video: a duration this model cannot make is named, not quietly changed", async () => {
  const SHORT = { ...H3, endpointId: "ep-short", name: "短片模型", isDefault: false, contract: { ...H3.contract, maxSeconds: 10 } };
  api.videoModels.mockResolvedValue([H3, SHORT]);
  put({ id: "IPP-V", name: "v", sceneId: "ecom-talking", doc: { ...EMPTY, nodes: [productNode] as never,
    sceneVideoState: { text: "", options: {}, duration: 15, ratio: "9:16" } } });
  await open(SceneVideoStudio, "/video?scene=ecom-talking&draft=IPP-V");
  fireEvent.change(await screen.findByRole("combobox", { name: "视频模型" }), { target: { value: "ep-short" } });
  expect(await screen.findByText("这个模型单段最长 10 秒，15 秒会分 2 段，交给创作助手做")).toBeTruthy();
});
