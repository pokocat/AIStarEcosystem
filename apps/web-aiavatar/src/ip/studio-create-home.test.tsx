// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IpProjectSummary, IpTemplate } from "@ai-star-eco/types";

const mocks = vi.hoisted(() => ({ projects: vi.fn(), templates: vi.fn(), examples: vi.fn(), get: vi.fn(), create: vi.fn(), remove: vi.fn(), push: vi.fn(), availability: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => <p>开通产品</p> }));
vi.mock("@/proto/api", () => ({ useIdentity: () => ({ operatorRole: "none" }), isOperatorRole: () => false }));
vi.mock("./api", () => ({ IpStudioApi: { listProjects: mocks.projects, listTemplates: mocks.templates, listDemoExamples: mocks.examples, getProject: mocks.get, createProject: mocks.create, deleteProject: mocks.remove } }));
vi.mock("@/canvas-bridge/template-api", () => ({ templateAvailability: mocks.availability }));
vi.mock("./studio-template-use", () => ({ StudioTemplateUse: ({ template, onClose }: any) => <div role="dialog"><p>{template.name} · 只读预览</p><button onClick={onClose}>返回</button></div> }));
vi.mock("antd", () => ({ Modal: ({ open, children, title }: any) => open ? <div role="dialog" aria-label={title}>{children}</div> : null }));
import { StudioCreateHome } from "./studio-create-home";
import { StudioTemplateMarket } from "./studio-template-market";

const doc = { nodes: [{ id: "n1", title: "图", type: "image", position: { x: 0, y: 0 }, width: 200, height: 200 }], connections: [], viewport: { x: 0, y: 0, k: 1 } };
const projects: IpProjectSummary[] = Array.from({ length: 7 }, (_, i) => ({ id: `P${i}`, name: `测试画布 ${i}`, status: i === 0 ? "published" : "draft", createdAt: `2026-10-0${7 - i}T10:00:00Z`, updatedAt: `2026-10-0${7 - i}T10:00:00Z`, coverUrl: "/should-not-render.png" }));
const official: IpTemplate = { id: "IPD-studio-commerce", name: "IP 商品视频", summary: "人物与商品", visibility: "official", doc, lookCount: 1, estimatedCredits: 0 };
const personal: IpTemplate = { ...official, id: "personal", versionId: "v1", visibility: "personal", mine: true, name: "个人工作流", enabled: false };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.projects.mockResolvedValue(projects); mocks.templates.mockResolvedValue([official, personal]); mocks.examples.mockResolvedValue([]);
  mocks.get.mockImplementation(async (id: string) => ({ ...projects.find(p => p.id === id), doc }));
  mocks.create.mockResolvedValue({ id: "P-new", doc }); mocks.remove.mockResolvedValue(undefined); mocks.availability.mockResolvedValue({});
});
afterEach(cleanup);

describe("Creation catalogue", () => {
  it("loads minimaps only for the visible page, searches, filters and pages real canvases", async () => {
    render(<StudioCreateHome />);
    await screen.findByRole("link", { name: "打开画布 测试画布 0" });
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(5));
    expect(document.querySelector('img[src="/should-not-render.png"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "下一页画布" }));
    await screen.findByRole("link", { name: "打开画布 测试画布 6" });
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(7));
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索我的画布" }), { target: { value: "测试画布 0" } });
    expect(screen.getByRole("link", { name: "打开画布 测试画布 0" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "打开画布 测试画布 6" })).toBeNull();
    fireEvent.click(within(screen.getByRole("group", { name: "画布状态" })).getByRole("button", { name: /草稿/ }));
    expect(screen.getByText("没有找到符合条件的画布")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(screen.getByRole("link", { name: "打开画布 测试画布 0" })).toBeTruthy();
  });
  it("opens a workflow template read-only without creating a canvas", async () => {
    render(<StudioCreateHome />);
    fireEvent.click(await screen.findByRole("button", { name: "预览模板 IP 商品视频" }));
    expect(screen.getByRole("dialog").textContent).toContain("只读预览");
    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    fireEvent.click(screen.getByRole("button", { name: "IP 商品视频", exact: true }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "查看更多模板" }).getAttribute("href")).toBe("/templates");
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
  it("keeps personal canvases available when the template catalogue fails", async () => {
    mocks.templates.mockRejectedValue(new Error("模板服务不可用"));
    render(<StudioCreateHome />);
    await screen.findByRole("link", { name: "打开画布 测试画布 0" });
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "模板服务不可用重新加载");
  });
  it("keeps a failed delete reviewable and removes the card only after a successful retry", async () => {
    mocks.remove.mockRejectedValueOnce(new Error("删除未成功"));
    render(<StudioCreateHome />);
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
  it("keeps published personal templates manageable and community templates explicitly unfinished", async () => {
    render(<StudioTemplateMarket />);
    await screen.findByRole("button", { name: "预览模板 IP 商品视频" });
    fireEvent.click(screen.getByRole("button", { name: /我的模板/ }));
    expect(screen.getByRole("button", { name: "预览模板 个人工作流" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "重新启用" }));
    await waitFor(() => expect(mocks.availability).toHaveBeenCalledWith("personal", true));
    await screen.findByRole("button", { name: "停用模板" });
    expect(screen.getByRole("button", { name: "预览模板 个人工作流" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /用户发布模板/ }));
    expect(screen.getByRole("heading", { name: "用户模板市场，正在建设" })).toBeTruthy();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("retains official example previews and separates template search from the personal canvas catalogue", async () => {
    mocks.examples.mockResolvedValue([{ ...official, id: "example", name: "精选故事" }]);
    render(<StudioTemplateMarket />);
    await screen.findByRole("button", { name: "预览模板 精选故事" });
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索模板" }), { target: { value: "精选故事" } });
    expect(screen.queryByRole("button", { name: "预览模板 IP 商品视频" })).toBeNull();
    expect(screen.getByRole("button", { name: "预览模板 精选故事" })).toBeTruthy();
    expect(mocks.projects).not.toHaveBeenCalled();
  });
});
