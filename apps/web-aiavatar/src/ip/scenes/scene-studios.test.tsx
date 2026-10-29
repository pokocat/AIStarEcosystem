// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { IpProject } from "@ai-star-eco/types";

const api = vi.hoisted(() => ({
  push: vi.fn(), failure: vi.fn(),
  uploadImage: vi.fn(), listProjects: vi.fn(), createProject: vi.fn(), updateProject: vi.fn(), getProject: vi.fn(),
  fetchModels: vi.fn(), readRun: vi.fn(), cancelRun: vi.fn(), capabilities: vi.fn(), submit: vi.fn(), importMedia: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push, replace: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, ...p }: any) => <a {...p}>{children}</a> }));
vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => null }));
vi.mock("@/components/hub/ui", () => ({ HubTabBar: () => null }));
vi.mock("../api", () => ({ IpStudioApi: { uploadImage: api.uploadImage, listProjects: api.listProjects, createProject: api.createProject, updateProject: api.updateProject, getProject: api.getProject } }));
vi.mock("@/canvas-bridge/api", () => ({ fetchModels: api.fetchModels, readRun: api.readRun, cancelRun: api.cancelRun }));
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
  api.listProjects.mockResolvedValue([]);
  api.createProject.mockImplementation(async ({ name }: { name: string }) => project({ name }));
  api.updateProject.mockImplementation(async (_id: string, { doc: next }: { doc: IpProject["doc"] }) => project({ doc: next, docVersion: "v2" }));
  api.uploadImage.mockResolvedValue({ key: "ipstudio/source/u/p.jpg", url: "blob:p", fileName: "p.jpg" });
  api.fetchModels.mockResolvedValue({ image: [{ endpointId: "ep-img", name: "图片模型", isDefault: true, creditCost: 8, billingUnit: "per_call", capability: null }], video: [] });
  api.capabilities.mockResolvedValue({ mock: false, operations: [], imageCost: 8, textCost: 1, videoCost: null });
  api.submit.mockResolvedValue({ id: "IPR-1", status: "running", output: {} });
  api.readRun.mockResolvedValue({ id: "IPR-1", status: "done", output: { candidates: [{ key: "ipstudio_gen/out.jpg", url: "https://cdn/out.jpg" }] } });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState(null, "", "/"); });

const upload = (input: HTMLInputElement, name = "p.jpg") => fireEvent.change(input, { target: { files: [new File(["x"], name, { type: "image/jpeg" })] } });

test("图片：没放必填参考图就不建草稿；放好后先把请求写进画布再提交，按模型单价报上限，结果回到页面", async () => {
  window.history.replaceState(null, "", "/image?scene=white-background");
  await act(async () => { render(<SceneImageStudio/>); });
  await waitFor(() => expect(screen.getByRole("button", { name: "立即生成图片" }).getAttribute("title")).toBe("预计 8 积分"));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "立即生成图片" })); });
  expect(screen.getByRole("status").textContent).toContain("先放「商品图」");
  expect(api.createProject).not.toHaveBeenCalled();

  await act(async () => { upload(document.querySelector('.scene-ref-row input[type="file"]')!); });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "立即生成图片" })); });
  expect(api.createProject).toHaveBeenCalledWith({ name: "商品白底图 · AI 图片" });
  const request = api.submit.mock.calls[0][1];
  expect(request).toMatchObject({ operation: "image", aspectRatio: "1:1", count: 1, model: "ep-img", maxCost: 8,
    references: [{ storageKey: "ipstudio/source/u/p.jpg", role: "character" }] });
  // 提交之前那次保存里已经有这条请求：网断了也能按原请求确认，不会换个编号重复扣费。
  const saved = api.updateProject.mock.calls[0][1].doc;
  expect(saved.nodes.find((n: any) => n.id === request.nodeId)?.metadata?.studio?.request).toEqual(request);
  expect(api.updateProject.mock.invocationCallOrder[0]).toBeLessThan(api.submit.mock.invocationCallOrder[0]);
  await waitFor(() => expect(screen.getByRole("img", { name: /商品白底图第 1 张/ })).toBeTruthy(), { timeout: 4000 });
  expect(api.submit).toHaveBeenCalledTimes(1);
});

test("视频：填好信息、放上商品图，素材进画布、这段话存成助手的第一句，打开画布自动发出", async () => {
  window.history.replaceState(null, "", "/video?scene=ecom-talking");
  api.importMedia.mockResolvedValue({ key: "ipstudio/media/u/p.jpg", url: "blob:p", mediaType: "image", mimeType: "image/jpeg", bytes: 1, fileName: "p.jpg", width: 800, height: 800 });
  await act(async () => { render(<SceneVideoStudio/>); });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "交给创作助手" })); });
  expect(screen.getByRole("status").textContent).toContain("先填「商品」");
  fireEvent.change(screen.getByPlaceholderText("例如：玻尿酸保湿精华 30ml"), { target: { value: "保湿精华" } });
  fireEvent.change(screen.getByPlaceholderText("例如：一抹就吸收、不黏腻、敏感肌能用"), { target: { value: "不黏腻" } });
  await act(async () => { upload(document.querySelector('.scene-media-row input[type="file"]')!); });
  expect(api.createProject).toHaveBeenCalledWith({ name: "口播带货 · 保湿精华 · AI 视频" });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "交给创作助手" })); });
  const saved = api.updateProject.mock.calls[0][1].doc;
  expect(saved.nodes.map((n: any) => n.title)).toEqual(["商品图 1"]);
  const brief = saved.assistantConversations[0];
  expect(brief.metadata.studioStart).toBe("assistant");
  expect(brief.metadata.prompt).toContain("商品：保湿精华");
  expect(api.push).toHaveBeenCalledWith("/projects/IPP-1?start=assistant&send=1");
  expect(api.submit).not.toHaveBeenCalled();
});
