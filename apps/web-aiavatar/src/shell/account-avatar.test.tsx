// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const state = vi.hoisted(() => ({ id: true, mock: false, acting: false, prepare: vi.fn() }));
vi.mock("@/proto/api", () => ({ get ID_MODE() { return state.id; }, get USE_MOCK() { return state.mock; }, prepareIdentityProfileEdit: state.prepare }));
vi.mock("@ai-star-eco/api-client", () => ({ idIssuer: () => "https://id.example.com" }));
vi.mock("@ai-star-eco/api-client/impersonation-session", () => ({ isImpersonating: () => state.acting }));
vi.mock("@/ip/studio-errors", () => ({ reportStudioError: vi.fn() }));
import { AccountAvatar, EditableAccountAvatar } from "./account-avatar";

const identity = { uid: "registered", avatarSeed: "registered-full-uid", avatarUrl: null, displayName: "林小满", phoneMasked: null, operatorRole: null, demo: false };
beforeEach(() => { state.id = true; state.mock = false; state.acting = false; state.prepare.mockClear(); });
afterEach(cleanup);

test("renders the same generated picture in different surfaces and after a name change", () => {
  const view = render(<><AccountAvatar identity={identity} /><AccountAvatar identity={identity} size={54} /></>);
  const svgs = view.container.querySelectorAll("svg");
  expect(svgs[0].outerHTML).toBe(svgs[1].outerHTML);
  const original = svgs[0].outerHTML;
  view.rerender(<AccountAvatar identity={{ ...identity, displayName: "新昵称" }} />);
  expect(view.container.querySelector("svg")!.outerHTML).toBe(original);
});

test("custom images take precedence and broken images recover to the fixed default", () => {
  const view = render(<AccountAvatar identity={{ ...identity, avatarUrl: "https://id.example.com/first.jpg" }} />);
  expect(view.container.querySelector("img")?.getAttribute("src")).toBe("https://id.example.com/first.jpg");
  expect(view.container.querySelector("svg")).toBeNull();
  fireEvent.error(view.container.querySelector("img")!);
  const fallback = view.container.querySelector("svg")!.outerHTML;
  view.rerender(<AccountAvatar identity={identity} />);
  expect(view.container.querySelector("svg")!.outerHTML).toBe(fallback);
  view.rerender(<AccountAvatar identity={{ ...identity, avatarUrl: "https://id.example.com/replacement.jpg" }} />);
  expect(view.container.querySelector("img")?.getAttribute("src")).toBe("https://id.example.com/replacement.jpg");
});

test("unknown accounts keep a neutral placeholder", () => {
  const view = render(<AccountAvatar />);
  expect(view.container.querySelector('svg[viewBox="0 0 1080 1080"]')).toBeNull();
});

test("the edit control opens the existing ID profile editor and arms return refresh", () => {
  render(<EditableAccountAvatar identity={identity} />);
  const link = screen.getByRole("link", { name: "修改头像（在账号中心打开）" });
  expect(link.getAttribute("href")).toBe("https://id.example.com/account/profile");
  expect(link.getAttribute("target")).toBe("_blank");
  link.addEventListener("click", event => event.preventDefault());
  fireEvent.click(link);
  expect(state.prepare).toHaveBeenCalledOnce();
});

test("demo, legacy and operator viewing cannot edit another identity", () => {
  const view = render(<EditableAccountAvatar identity={{ ...identity, demo: true }} />);
  expect(screen.queryByRole("link")).toBeNull();
  state.acting = true;
  view.rerender(<EditableAccountAvatar identity={identity} />);
  expect(screen.queryByRole("link")).toBeNull();
  state.acting = false; state.id = false;
  view.rerender(<EditableAccountAvatar identity={identity} />);
  expect(screen.queryByRole("link")).toBeNull();
});
