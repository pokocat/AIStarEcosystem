// @vitest-environment jsdom
// AI 视频页的长视频（docs/studio-segmented-video.md）：拖到单段上限以上，点一次「生成视频」就做到成片，不交给创作助手。
// 服务端用一份内存草稿库；价格、提交和执行记录是假的，断言页面做的事：先记请求再提交、结果不明时能查原任务、进度和成片。
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { IpProject, IpProjectDoc } from "@ai-star-eco/types";
import type { StudioPlanExecution, StudioPlanExecutionStep } from "@ai-star-eco/types/ip-studio-workflow";

const SCENES = JSON.parse(readFileSync(join(__dirname, "../../../../server/src/main/resources/ipstudio/scenes.json"), "utf8"));
const api = vi.hoisted(() => ({
  push: vi.fn(), failure: vi.fn(), listProjects: vi.fn(), createProject: vi.fn(), updateProject: vi.fn(), getProject: vi.fn(), listScenes: vi.fn(), composeScene: vi.fn(),
  readRun: vi.fn(), cancelRun: vi.fn(), capabilities: vi.fn(), submit: vi.fn(), videoModels: vi.fn(), signKeys: vi.fn(), price: vi.fn(), start: vi.fn(), getExecution: vi.fn(), pause: vi.fn(), resume: vi.fn(), cancel: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push, replace: vi.fn() }), useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock("next/link", () => ({ default: ({ children, ...p }: any) => <a {...p}>{children}</a> }));
vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => null }));
vi.mock("@/components/hub/ui", () => ({ HubTabBar: () => null }));
vi.mock("../api", () => ({ IpStudioApi: { listProjects: api.listProjects, createProject: api.createProject, updateProject: api.updateProject, getProject: api.getProject, listScenes: api.listScenes, composeScene: api.composeScene } }));
vi.mock("@/canvas-bridge/api", () => ({ readRun: api.readRun, cancelRun: api.cancelRun, fetchStudioVideoModels: api.videoModels, signKeys: api.signKeys }));
vi.mock("@/canvas-bridge/studio-api", () => ({ studioCapabilities: api.capabilities, submitStudioRun: api.submit }));
vi.mock("@/canvas-bridge/studio-segmented", async original => ({ ...(await original<typeof import("@/canvas-bridge/studio-segmented")>()), segmentedVideoPrice: api.price, startSegmentedVideo: api.start }));
vi.mock("@/canvas-bridge/studio-plan-execution", async original => ({ ...(await original<typeof import("@/canvas-bridge/studio-plan-execution")>()),
  getStudioPlanExecution: api.getExecution, pauseStudioPlanExecution: api.pause, resumeStudioPlanExecution: api.resume, cancelStudioPlanExecution: api.cancel }));
vi.mock("@/canvas-bridge/studio-video-price", async original => ({ ...(await original<typeof import("@/canvas-bridge/studio-video-price")>()), useStudioVideoPrice: () => ({ status: "idle" }) }));
vi.mock("@/canvas-bridge/signed-video", () => ({ SignedVideo: ({ src, "aria-label": label }: any) => <video src={src} aria-label={label}/> }));
vi.mock("../studio-errors", async original => ({ ...(await original<typeof import("../studio-errors")>()), useStudioFailure: () => api.failure, studioErrorMetadata: () => ({}) }));
vi.mock("../library-reference-picker", () => import("./scene-test-picker"));
vi.mock("../studio-select", () => ({ StudioSelect: () => null }));
import { SceneVideoStudio } from "./scene-video-studio";

const limit = (mediaType: string, maxCount: number) => ({ mediaType, maxCount, maxBytes: 1, formats: [], minDurationSec: null, maxDurationSec: null });
const H3 = { endpointId: "ep-h3", name: "H3", isDefault: true, selectableById: true, supportsPromptOptimization: false, batchCounts: [1],
  contract: { minSeconds: 5, maxSeconds: 15, promptMaxChars: 7000, seedMax: 100,
    tiers: [{ tier: "768p", canvases: [{ aspectRatio: "9:16", width: 432, height: 768, outputSizeCode: null }] }],
    modes: [{ mode: "universal_reference_video", needsFirstFrame: false, needsLastFrame: false, frameImage: null,
      references: { image: limit("image", 9), video: limit("video", 1), audio: limit("audio", 3), maxImagesWithVideo: 4, maxTotal: 12, minVisual: 1, maxAudioTotalSec: 30 } }] },
  pricing: { perSecond: { universal_reference_video: { "768p": 40 } }, freeRefImages: 9, extraRefImagePerSecond: 0, promptOptimizationPerCall: 0 } };
const PRICE = { segments: [15, 15, 10], boards: 3, boardReview: true, videoCost: 1600, boardCost: 24, textCost: 400, estimated: 2024, cap: 2290 };
const productNode = { id: "product", type: "image", title: "商品图 1", position: { x: 100, y: 400 }, width: 100, height: 100,
  metadata: { storageKey: "product.jpg", content: "https://cdn/product.jpg", origin: "upload", mimeType: "image/jpeg", status: "success" } };
const EMPTY: IpProjectDoc = { nodes: [], connections: [], viewport: { x: 0, y: 0, k: 1 } };
const store = new Map<string, IpProject>();
const put = (p: Partial<IpProject> & { id: string }) => {
  const row = { name: p.id, status: "draft", createdAt: "", updatedAt: "2026-11-05", doc: EMPTY, runs: {}, runsById: {}, docVersion: "v1", ...p } as IpProject;
  store.set(row.id, row); return row;
};
const step = (id: string, operation: StudioPlanExecutionStep["operation"], status: StudioPlanExecutionStep["status"], runIds: string[] = []): StudioPlanExecutionStep =>
  ({ id, title: id, operation, stage: "production", dependsOn: [], status, runIds, attempt: 1, quotedCost: 0, nodeId: `PEX-1-p-${id}` });
const execution = (status: StudioPlanExecution["status"], steps: StudioPlanExecutionStep[], extra: Partial<StudioPlanExecution> = {}): StudioPlanExecution =>
  ({ id: "PEX-1", projectId: "IPP-V", skillKey: "video-generation", skillVersion: 1, stage: "production", planRunId: "SEG-1", planRevision: 1, planFingerprint: "f", status, steps,
    budgets: [{ stage: "production", approvedCap: 2290, autoFixCap: 266, spent: 120, inFlight: 0, remaining: 2170 }], startedAt: "2026-11-05T00:00:00Z", deadlineAt: "2026-11-05T03:00:00Z", updatedAt: "2026-11-05T00:01:00Z", ...extra });

beforeEach(() => {
  store.clear();
  localStorage.clear();
  api.listScenes.mockResolvedValue(SCENES);
  api.listProjects.mockImplementation(async () => [...store.values()].map(p => ({ id: p.id, name: p.name, sceneId: p.sceneId, updatedAt: p.updatedAt, createdAt: p.createdAt })));
  api.getProject.mockImplementation(async (id: string) => structuredClone(store.get(id)));
  api.updateProject.mockImplementation(async (id: string, { doc }: { doc: IpProjectDoc }) => {
    const old = store.get(id)!;
    return put({ ...old, doc: structuredClone(doc), docVersion: `v${Number(old.docVersion.slice(1)) + 1}` });
  });
  api.capabilities.mockResolvedValue({ mock: false, operations: [], imageCost: 8, textCost: 1, videoCost: null, textModels: [{ endpointId: "text", name: "Text", isDefault: true, supportsVision: true, tokenPricing: { maxCost: 21 } }] });
  api.videoModels.mockResolvedValue([H3]);
  api.price.mockResolvedValue(PRICE);
  api.start.mockResolvedValue(execution("running", [step("script", "text", "running")]));
  api.getExecution.mockResolvedValue(execution("running", [step("script", "text", "running"), step("review", "text", "pending"), step("b1", "image", "pending"), step("v1", "video", "pending"), step("film", "assemble", "pending")]));
  api.signKeys.mockResolvedValue({});
});
afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState(null, "", "/"); });

const longDraft = (extra: Partial<IpProjectDoc> = {}) => put({ id: "IPP-V", name: "v", sceneId: "ecom-talking", doc: { ...EMPTY, nodes: [productNode] as never,
  sceneInputs: { images: ["product.jpg"], character: null, voice: null, video: null },
  sceneVideoState: { text: "保湿精华，讲清楚卖点", options: {}, duration: 40, ratio: "9:16" }, ...extra } });
async function open() {
  window.history.replaceState(null, "", "/video?scene=ecom-talking&draft=IPP-V");
  await act(async () => { render(<SceneVideoStudio/>); });
}
const go = () => screen.getByRole("button", { name: "生成视频" }) as HTMLButtonElement;
const records = () => store.get("IPP-V")!.doc.sceneSegmented ?? [];

test("longer than one segment: the button generates, says how it splits and what it costs, and is not a hand-off", async () => {
  longDraft();
  await open();
  await screen.findByText(/这个模型单段最长 15 秒，40 秒分 3 段（15 \+ 15 \+ 10）/);
  await waitFor(() => expect(go().textContent).toContain("约 1,624 积分"));
  expect(screen.getByText(/写脚本、审核和提示词优化按实际用量另扣，整条最多 2,290 积分/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "交给创作助手" })).toBeNull();
  expect(api.price).toHaveBeenLastCalledWith(expect.objectContaining({ model: "ep-h3", tier: "768p", duration: 40, ratio: "9:16", images: 1, character: false, voice: false }), expect.anything());
});

test("one click: the request is saved before it is sent, then the row follows the execution", async () => {
  longDraft();
  let savedFirst = false;
  api.start.mockImplementation(async () => { savedFirst = records().length === 1; return execution("running", [step("script", "text", "running")]); });
  await open();
  await waitFor(() => expect(go().disabled).toBe(false), { timeout: 5000 });
  fireEvent.click(go());
  await waitFor(() => expect(records()[0]?.executionId).toBe("PEX-1"));
  expect(savedFirst).toBe(true);
  const [projectId, request] = api.start.mock.calls[0];
  expect(projectId).toBe("IPP-V");
  expect(request).toMatchObject({ sceneId: "ecom-talking", text: "保湿精华，讲清楚卖点", hasScript: false, duration: 40, ratio: "9:16", model: "ep-h3", tier: "768p", budgetCap: 2290,
    materials: [{ nodeId: "product", title: expect.any(String), slot: "image" }] });
  expect(api.push).not.toHaveBeenCalled();
  expect(await screen.findByText("写分镜脚本")).toBeTruthy();
  expect(screen.getByText("合成成片")).toBeTruthy();
  expect(screen.getByRole("button", { name: "暂停" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "停止" })).toBeTruthy();
});

test("a refused start leaves no row and says why; the page keeps what was written", async () => {
  longDraft();
  api.start.mockRejectedValue(Object.assign(new Error("价格有变化"), { status: 409, code: "STUDIO_PRICE_CHANGED" }));
  await open();
  await waitFor(() => expect(go().disabled).toBe(false), { timeout: 5000 });
  fireEvent.click(go());
  await waitFor(() => expect(api.failure).toHaveBeenCalled());
  await waitFor(() => expect(records()).toEqual([]));
  expect(store.get("IPP-V")!.doc.sceneVideoState?.text).toBe("保湿精华，讲清楚卖点");
});

test("an unknown outcome keeps the row: checking again sends the same request id, it does not start a second one", async () => {
  longDraft();
  api.start.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  await open();
  await waitFor(() => expect(go().disabled).toBe(false), { timeout: 5000 });
  fireEvent.click(go());
  const confirm = await screen.findByRole("button", { name: "确认原任务" });
  expect(records()).toHaveLength(1);
  const first = api.start.mock.calls[0][1].clientRequestId;
  fireEvent.click(confirm);
  await waitFor(() => expect(records()[0].executionId).toBe("PEX-1"));
  expect(api.start.mock.calls[1][1].clientRequestId).toBe(first);
});

test("a stopped run says why and can continue; a finished one shows the film", async () => {
  longDraft({ sceneSegmented: [{ clientRequestId: "r1", at: "", title: "带货 · 40 秒", executionId: "PEX-1", request: { clientRequestId: "r1", sceneId: "ecom-talking", text: "", duration: 40, ratio: "9:16", materials: [], budgetCap: 1 } }] });
  api.getExecution.mockResolvedValue(execution("needs_user", [step("v1", "video", "done"), step("v2", "video", "failed")], { needsUserReason: "「第 2 段视频」没有完成：厂商没有出片。可以继续重试这一步，或结束本次制作。" }));
  const done = execution("done", [step("v1", "video", "done", ["run-1"]), step("film", "assemble", "done", ["run-film"])], { updatedAt: "2026-11-05T00:09:00Z" });
  api.resume.mockResolvedValue(done);
  api.readRun.mockImplementation(async (id: string) => ({ id, status: "done", output: { storageKey: id === "run-film" ? "gen/film.mp4" : "gen/v1.mp4" }, inputs: {} }));
  api.signKeys.mockResolvedValue({ "gen/film.mp4": "https://cdn/film.mp4" });
  await open();
  expect(await screen.findByText(/第 2 段视频」没有完成/)).toBeTruthy();
  expect(screen.getByText("各段视频 1/2")).toBeTruthy();
  api.getExecution.mockResolvedValue(done);
  fireEvent.click(screen.getByRole("button", { name: "继续" }));
  await waitFor(() => expect(api.resume).toHaveBeenCalled());
  const video = await screen.findByLabelText("带货 · 40 秒", {}, { timeout: 3000 });
  expect(video.getAttribute("src")).toBe("https://cdn/film.mp4");
  expect(screen.getByRole("button", { name: "下载" })).toBeTruthy();
  expect(screen.queryByText("写分镜脚本")).toBeNull();
});

test('reopening a canvas-saved draft restores its long-video status from native runs without starting generation', async () => {
  const draft = longDraft();
  const run = { id: 'run-script', status: 'done', createdAt: '2026-11-06T08:34:24Z',
    inputs: { executionId: 'PEX-1', segmented: { kind: 'script', scene: { duration: 24, ratio: '9:16' } } },
    output: { text: '已经生成的脚本' } };
  put({ ...draft, runs: { 'script-node': run } as never, runsById: { 'run-script': run } as never });
  api.getExecution.mockResolvedValue(execution('needs_user', [step('b1', 'image', 'failed')], { needsUserReason: '第 1 段分镜图请求失败，已暂停制作' }));
  await open();
  expect(await screen.findByText('第 1 段分镜图请求失败，已暂停制作')).toBeTruthy();
  expect(screen.getByRole('button', { name: '继续' })).toBeTruthy();
  expect(api.getExecution).toHaveBeenCalledWith('IPP-V', 'PEX-1');
  expect(api.start).not.toHaveBeenCalled();
  expect(api.submit).not.toHaveBeenCalled();
});
