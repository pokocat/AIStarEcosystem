// @vitest-environment jsdom
// 场景页换草稿时的异步回包（2026-10-30 代码复核，Codex 隔离复现）：
//   A 的保存还没回来就从「最近」打开 B，A 的回包把页面换回了 A；排着队的 A 的修改会套到 B 上。
//   视频页移除 / 更换素材只改了页面，重新打开草稿又是旧素材。
// 服务端用一份内存草稿库：保存了什么，重新打开读到的就是什么。
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { IpProject, IpProjectDoc } from "@ai-star-eco/types";

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
import { addScriptNode } from "./scene-drafts";

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

/** 一个之后再放行的回包。 */
function later<T>() { let release!: (v: T) => void; const promise = new Promise<T>(r => { release = r; }); return { promise, release }; }

async function startImageInA() {
  put({ id: "IPP-B", name: "draft B", sceneId: "free" });
  window.history.replaceState(null, "", "/image?scene=free");
  await act(async () => { render(<SceneImageStudio/>); });
  fireEvent.change(screen.getByRole("textbox", { name: "想要的画面" }), { target: { value: "test image" } });
}
const openB = async () => { await act(async () => { fireEvent.click(await screen.findByRole("button", { name: /draft B/ })); }); };
const continueLink = () => screen.getByRole("link", { name: "在画布中继续" }).getAttribute("href");

test("image: A's save coming back after B was opened finishes A's work and leaves the page on B", async () => {
  const first = later<IpProject>();
  api.updateProject.mockImplementationOnce(async (id: string, { doc }: { doc: IpProjectDoc }) => { await first.promise; return put({ ...store.get(id)!, doc, docVersion: "v2" }); });
  await startImageInA();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "立即生成图片" })); });
  await waitFor(() => expect(api.updateProject).toHaveBeenCalledTimes(1));
  await openB();
  expect(window.location.search).toContain("IPP-B");
  await act(async () => { first.release(store.get("IPP-A")!); });

  // A 的提交照样做完：任务交给 A，结果也写回 A。
  await waitFor(() => expect(api.submit).toHaveBeenCalledWith("IPP-A", expect.anything()));
  await waitFor(() => expect(saves("IPP-A")).toBe(2));
  expect(store.get("IPP-A")!.doc.nodes.some(n => n.metadata?.studio?.runId === "run-A")).toBe(true);
  // 页面和 B 都没被动过。
  expect(continueLink()).toBe("/projects/IPP-B");
  expect(window.location.search).toContain("IPP-B");
  expect(saves("IPP-B")).toBe(0);
});

test("image: a draft created after the page moved on is kept for its own work, not shown", async () => {
  const created = later<IpProject>();
  api.createProject.mockImplementationOnce(async ({ name, sceneId }: { name: string; sceneId?: string }) => { await created.promise; return put({ id: "IPP-A", name, sceneId }); });
  await startImageInA();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "立即生成图片" })); });
  await openB();
  await act(async () => { created.release(undefined as never); });
  await waitFor(() => expect(api.submit).toHaveBeenCalledWith("IPP-A", expect.anything()));
  expect(continueLink()).toBe("/projects/IPP-B");
  expect(window.location.search).toContain("IPP-B");
  expect(saves("IPP-B")).toBe(0);
});

test("image: a reference picture that finishes uploading after switching drafts does not land in the new one", async () => {
  const uploaded = later<{ key: string; url: string; fileName: string }>();
  api.uploadImage.mockImplementationOnce(() => uploaded.promise);
  await startImageInA();
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["x"], "p.jpg", { type: "image/jpeg" })] } });
  await openB();
  await act(async () => { uploaded.release({ key: "ipstudio/source/u/late.jpg", url: "blob:late", fileName: "late.jpg" }); });
  expect(document.querySelector('img[src="blob:late"]')).toBeNull();
});

test("image: a finished task read after switching drafts is not written into the new draft", async () => {
  const row = { id: "row-A", type: "image", title: "出图", position: { x: 400, y: 120 }, width: 300, height: 300,
    metadata: { status: "loading", studio: { kind: "image", runId: "run-A", request: { clientRequestId: "c1", operation: "image", prompt: "p" } } } };
  put({ id: "IPP-A", name: "draft A", sceneId: "free", doc: { ...EMPTY, nodes: [row] as never } });
  put({ id: "IPP-B", name: "draft B", sceneId: "free" });
  const read = later<unknown>();
  api.readRun.mockImplementationOnce(() => read.promise);
  window.history.replaceState(null, "", "/image?scene=free&draft=IPP-A");
  await act(async () => { render(<SceneImageStudio/>); });
  await waitFor(() => expect(api.readRun).toHaveBeenCalled());
  await openB();
  await act(async () => { read.release({ id: "run-A", status: "done", output: { candidates: [{ key: "ipstudio_gen/out.jpg", url: "https://cdn/out.jpg" }] } }); });
  expect(saves("IPP-B")).toBe(0);
  expect(continueLink()).toBe("/projects/IPP-B");
});

// ── 视频页素材 ──────────────────────────────────────────────────────────
const voiceNode = (id: string, key: string) => ({ id, type: "audio", title: "声音样本", position: { x: 100, y: 100 }, width: 100, height: 100,
  metadata: { storageKey: key, content: `https://cdn/${key}`, origin: "upload", mimeType: "audio/mpeg", status: "success" } });
async function openVideoDraft() {
  window.history.replaceState(null, "", "/video?scene=ecom-talking&draft=IPP-V");
  await act(async () => { render(<SceneVideoStudio/>); });
  await waitFor(() => expect(api.getProject).toHaveBeenCalled());
}

test("video: a removed voice stays removed when the draft is opened again; the old voice node is kept", async () => {
  put({ id: "IPP-V", name: "draft V", sceneId: "ecom-talking", doc: { ...EMPTY, nodes: [voiceNode("old", "old.mp3")] as never } });
  await openVideoDraft();
  fireEvent.click(await screen.findByRole("button", { name: "移除声音" }));
  await waitFor(() => expect(store.get("IPP-V")!.doc.sceneInputs?.voice).toBeNull());
  expect(store.get("IPP-V")!.doc.nodes.map(n => n.id)).toContain("old");

  cleanup(); api.getProject.mockClear();
  await openVideoDraft();
  expect(screen.queryByRole("button", { name: "移除声音" })).toBeNull();
  expect(screen.getByRole("button", { name: "添加声音" })).toBeTruthy();
});

const productNode = { id: "product", type: "image", title: "商品图 1", position: { x: 100, y: 400 }, width: 100, height: 100,
  metadata: { storageKey: "product.jpg", content: "https://cdn/product.jpg", origin: "upload", mimeType: "image/jpeg", status: "success" } };

test("video: after replacing the voice, opening the draft again picks the replacement", async () => {
  put({ id: "IPP-V", name: "draft V", sceneId: "ecom-talking", doc: { ...EMPTY, nodes: [voiceNode("old", "old.mp3"), productNode] as never } });
  api.importMedia.mockResolvedValue({ key: "new.mp3", url: "https://cdn/new.mp3", fileName: "new.mp3", bytes: 3, mimeType: "audio/mpeg", mediaType: "audio" });
  await openVideoDraft();
  fireEvent.click(await screen.findByRole("button", { name: "更换声音" }));
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["x"], "new.mp3", { type: "audio/mpeg" })] } });
  await waitFor(() => expect(store.get("IPP-V")!.doc.sceneInputs?.voice).toBe("new.mp3"));
  expect(store.get("IPP-V")!.doc.nodes.filter(n => n.type === "audio")).toHaveLength(2);

  cleanup();
  await openVideoDraft();
  expect(screen.getByRole("button", { name: "更换声音" }).getAttribute("title")).toBeTruthy();
  // 再写一版脚本时交出去的声音就是换后的那份。
  api.composeScene.mockResolvedValue({ text: "write script" });
  fireEvent.change(screen.getByRole("textbox", { name: "想做的视频" }), { target: { value: "保湿精华" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "让编导写脚本" })); });
  await waitFor(() => expect(api.submit).toHaveBeenCalled());
  const saved = store.get("IPP-V")!.doc;
  const script = saved.nodes.find(n => n.metadata?.studio?.sceneDirector)!;
  // 素材连到脚本节点上（声音不在读图列表里，看连线）。
  const used = saved.connections.filter(c => c.toNodeId === script.id).map(c => saved.nodes.find(n => n.id === c.fromNodeId)?.metadata?.storageKey);
  expect(used).toContain("new.mp3");
  expect(used).not.toContain("old.mp3");
});

// ── 编导写脚本的模型（2026-10-30 用户第七项：对话框里不能换模型）─────────────────────
const TEXT_MODELS = [
  { endpointId: "text-a", name: "看图模型", isDefault: true, supportsVision: true, tokenPricing: { maxCost: 21 } },
  { endpointId: "text-b", name: "便宜模型", isDefault: false, supportsVision: false, tokenPricing: { maxCost: 9 } },
];
const twoTextModels = () => api.capabilities.mockResolvedValue({ mock: false, operations: [], imageCost: 8, textCost: 1, videoCost: null, textModelMode: "selectable", textModels: TEXT_MODELS });
const modelPick = async () => await screen.findByRole("combobox", { name: "写脚本的模型" }) as HTMLSelectElement;

test("video: the script model can be switched; price and picture reading follow it, the next script uses it, and the draft remembers it", async () => {
  twoTextModels();
  put({ id: "IPP-V", name: "draft V", sceneId: "ecom-talking", doc: { ...EMPTY, nodes: [productNode] as never } });
  await openVideoDraft();
  expect((await modelPick()).value).toBe("text-a");
  expect(screen.getByText(/写一版脚本最多 21 积分/).textContent).not.toContain("不看图");

  fireEvent.change(await modelPick(), { target: { value: "text-b" } });
  expect(screen.getByText(/写一版脚本最多 9 积分/).textContent).toContain("这个模型不看图");
  expect(screen.getByRole("button", { name: "移除商品图 1" })).toBeTruthy(); // 换模型不动素材
  await waitFor(() => expect(store.get("IPP-V")!.doc.sceneDirectorModel).toBe("text-b"));

  api.composeScene.mockResolvedValue({ text: "write script" });
  fireEvent.change(screen.getByRole("textbox", { name: "想做的视频" }), { target: { value: "保湿精华" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "让编导写脚本" })); });
  await waitFor(() => expect(api.submit).toHaveBeenCalled());
  const request = api.submit.mock.calls.at(-1)![1];
  expect(request.model).toBe("text-b");
  expect(request.maxCost).toBe(9);
  expect(request.readVisuals).toBeUndefined();
  expect(request.contextNodeIds).toEqual([]);

  cleanup();
  await openVideoDraft();
  expect((await modelPick()).value).toBe("text-b");
  // 素材也原样回来了（这一版是不看图的模型写的，不能靠读图列表推断）。
  expect(screen.getByRole("button", { name: "移除商品图 1" })).toBeTruthy();
  expect(screen.getByText(/写一版脚本最多 9 积分/)).toBeTruthy();
});

test("video: 确认原任务 resends the original request with its original model, even after switching", async () => {
  twoTextModels();
  const made = addScriptNode({ ...EMPTY, nodes: [productNode] as never }, { ask: "保湿精华", revision: false, prompt: "写脚本", materialIds: ["product"], imageIds: ["product"],
    duration: 15, ratio: "9:16", language: "中文", model: "text-a", maxCost: 21 });
  put({ id: "IPP-V", name: "draft V", sceneId: "ecom-talking", doc: made.doc });
  await openVideoDraft();
  fireEvent.change(await modelPick(), { target: { value: "text-b" } });
  await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "确认原任务" })); });
  await waitFor(() => expect(api.submit).toHaveBeenCalled());
  const request = api.submit.mock.calls.at(-1)![1];
  expect(request.clientRequestId).toBe(made.request.clientRequestId);
  expect(request.model).toBe("text-a");
});
