// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({ pathname: "/me", hash: "" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock("@/proto/api", () => ({ USE_MOCK: false, auth: { isAuthed: () => true, logout: vi.fn() }, useIdentity: () => ({ uid: "test", displayName: "测试账号" }) }));
vi.mock("./account-workspace", () => ({ useStudioHash: () => state.hash }));
vi.mock("./layout-mode", () => ({ setLayout: vi.fn() }));
vi.mock("./wallet-badge", () => ({ WalletBadge: () => null }));
import { DesktopTopBar } from "./desktop-top-bar";

beforeEach(() => { state.pathname = "/me"; state.hash = ""; });
afterEach(cleanup);
function openMenu() {
  const details = screen.getByLabelText("测试账号，打开账号菜单").closest("details")!;
  details.open = true;
  return details;
}

test("outside pointer dismisses the menu, while a pointer inside keeps its links usable", () => {
  render(<DesktopTopBar />);
  const menu = openMenu();
  fireEvent.pointerDown(screen.getByRole("link", { name: "我的账号" }));
  expect(menu.open).toBe(true);
  fireEvent.pointerDown(document.body);
  expect(menu.open).toBe(false);
});
test("Escape dismisses the menu and returns keyboard focus to its trigger", () => {
  render(<DesktopTopBar />);
  const menu = openMenu();
  screen.getByRole("link", { name: "我的账号" }).focus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(menu.open).toBe(false);
  expect(document.activeElement).toBe(menu.querySelector("summary"));
});
test("choosing an account link closes the menu immediately", () => {
  render(<DesktopTopBar />);
  const menu = openMenu();
  const link = screen.getByRole("link", { name: "我的账号" });
  link.addEventListener("click", event => event.preventDefault());
  fireEvent.click(link);
  expect(menu.open).toBe(false);
});
test.each(["pathname", "hash"] as const)("navigation via %s closes an open menu", field => {
  const view = render(<DesktopTopBar />);
  const menu = openMenu();
  state[field] = field === "pathname" ? "/assets" : "#/membership";
  view.rerender(<DesktopTopBar />);
  expect(menu.open).toBe(false);
});

test("Projects follows Home and owns its active navigation state", () => {
  state.pathname = "/projects";
  const view = render(<DesktopTopBar/>);
  const nav = within(screen.getByRole("navigation", {name:"主导航"}));
  const links = nav.getAllByRole("link");
  expect(links.map(link => link.getAttribute("href")).slice(0,4)).toEqual(["/dashboard","/projects","/create","/scenes"]);
  expect(nav.getByRole("link", {name:"项目",exact:true}).getAttribute("aria-current")).toBe("page");
  expect(nav.getByRole("link", {name:"画布·自由创作"}).hasAttribute("aria-current")).toBe(false);
  state.pathname = "/projects/demos";
  view.rerender(<DesktopTopBar/>);
  expect(nav.getByRole("link", {name:"灵感"}).getAttribute("aria-current")).toBe("page");
  expect(nav.getByRole("link", {name:"项目",exact:true}).hasAttribute("aria-current")).toBe(false);
});
