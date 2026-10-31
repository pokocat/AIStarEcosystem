// @vitest-environment jsdom
// 编导按会交给视频模型的素材写、出片时规格变了提示重写（2026-10-30 审查 F07）：
//   编导按全部素材编号「图1、图2」，出片时只认首帧的模型只拿第一张、纯文字模型一张都不拿，脚本里的「图2」视频模型看不到；
//   写脚本的模型看不到图时还被告知「已附图片、先看图」；换了模型或时长后脚本没人复核。
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

/** 只能按文字出、4 秒（照本地 Agnes Video 2.5 Flash 的形状）。 */
const TEXT_ONLY = { ...H3, endpointId: "ep-text", name: "文字出片", isDefault: false,
  contract: { ...H3.contract, minSeconds: 4, maxSeconds: 4, modes: [H3.contract.modes[0]] } };

test("video: with a text-only video model the director gets no numbered pictures, and a director that cannot see is not told to look", async () => {
  api.videoModels.mockResolvedValue([TEXT_ONLY]);
  api.capabilities.mockResolvedValue({ mock: false, operations: [], imageCost: 8, textCost: 1, videoCost: null,
    textModels: [{ endpointId: "text", name: "Text", isDefault: true, supportsVision: false, tokenPricing: { maxCost: 21 } }] });
  api.composeScene.mockResolvedValue({ text: "写脚本" });
  put({ id: "IPP-V", name: "v", sceneId: "ecom-talking", doc: { ...EMPTY, nodes: [productNode] as never } });
  await open(SceneVideoStudio, "/video?scene=ecom-talking&draft=IPP-V");
  fireEvent.change(await screen.findByRole("textbox", { name: "想做的视频" }), { target: { value: "保湿面霜" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "让编导写脚本" })); });
  await waitFor(() => expect(api.composeScene).toHaveBeenCalled());
  expect(api.composeScene.mock.calls[0][0]).toMatchObject({ imageTitles: [], seenTitles: ["商品图 1"], visual: false });
  // 这一版记下按哪个模型、交给它几张图写的。
  await waitFor(() => expect(api.submit).toHaveBeenCalled());
  const script = store.get("IPP-V")!.doc.nodes.find(n => n.metadata?.studio?.sceneDirector)!;
  expect(script.metadata!.studio!.sceneDirector).toMatchObject({ videoModel: "ep-text", refs: [], duration: 4 });
});

test("video: when the settings no longer match what the script was written for, the editor says what changed and can ask the director to redo it", async () => {
  const { doc } = withScript({ ...EMPTY, nodes: [productNode] as never }); // 按 15 秒写的
  put({ id: "IPP-V", name: "v", sceneId: "ecom-talking", doc });
  api.composeScene.mockResolvedValue({ text: "改脚本" });
  await open(SceneVideoStudio, "/video?scene=ecom-talking&draft=IPP-V");
  fireEvent.click(await screen.findByRole("button", { name: "用这个脚本生成" }));
  // 时长还是 15 秒：不提示。
  expect(screen.queryByRole("button", { name: /让编导照现在的改一版/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "10 秒" }));
  expect(screen.getByText(/这版脚本是照 15 秒写的，现在要出 10 秒/)).toBeTruthy();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /让编导照现在的改一版/ })); });
  await waitFor(() => expect(api.composeScene).toHaveBeenCalled());
  expect(api.composeScene.mock.calls[0][0]).toMatchObject({ kind: "video-script", duration: 10, revision: expect.stringContaining("这版脚本是照 15 秒写的，现在要出 10 秒") });
  // 回到编导那一列，看得到新的一版在写。
  expect(screen.queryByRole("textbox", { name: "视频脚本" })).toBeNull();
});

// 2026-10-30 审查 F01–F05：同城团购缺价格时拍成了探店；脚本成功只验格式。
const storeNode = { ...productNode, id: "store", title: "门店照片 1", metadata: { ...productNode.metadata, storageKey: "store.jpg", content: "https://cdn/store.jpg" } };
function withGroupbuyScript(content: string) {
  const made = addScriptNode({ ...EMPTY, nodes: [storeNode] as never }, { ask: "巷里火锅，双人套餐 99，原价 158", revision: false, prompt: "写脚本",
    materialIds: ["store"], imageIds: [], duration: 15, ratio: "9:16", language: "中文" });
  return patchNode(made.doc, made.nodeId, n => ({ ...n, metadata: { ...n.metadata, status: "success", content } }));
}

test("video: the scene's facts are chips that start a line in the input", async () => {
  await open(SceneVideoStudio, "/video?scene=local-groupbuy");
  const chips = within(await screen.findByRole("group", { name: "要写清楚的信息" }));
  fireEvent.click(chips.getByRole("button", { name: "店名和位置" }));
  fireEvent.change(screen.getByRole("textbox", { name: "想做的视频" }), { target: { value: "店名和位置：巷里火锅，万达东门" } });
  fireEvent.click(chips.getByRole("button", { name: "团购价" }));
  expect(text("想做的视频")).toBe("店名和位置：巷里火锅，万达东门\n团购价：");
  // 选填的标着「有就写」。
  expect(chips.getByRole("button", { name: /原价有就写/ })).toBeTruthy();
});

test("video: a script that says what is still missing shows it, drops that line when used, and cannot be generated while 【待补】 is left", async () => {
  put({ id: "IPP-G", name: "g", sceneId: "local-groupbuy", doc: withGroupbuyScript("还缺：怎么买。\n第1镜（0–5 秒）：门头。旁白说：「万达东门巷里火锅，双人餐九十九。」\n第2镜（5–10 秒）：套餐。旁白说：「点【待补：购买入口】下单。」") });
  await open(SceneVideoStudio, "/video?scene=local-groupbuy&draft=IPP-G");
  expect(await screen.findByText("还缺购买入口。在下面写上发给编导，会补进脚本。")).toBeTruthy();
  // 留空的地方标出来。
  expect(document.querySelector("mark.scene-script-blank")?.textContent).toBe("【待补：购买入口】");
  // 原价 158 用户写了、脚本里没有：灰字提醒，不拦。
  expect(screen.getByText("你写的 158 脚本里没用上，要加的话跟编导说一声。")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "用这个脚本生成" }));
  expect(text("视频脚本").startsWith("第1镜")).toBe(true);
  const go = screen.getByRole("button", { name: "立即生成视频" }) as HTMLButtonElement;
  await waitFor(() => expect(go.textContent).toContain("还有没填的：购买入口。在上面换成实际内容，用不上的直接删掉。"));
  expect(go.disabled).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: "视频脚本" }), { target: { value: text("视频脚本").replace("【待补：购买入口】", "本视频团购") } });
  await waitFor(() => expect(go.disabled).toBe(false));
});

test("video: a 还缺 line with no 【待补】 left in the script is shown as a soft note, not a blocker", async () => {
  put({ id: "IPP-G", name: "g", sceneId: "local-groupbuy", doc: withGroupbuyScript("第1镜（0–2 秒）：门头。旁白说：「巷里火锅，双人餐九十九，原价一百五十八。」\n\n还缺：火锅店的名字。") });
  await open(SceneVideoStudio, "/video?scene=local-groupbuy&draft=IPP-G");
  expect(await screen.findByText("编导觉得可能还缺火锅店的名字，写过了就不用管。")).toBeTruthy();
  expect(document.querySelector(".scene-script-missing")).toBeNull();
});

test("video: blanks for facts marked 有就写 do not count as missing; after a script only the blank facts are offered as chips", async () => {
  put({ id: "IPP-G", name: "g", sceneId: "local-groupbuy", doc: withGroupbuyScript("第1镜（0–2 秒）：门头。旁白说：「双人餐九十九，原价【待补：原价】。」") });
  await open(SceneVideoStudio, "/video?scene=local-groupbuy&draft=IPP-G");
  expect(await screen.findByText("原价没有就不用写，出片前把脚本里标着的那几处删掉就行。")).toBeTruthy();
  expect(document.querySelector(".scene-script-missing")).toBeNull();
  const chips = within(screen.getByRole("group", { name: "要写清楚的信息" }));
  expect(chips.getAllByRole("button").map(b => b.textContent)).toEqual(["原价有就写"]);
});
