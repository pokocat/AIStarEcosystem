// @vitest-environment jsdom
// 出的结果接着用（2026-10-30 审查 G04）：图片只能下载，想拿它当参考或做视频得下载再上传；
// 结果地址是签过名的，开久了会过期（G07）——加载失败按 key 换签由 SignedImage / SignedVideo 负责。
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
const refInput = () => document.querySelector('.scene-ref-row input[type="file"]')!;
const continueLink = () => screen.queryByRole("link", { name: "在画布中继续" })?.getAttribute("href");
const heading = () => document.querySelector(".scene-composer-head strong")?.textContent;
const pressed = (group: string, name: string) => within(screen.getByRole("group", { name: group })).getByRole("button", { name }).getAttribute("aria-pressed");
const text = (name: string) => (screen.getByRole("textbox", { name }) as HTMLTextAreaElement).value;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
async function open(Page: typeof SceneImageStudio, url: string) {
  window.history.replaceState(null, "", url);
  await act(async () => { render(<Page/>); });
}

const RESULT = { id: "run-A", status: "done", output: { candidates: [{ key: "ipstudio_gen/u/out.jpg", url: "https://cdn/out.jpg" }] } };
async function oneResult() {
  api.readRun.mockResolvedValue(RESULT);
  await open(SceneImageStudio, "/image?scene=white-background");
  await act(async () => { upload(refInput()); });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "立即生成图片" })); });
  await screen.findByRole("img", { name: /商品白底图第 1 张/ }, { timeout: 4000 });
}

test("image: a single result can become the reference picture, replacing the first one when all slots are full", async () => {
  await oneResult();
  fireEvent.click(screen.getByRole("button", { name: "当参考图" }));
  expect((screen.getByRole("img", { name: "商品图" }) as HTMLImageElement).src).toBe("https://cdn/out.jpg");
  expect(screen.getByText("放进「商品图」了，换掉了原来那张。")).toBeTruthy();
});

test("image: 做成视频 takes the picture to the video page; the viewer offers the same for each picture", async () => {
  await oneResult();
  fireEvent.click(screen.getByRole("button", { name: "做成视频" }));
  expect(api.push).toHaveBeenCalledWith("/video?scene=ecom-talking&ref=ipstudio_gen%2Fu%2Fout.jpg");
  fireEvent.click(screen.getByRole("button", { name: "查看第 1 张" }));
  const viewer = within(screen.getByRole("dialog", { name: "查看大图" }));
  expect(viewer.getByRole("button", { name: "当参考图" })).toBeTruthy();
  expect(viewer.getByRole("button", { name: "做成视频" })).toBeTruthy();
});

test("video: a picture brought from AI 图片 goes into the scene's pictures and the draft, and leaves the address", async () => {
  api.signKeys.mockResolvedValue({ "ipstudio_gen/u/out.jpg": "https://cdn/out-fresh.jpg" });
  window.history.replaceState(null, "", "/video?scene=ecom-talking&ref=ipstudio_gen%2Fu%2Fout.jpg");
  await act(async () => { render(<SceneVideoStudio/>); });
  const tile = await screen.findByRole("img", { name: "商品图 1" });
  expect((tile as HTMLImageElement).src).toBe("https://cdn/out-fresh.jpg");
  expect(api.signKeys).toHaveBeenCalledWith(["ipstudio_gen/u/out.jpg"]);
  expect(window.location.search).not.toContain("ref=");
  await waitFor(() => expect(store.get("IPP-A")!.doc.sceneInputs?.images).toEqual(["ipstudio_gen/u/out.jpg"]));
  expect(screen.getByText(/图带过来了，放在「商品图」/)).toBeTruthy();
});
