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
vi.mock("@/shell/account-workspace", () => ({ AccountOverview: () => null }));
vi.mock("@/shell/wallet-balance", () => ({ useWalletBalance: () => ({ balance: 1280, error: undefined, refresh: vi.fn() }) }));
import MePage from "./page";

afterEach(() => { cleanup(); document.documentElement.removeAttribute("data-ui"); });

// 2026-11-02：新版手机「我的」换到和 AI 视频、AI 图片同一套样子；项目、资产、导演台从这里进，底栏是新版的扁平底栏。
test("the new version's 我的 lists 灵感, 项目, 资产 and 短剧导演台 and uses the new tab bar", () => {
  document.documentElement.setAttribute("data-ui", "next");
  render(<MePage/>);
  const main = document.querySelector("main.studio-me") as HTMLElement;
  expect(main).toBeTruthy();
  const create = within(screen.getByRole("navigation", { name: "创作" }));
  expect(create.getAllByRole("link").map(a => [a.textContent?.slice(0, 2), a.getAttribute("href")]))
    .toEqual([["灵感", "/templates"], ["项目", "/projects"], ["资产", "/assets"], ["短剧", "/director"]]);
  // 手机上原来哪儿都看不到余额：个人卡上写可用积分，点了去积分页。
  expect(screen.getByRole("link", { name: "可用积分 1,280，查看积分" })).toBeTruthy();
  expect(screen.getByRole("button", { name: /切换到电脑版/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /返回旧版/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: "退出登录" })).toBeTruthy();
  expect(main.querySelector(".studio-tabbar")).toBeTruthy();
});

test("the old version's 我的 stays as it was", () => {
  render(<MePage/>);
  expect(document.querySelector("main.studio-me")).toBeNull();
  expect(screen.queryByRole("navigation", { name: "创作" })).toBeNull();
  expect(screen.getByText("体验新版")).toBeTruthy();
  expect(document.querySelector(".wx-tabbar")).toBeTruthy();
});
