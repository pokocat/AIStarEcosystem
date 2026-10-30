// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
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
test("the phone tab bar offers AI 视频 and AI 图片 in the new version", () => {
  document.documentElement.setAttribute("data-ui", "next");
  render(<HubTabBar/>);
  const labels = [...document.querySelectorAll(".hub-tabbar .lbl, .hub-tabbar .fab-lbl")].map(e => e.textContent);
  expect(labels).toEqual(["首页", "AI 视频", "创作", "AI 图片", "我的"]);
  expect(screen.getByRole("link", { name: /AI 视频/ }).className).toContain(" on");
  cleanup();
  document.documentElement.removeAttribute("data-ui");
  render(<HubTabBar/>);
  expect([...document.querySelectorAll(".hub-tabbar .lbl, .hub-tabbar .fab-lbl")].map(e => e.textContent)).toEqual(["首页", "发现", "创作", "资产", "我的"]);
});
