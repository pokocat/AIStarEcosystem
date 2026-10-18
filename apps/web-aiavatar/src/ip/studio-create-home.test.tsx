// @vitest-environment jsdom
import { mountStudioErrorNotifications } from './testing/studio-notification-harness';

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IpProjectSummary, IpTemplate } from "@ai-star-eco/types";
import { setupRadixSelectDom } from './testing/radix-select-dom';

setupRadixSelectDom();

const mocks = vi.hoisted(() => ({ projects: vi.fn(), templates: vi.fn(), examples: vi.fn(), get: vi.fn(), create: vi.fn(), remove: vi.fn(), push: vi.fn(), update: vi.fn(), availability: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), usePathname: () => "/create" }));
vi.mock("next/link", () => ({ default: ({ children, replace, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => <p>开通产品</p> }));
vi.mock("@/proto/api", () => ({ useIdentity: () => ({ operatorRole: "none" }), isOperatorRole: () => false }));
vi.mock("./api", () => ({ IpStudioApi: { listProjects: mocks.projects, listTemplates: mocks.templates, listDemoExamples: mocks.examples, getProject: mocks.get, createProject: mocks.create, updateProject: mocks.update, deleteProject: mocks.remove } }));
vi.mock("@/canvas-bridge/template-api", () => ({ templateAvailability: mocks.availability }));
vi.mock("./studio-template-use", () => ({ StudioTemplateUse: ({ template, onClose }: any) => <div role="dialog"><p>{template.name} · 只读预览</p><button onClick={onClose}>返回</button></div> }));
vi.mock("antd", () => ({ Modal: ({ open, children, title }: any) => open ? <div role="dialog" aria-label={title}>{children}</div> : null }));
import { StudioProjects } from "./studio-projects";
import { StudioCreateHome } from "./studio-create-home";
import { StudioTemplateMarket } from "./studio-template-market";

const doc = { nodes: [{ id: "n1", title: "图", type: "image", position: { x: 0, y: 0 }, width: 200, height: 200 }], connections: [], viewport: { x: 0, y: 0, k: 1 } };
const projects: IpProjectSummary[] = Array.from({ length: 27 }, (_, i) => ({ id: `P${i}`, name: `测试画布 ${i}`, status: i === 0 ? "published" : "draft", createdAt: `2026-10-${String(30 - i).padStart(2, "0")}T10:00:00Z`, updatedAt: `2026-10-${String(30 - i).padStart(2, "0")}T10:00:00Z`, coverUrl: "/project-cover.png" }));
const official: IpTemplate = { id: "IPD-studio-commerce", name: "IP 商品视频", summary: "人物与商品", visibility: "official", doc, lookCount: 1, estimatedCredits: 0 };
const personal: IpTemplate = { ...official, id: "personal", versionId: "v1", visibility: "personal", mine: true, name: "个人工作流", enabled: false };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.projects.mockResolvedValue(projects); mocks.templates.mockResolvedValue([official, personal]); mocks.examples.mockResolvedValue([]);
  mocks.get.mockImplementation(async (id: string) => ({ id, docVersion: "v1", ...projects.find(p => p.id === id), doc }));
  mocks.create.mockResolvedValue({ id: "P-new", docVersion: "v1", doc }); mocks.update.mockImplementation(async (id, body) => ({ id, docVersion: "v2", doc: body.doc })); mocks.remove.mockResolvedValue(undefined); mocks.availability.mockResolvedValue({});
});
afterEach(cleanup);

describe("Creation catalogue", () => {
  it("loads content only for the visible page, searches, filters and pages real canvases", async () => {
    render(<StudioProjects />);
    await screen.findByRole("link", { name: "打开画布 测试画布 0" });
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(24));
    expect(document.querySelector('img[src="/project-cover.png"]')).toBeTruthy();
    expect(screen.queryByRole('img', {name:/工作流示意/})).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "下一页画布" }));
    await screen.findByRole("link", { name: "打开画布 测试画布 26" });
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(27));
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索我的画布" }), { target: { value: "测试画布 0" } });
    expect(screen.getByRole("link", { name: "打开画布 测试画布 0" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "打开画布 测试画布 26" })).toBeNull();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "画布状态" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "草稿" }));
    expect(screen.getByText("没有找到符合条件的画布")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(screen.getByRole("link", { name: "打开画布 测试画布 0" })).toBeTruthy();
  });
  it("opens the secondary flow preview and persists a fixed cover without sending the document", async () => {
    mocks.projects.mockResolvedValue([projects[0]]);
    const imageDoc = { ...doc, nodes: [{ ...doc.nodes[0], metadata: { storageKey: 'owned/image.png', url: '/real-image.png' } }] };
    mocks.get.mockResolvedValue({ ...projects[0], doc: imageDoc });
    mocks.update.mockRejectedValueOnce(new Error('封面保存失败')).mockResolvedValueOnce({ ...projects[0], coverUrl: '/real-image.png', updatedAt: '2026-10-31T10:00:00Z', doc: imageDoc });
    render(<StudioProjects/>);
    await screen.findByText('1 张图片');
    fireEvent.click(screen.getByRole('button', { name: '查看流程' }));
    expect(screen.getByRole('img', {name:'工作流示意：1 个节点'})).toBeTruthy();
    // Switch the inspector via the card's visible action (the Modal mock has no close chrome).
    fireEvent.click(screen.getAllByRole('button', {name:'设置封面'})[1]);
    fireEvent.click(screen.getByRole('button', {name:'设为封面：图 1'}));
    await screen.findByText('封面保存失败');
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name:'设为封面：图 1'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.update).toHaveBeenLastCalledWith('P0', { coverStorageKey:'owned/image.png' });
    expect(document.querySelector('img[src="/real-image.png"]')).toBeTruthy();
  });
  it("restores automatic covers and explicitly refreshes content previews", async () => {
    mocks.projects.mockResolvedValue([projects[0]]);
    mocks.update.mockResolvedValue({ ...projects[0], doc });
    render(<StudioProjects/>);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', {name:'刷新画布'}));
    await waitFor(() => expect(mocks.get.mock.calls.length).toBeGreaterThan(1));
    fireEvent.click(screen.getAllByRole('button', {name:'设置封面'})[1]);
    fireEvent.click(screen.getByRole('button', {name:'恢复自动封面'}));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('P0', {coverStorageKey:''}));
  });
  it("opens a workflow template read-only without creating a canvas", async () => {
    render(<StudioCreateHome />);
    expect(screen.queryByRole("group", { name: "创作工作区" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "创作想法" })).toBeTruthy();
    expect(screen.queryByRole("searchbox", { name: "搜索我的画布" })).toBeNull();
    expect(within(screen.getByRole("navigation", { name: "工作台导航" })).getByRole("link", { name: "项目", exact: true }).getAttribute("href")).toBe("/projects");
    expect(mocks.projects).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "预览模板 IP 商品视频" }));
    expect(screen.getByRole("dialog").textContent).toContain("只读预览");
    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    fireEvent.click(screen.getByRole("button", { name: "预览模板 IP 商品视频", exact: true }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "更多模板" }).getAttribute("href")).toBe("/templates");
  });
  it("guards rapid blank-canvas creation and navigates into the existing canvas route", async () => {
    let resolve!: (p: any) => void;
    mocks.create.mockReturnValue(new Promise(r => { resolve = r; }));
    render(<StudioCreateHome />);
    const button = await screen.findByRole("button", { name: "空白画布", exact: true });
    fireEvent.click(button); fireEvent.click(button);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    resolve({ id: "P-new", doc });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/projects/P-new"));
  });
  it("keeps saved canvases in Projects without loading the template catalogue", async () => {
    render(<StudioProjects />);
    await screen.findByRole("link", { name: "打开画布 测试画布 0" });
    expect(screen.getByRole("heading", { name: "项目", level: 1 })).toBeTruthy();
    expect(screen.getByRole("link", { name: "新建创作" }).getAttribute("href")).toBe("/create");
    expect(mocks.templates).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "创作想法" })).toBeNull();
  });
  it("keeps a failed delete reviewable and removes the card only after a successful retry", async () => {
    mocks.remove.mockRejectedValueOnce(new Error("删除未成功"));
    render(<StudioProjects />);
    await screen.findByRole("link", { name: "打开画布 测试画布 0" });
    const card = screen.getByRole("link", { name: "打开画布 测试画布 0" }).closest("article")!;
    fireEvent.click(within(card).getByText("删除画布"));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await screen.findByText("删除未成功");
    expect(screen.getByRole("link", { name: "打开画布 测试画布 0" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(screen.queryByRole("link", { name: "打开画布 测试画布 0" })).toBeNull());
    expect(mocks.remove).toHaveBeenCalledTimes(2);
  });
});

describe("Template market", () => {
  it("keeps personal templates manageable and separates curated examples from the personal catalogue", async () => {
    render(<StudioTemplateMarket />);
    await screen.findByRole("button", { name: "预览模板 IP 商品视频" });
    fireEvent.click(screen.getByRole("button", { name: /我的模板/ }));
    expect(screen.getByRole("button", { name: "预览模板 个人工作流" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "重新启用" }));
    await waitFor(() => expect(mocks.availability).toHaveBeenCalledWith("personal", true));
    await screen.findByRole("button", { name: "停用模板" });
    expect(screen.getByRole("button", { name: "预览模板 个人工作流" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /精选案例/ }));
    expect(screen.getByRole("heading", { name: "精选案例" })).toBeTruthy();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("retains official example previews and separates template search from the personal canvas catalogue", async () => {
    mocks.examples.mockResolvedValue([{ ...official, id: "example", name: "精选故事" }]);
    render(<StudioTemplateMarket />);
    fireEvent.click(screen.getByRole("button", { name: /精选案例/ }));
    await screen.findByRole("button", { name: "预览模板 精选故事" });
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索模板" }), { target: { value: "精选故事" } });
    expect(screen.queryByRole("button", { name: "预览模板 IP 商品视频" })).toBeNull();
    expect(screen.getByRole("button", { name: "预览模板 精选故事" })).toBeTruthy();
    expect(mocks.projects).not.toHaveBeenCalled();
  });
});


describe("Creation idea moved from home", () => {
  it("saves the selected intent only after an explicit creation action", async () => {
    render(<StudioCreateHome/>);
    fireEvent.click(screen.getByRole('button', { name:'视频', exact:true }));
    fireEvent.change(screen.getByRole('textbox', { name:'创作想法' }), { target:{value:'让小紫介绍灵感杯'} });
    expect(mocks.create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name:'创建并打开画布' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/projects/P-new?start=video'));
    expect(mocks.update.mock.calls[0][1].doc.nodes.at(-1).metadata.prompt).toBe('让小紫介绍灵感杯');
  });
  it("retains a failed idea save and retries the same created workspace", async () => {
    mocks.update.mockRejectedValueOnce(new Error('保存失败'));
    render(<StudioCreateHome/>);
    fireEvent.change(screen.getByRole('textbox', { name:'创作想法' }), { target:{value:'保留这段创作想法'} });
    fireEvent.click(screen.getByRole('button', { name:'创建并打开画布' }));
    await screen.findByText(/画布已创建，重试/);
    expect((screen.getByRole('textbox', { name:'创作想法' }) as HTMLTextAreaElement).value).toBe('保留这段创作想法');
    expect(screen.getByRole('textbox', { name:'创作想法' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name:'继续保存并打开' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/projects/P-new?start=assistant'));
    expect(mocks.create).toHaveBeenCalledOnce();
  });
});

beforeEach(() => { mountStudioErrorNotifications(); });
