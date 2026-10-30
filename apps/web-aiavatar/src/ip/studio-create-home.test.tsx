// @vitest-environment jsdom
import { mountStudioErrorNotifications } from './testing/studio-notification-harness';

import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IpProjectSummary, IpTemplate } from "@ai-star-eco/types";
import { ApiError } from "@ai-star-eco/api-client";
import { setupRadixSelectDom } from './testing/radix-select-dom';

setupRadixSelectDom();

const mocks = vi.hoisted(() => ({ works: vi.fn(), projects: vi.fn(), templates: vi.fn(), examples: vi.fn(), get: vi.fn(), create: vi.fn(), remove: vi.fn(), push: vi.fn(), replace: vi.fn(), update: vi.fn(), availability: vi.fn(), selectCover: vi.fn(), resetCover: vi.fn(), identityRole: "none", layout: "mobile" as "mobile" | "desktop" | null }));
const router = vi.hoisted(() => ({ push: (href: string) => mocks.push(href), replace: (href: string) => mocks.replace(href) }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/create" }));
vi.mock("@/shell/layout-mode", () => ({ useLayoutMode: () => mocks.layout }));
vi.mock("next/link", () => ({ default: ({ children, replace, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => <p>开通产品</p> }));
vi.mock("@/proto/api", () => ({ useIdentity: () => ({ operatorRole: mocks.identityRole }), isOperatorRole: () => false }));
vi.mock("./api", () => ({ DirectorApi: { listWorks: mocks.works }, IpStudioApi: { listProjects: mocks.projects, listTemplates: mocks.templates, listDemoExamples: mocks.examples, getProject: mocks.get, createProject: mocks.create, updateProject: mocks.update, deleteProject: mocks.remove } }));
vi.mock("./canvas-cover-api", () => ({ selectCanvasCover: mocks.selectCover, resetCanvasCover: mocks.resetCover }));
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
  mocks.identityRole = "none"; mocks.layout = "mobile";
  mocks.works.mockResolvedValue([]); mocks.projects.mockResolvedValue(projects); mocks.templates.mockResolvedValue([official, personal]); mocks.examples.mockResolvedValue([]);
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
    // 项目页只放已存的画布，不读模板目录（放在列表被筛空之后断言：整棵树小，getByRole 不用扫 24 张卡）
    expect(screen.getByRole("heading", { name: "项目", level: 1 })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "新建创作" })).toBeNull();
    expect(mocks.templates).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "想做什么" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(screen.getByRole("link", { name: "打开画布 测试画布 0" })).toBeTruthy();
  });
  it("opens the secondary flow preview and persists a fixed cover without sending the document", async () => {
    mocks.projects.mockResolvedValue([projects[0]]);
    const imageDoc = { ...doc, nodes: [{ ...doc.nodes[0], metadata: { storageKey: 'owned/image.png', url: '/real-image.png' } }] };
    mocks.get.mockResolvedValue({ ...projects[0], doc: imageDoc });
    mocks.selectCover.mockRejectedValueOnce(new Error('封面保存失败')).mockResolvedValueOnce({coverUrl:'/real-image.png'});
    mocks.projects.mockResolvedValue([{...projects[0],coverUrl:'/real-image.png'}]);
    render(<StudioProjects/>);
    await screen.findByText('1 张图片');
    fireEvent.click(screen.getByRole('button', { name: '查看流程' }));
    expect(screen.getByRole('img', {name:'工作流示意：1 个节点'})).toBeTruthy();
    // Switch the inspector via the card's visible action (the Modal mock has no close chrome).
    fireEvent.click(screen.getAllByRole('button', {name:'设置封面'})[1]);
    fireEvent.click(screen.getByRole('button', {name:'设为封面：图 1'}));
    await screen.findByText('封面保存失败');
    expect(screen.getByRole('dialog')).toBeTruthy();
    await waitFor(() => expect((screen.getByRole('button', {name:'设为封面：图 1'}) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', {name:'设为封面：图 1'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.selectCover).toHaveBeenLastCalledWith('project', 'P0', 'owned/image.png');
    expect(document.querySelector('img[src="/real-image.png"]')).toBeTruthy();
  });
  it("restores automatic covers and explicitly refreshes content previews", async () => {
    mocks.projects.mockResolvedValue([projects[0]]);
    mocks.resetCover.mockResolvedValue({coverUrl:null});
    render(<StudioProjects/>);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', {name:'刷新画布'}));
    await waitFor(() => expect(mocks.get.mock.calls.length).toBeGreaterThan(1));
    fireEvent.click(screen.getAllByRole('button', {name:'设置封面'})[1]);
    fireEvent.click(screen.getByRole('button', {name:'恢复自动封面'}));
    await waitFor(() => expect(mocks.resetCover).toHaveBeenCalledWith('project','P0'));
  });
  it("opens a workflow template read-only without creating a canvas", async () => {
    render(<StudioCreateHome />);
    expect(screen.queryByRole("group", { name: "创作工作区" })).toBeNull();
    expect(screen.getByRole("button", { name: "新建画布" })).toBeTruthy();
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
  // §2.1/§2.2: the 「新建画布」 card is the shared 「新建」 (reuse rule, opened with the assistant).
  it("guards rapid 「新建画布」 clicks, keeps the other entries busy and opens the new canvas with the assistant", async () => {
    let resolve!: (p: any) => void;
    mocks.create.mockReturnValue(new Promise(r => { resolve = r; }));
    render(<StudioCreateHome />);
    const button = await screen.findByRole("button", { name: "新建画布" });
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create).toHaveBeenCalledWith({ name: "空白画布 · 新画布" });
    const card = screen.getByRole("button", { name: "新建画布" }) as HTMLButtonElement;
    expect(card.disabled).toBe(true);
    expect(card.getAttribute("aria-busy")).toBe("true");
    expect((screen.getByRole("button", { name: "图片创作" }) as HTMLButtonElement).disabled).toBe(true);
    resolve({ id: "P-new", doc });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/projects/P-new?start=assistant"));
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("「新建画布」 reuses an untouched blank canvas from the last two hours", async () => {
    mocks.projects.mockResolvedValue([{ ...projects[0], id: "P-blank", name: "空白画布 · 新画布", createdAt: new Date(Date.now() - 60_000).toISOString() }]);
    mocks.get.mockResolvedValue({ id: "P-blank", docVersion: "v1", doc: { nodes: [], connections: [], viewport: { x: 0, y: 0, k: 1 } } });
    render(<StudioCreateHome />);
    fireEvent.click(await screen.findByRole("button", { name: "新建画布" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/projects/P-blank?start=assistant"));
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("keeps a failed delete reviewable and removes the card only after a successful retry", async () => {
    mocks.remove.mockRejectedValueOnce(new Error("删除未成功"));
    // 只测删除：1 份画布就够（默认 27 份会让 waitFor 每拍都扫 24 张卡）
    mocks.projects.mockResolvedValue([projects[0]]);
    render(<StudioProjects />);
    await screen.findByRole("link", { name: "打开画布 测试画布 0" });
    const card = screen.getByRole("link", { name: "打开画布 测试画布 0" }).closest("article")!;
    fireEvent.click(within(card).getByText("删除画布"));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await screen.findByText("删除未成功");
    expect(screen.getByRole("link", { name: "打开画布 测试画布 0" })).toBeTruthy();
    await waitFor(() => expect((screen.getByRole("button", { name: "确认删除" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(screen.queryByRole("link", { name: "打开画布 测试画布 0" })).toBeNull());
    expect(mocks.remove).toHaveBeenCalledTimes(2);
  });

  // 2026-10-27 audit: 「项目」 only listed canvases, so 短剧 made in AI 导演台 seemed to be missing.
  it("points at the latest AI 导演台 works, and shows nothing when there are none", async () => {
    mocks.projects.mockResolvedValue([projects[0]]);
    mocks.works.mockResolvedValue([{ id: "DW-1", title: "夜班快递", episodeCount: 2, assetCount: 0, clipCount: 5, boardCount: 0, videoCount: 0, hasScript: true, running: false, updatedAt: "2026-10-27T08:00:00Z", coverUrl: null }]);
    render(<StudioProjects />);
    const work = await screen.findByRole("link", { name: /夜班快递/ });
    expect(work.getAttribute("href")).toBe("/director/DW-1");
    expect(within(work).getByText(/2 集 · 5 个片段/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /全部作品/ }).getAttribute("href")).toBe("/director");
    cleanup();
    mocks.works.mockResolvedValue([]);
    render(<StudioProjects />);
    await screen.findByRole("link", { name: "打开画布 测试画布 0" });
    expect(screen.queryByRole("region", { name: "短剧导演台作品" })).toBeNull();
  });
});

describe("Template market", () => {
  it("lets super admins manage built-in official covers through the shared editor", async () => {
    mocks.identityRole = "super_admin";
    mocks.templates.mockResolvedValue([{...official,visibility:undefined,doc:{...doc,nodes:[{...doc.nodes[0],metadata:{storageKey:'builtin/image',content:'/builtin-image.png'}}]}}]);
    mocks.selectCover.mockResolvedValue({coverUrl:'/builtin-image.png'});
    render(<StudioTemplateMarket/>);
    fireEvent.click(await screen.findByRole('button',{name:'设置封面'}));
    fireEvent.click(screen.getByRole('button',{name:'设为封面：图 1'}));
    await waitFor(()=>expect(mocks.selectCover).toHaveBeenCalledWith('template',official.id,'builtin/image'));
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  });
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


// docs/ip-studio-new-canvas-and-threads.md §2.2 (2026-10-21): /create is a page again on both forms, with no mode switch and
// no conversation box (the home page has that box).
describe("Creation page", () => {
  it("has no mode switch and no conversation box, and the tools no longer list the blank canvas", async () => {
    render(<StudioCreateHome/>);
    expect(screen.queryByRole('group', { name:'创作方式' })).toBeNull();
    expect(screen.queryByRole('textbox', { name:'创作想法' })).toBeNull();
    expect(screen.queryByRole('textbox', { name:'想做什么' })).toBeNull();
    expect(screen.queryByRole('button', { name:'开始对话' })).toBeNull();
    const tools = screen.getByRole("navigation", { name: "快速开始创作" });
    expect(within(tools).queryByRole('button', { name:'空白画布' })).toBeNull();
    expect(within(tools).getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['图片创作','视频创作','剧本创编','解析视频','分镜讨论','成片编辑','人物配音','数字人口型','IP 人物库']);
    // The card comes first, above the tools.
    const card = screen.getByRole('button', { name:'新建画布' });
    expect(card.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(card.getAttribute('aria-describedby') && document.getElementById(card.getAttribute('aria-describedby')!)?.textContent).toBe('一张空白画布，打开就有助手，直接开始。');
    await screen.findByRole("button", { name: "预览模板 IP 商品视频" });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("a tool opens its own free canvas with its panel, and a failure leaves the page usable", async () => {
    mocks.create.mockRejectedValueOnce(new Error('网络断开'));
    render(<StudioCreateHome/>);
    fireEvent.click(screen.getByRole('button', { name:'图片创作' }));
    await waitFor(() => expect((screen.getByRole('button', { name:'图片创作' }) as HTMLButtonElement).disabled).toBe(false));
    expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name:'图片创作' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/projects/P-new?start=image'));
    expect(mocks.create).toHaveBeenLastCalledWith({ name: '图片创作 · 新画布' });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

beforeEach(() => { mountStudioErrorNotifications(); });

// docs/ip-studio-new-canvas-and-threads.md §2.2: 「新建」 opens a canvas directly; on /create that is the 「新建画布」 card,
// clicked by the user (the page no longer hands off to a canvas by itself).
describe("New canvas entries", () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  it("项目页「新建创作」 creates one canvas and opens it with the assistant, busy while it runs", async () => {
    mocks.projects.mockResolvedValue([projects[0]]);
    let resolve!: (p: any) => void;
    mocks.create.mockReturnValue(new Promise(r => { resolve = r; }));
    render(<StudioProjects/>);
    await screen.findByRole("link", { name: "打开画布 测试画布 0" });
    const button = screen.getByRole("button", { name: "新建创作" });
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create).toHaveBeenCalledWith({ name: "空白画布 · 新画布" });
    expect((screen.getByRole("button", { name: "新建创作" }) as HTMLButtonElement).disabled).toBe(true);
    resolve({ id: "P-new", docVersion: "v1", doc });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/projects/P-new?start=assistant"));
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("项目页空态「开始创作」 reuses an untouched blank canvas from the last two hours", async () => {
    mocks.projects.mockResolvedValueOnce([]).mockResolvedValue([{ ...projects[0], id: "P-blank", name: "空白画布 · 新画布", createdAt: ago(60_000) }]);
    mocks.get.mockResolvedValue({ id: "P-blank", docVersion: "v1", doc: { nodes: [], connections: [], viewport: { x: 0, y: 0, k: 1 } } });
    render(<StudioProjects/>);
    fireEvent.click(await screen.findByRole("button", { name: "开始创作" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/projects/P-blank?start=assistant"));
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("项目页 keeps a failed creation on the page and lets the user try again", async () => {
    mocks.projects.mockResolvedValue([projects[0]]);
    mocks.create.mockRejectedValueOnce(new Error("网络断开"));
    render(<StudioProjects/>);
    await screen.findByRole("link", { name: "打开画布 测试画布 0" });
    fireEvent.click(screen.getByRole("button", { name: "新建创作" }));
    await screen.findByText(/新画布没有创建成功/);
    expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "新建创作" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/projects/P-new?start=assistant"));
  });
  it("desktop /create shows the page and creates nothing until 「新建画布」 is clicked, then one canvas even under StrictMode", async () => {
    mocks.layout = "desktop";
    render(<StrictMode><StudioCreateHome/></StrictMode>);
    const card = await screen.findByRole("button", { name: "新建画布" });
    await screen.findByRole("button", { name: "预览模板 IP 商品视频" });
    expect(screen.queryByText("正在打开新画布…")).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.click(card);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/projects/P-new?start=assistant"));
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("/create shows why a new canvas failed and the card can be clicked again", async () => {
    mocks.layout = "desktop";
    mocks.create.mockRejectedValueOnce(new Error("服务暂时不可用"));
    render(<StudioCreateHome/>);
    fireEvent.click(screen.getByRole("button", { name: "新建画布" }));
    await screen.findByText(/新画布没有创建成功/);
    expect(mocks.push).not.toHaveBeenCalled();
    await waitFor(() => expect((screen.getByRole("button", { name: "新建画布" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "新建画布" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/projects/P-new?start=assistant"));
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });
  it("/create shows the enrolment screen when the product is not enabled", async () => {
    mocks.layout = "desktop";
    mocks.create.mockRejectedValueOnce(new ApiError({ code: "PRODUCT_NOT_ENROLLED", message: "未开通" }, 403));
    render(<StudioCreateHome/>);
    fireEvent.click(screen.getByRole("button", { name: "新建画布" }));
    await screen.findByText("开通产品");
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it("/create creates nothing on load, whatever the layout", async () => {
    for (const layout of [null, "mobile", "desktop"] as const) {
      mocks.layout = layout;
      render(<StudioCreateHome/>);
      expect(screen.getByRole("button", { name: "新建画布" })).toBeTruthy();
      await screen.findByRole("button", { name: "预览模板 IP 商品视频" });
      cleanup();
    }
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.projects).not.toHaveBeenCalled();
  });
});
