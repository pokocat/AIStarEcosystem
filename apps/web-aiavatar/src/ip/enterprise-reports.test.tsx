// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { EnterpriseReports } from "./enterprise-reports";
import type { EnterpriseContext } from "@ai-star-eco/types/enterprise";
const api = vi.hoisted(() => ({ usage: vi.fn(), transfers: vi.fn(), audit: vi.fn() }));
vi.mock("@/canvas-bridge/enterprise-api", () => ({ EnterpriseApi: api }));
vi.mock("./studio-errors", () => ({ normalizeStudioError: (error: Error) => ({ message: error.message }) }));
vi.mock("antd", () => ({
  Alert: ({ title, action }: any) => <div role="alert">{title}{action}</div>, Button: ({ children, loading, ...props }: any) => <button {...props}>{children}</button>, Skeleton: () => <p>读取中</p>, Tag: ({ children }: any) => <span>{children}</span>,
  Pagination: ({ current, total, pageSize, onChange }: any) => total > current * pageSize ? <button onClick={() => onChange(current + 1)}>下一页记录</button> : null,
  Table: ({ dataSource, columns }: any) => <table><thead><tr>{columns.map((column: any, i: number) => <th key={i}>{column.title}</th>)}</tr></thead><tbody>{dataSource.map((row: any) => <tr key={row.id}>{columns.map((column: any, i: number) => <td key={i}>{column.render ? column.render(row[column.dataIndex], row) : row[column.dataIndex]}</td>)}</tr>)}</tbody></table>,
}));
const context = { enterprise: { id: "team" }, member: { id: "member", userId: "me" }, permissions: ["usage.read"] } as EnterpriseContext;
const usage = { id: "usage", actorUserId: "other", actorName: "张三", referenceType: "ip-run", referenceId: "internal-run-id", cost: 0, pendingCredits: 20, status: "reserved", modelName: "人像图片", createdAt: "2026-10-15T08:00:00Z" };
beforeEach(() => { vi.clearAllMocks(); api.usage.mockResolvedValue({ data: [usage], pagination: { total: 30 } }); });
afterEach(cleanup);

test("pending usage shows real actor/model and frozen funds without claiming settlement", async () => {
  render(<EnterpriseReports context={context} kind="usage"/>);
  expect(await screen.findByText("张三")).toBeDefined(); expect(screen.getByText("人像图片")).toBeDefined(); expect(screen.getByText("20")).toBeDefined(); expect(screen.getAllByText("排队中").length).toBeGreaterThan(0);
  expect(screen.queryByText("已结算")).toBeNull(); expect(screen.queryByText("internal-run-id")).toBeNull(); expect(screen.getByText("发起时间")).toBeDefined();
});

test("usage pagination goes back to the server rather than slicing current rows", async () => {
  render(<EnterpriseReports context={context} kind="usage"/>); fireEvent.click(await screen.findByRole("button", { name: "下一页记录" }));
  await waitFor(() => expect(api.usage).toHaveBeenLastCalledWith("team", 1, 20));
});

test("partial consumption and returned remainder keep actual spend distinct from freezing", async () => {
  api.usage.mockResolvedValue({ data: [{ ...usage, cost: 6, pendingCredits: 0, status: "released" }], pagination: { total: 1 } });
  render(<EnterpriseReports context={context} kind="usage"/>); await screen.findByText("6"); expect(screen.getAllByText("已结算，余款已退回").length).toBeGreaterThan(0); expect(screen.queryByText("20")).toBeNull();
});


test("changing report kind never renders old audit rows as usage amounts", async () => {
  api.audit.mockResolvedValue({ data: [{ id: "audit", actorUserId: "me", action: "enterprise.create", summary: "已创建", createdAt: usage.createdAt }], pagination: { total: 1 } });
  let finishUsage: (result: any) => void = () => {};
  api.usage.mockReturnValue(new Promise(resolve => { finishUsage = resolve; }));
  const view = render(<EnterpriseReports context={context} kind="audit"/>);
  await screen.findByText("已创建");
  view.rerender(<EnterpriseReports context={context} kind="usage"/>);
  expect(screen.queryByText("已创建")).toBeNull();
  finishUsage({ data: [usage], pagination: { total: 1 } });
  expect(await screen.findByText("张三")).toBeDefined();
  expect(screen.getByText("20")).toBeDefined();
});

test("a delayed previous report cannot overwrite the newly selected report", async () => {
  let finishAudit: (result: any) => void = () => {};
  api.audit.mockReturnValue(new Promise(resolve => { finishAudit = resolve; }));
  const view = render(<EnterpriseReports context={context} kind="audit"/>);
  await waitFor(() => expect(api.audit).toHaveBeenCalled());
  view.rerender(<EnterpriseReports context={context} kind="usage"/>);
  await screen.findByText("张三");
  await act(async () => { finishAudit({ data: [{ id: "late-audit", actorUserId: "me", action: "enterprise.create", summary: "过期操作记录", createdAt: usage.createdAt }], pagination: { total: 1 } }); });
  expect(screen.queryByText("过期操作记录")).toBeNull();
  expect(screen.getByText("张三")).toBeDefined();
});
