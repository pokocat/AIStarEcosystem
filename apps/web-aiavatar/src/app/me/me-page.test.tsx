// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/me", useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, replace: _replace, ...p }: any) => <a {...p}>{children}</a> }));
vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => null }));
vi.mock("@/proto/api", () => ({
  auth: { logout: vi.fn() }, ID_MODE: false, USE_MOCK: false,
  useIdentity: () => ({ displayName: "小鹿", phoneMasked: "188****1018" }),
}));
vi.mock("@/shell/layout-mode", () => ({ useLayoutMode: () => "mobile", setLayout: vi.fn() }));
vi.mock("@/shell/account-avatar", () => ({ EditableAccountAvatar: () => <span>头像</span>, AccountAvatar: () => <span>头像</span> }));
vi.mock("@/account/account-overview", () => ({ AccountOverview: () => null }));
vi.mock("@/shell/wallet-balance", () => ({ useWalletBalance: () => ({ balance: 1280, error: undefined, refresh: vi.fn() }) }));
import MePage from "./page";

afterEach(cleanup);

// 2026-11-02：手机「我的」和 AI 视频、AI 图片同一套样子。底栏没有项目、资产、导演台和官方形象，从这里进。
test("我的 lists the places the phone tab bar leaves out, and uses the flat tab bar", () => {
  render(<MePage/>);
  const main = document.querySelector("main.studio-me") as HTMLElement;
  expect(main).toBeTruthy();
  const create = within(screen.getByRole("navigation", { name: "创作" }));
  expect(create.getAllByRole("link").map(a => a.getAttribute("href")))
    .toEqual(["/templates", "/projects", "/assets", "/assets/cards", "/director", "/assets?tab=official"]);
  // 2026-11-10：账号这一组和电脑版的标签一一对应，地址都在 /me 下面（企业只在开通企业功能时出现）。
  expect(within(screen.getByRole("navigation", { name: "账号" })).getAllByRole("link").map(a => a.getAttribute("href")))
    .toEqual(["/me/tasks", "/me/credits", "/me/storage", "/me/authorization", "/me/settings"]);
  // 手机上原来哪儿都看不到余额：个人卡上写可用积分，点了去积分页。
  expect(screen.getByRole("link", { name: "可用积分 1,280，查看积分" }).getAttribute("href")).toBe("/me/credits");
  expect(screen.getByRole("button", { name: /切换到电脑版/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: "退出登录" })).toBeTruthy();
  expect(main.querySelector(".studio-tabbar")).toBeTruthy();
});
