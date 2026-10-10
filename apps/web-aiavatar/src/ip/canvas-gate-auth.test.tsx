// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { CanvasGate } from "./canvas-gate";

const session = vi.hoisted(() => ({ state: "checking", mount: vi.fn() }));
vi.mock("@/components/hub/auth", () => ({
  useRequireAuth: () => session.state,
  PlatformGateScreen: () => <div>请先开通数字资产</div>,
}));
vi.mock("@/shell/layout-mode", () => ({ useLayoutMode: () => "desktop", setLayout: vi.fn() }));
vi.mock("next/dynamic", () => ({ default: () => ({ projectId }: { projectId: string }) => {
  session.mount(projectId);
  return <div>本人画布 {projectId}</div>;
} }));
afterEach(cleanup);
beforeEach(() => { session.state = "checking"; session.mount.mockClear(); });

test.each(["checking", "redirecting"])("%s 时不挂载画布或读取本人项目", state => {
  session.state = state;
  render(<CanvasGate projectId="IPP-private" />);
  expect(session.mount).not.toHaveBeenCalled();
  expect(screen.getByText("正在打开画布…")).toBeTruthy();
});

test("已登录但未开通时展示开通入口，不挂载画布", () => {
  session.state = "no-platform";
  render(<CanvasGate projectId="IPP-private" />);
  expect(screen.getByText("请先开通数字资产")).toBeTruthy();
  expect(session.mount).not.toHaveBeenCalled();
});

test("登录和开通检查通过后才挂载指定画布", () => {
  session.state = "ok";
  render(<CanvasGate projectId="IPP-private" />);
  expect(screen.getByText("本人画布 IPP-private")).toBeTruthy();
  expect(session.mount).toHaveBeenCalledWith("IPP-private");
});
