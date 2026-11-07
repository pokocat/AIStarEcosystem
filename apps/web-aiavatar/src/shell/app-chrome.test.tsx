// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
const state = vi.hoisted(() => ({ path: "/create", search: "", authed: true }));
vi.mock("next/navigation", () => ({ usePathname: () => state.path, useSearchParams: () => new URLSearchParams(state.search) }));
vi.mock("@/proto/api", () => ({ USE_MOCK: false, auth: { isAuthed: () => state.authed } }));
vi.mock("./layout-mode", () => ({ useLayoutMode: () => "desktop" }));
vi.mock("./desktop-top-bar", () => ({ DesktopTopBar: () => <header aria-label="网站导航" /> }));
import { AppChrome } from "./app-chrome";
import { readCanvasReturn } from "./canvas-return";
beforeEach(() => { state.path = "/create"; state.search = ""; state.authed = true; window.sessionStorage.clear(); });
afterEach(cleanup);

// AppChrome 只看 pathname，`?start=image|video|script` 走的是同一条路径，不再逐个列。
test.each(["/projects/IPP-new", "/projects/IPP-copy"])("%s uses the full canvas viewport and returns cleanly to creation", url => {
  const view = render(<AppChrome />);
  expect(screen.getByRole("banner", { name: "网站导航" })).toBeTruthy();
  expect(document.body.classList.contains("has-desktop-bar")).toBe(true);
  state.path = url; view.rerender(<AppChrome />);
  expect(screen.queryByRole("banner", { name: "网站导航" })).toBeNull();
  expect(document.body.classList.contains("has-desktop-bar")).toBe(false);
  state.path = "/create"; view.rerender(<AppChrome />);
  expect(screen.getByRole("banner", { name: "网站导航" })).toBeTruthy();
  expect(document.body.classList.contains("has-desktop-bar")).toBe(true);
  view.unmount(); expect(document.body.classList.contains("has-desktop-bar")).toBe(false);
});
// `/create` 已由上一组每条的起点覆盖。
test("templates and demo lists retain normal product navigation", () => {
  for (const path of ["/templates", "/projects/demos", "/projects/demos/"]) {
    state.path = path; const view = render(<AppChrome />);
    expect(screen.getByRole("banner", { name: "网站导航" }), path).toBeTruthy();
    view.unmount();
  }
});
test("unauthenticated direct canvas entry cannot gain navigation or a stale body offset", () => {
  state.path = "/projects/IPP-private"; state.authed = false;
  render(<AppChrome />);
  expect(screen.queryByRole("banner")).toBeNull();
  expect(document.body.classList.contains("has-desktop-bar")).toBe(false);
});

// 2026-10-30 用户反馈：新版里 /dashboard 有左侧导航，从 / 进来就没了。登录后两处是同一个首页。
test("in the new version a signed-in visit to / keeps the navigation, like /dashboard; signed out it stays the landing page", () => {
  document.documentElement.setAttribute("data-ui", "next");
  try {
    for (const path of ["/", "/dashboard"]) {
      state.path = path; const view = render(<AppChrome />);
      expect(screen.getByRole("banner", { name: "网站导航" }), path).toBeTruthy();
      expect(document.body.classList.contains("has-desktop-bar"), path).toBe(true);
      view.unmount();
    }
    state.path = "/"; state.authed = false;
    render(<AppChrome />);
    expect(screen.queryByRole("banner")).toBeNull();
  } finally { document.documentElement.removeAttribute("data-ui"); }
});

// 2026-11-07 用户反馈：从 AI 视频进画布回不去。外壳记下进画布之前的那一页，画布的返回按钮读它。
test("the shell remembers the page the canvas was opened from, including its scene and draft", () => {
  state.path = "/video"; state.search = "scene=ecom-talking";
  const view = render(<AppChrome />);
  state.search = "scene=ecom-talking&draft=IPP-1"; view.rerender(<AppChrome />);
  state.path = "/projects/IPP-1"; state.search = "start=assistant"; view.rerender(<AppChrome />);
  expect(readCanvasReturn()).toEqual({ href: "/video?scene=ecom-talking&draft=IPP-1", label: "AI 视频" });
});
