// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/video" }));
vi.mock("next/link", () => ({ default: ({ children, replace: _replace, ...p }: any) => <a {...p}>{children}</a> }));
import { StudioPage } from "@/ip/studio-page";
import { HubTabBar } from "@/components/hub/ui";

afterEach(() => { cleanup(); document.documentElement.removeAttribute("data-ui"); });

// 2026-10-30 线上走查：新版的「回到旧版」只悬浮在右上角，压住了卡片标题和「新建创作」。
test("in the new version the switch sits in the page heading next to the page actions; the old version has none there", () => {
  document.documentElement.setAttribute("data-ui", "next");
  render(<StudioPage title="项目" description="管理画布" actions={<button type="button">新建创作</button>}>内容</StudioPage>);
  const actions = within(document.querySelector(".studio-page-actions") as HTMLElement);
  expect(actions.getAllByRole("button").map(b => b.textContent)).toEqual(["回到旧版", "新建创作"]);
  expect(document.querySelector(".ip-ui-switch-inline")).toBeTruthy();
  cleanup();
  document.documentElement.removeAttribute("data-ui");
  render(<StudioPage title="项目" description="管理画布" actions={<button type="button">新建创作</button>}>内容</StudioPage>);
  expect(screen.queryByRole("button", { name: /旧版|新版/ })).toBeNull();
});

// 新版手机底栏：AI 视频、AI 图片能直接到；旧版还是原来那一排。
// 2026-11-02 起新版是设计稿里的扁平底栏（.studio-tabbar），不再借旧底栏的凸起大圆钮。
test("the phone tab bar offers AI 视频 and AI 图片 in the new version", () => {
  document.documentElement.setAttribute("data-ui", "next");
  render(<HubTabBar/>);
  const labels = [...document.querySelectorAll(".hub-tabbar .lbl, .hub-tabbar .fab-lbl")].map(e => e.textContent);
  expect(labels).toEqual(["首页", "AI 视频", "创作", "AI 图片", "我的"]);
  expect(document.querySelector(".hub-tabbar.studio-tabbar")).toBeTruthy();
  expect(document.querySelector(".wx-fab")).toBeNull();
  expect(screen.getByRole("link", { name: /AI 视频/ }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("button", { name: /创作/ }).getAttribute("aria-haspopup")).toBe("dialog");
  cleanup();
  document.documentElement.removeAttribute("data-ui");
  render(<HubTabBar/>);
  expect([...document.querySelectorAll(".hub-tabbar .lbl, .hub-tabbar .fab-lbl")].map(e => e.textContent)).toEqual(["首页", "发现", "创作", "资产", "我的"]);
});

// 2026-11-02 用户定：「创作」先选 AI 视频 / AI 图片 / 画布，不再直接进画布。
test("the new-version 创作 tab asks which of the three to start with", () => {
  document.documentElement.setAttribute("data-ui", "next");
  render(<HubTabBar/>);
  const create = screen.getByRole("button", { name: /创作/ });
  expect(screen.queryByRole("dialog")).toBeNull();
  create.focus(); // 键盘用户：先聚焦再按回车，关掉后焦点回到「创作」
  fireEvent.click(create);
  expect(create.getAttribute("aria-expanded")).toBe("true");
  const dialog = screen.getByRole("dialog", { name: "想做点什么？" });
  const choices = within(dialog).getAllByRole("link");
  expect(choices.map(a => [a.querySelector("strong")?.textContent, a.getAttribute("href")])).toEqual([["AI 视频", "/video"], ["AI 图片", "/image"], ["画布", "/create"]]);
  expect(choices[0].getAttribute("aria-current")).toBe("page");
  // jsdom 没有布局，dialogFocus 只能把焦点放在弹层本身；真浏览器里落在第一项（本地 390 宽实测）。
  expect(dialog.contains(document.activeElement)).toBe(true);
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.body.style.overflow).toBe("");
  expect(document.activeElement).toBe(create);
  fireEvent.click(create);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("link", { name: /AI 图片/ }));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(create);
  fireEvent.click(document.querySelector(".studio-create-backdrop") as HTMLElement);
  expect(screen.queryByRole("dialog")).toBeNull();
});

// 2026-11-02 线上走查：新版手机上项目、资产、发行顶上还有一排「AI 视频 / AI 图片 / 画布…」，和底栏重复。
test("the row of workspace links on top of a page is only in the old version", () => {
  document.documentElement.setAttribute("data-ui", "next");
  render(<StudioPage title="项目" description="管理画布">内容</StudioPage>);
  expect(screen.queryByRole("navigation", { name: "工作台导航" })).toBeNull();
  cleanup();
  document.documentElement.removeAttribute("data-ui");
  render(<StudioPage title="项目" description="管理画布">内容</StudioPage>);
  expect(screen.getByRole("navigation", { name: "工作台导航" })).toBeTruthy();
});
