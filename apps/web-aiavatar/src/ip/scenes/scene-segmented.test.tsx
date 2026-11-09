// @vitest-environment jsdom
// AI 视频页的长视频（docs/studio-segmented-video.md）：拖到单段上限以上，点一次「生成视频」就做到成片，不交给创作助手。
// 服务端用一份内存草稿库；价格、提交和执行记录是假的，断言页面做的事：先记请求再提交、结果不明时能查原任务、进度和成片。
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { IpProject, IpProjectDoc } from "@ai-star-eco/types";
import type { StudioPlanExecution, StudioPlanExecutionStep } from "@ai-star-eco/types/ip-studio-workflow";

const SCENES = JSON.parse(readFileSync(join(__dirname, "../../../../server/src/main/resources/ipstudio/scenes.json"), "utf8"));
const api = vi.hoisted(() => ({
  push: vi.fn(), failure: vi.fn(), payer: vi.fn(), listProjects: vi.fn(), createProject: vi.fn(), updateProject: vi.fn(), getProject: vi.fn(), listScenes: vi.fn(), composeScene: vi.fn(),
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
vi.mock("@/canvas-bridge/studio-video-price", async original => ({ ...(await original<typeof import("@/canvas-bridge/studio-video-price")>()), studioPreviewPayer: api.payer, useStudioVideoPrice: () => ({ status: "idle" }) }));
vi.mock("@/canvas-bridge/signed-video", () => ({ SignedVideo: ({ src, "aria-label": label }: any) => <video src={src} aria-label={label}/> }));
vi.mock("@/canvas-bridge/signed-image", () => ({ SignedImage: ({ src, alt }: any) => <img src={src} alt={alt}/> }));
vi.mock("../studio-errors", async original => ({ ...(await original<typeof import("../studio-errors")>()), useStudioFailure: () => api.failure, studioErrorMetadata: () => ({}) }));
vi.mock("../library-reference-picker", () => import("./scene-test-picker"));
vi.mock("../studio-select", () => ({ StudioSelect: ({ label, value, onChange, options }: any) => <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select> }));
const acceptedTasks = new Map<string, any>();
vi.mock('@/canvas-bridge/studio-video-tasks', async original => ({ ...(await original<typeof import('@/canvas-bridge/studio-video-tasks')>()),
  videoTasks: async () => ({ items: [], page: 0, hasMore: false }),
  videoTaskPrice: async () => ({ ...PRICE, cap: PRICE.estimated * 3 }),
  prepareVideoTask: async (_id: string, request: any) => ({ ...request, billing: { mode: 'personal' } }),
  startVideoTask: async (projectId: string, request: any) => {
    const execution = await api.start(projectId, request.configuration);
    const task = { id: execution.id, projectId, sceneId: request.sceneId, title: request.title, kind: request.kind, input: request.input, request, execution, createdAt: execution.startedAt };
    acceptedTasks.set(task.id, task); return task;
  },
  videoTask: async (id: string) => ({ ...acceptedTasks.get(id), execution: await api.getExecution() }),
}));
import { SceneVideoStudio } from "./scene-video-studio";
import { addScriptNode } from "./scene-drafts";

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
  store.clear(); acceptedTasks.clear(); sessionStorage.clear();
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
  api.signKeys.mockResolvedValue({});
  api.payer.mockResolvedValue({ kind: "decided", billing: { mode: "personal" } });
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
const records = () => store.get("IPP-V")!.doc.sceneVideoSubmissions ?? [];

// 2026-11-09：「重新编辑」并进「视频裂变」的「自己改」，放回同一份草稿（新视频和原来的在同一批），不再复制成新草稿。
test.each([false, true])('failed Fast task: 自己改 retains the prompt in the same draft and switching models keeps it (adopted script: %s)', async adopted => {
  const prompt = '第1镜（0–5秒）：产品特写。旁白说：「这是我写好的脚本。」';
  const state = { text: adopted ? '' : prompt, options: {}, duration: 15, ratio: '9:16', tier: '768p',
    ...(adopted ? { edit: { scriptId: 'script-from-original-draft', prompt } } : {}) };
  longDraft();
  api.videoModels.mockResolvedValue([{ ...H3, endpointId: 'ep-fast', name: 'Seedance Fast' }, { ...H3, isDefault: false }]);
  const input = { nodes: [productNode], sceneInputs: { images: ['product.jpg'], character: null, voice: null, video: null },
    sceneVideoModel: 'ep-fast', sceneVideoState: state };
  acceptedTasks.set('PEX-fast-failed', { id: 'PEX-fast-failed', projectId: 'IPP-V', sceneId: 'ecom-talking', title: 'Fast 失败的原任务', kind: 'direct',
    createdAt: '2026-11-07', input, request: { input, configuration: { text: prompt, hasScript: adopted } } });
  api.getExecution.mockResolvedValue(execution('needs_user', [step('video', 'video', 'failed')], { id: 'PEX-fast-failed' }));
  window.history.replaceState(null, '', '/video?scene=ecom-talking&draft=IPP-V&task=PEX-fast-failed');
  await act(async () => { render(<SceneVideoStudio/>); });
  fireEvent.click(await screen.findByRole('button', { name: '视频裂变' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '视频裂变' })).getByRole('radio', { name: /自己改/ }));
  await act(async () => { fireEvent.click(within(screen.getByRole('dialog', { name: '视频裂变' })).getByRole('button', { name: '去修改' })); });
  await waitFor(() => expect(screen.getByRole('textbox', { name: /想做的视频|视频脚本/ }).textContent).toBe(prompt));
  expect(screen.queryByRole('dialog', { name: '视频裂变' })).toBeNull();
  expect(document.querySelector('.scene-video-studio')?.getAttribute('data-video-view')).toBe('compose');
  if (adopted) expect(screen.getByRole('textbox', { name: '视频脚本' })).toBeTruthy();
  expect(screen.getByRole('combobox', { name: '视频模型' })).toHaveProperty('value', 'ep-fast');
  fireEvent.change(screen.getByRole('combobox', { name: '视频模型' }), { target: { value: 'ep-h3' } });
  expect(screen.getByRole('textbox', { name: /想做的视频|视频脚本/ }).textContent).toBe(prompt);
  await waitFor(() => expect(store.get('IPP-V')!.doc.sceneVideoModel).toBe('ep-h3'));
  expect(api.createProject).not.toHaveBeenCalled();
  expect(api.start).not.toHaveBeenCalled();
  expect(api.submit).not.toHaveBeenCalled();
  cleanup();
  window.history.replaceState(null, '', '/video?scene=ecom-talking&draft=IPP-V');
  await act(async () => { render(<SceneVideoStudio/>); });
  await waitFor(() => expect(screen.getByRole('textbox', { name: /想做的视频|视频脚本/ }).textContent).toBe(prompt));
  expect(screen.getByRole('combobox', { name: '视频模型' })).toHaveProperty('value', 'ep-h3');
});

// 2026-11-07 用户：按钮下的费用明细和分段说明多余。按钮上写约数，上限放悬停提示；怎么分段写在时长设置里。
test("longer than one segment: the button generates and shows what it costs, the cap only on hover, and is not a hand-off", async () => {
  longDraft();
  await open();
  await waitFor(() => expect(go().textContent).toContain("约 1,624 积分"));
  await waitFor(() => expect(go().querySelector("small")?.getAttribute("title")).toContain(`最多 ${(PRICE.estimated * 3).toLocaleString("zh-CN")} 积分`));
  expect(screen.queryByText(/将分 3 段|其余按实际用量结算|最多 .*积分/)).toBeNull();
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
  await waitFor(() => expect(store.get("IPP-V")!.doc.sceneVideoTasks).toContain("PEX-1"));
  expect(savedFirst).toBe(true);
  const [projectId, request] = api.start.mock.calls[0];
  expect(projectId).toBe("IPP-V");
  expect(request).toMatchObject({ sceneId: "ecom-talking", text: "保湿精华，讲清楚卖点", hasScript: false, duration: 40, ratio: "9:16", model: "ep-h3", tier: "768p", budgetCap: PRICE.estimated * 3,
    materials: [{ nodeId: "product", title: expect.any(String), slot: "image" }] });
  expect(api.push).not.toHaveBeenCalled();
  expect(await screen.findByText("正在写分镜脚本")).toBeTruthy();
  // The start response only includes the script; the next poll supplies the full plan.
  expect(await screen.findByText("导出成片", {}, { timeout: 5000 })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "暂停" })).toBeNull();
  expect(screen.getByRole("button", { name: "停止生成" })).toBeTruthy();
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
  await waitFor(() => expect(store.get("IPP-V")!.doc.sceneVideoTasks).toContain("PEX-1"));
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

test('entering bare video page restores its last selected task after scene defaults load', async () => {
  longDraft(); sessionStorage.setItem('studio:video:selected-task', 'PEX-return');
  acceptedTasks.set('PEX-return', { id: 'PEX-return', projectId: 'IPP-V', sceneId: 'ecom-talking', title: '上次制作', kind: 'segmented', createdAt: '2026-11-06', input: { sceneVideoState: { text: '原来的要求', duration: 40, ratio: '9:16', options: {} }, nodes: [] } });
  api.getExecution.mockResolvedValue(execution('running', [step('script', 'text', 'running')], { id: 'PEX-return' }));
  window.history.replaceState(null, '', '/video');
  await act(async () => { render(<SceneVideoStudio/>); });
  await waitFor(() => expect(window.location.search).toContain('task=PEX-return'));
  expect(await screen.findByRole('region', { name: '本次设置' })).toBeTruthy();
  expect(api.start).not.toHaveBeenCalled();
});

test("long video shows the server discount and keeps the standard budget cap", async () => {
  longDraft();
  api.price.mockResolvedValue({ ...PRICE, discountedVideoCost: 800, videoDiscountName: "H3限时折扣" });
  await open();
  await waitFor(() => expect(go().textContent).toContain("824 积分"));
  expect(go().querySelector("s")?.textContent).toContain("1,624");
  // 优惠和上限都在价格的悬停提示里，按钮下不写（2026-11-07）。
  expect(go().querySelector("small")?.title).toContain("H3限时折扣，视频费省 800 积分");
  await waitFor(() => expect(go().querySelector("small")?.title).toContain("按实际用量结算，最多"));
  fireEvent.click(go());
  await waitFor(() => expect(api.start).toHaveBeenCalled());
  expect(api.start.mock.calls[0][1].budgetCap).toBe(PRICE.estimated * 3);
});

test("undecided payer shows both long-video prices and a starting price", async () => {
  longDraft();
  api.payer.mockResolvedValue({ kind: "undecided", enterpriseId: "team" });
  api.price.mockImplementation(async ({ payer }) => ({ ...PRICE, discountedVideoCost: payer === "enterprise" ? 800 : 1600 }));
  await open();
  await waitFor(() => expect(go().textContent).toContain("824 积分起"));
  expect(go().querySelector("small")?.title).toContain("个人账户视频费 1,600 积分，企业账户视频费 800 积分");
  expect(screen.queryByText(/个人账户视频费/)).toBeNull();
  expect(api.price).toHaveBeenCalledWith(expect.objectContaining({ payer: "enterprise", enterpriseId: "team" }), expect.anything());
});

test("an enterprise payer whose quote is refused still gets the standard price and can generate", async () => {
  longDraft();
  api.payer.mockResolvedValue({ kind: "decided", billing: { mode: "enterprise", enterpriseId: "team" } });
  api.price.mockImplementation(async ({ payer }) => {
    if (payer === "enterprise") throw new Error("已达到企业设定的在途任务上限");
    return { ...PRICE, discountedVideoCost: 800, videoDiscountName: "个人折扣" };
  });
  await open();
  await waitFor(() => expect(go().textContent).toContain("1,624 积分"));
  expect(go().querySelector("s")).toBeNull();
  expect(screen.queryByText(/个人折扣/)).toBeNull();
  fireEvent.click(go());
  await waitFor(() => expect(api.start).toHaveBeenCalled());
});

test("coming back to the page re-quotes without taking the shown price away", async () => {
  longDraft();
  api.price.mockResolvedValue({ ...PRICE, discountedVideoCost: 800 });
  await open();
  await waitFor(() => expect(go().textContent).toContain("824 积分"));
  api.price.mockClear();
  api.price.mockImplementation(() => new Promise(() => {}));
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  await waitFor(() => expect(api.price).toHaveBeenCalled(), { timeout: 1500 });
  expect(go().textContent).toContain("824 积分");
});

function directorDraft() {
  const made = addScriptNode({ ...EMPTY, nodes: [productNode] as never }, { ask: "写一版脚本", revision: false, prompt: "写脚本", materialIds: ["product"], imageIds: ["product"], duration: 15, ratio: "9:16", language: "中文" });
  made.doc.nodes.at(-1)!.metadata!.studio!.runId = "script-run";
  longDraft({ ...made.doc, sceneVideoState: { text: "写一版脚本", options: {}, duration: 15, ratio: "9:16" } });
  api.readRun.mockResolvedValue({ id: "script-run", status: "running", stage: "studio.generate", output: {} });
}

test("director stop responds immediately, disables repeats and allows another request after acknowledgement", async () => {
  directorDraft();
  let resolve!: (run: unknown) => void;
  api.cancelRun.mockImplementation(() => new Promise(r => { resolve = r; }));
  await open();
  const director = screen.queryByRole("button", { name: "AI 编导" });
  if (director) fireEvent.click(director);
  fireEvent.click(screen.getByRole("button", { name: "停止" }));
  expect(screen.getByText("正在停止…")).toBeTruthy();
  expect((screen.getByRole("button", { name: "已请求停止" }) as HTMLButtonElement).disabled).toBe(true);
  expect(api.cancelRun).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ id: "script-run", status: "running", stage: "studio.stopping", output: {} }));
  expect(screen.getByText("已停止创作，正在结算已用费用")).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox", { name: "修改意见" }), { target: { value: "换一个开场" } });
  expect((screen.getByRole("button", { name: "发送修改意见" }) as HTMLButtonElement).disabled).toBe(false);
});

test("a refused stop restores the writing state and lets the user retry", async () => {
  directorDraft();
  api.cancelRun.mockRejectedValue(new TypeError("Failed to fetch"));
  await open();
  const director = screen.queryByRole("button", { name: "AI 编导" });
  if (director) fireEvent.click(director);
  fireEvent.click(screen.getByRole("button", { name: "停止" }));
  await waitFor(() => expect(api.failure).toHaveBeenCalled());
  expect(screen.getByRole("button", { name: "停止" })).toBeTruthy();
  expect(screen.queryByText("已停止创作，正在结算已用费用")).toBeNull();
});

test("a stopped director is shown as stopped, and its returned status is applied immediately", async () => {
  directorDraft();
  api.cancelRun.mockResolvedValue({ id: "script-run", status: "failed", errorCode: "IP_RUN_CANCELLED",
    errorMessage: "创作已停止", output: {} });
  await open();
  const director = screen.queryByRole("button", { name: "AI 编导" });
  if (director) fireEvent.click(director);
  fireEvent.click(screen.getByRole("button", { name: "停止" }));
  await screen.findByText("创作已停止");
  expect(document.querySelector(".scene-script-card.is-stopped")).toBeTruthy();
  expect(document.querySelector(".scene-script-state.is-failed")).toBeNull();
});

// 2026-11-09 用户：打开历史任务要看得出当时选的场景和模型；同一份脚本想再出几条，不用重新编辑。
const openOrig = async (text = '原来的要求', hasScript = false) => {
  longDraft();
  const input = { nodes: [productNode], sceneInputs: { images: ['product.jpg'], character: null, voice: null, video: null }, sceneVideoModel: 'ep-h3',
    sceneVideoState: { text: hasScript ? '' : text, duration: 40, ratio: '9:16', tier: '768p', options: {}, ...(hasScript ? { edit: { scriptId: 'script-1', prompt: text } } : {}) } };
  const configuration = { clientRequestId: 'orig', sceneId: 'ecom-talking', text, hasScript, duration: 40, ratio: '9:16', model: 'ep-h3', tier: '768p', optimize: false,
    materials: [{ nodeId: 'product', title: '商品图 1', slot: 'image' }], budgetCap: 1, billing: { mode: 'personal' } };
  acceptedTasks.set('PEX-orig', { id: 'PEX-orig', projectId: 'IPP-V', sceneId: 'ecom-talking', title: '口播带货 · 原来的要求', kind: 'segmented', createdAt: '2026-11-06', input,
    request: { clientRequestId: 'orig', kind: 'segmented', sceneId: 'ecom-talking', title: '口播带货 · 原来的要求', configuration, budgetCap: 1, billing: { mode: 'personal' }, input } });
  api.getExecution.mockResolvedValue(execution('done', [step('film', 'assemble', 'done')], { id: 'PEX-orig' }));
  window.history.replaceState(null, '', '/video?scene=ecom-talking&draft=IPP-V&task=PEX-orig');
  await act(async () => { render(<SceneVideoStudio/>); });
  return screen.findByRole('region', { name: '本次设置' });
};
const more = () => screen.getByRole('dialog', { name: '视频裂变' });
test('an opened task shows its scene and model, and 视频裂变 submits the same request as new tasks', async () => {
  const settings = await openOrig();
  expect(within(settings).getByRole('button', { name: '切换场景，当前：口播带货' })).toBeTruthy();
  await waitFor(() => expect(within(settings).getByText('模型').nextElementSibling?.textContent).toBe('H3'));
  fireEvent.click(within(settings).getByRole('button', { name: '视频裂变' }));
  fireEvent.click(within(more()).getByRole('button', { name: '2 条' }));
  await act(async () => { fireEvent.click(within(more()).getByRole('button', { name: /生成 2 条/ })); });
  await waitFor(() => expect(api.start).toHaveBeenCalledTimes(2));
  const sent = api.start.mock.calls.map(call => call[1]);
  expect(new Set(sent.map(c => c.clientRequestId)).size).toBe(2);
  for (const c of sent) expect(c).toMatchObject({ text: '原来的要求', model: 'ep-h3', duration: 40, budgetCap: PRICE.estimated * 3 });
  expect(sent.some(c => c.clientRequestId === 'orig')).toBe(false);
  await waitFor(() => expect(store.get('IPP-V')!.doc.sceneVideoSubmissions ?? []).toEqual([]));
  expect(store.get('IPP-V')!.doc.sceneVideoTasks).toContain('PEX-1');
  // 新任务记下从哪条来、怎么来的（结果区按它标出「AI 改写」「换变量」）。
  expect(acceptedTasks.get('PEX-1').input.take).toEqual({ of: 'PEX-orig', mode: 'same' });
  // 都交上去了，弹窗关掉；原任务还在这页上，没有被换成编辑器。
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '视频裂变' })).toBeNull());
  expect(screen.getByRole('region', { name: '本次设置' })).toBeTruthy();
  expect(window.location.search).toContain('task=PEX-orig');
});

test('视频裂变 · AI 改写: each version is a director rewrite of the submitted script, kept apart from the director versions', async () => {
  const script = '一、剧情概述：宝妈在厨房里试用。';
  const sentRuns = new Map<string, any>();
  api.submit.mockImplementation(async (_id: string, request: any) => { sentRuns.set(`run-${request.nodeId}`, request); return { id: `run-${request.nodeId}`, status: 'running', inputs: request, output: {} }; });
  api.readRun.mockImplementation(async (id: string) => ({ id, status: 'done', inputs: sentRuns.get(id),
    output: { text: `改写稿 ${id.slice(-4)}`, textRevision: { summary: '换了场景', content: `改写稿 ${id.slice(-4)}` } } }));
  const settings = await openOrig(script, true);
  fireEvent.click(within(settings).getByRole('button', { name: '视频裂变' }));
  fireEvent.click(within(more()).getByRole('radio', { name: /AI 改写/ }));
  await act(async () => { fireEvent.click(within(more()).getByRole('button', { name: /写 2 版脚本/ })); });
  await waitFor(() => expect(api.submit).toHaveBeenCalledTimes(2));
  const requests = api.submit.mock.calls.map(call => call[1]);
  requests.forEach((r, i) => expect(r).toMatchObject({ operation: 'text', textEdit: { content: script }, model: 'text', maxCost: 21,
    scene: { kind: 'video-script', sceneId: 'ecom-talking', duration: 40, ratio: '9:16', visual: false, variant: { index: i + 1, total: 2, changes: [] } } }));
  expect(requests[0].readVisuals).toBeUndefined();
  const doc = () => store.get('IPP-V')!.doc;
  const takeRows = () => (doc().nodes as any[]).filter(n => n.metadata?.studio?.sceneTake?.kind === 'rewrite');
  expect(takeRows()).toHaveLength(2);
  expect(takeRows().every(n => !n.metadata.studio.sceneDirector)).toBe(true);
  // 写好之后能看，再点生成；交出去的是改写稿。
  await waitFor(() => expect(within(more()).getByRole('button', { name: /生成 2 条/ })).toBeTruthy(), { timeout: 4000 });
  await act(async () => { fireEvent.click(within(more()).getByRole('button', { name: /生成 2 条/ })); });
  await waitFor(() => expect(api.start).toHaveBeenCalledTimes(2));
  const texts = api.start.mock.calls.map(call => call[1].text);
  expect(texts.every(t => t.startsWith('改写稿'))).toBe(true);
  expect(acceptedTasks.get('PEX-1').input.take).toMatchObject({ of: 'PEX-orig', mode: 'rewrite' });
});

test('视频裂变 · 找变量 asks only for the script and does not attach pictures', async () => {
  api.submit.mockResolvedValue({ id: 'run-vars', status: 'running', output: {} });
  api.readRun.mockResolvedValue({ id: 'run-vars', status: 'running', output: {} });
  const settings = await openOrig('宝妈在厨房里试用', true);
  fireEvent.click(within(settings).getByRole('button', { name: '视频裂变' }));
  fireEvent.click(within(more()).getByRole('radio', { name: /换变量/ }));
  await act(async () => { fireEvent.click(within(more()).getByRole('button', { name: '找变量' })); });
  await waitFor(() => expect(api.submit).toHaveBeenCalledOnce());
  expect(api.submit.mock.calls[0][1]).toMatchObject({ operation: 'text', textEdit: { content: '宝妈在厨房里试用' },
    scene: { kind: 'video-variables', sceneId: 'ecom-talking', duration: 40, ratio: '9:16' } });
  expect(api.submit.mock.calls[0][1].contextNodeIds).toBeUndefined();
  expect(more().textContent).toContain('正在从脚本里找');
});
