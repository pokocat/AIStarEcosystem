// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
const state = vi.hoisted(() => ({ path: "/create", authed: true }));
vi.mock("next/navigation", () => ({ usePathname: () => state.path }));
vi.mock("@/proto/api", () => ({ USE_MOCK: false, auth: { isAuthed: () => state.authed } }));
vi.mock("./layout-mode", () => ({ useLayoutMode: () => "desktop" }));
vi.mock("./desktop-top-bar", () => ({ DesktopTopBar: () => <header aria-label="网站导航" /> }));
import { AppChrome } from "./app-chrome";
beforeEach(() => { state.path = "/create"; state.authed = true; });
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
