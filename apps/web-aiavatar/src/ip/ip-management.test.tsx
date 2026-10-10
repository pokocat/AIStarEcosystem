// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(), patch: vi.fn(), assets: vi.fn(), voices: vi.fn(), create: vi.fn(), update: vi.fn(), push: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), usePathname: () => "/ips" }));
vi.mock("next/link", () => ({ default: ({ children, replace, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock("antd", () => ({ Modal: ({ open, children, title }: any) => open ? <div role="dialog" aria-label={title}>{children}</div> : null }));
vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => null }));
vi.mock("@/proto/api", () => ({ USE_MOCK: false, AvatarApi: { list: mocks.list, patch: mocks.patch } }));
vi.mock("@/canvas-bridge/studio-api", () => ({ listStudioIpAssets: mocks.assets, studioVoiceProfiles: mocks.voices, classifyStudioIpAsset: vi.fn() }));
vi.mock("@/canvas-bridge/signed-image", () => ({ SignedImage: ({ storageKey, src, ...props }: any) => <img src={src} {...props} /> }));
vi.mock("@/canvas-bridge/signed-audio", () => ({ SignedAudio: () => null }));
vi.mock("@/ip/api", () => ({ IpStudioApi: { createProject: mocks.create, updateProject: mocks.update } }));
import { IpManagement } from "./ip-management";

const avatar = {
  id: "DH-test", name: "小鹿", path: "ai", status: "finalized", tagline: "在城市里记录日常", updated: "2026-10-10 10:00:00",
  versions: 2, counts: { video: 1 }, def: { 年龄: "18", 气质: "自然", 用途: "摄影", 性格: ["温柔"], 服饰: "外套", 设定语: "用镜头记录生活" },
};
const main = { avatarId: "DH-test", name: "主形象", characterName: "小鹿", current: true, version: 2, storageKey: "owned/main-v2.png", url: "/main.png", path: "ai" };
const side = { avatarId: "DH-test", name: "侧面参考", characterName: "小鹿", current: false, version: 1, storageKey: "owned/side-v1.png", url: "/side.png", lookId: "LK-side", assetRole: "side", path: "ai" };
const project = { id: "IPP-free", name: "小鹿", docVersion: "old-version", doc: { nodes: [], connections: [], viewport: { x: 0, y: 0, k: 1 } } };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue([avatar]); mocks.assets.mockResolvedValue([main, side]);
  mocks.voices.mockResolvedValue({ profiles: [], performers: [] });
  mocks.create.mockResolvedValue(project); mocks.update.mockResolvedValue(project);
});
afterEach(cleanup);

async function openPerson() {
  render(<IpManagement />);
  fireEvent.click(await screen.findByRole("button", { name: "查看 IP 小鹿" }));
}
describe("IP management user flows", () => {
  it("keeps shared navigation available when the desktop header is hidden on mobile", async () => {
    render(<IpManagement />);
    await screen.findByRole("button", { name: "查看 IP 小鹿" });
    expect(screen.getByRole("link", { name: "首页", exact: true }).getAttribute("href")).toBe("/dashboard");
    expect(screen.getByRole("link", { name: "资产", exact: true }).getAttribute("href")).toBe("/assets");
    expect(screen.getByRole("link", { name: "我的", exact: true }).getAttribute("href")).toBe("/me");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("saves a renamed character and updates the list and open dossier together", async () => {
    mocks.patch.mockResolvedValue({ ...avatar, name: "新小鹿", tagline: "新简介" });
    await openPerson();
    fireEvent.click(screen.getByRole("button", { name: "编辑角色设定" }));
    fireEvent.change(screen.getByLabelText("角色名称"), { target: { value: "新小鹿" } });
    fireEvent.change(screen.getByLabelText("一句话简介"), { target: { value: "新简介" } });
    fireEvent.click(screen.getByRole("button", { name: "保存设定" }));
    expect(await screen.findByRole("button", { name: "查看 IP 新小鹿" })).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "新小鹿的 IP 详情" })).toBeTruthy();
    expect(mocks.patch.mock.calls[0][0]).toBe("DH-test");
    expect(mocks.patch.mock.calls[0][1].def.年龄).toBe("18");
    expect(mocks.patch.mock.calls[0][1].def.设定语).toBe("用镜头记录生活");
  });
  it("keeps the edit draft on a failed save and does not display a success message", async () => {
    mocks.patch.mockRejectedValue(new Error("设定保存失败"));
    await openPerson();
    fireEvent.click(screen.getByRole("button", { name: "编辑角色设定" }));
    fireEvent.change(screen.getByLabelText("角色名称"), { target: { value: "仍在编辑的新名字" } });
    fireEvent.click(screen.getByRole("button", { name: "保存设定" }));
    await screen.findAllByRole("alert");
    expect((screen.getByLabelText("角色名称") as HTMLInputElement).value).toBe("仍在编辑的新名字");
    expect(screen.queryByText("角色设定已保存")).toBeNull();
  });
  it("passes the selected historical look/version into a free canvas without generating", async () => {
    await openPerson();
    fireEvent.click(screen.getByRole("button", { name: "侧面参考" }));
    fireEvent.click(screen.getByRole("button", { name: "生成形象" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/projects/IPP-free?start=image"));
    const node = mocks.update.mock.calls[0][1].doc.nodes[0];
    expect(node.metadata.storageKey).toBe("owned/side-v1.png");
    expect(node.metadata.studio.references).toEqual([{ avatarId: "DH-test", version: 1, storageKey: "owned/side-v1.png", lookId: "LK-side", role: "character" }]);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("reuses the existing free project after an initial reference-save failure", async () => {
    mocks.update.mockRejectedValueOnce(new Error("引用尚未保存")).mockResolvedValueOnce(project);
    await openPerson();
    fireEvent.click(screen.getByRole("button", { name: "生成形象" }));
    await screen.findByText("引用尚未保存");
    fireEvent.click(screen.getByRole("button", { name: "生成形象" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });
  it("clears the open dossier when its character is removed by a search filter", async () => {
    await openPerson();
    fireEvent.change(screen.getByRole("textbox", { name: "搜索 IP 名称、标签或关键词" }), { target: { value: "不存在的人物" } });
    await waitFor(() => expect(screen.queryByRole("complementary", { name: "小鹿的 IP 详情" })).toBeNull());
    expect(screen.getByRole("heading", { name: "没有找到符合条件的 IP" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(screen.getByRole("button", { name: "查看 IP 小鹿" })).toBeTruthy();
  });
  it("shows unavailable statistics when the corresponding catalogue failed", async () => {
    mocks.voices.mockRejectedValue(new Error("声音服务未返回"));
    mocks.assets.mockRejectedValue(new Error("素材服务未返回"));
    render(<IpManagement />);
    await screen.findByRole("button", { name: "查看 IP 小鹿" });
    expect(screen.getAllByText("形象素材")[0].parentElement?.textContent).toContain("—");
    expect(screen.getByText("已绑定声音").parentElement?.textContent).toContain("—");
    expect(screen.queryByText("演示模式 · 以下为示例数据")).toBeNull();
  });
});
