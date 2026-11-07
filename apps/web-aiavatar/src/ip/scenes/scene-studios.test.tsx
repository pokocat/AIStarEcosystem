// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { IpProject } from "@ai-star-eco/types";
// 用服务端那份真目录（ipstudio/scenes.json），不另写样本。
const SCENES = JSON.parse(readFileSync(join(__dirname, "../../../../server/src/main/resources/ipstudio/scenes.json"), "utf8"));

const api = vi.hoisted(() => ({
  push: vi.fn(), failure: vi.fn(), taskStart: vi.fn(), taskGet: vi.fn(), ask: vi.fn(), signKeys: vi.fn(),
  uploadImage: vi.fn(), listProjects: vi.fn(), createProject: vi.fn(), updateProject: vi.fn(), getProject: vi.fn(), listScenes: vi.fn(), composeScene: vi.fn(),
  fetchModels: vi.fn(), readRun: vi.fn(), cancelRun: vi.fn(), capabilities: vi.fn(), submit: vi.fn(), importMedia: vi.fn(), videoModels: vi.fn(), videoPrice: vi.fn(),
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
vi.mock("@/canvas-bridge/studio-video-tasks", async original => ({ ...await original<any>(),
  videoTasks: async () => ({ items: [], page: 0, hasMore: false }), videoTask: api.taskGet,
  videoTaskPrice: async (q: any) => ({ estimated: q.duration * 40, cap: q.duration * 120, segments: [q.duration], boards: 0 }),
  prepareVideoTask: async (_id: string, request: any) => request, startVideoTask: api.taskStart,
}));
vi.mock("@/canvas-bridge/studio-image-file", () => ({ prepareStudioImageUpload: async (f: File) => f }));
vi.mock("../studio-credit-shortage", () => ({ askStudioCreditShortage: api.ask }));
vi.mock("@/canvas-bridge/studio-model-quote", () => ({ quoteVideoPrice: api.videoPrice }));
vi.mock("../studio-errors", async importOriginal => ({ ...(await importOriginal<typeof import("../studio-errors")>()), useStudioFailure: () => api.failure, studioErrorMetadata: () => ({}) }));
vi.mock("../library-reference-picker", () => import("./scene-test-picker"));
vi.mock("../studio-select", () => ({ StudioSelect: ({ label, value, onChange, options }: any) =>
  <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select> }));
import { SceneImageStudio } from "./scene-image-studio";
import { SceneVideoStudio } from "./scene-video-studio";
import { confirmLibrary, openLibrary, openRecent, openSpec, optionGroup, pickFromLibrary, pickScene, setDuration, fieldText, fillField } from "./scene-test-helpers";
import { setLibrarySource } from "./scene-test-picker";
// 素材从资产库选：选中的那份按各测试原来设定的上传结果来（视频页设了 importMedia 就用它，否则用 uploadImage）。
beforeEach(() => { setLibrarySource(async () => (await api.importMedia()) ?? (await api.uploadImage())); });

const doc = { nodes: [], connections: [], viewport: { x: 0, y: 0, k: 1 } };
const project = (patch: Partial<IpProject> = {}): IpProject => ({ id: "IPP-1", name: "x", status: "draft", createdAt: "", updatedAt: "", doc, runs: {}, runsById: {}, docVersion: "v1", ...patch });

beforeEach(() => {
  api.taskStart.mockImplementation(async (projectId: string, request: any) => {
    if (request.kind === 'direct') await api.submit(projectId, request.video);
    const task = { id: 'PEX-task', projectId, ...request, request, createdAt: '2026-11-06',
      execution: { id: 'PEX-task', projectId, stage: 'production', status: 'running', budgets: [],
        steps: [{ id: 'video', title: '生成视频', operation: 'video', status: 'running', stage: 'production', attempt: 1, runIds: [], dependsOn: [] }], updatedAt: '2026-11-06' } };
    api.taskGet.mockResolvedValue(task); return task;
  });
  api.signKeys.mockImplementation(async (keys: string[]) => Object.fromEntries(keys.map(key => [key, `https://cdn/${key}`])));
  api.listScenes.mockResolvedValue(SCENES);
  api.listProjects.mockResolvedValue([]);
  api.createProject.mockImplementation(async ({ name, sceneId }: { name: string; sceneId?: string }) => project({ name, sceneId }));
  api.updateProject.mockImplementation(async (_id: string, { doc: next }: { doc: IpProject["doc"] }) => project({ doc: next, docVersion: "v2" }));
  api.uploadImage.mockResolvedValue({ key: "ipstudio/source/u/p.jpg", url: "blob:p", fileName: "p.jpg" });
  api.fetchModels.mockResolvedValue({ image: [{ endpointId: "ep-img", name: "图片模型", isDefault: true, creditCost: 8, billingUnit: "per_call", capability: null }], video: [] });
  api.capabilities.mockResolvedValue({ mock: false, operations: [], imageCost: 8, textCost: 1, videoCost: null });
  api.submit.mockResolvedValue({ id: "IPR-1", status: "running", output: {} });
  // 按钮旁的服务端报价默认报不出来：页面用本地价表价（其它测试照旧按价表核对）。
  api.videoPrice.mockRejectedValue(new Error("offline"));
  api.readRun.mockResolvedValue({ id: "IPR-1", status: "done", output: { candidates: [{ key: "ipstudio_gen/out.jpg", url: "https://cdn/out.jpg" }] } });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState(null, "", "/"); });


test("图片：没放必填参考图时按钮直接写缺什么；放好后先把请求写进画布再提交，描述是场景描述加补充要求，结果回到页面", async () => {
  window.history.replaceState(null, "", "/image?scene=white-background");
  await act(async () => { render(<SceneImageStudio/>); });
  const go = () => screen.getByRole("button", { name: "生成图片" }) as HTMLButtonElement;
  await waitFor(() => expect(screen.getByText("请添加商品")).toBeTruthy());
  expect(go().disabled).toBe(true);
  // 一大段场景描述不摆出来：只有场景标签和补充要求输入框。
  expect(screen.queryByRole("textbox", { name: "完整描述" })).toBeNull();
  fillField(screen.getByRole("textbox", { name: "补充要求" }), "45 度角");
  // 选项组照参考站：点选，不用写字；默认是「主图加多角度」。
  const angle = within(optionGroup("出图方式"));
  expect(angle.getByRole("button", { name: "主图加多角度" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(angle.getByRole("button", { name: "俯拍" }));
  api.composeScene.mockResolvedValue({ text: "服务端拼好的白底图描述\n补充要求：45 度角" });

  await pickFromLibrary();
  await waitFor(() => expect(go().textContent).toContain("8 积分"));
  await act(async () => { fireEvent.click(go()); });
  // 描述由服务端按场景拼：只交场景编号、补充要求和放了图的位置。
  expect(api.composeScene).toHaveBeenCalledWith({ kind: "image", sceneId: "white-background", text: "45 度角", refCounts: [1], options: { angle: "top" } });
  expect(api.createProject).toHaveBeenCalledWith({ name: "商品白底图", sceneId: "white-background" });
  const request = api.submit.mock.calls[0][1];
  expect(request).toMatchObject({ operation: "image", aspectRatio: "16:9", count: 1, model: "ep-img", maxCost: 8,
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
    ? { id, status: "done", kind: "studio-text", inputs: api.submit.mock.calls[0][1], output: { textRevision: { summary: "先讲干皮的烦恼", content: script },
        billing: { inputTokens: 900, outputTokens: 300, credits: 2, inputCreditsPerK: 1, outputCreditsPerK: 1 } } }
    : { id, status: "running", output: {} });
  await act(async () => { render(<SceneVideoStudio/>); });
  const send = () => screen.getByRole("button", { name: "生成脚本" }) as HTMLButtonElement;
  await waitFor(() => expect(screen.getByText("请添加商品图")).toBeTruthy());
  fillField(screen.getByRole("textbox", { name: "想做的视频" }), "保湿精华，不黏腻");
  // 连着点两组选项：后一次不能把前一次盖掉。
  optionGroup("出镜方式");
  act(() => {
    fireEvent.click(within(optionGroup("出镜方式")).getByRole("button", { name: "只拍商品" }));
    fireEvent.click(within(optionGroup("语气")).getByRole("button", { name: "专业讲解" }));
  });
  await pickFromLibrary();
  expect(api.createProject).toHaveBeenCalledWith({ name: "口播带货 · 保湿精华", sceneId: "ecom-talking" });
  // 默认 25 秒超过模型上限：先按模型最长 15 秒出，拖到上限以外才分段交给助手。
  expect(screen.getByRole("button", { name: /^视频规格：/ }).textContent).toContain("15 秒");
  // 点「AI 编导」只是换到编导那一页：还没开始，想法带过来，能调时长（2026-11-04 用户反馈）。
  fireEvent.click(screen.getByRole("button", { name: "AI 编导" }));
  await waitFor(() => expect(fieldText("想做的视频")).toBe("保湿精华，不黏腻"));
  expect(api.submit).not.toHaveBeenCalled();
  expect(screen.getByRole("group", { name: "常用开头" })).toBeTruthy();
  await waitFor(() => expect(send().disabled).toBe(false));
  await act(async () => { fireEvent.click(send()); });

  // 编导的话由服务端按提示词库拼：请求带场景输入，prompt 只是显示用的那句（docs/studio-prompt-architecture.md §5.1）。
  expect(api.composeScene).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "video-script" }));
  const textRequest = api.submit.mock.calls[0][1];
  expect(textRequest).toMatchObject({ operation: "text", prompt: "保湿精华，不黏腻", textEdit: { content: "" }, readVisuals: true, model: "ep-qwen", maxCost: 21,
    scene: { kind: "video-script", sceneId: "ecom-talking", text: "保湿精华，不黏腻", imageTitles: ["商品图 1"], duration: 15, ratio: "9:16", language: "中文",
      options: { presenter: "product", tone: "expert" } } });
  // 上传完就存进草稿（刷新后素材还在）；写脚本那次保存里请求已经在节点上，之后才提交。
  expect(api.updateProject.mock.calls[0][1].doc.nodes.map((n: any) => n.title)).toEqual(["商品图 1"]);
  const scriptSave = api.updateProject.mock.calls.findIndex((c: any) => c[1].doc.nodes.some((n: any) => n.id === textRequest.nodeId));
  const saved = api.updateProject.mock.calls[scriptSave][1].doc;
  const image = saved.nodes.find((n: any) => n.title === "商品图 1");
  expect(textRequest.contextNodeIds).toEqual([image.id]);
  expect(saved.nodes.filter((n: any) => n.title === "商品图 1")).toHaveLength(1);
  expect(saved.nodes.find((n: any) => n.id === textRequest.nodeId)?.metadata?.studio?.request).toEqual(textRequest);
  expect(api.updateProject.mock.invocationCallOrder[scriptSave]).toBeLessThan(api.submit.mock.invocationCallOrder[0]);

  const use = await screen.findByRole("button", { name: "采用脚本" }, { timeout: 4000 });
  expect(screen.getByText(/干皮看过来/)).toBeTruthy();
  await act(async () => { fireEvent.click(use); });
  expect(fieldText("视频脚本")).toBe(script);
  setDuration(10);
  const go = screen.getByRole("button", { name: "生成视频" }) as HTMLButtonElement;
  await waitFor(() => expect(go.textContent).toContain("400 积分"));
  // 优化描述单独按用量扣、不含在视频价里，用户可以选按原文生成（只扣视频价）。
  const rewrite = within(screen.getByRole("group", { name: "提示词" }));
  expect(rewrite.getByText(/按实际用量另计/)).toBeTruthy();
  fireEvent.click(rewrite.getByRole("button", { name: "按原文生成" }));
  expect(rewrite.queryByText(/按实际用量另计/)).toBeNull();
  fireEvent.click(rewrite.getByRole("button", { name: "优化后生成" }));
  await waitFor(() => expect(go.disabled).toBe(false));
  await act(async () => { fireEvent.click(go); });
  const videoRequest = api.submit.mock.calls[1][1];
  expect(videoRequest).toMatchObject({ operation: "video", prompt: script, durationSec: 10, aspectRatio: "9:16", count: 1, model: "ep-h3", maxCost: 400,
    video: { mode: "universal_reference_video", resolutionTier: "768p", rewrite: "auto", references: [{ mediaType: "image", key: "ipstudio/media/u/p.jpg" }] } });
  expect(await screen.findByRole("heading", { name: "正在生成视频" })).toBeTruthy();
});

test("video: AI 编导 opens the page without starting; the duration set there is what the first script is written for, and an idea only fills the box", async () => {
  window.history.replaceState(null, "", "/video?scene=ecom-talking");
  api.capabilities.mockResolvedValue({ mock: false, operations: [], imageCost: 8, textCost: 1, videoCost: null,
    textModels: [{ endpointId: "ep-qwen", name: "Qwen", isDefault: true, supportsVision: true, tokenPricing: { maxCost: 21 } }] });
  api.videoModels.mockResolvedValue([H3]);
  api.importMedia.mockResolvedValue({ key: "ipstudio/media/u/p.jpg", url: "blob:p", mediaType: "image", mimeType: "image/jpeg", bytes: 1, fileName: "p.jpg", width: 800, height: 800 });
  api.submit.mockImplementation(async () => ({ id: "IPR-s", status: "running", output: {} }));
  api.readRun.mockResolvedValue({ id: "IPR-s", status: "running", output: {} });
  await act(async () => { render(<SceneVideoStudio/>); });
  // 什么都没放也能进去；缺的就地说，发送键点不了。
  fireEvent.click(await screen.findByRole("button", { name: "AI 编导" }));
  const go = () => screen.getByRole("button", { name: "生成脚本" }) as HTMLButtonElement;
  expect(screen.getByText("想做一条什么视频？")).toBeTruthy();
  expect(screen.getByText("请添加商品图")).toBeTruthy();
  expect(go().disabled).toBe(true);
  expect(api.createProject).not.toHaveBeenCalled();
  // 常用开头只进输入框，不发送；再点一次不重复。
  fireEvent.click(within(screen.getByRole("group", { name: "常用开头" })).getByRole("button", { name: "开头先说这东西适合谁" }));
  fireEvent.click(within(screen.getByRole("group", { name: "常用开头" })).getByRole("button", { name: "开头先说这东西适合谁" }));
  await waitFor(() => expect(fieldText("想做的视频")).toBe("开头先说这东西适合谁"));
  await pickFromLibrary();
  setDuration(10);
  expect(api.submit).not.toHaveBeenCalled();
  await waitFor(() => expect(go().disabled).toBe(false));
  await act(async () => { fireEvent.click(go()); });
  await waitFor(() => expect(api.submit).toHaveBeenCalledTimes(1));
  expect(api.submit.mock.calls[0][1].scene).toMatchObject({ kind: "video-script", text: "开头先说这东西适合谁", duration: 10 });
  // 开始之后这一页是改稿的输入框，开场那一块收起来。
  expect(await screen.findByRole("textbox", { name: "修改意见" })).toBeTruthy();
  expect(screen.queryByText("想做一条什么视频？")).toBeNull();
  // 想法还在编辑框里。
  fireEvent.click(screen.getByRole("button", { name: "返回编辑" }));
  await waitFor(() => expect(fieldText("想做的视频")).toBe("开头先说这东西适合谁"));
});

test("视频：按钮旁的价按服务端报价显示折扣（原价划掉）；报价不带素材 key 和提示词；换时长后慢回来的旧报价不会盖住新选择", async () => {
  window.history.replaceState(null, "", "/video?scene=ecom-talking");
  api.capabilities.mockResolvedValue({ mock: false, operations: [], imageCost: 8, textCost: 1, videoCost: null });
  api.videoModels.mockResolvedValue([H3]);
  const priced = (seconds: number) => ({ standardCredits: 40 * seconds, discountCredits: 20 * seconds, payableCredits: 20 * seconds, scopedCredits: 0,
    walletCredits: 20 * seconds, discountName: "H3限时折扣", canAfford: true });
  let late: (() => void) | undefined;
  api.videoPrice.mockImplementation((q: { durationSec: number }) => q.durationSec === 10
    ? new Promise(resolve => { late = () => resolve(priced(10)); }) : Promise.resolve(priced(q.durationSec)));
  await act(async () => { render(<SceneVideoStudio/>); });
  const go = () => screen.getByRole("button", { name: "生成视频" });
  // 还没写字、没放图也看得到折后价。
  await waitFor(() => expect(go().querySelector("s")?.textContent).toContain("600"));
  expect(go().textContent).toContain("300 积分");
  // 折后价已经划掉原价，折扣只放悬停提示；普通视频价格确定，不写上限。
  expect(go().querySelector("small")?.title).toBe("H3限时折扣，省 300 积分");
  expect(screen.getByText("优化提示词按实际用量另计。")).toBeTruthy();
  expect(screen.queryByText(/最多 .*积分|本次上限|限时折扣/)).toBeNull();
  const [query, billing] = api.videoPrice.mock.calls.at(-1)!;
  expect(query).toMatchObject({ model: "ep-h3", tier: "768p", aspectRatio: "9:16", durationSec: 15 });
  expect(billing).toEqual({ mode: "personal" });
  expect(JSON.stringify(query)).not.toMatch(/prompt|ipstudio\//);
  expect(api.submit).not.toHaveBeenCalled();

  setDuration(10); // 10 秒那份很慢：先显示价表价，不沿用 15 秒的折扣
  await waitFor(() => expect(go().textContent).toContain("400 积分"));
  expect(go().querySelector("s")).toBeNull();
  setDuration(12);
  await waitFor(() => expect(go().textContent).toContain("240 积分"));
  await act(async () => { late?.(); });
  expect(go().textContent).toContain("240 积分");
  expect(go().querySelector("s")?.textContent).toContain("480");
});

test("视频：爆款复刻直接受理后台任务，保留原片与要求，不跳画布", async () => {
  window.history.replaceState(null, "", "/video?scene=recreation");
  api.videoModels.mockResolvedValue([H3]);
  api.importMedia.mockResolvedValue({ key: "ipstudio/media/u/v.mp4", url: "blob:v", mediaType: "video", mimeType: "video/mp4", bytes: 1, fileName: "v.mp4" });
  await act(async () => { render(<SceneVideoStudio/>); });
  const send = () => screen.getByRole("button", { name: "生成视频" }) as HTMLButtonElement;
  await waitFor(() => expect(screen.getByText("请添加参考视频")).toBeTruthy());
  await pickFromLibrary("参考视频");
  fillField(screen.getByRole("textbox", { name: "想做的视频" }), "换成我的面霜");
  await waitFor(() => expect(send().disabled).toBe(false));
  await act(async () => { fireEvent.click(send()); });
  expect(api.taskStart).toHaveBeenCalledWith("IPP-1", expect.objectContaining({ kind: "recreation", sourceNodeId: expect.any(String),
    configuration: expect.objectContaining({ sceneId: "recreation", text: "换成我的面霜" }),
    input: expect.objectContaining({ nodes: expect.arrayContaining([expect.objectContaining({ type: "video", metadata: expect.objectContaining({ storageKey: "ipstudio/media/u/v.mp4" }) })]) }) }));
  expect(api.composeScene).not.toHaveBeenCalled(); expect(api.push).not.toHaveBeenCalled();
  expect(api.submit).not.toHaveBeenCalled(); expect(window.location.search).toContain("task=PEX-task");
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

test("图片设置：选张数时焦点留在选中的按钮上；Esc 关掉面板，焦点回到「图片设置」；结果标签能用方向键切换", async () => {
  window.history.replaceState(null, "", "/image?scene=white-background");
  await act(async () => { render(<SceneImageStudio/>); });
  const trigger = await screen.findByRole("button", { name: /图片设置/ });
  fireEvent.click(trigger);
  const panel = within(screen.getByRole("group", { name: "图片设置" }));
  const four = panel.getByRole("button", { name: "4 张" });
  four.focus();
  fireEvent.click(four);
  // 2026-10-30 线上复核：点完 4 张焦点跳回了比例那一格。
  expect(document.activeElement).toBe(panel.getByRole("button", { name: "4 张" }));
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(screen.queryByRole("group", { name: "图片设置" })).toBeNull();
  expect(document.activeElement).toBe(trigger);

  const example = screen.getByRole("tab", { name: "示例" });
  expect(example.getAttribute("aria-selected")).toBe("true");
  expect(example.tabIndex).toBe(0);
  expect(screen.getByRole("tab", { name: /作品/ }).tabIndex).toBe(-1);
  example.focus();
  fireEvent.keyDown(example, { key: "ArrowLeft" });
  const results = screen.getByRole("tab", { name: /作品/ });
  expect(results.getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(results);
  expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(results.id);
  fireEvent.keyDown(results, { key: "End" });
  expect(screen.getByRole("tab", { name: "示例" }).getAttribute("aria-selected")).toBe("true");
});

test("「最近」读失败：写明加载失败并能重试，不显示成空列表", async () => {
  window.history.replaceState(null, "", "/image?scene=white-background");
  api.listProjects.mockRejectedValueOnce(new Error("网络断了"));
  await act(async () => { render(<SceneImageStudio/>); });
  const recent = await openRecent();
  expect(await recent.findByText("草稿加载失败")).toBeTruthy();
  expect(recent.queryByText("暂无草稿。")).toBeNull();
  api.listProjects.mockResolvedValueOnce([]);
  await act(async () => { fireEvent.click(recent.getByRole("button", { name: "重试" })); });
  expect(await recent.findByText("暂无草稿。")).toBeTruthy();
  expect(recent.queryByText("草稿加载失败")).toBeNull();
});

// ── 积分不足（提示框的内容见 studio-credit-shortage.test.tsx，这里看页面怎么收尾）────────
const shortageCancel = (choice: unknown) => Object.assign(new Error("本次生成已取消，未提交任务。"), { code: "STUDIO_BILLING_CANCELLED", status: 400, creditShortage: choice });
const twoImageModels = { image: [{ endpointId: "ep-img", name: "图片模型", isDefault: true, creditCost: 8, billingUnit: "per_call", capability: null },
  { endpointId: "ep-grant", name: "有赠款的模型", isDefault: false, creditCost: 40, billingUnit: "per_call", capability: null }], video: [] };
const readyToGenerate = async () => {
  window.history.replaceState(null, "", "/image?scene=white-background");
  api.composeScene.mockResolvedValue({ text: "白底图" });
  await act(async () => { render(<SceneImageStudio/>); });
  // 资产库按钮出现后再选图；不依赖必填提示的具体文案。
  await pickFromLibrary();
  const button = () => screen.getByRole("button", { name: "生成图片" }) as HTMLButtonElement;
  await waitFor(() => expect(button().disabled).toBe(false));
  return button;
};
const savedRows = () => {
  const calls = api.updateProject.mock.calls;
  return calls[calls.length - 1][1].doc.nodes.filter((n: any) => n.metadata?.studio?.request);
};

test("图片：积分不足点「返回修改」，不留失败记录、不弹错误、输入还在", async () => {
  api.fetchModels.mockResolvedValue(twoImageModels);
  api.submit.mockRejectedValueOnce(shortageCancel({ kind: "close" }));
  const button = await readyToGenerate();
  fillField(screen.getByRole("textbox", { name: "补充要求" }), "45 度角");
  await act(async () => { fireEvent.click(button()); });
  await waitFor(() => expect(savedRows()).toHaveLength(0));
  expect(api.failure).not.toHaveBeenCalled();
  expect(api.submit).toHaveBeenCalledTimes(1);
  expect(fieldText("补充要求")).toBe("45 度角");
  // 提示框知道这个页面能换哪些模型，标准价按现在的张数算。
  expect(api.submit.mock.calls[0][2]).toMatchObject({ canRetry: true, modelChoices: [{ endpointId: "ep-img", cost: 8 }, { endpointId: "ep-grant", cost: 40 }] });
});

test("图片：提示框里改用另一个模型，选择器跟着换，并按新模型再提交一次（新的请求和报价）", async () => {
  api.fetchModels.mockResolvedValue(twoImageModels);
  api.submit.mockRejectedValueOnce(shortageCancel({ kind: "switch-model", endpointId: "ep-grant", name: "有赠款的模型" }));
  const button = await readyToGenerate();
  await act(async () => { fireEvent.click(button()); });
  await waitFor(() => expect(api.submit).toHaveBeenCalledTimes(2));
  const [first, second] = api.submit.mock.calls.map((c: any) => c[1]);
  expect(first).toMatchObject({ model: "ep-img", maxCost: 8 });
  expect(second).toMatchObject({ model: "ep-grant", maxCost: 40 });
  expect(second.clientRequestId).not.toBe(first.clientRequestId);
  expect(second.nodeId).not.toBe(first.nodeId);
  expect((screen.getByLabelText("图片模型") as HTMLSelectElement).value).toBe("ep-grant");
  expect(api.failure).not.toHaveBeenCalled();
});

test("图片：充值后点「继续生成」，同一个模型再提交一次", async () => {
  api.submit.mockRejectedValueOnce(shortageCancel({ kind: "retry" }));
  const button = await readyToGenerate();
  await act(async () => { fireEvent.click(button()); });
  await waitFor(() => expect(api.submit).toHaveBeenCalledTimes(2));
  expect(api.submit.mock.calls[1][1]).toMatchObject({ model: "ep-img", maxCost: 8 });
});

test("图片：确认原任务时积分不足，这条转成可以重新生成的失败记录，不再要求确认", async () => {
  api.submit.mockRejectedValueOnce(Object.assign(new Error("网络中断"), { code: "NETWORK_ERROR" }));
  const button = await readyToGenerate();
  await act(async () => { fireEvent.click(button()); });
  const confirm = await screen.findByRole("button", { name: "确认原任务" });
  api.submit.mockRejectedValueOnce(shortageCancel({ kind: "close" }));
  await act(async () => { fireEvent.click(confirm); });
  await waitFor(() => expect(savedRows()[0].metadata).toMatchObject({ status: "error", errorDetails: "积分不足，未提交" }));
  expect(screen.queryByRole("button", { name: "确认原任务" })).toBeNull();
});

test("图片：换过去规格会变时只换模型，不自动提交", async () => {
  api.fetchModels.mockResolvedValue(twoImageModels);
  api.submit.mockRejectedValueOnce(shortageCancel({ kind: "switch-model", endpointId: "ep-grant", name: "有赠款的模型", changes: "比例将改为 1:1" }));
  const button = await readyToGenerate();
  await act(async () => { fireEvent.click(button()); });
  await waitFor(() => expect((screen.getByLabelText("图片模型") as HTMLSelectElement).value).toBe("ep-grant"));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
  expect(api.submit).toHaveBeenCalledTimes(1);
});

test("图片：提示框知道换过去的实际规格和价格，比例不支持时写进 changes", async () => {
  api.fetchModels.mockResolvedValue({ image: [{ endpointId: "ep-img", name: "图片模型", isDefault: true, creditCost: 8, billingUnit: "per_call", capability: null },
    { endpointId: "ep-square", name: "只出方图", isDefault: false, creditCost: 10, billingUnit: "per_call", capability: { imageRatios: ["1:1"], imageBatchCounts: [1] } }], video: [] });
  api.submit.mockRejectedValueOnce(shortageCancel({ kind: "close" }));
  window.history.replaceState(null, "", "/image?scene=free");
  api.composeScene.mockResolvedValue({ text: "画面" });
  await act(async () => { render(<SceneImageStudio/>); });
  fillField(await screen.findByRole("textbox", { name: "想要的画面" }), "一只猫");
  const go = () => screen.getByRole("button", { name: "生成图片" }) as HTMLButtonElement;
  await waitFor(() => expect(go().disabled).toBe(false));
  await act(async () => { fireEvent.click(go()); });
  const choices = api.submit.mock.calls[0][2].modelChoices;
  expect(choices[0]).toMatchObject({ endpointId: "ep-img", changes: "" });
  expect(choices[1]).toMatchObject({ endpointId: "ep-square", cost: 10 });
  expect(choices[1].changes).toBeTruthy();
});

test("图片：提示框开着时换了草稿，用户的选择不作用到别的草稿上", async () => {
  api.fetchModels.mockResolvedValue(twoImageModels);
  let refuse!: (e: unknown) => void;
  api.submit.mockImplementationOnce(() => new Promise((_, reject) => { refuse = reject; }));
  const button = await readyToGenerate();
  await act(async () => { fireEvent.click(button()); });
  await waitFor(() => expect(api.submit).toHaveBeenCalledTimes(1));
  // 付款询问还开着，用户点了「新建」，页面上已经是另一份空草稿。
  fireEvent.click(screen.getByRole("button", { name: "新建" }));
  await act(async () => { refuse(shortageCancel({ kind: "switch-model", endpointId: "ep-grant", name: "有赠款的模型" })); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
  expect(api.submit).toHaveBeenCalledTimes(1);
  expect((screen.getByLabelText("图片模型") as HTMLSelectElement).value).toBe("ep-img");
});

test("图片：提示框选完、撤销保存还没结束时换了草稿，选择也不作用到新草稿", async () => {
  api.fetchModels.mockResolvedValue(twoImageModels);
  const button = await readyToGenerate();
  // 撤销那次保存卡住：提交被拒之后的第一次保存，等测试放行才结束。
  let release!: () => void;
  const realUpdate = api.updateProject.getMockImplementation();
  api.submit.mockImplementationOnce(async () => {
    api.updateProject.mockImplementationOnce(async (...args: unknown[]) => { await new Promise<void>(resolve => { release = resolve; }); return realUpdate!(...args as [string, { doc: IpProject["doc"] }]); });
    throw shortageCancel({ kind: "switch-model", endpointId: "ep-grant", name: "有赠款的模型" });
  });
  await act(async () => { fireEvent.click(button()); });
  await waitFor(() => expect(release).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "新建" }));
  await act(async () => { release(); await new Promise(resolve => setTimeout(resolve, 50)); });
  expect(api.submit).toHaveBeenCalledTimes(1);
  expect((screen.getByLabelText("图片模型") as HTMLSelectElement).value).toBe("ep-img");
});

test("图片：换过去的尺寸按页面真实规则算，不提前挑一个页面不会用的同清晰度尺寸", async () => {
  api.fetchModels.mockResolvedValue({ image: [{ endpointId: "ep-img", name: "图片模型", isDefault: true, creditCost: 8, billingUnit: "per_call",
      capability: { imageRatios: ["3:4"], imageSizes: [{ size: "768x1024", aspectRatio: "3:4" }] }, imageResolutionCosts: { "1K": 8, "2K": 20 } },
    { endpointId: "ep-other", name: "别的模型", isDefault: false, creditCost: 8, billingUnit: "per_call",
      capability: { imageRatios: ["3:4"], imageSizes: [{ size: "1536x2048", aspectRatio: "3:4" }, { size: "864x1152", aspectRatio: "3:4" }] }, imageResolutionCosts: { "1K": 8, "2K": 20 } }], video: [] });
  api.submit.mockRejectedValueOnce(shortageCancel({ kind: "close" }));
  window.history.replaceState(null, "", "/image?scene=free");
  api.composeScene.mockResolvedValue({ text: "画面" });
  await act(async () => { render(<SceneImageStudio/>); });
  fillField(await screen.findByRole("textbox", { name: "想要的画面" }), "一只猫");
  const go = () => screen.getByRole("button", { name: "生成图片" }) as HTMLButtonElement;
  await waitFor(() => expect(go().disabled).toBe(false));
  await act(async () => { fireEvent.click(go()); });
  const other = api.submit.mock.calls[0][2].modelChoices.find((c: any) => c.endpointId === "ep-other");
  // 页面的规则：当前尺寸没有就退到第一项（1536x2048，2K），不是同清晰度的 864x1152。
  expect(other.quotePatch).toEqual({ size: "1536x2048" });
  expect(other.cost).toBe(20);
  expect(other.changes).toBeTruthy();
});

// AI 视频直接出片：任务受理后才异步执行，积分不够只能在受理前问（提示框的内容见 studio-credit-shortage.test.tsx）。
const POOR = { target: { appCode: "aiavatar", action: "video", endpointId: "ep-h3", providerModel: "h3", specKey: "768p", unit: "second" }, standardCredits: 600, discountCredits: 0, payableCredits: 600,
  scopedCredits: 0, walletCredits: 600, canAfford: false, unavailableCode: "MODEL_CREDITS_INSUFFICIENT" };
const readyDirect = async () => {
  window.history.replaceState(null, "", "/video?scene=drama-dialogue");
  api.videoModels.mockResolvedValue([H3, { ...H3, endpointId: "ep-grant", name: "有赠款的视频模型", isDefault: false }]);
  api.videoPrice.mockResolvedValue(POOR);
  await act(async () => { render(<SceneVideoStudio/>); });
  fillField(await screen.findByRole("textbox", { name: "想做的视频" }), "两个人在咖啡店对话");
  const go = () => screen.getByRole("button", { name: "生成视频" }) as HTMLButtonElement;
  await waitFor(() => expect(go().disabled).toBe(false));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
  return go;
};

test("视频：积分不够时受理前就弹提示框，不建任务；「改用」只换模型，看过价再点，不自动开始花钱", async () => {
  api.ask.mockResolvedValueOnce({ kind: "switch-model", endpointId: "ep-grant", name: "有赠款的视频模型" });
  const go = await readyDirect();
  await act(async () => { fireEvent.click(go()); });
  await waitFor(() => expect(api.ask).toHaveBeenCalledTimes(1));
  const input = api.ask.mock.calls[0][0];
  expect(input.quote).toBe(POOR);
  expect(input.modelChoices.find((c: any) => c.endpointId === "ep-grant")).toMatchObject({ extraCharge: expect.any(String), quotePatch: { durationSec: expect.any(Number) } });
  await waitFor(() => expect((screen.getByLabelText("视频模型") as HTMLSelectElement).value).toBe("ep-grant"));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
  expect(api.taskStart).not.toHaveBeenCalled();
  expect(api.failure).not.toHaveBeenCalled();
  // 候选按它自己的规格问服务端，不带素材 key 和提示词。
  api.videoPrice.mockClear();
  await input.verifyChoice("ep-grant", { video: { mode: "t2v", resolutionTier: "768p" }, durationSec: 10 });
  expect(api.videoPrice.mock.calls[0][0]).toMatchObject({ model: "ep-grant", tier: "768p", durationSec: 10 });
});

test("视频：充值回来点「继续生成」，同一个模型重新核对后才建任务", async () => {
  api.ask.mockImplementationOnce(async () => { api.videoPrice.mockResolvedValue({ ...POOR, canAfford: true, unavailableCode: undefined }); return { kind: "retry" }; });
  const go = await readyDirect();
  await act(async () => { fireEvent.click(go()); });
  await waitFor(() => expect(api.taskStart).toHaveBeenCalledTimes(1), { timeout: 3000 });
  expect(api.ask).toHaveBeenCalledTimes(1);
  expect(api.taskStart.mock.calls[0][1]).toMatchObject({ kind: "direct", video: { model: "ep-h3" } });
});

test("视频：报价读不到不拦生成，由服务端和任务面板说话", async () => {
  const go = await readyDirect();
  api.videoPrice.mockRejectedValue(new Error("网络中断"));
  await act(async () => { fireEvent.click(go()); });
  await waitFor(() => expect(api.taskStart).toHaveBeenCalledTimes(1));
  expect(api.ask).not.toHaveBeenCalled();
});
