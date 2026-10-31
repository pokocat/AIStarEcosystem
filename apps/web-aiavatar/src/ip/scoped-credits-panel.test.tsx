// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ScopedCreditsPanel } from "./scoped-credits-panel";

const state = vi.hoisted(() => ({ uid: "alice", query: vi.fn() }));
vi.mock("@/proto/api", () => ({ useIdentity: () => ({ uid: state.uid }) }));
vi.mock("@ai-star-eco/api-client", async importOriginal => ({ ...await importOriginal<typeof import("@ai-star-eco/api-client")>(), ModelBillingApi: { myGrants: state.query } }));
const grant = { id: "g", campaignName: "图片体验", targetLabels: ["图片模型 · 1024x1024"], campaignActive: true,
  available: 30, frozen: 5, spent: 15, expiresAt: "2030-01-01T00:00:00Z" };
const result = (rows: unknown[]) => ({ data: rows, pagination: { hasNext: false } });
beforeEach(() => { state.uid = "alice"; state.query.mockReset(); });
afterEach(cleanup);

test("shows restricted balance and its models separately from ordinary credits", async () => {
  state.query.mockResolvedValue(result([grant]));
  render(<ScopedCreditsPanel enterpriseId="company" />);
  expect(await screen.findByText("30 可用")).toBeDefined();
  expect(screen.getByText(/适用：图片模型/)).toBeDefined();
  expect(screen.getByText(/任务占用 5/)).toBeDefined();
  expect(screen.getByText(/不计入上方通用积分/)).toBeDefined();
  expect(state.query).toHaveBeenCalledWith({ enterpriseId: "company", page: 0, size: 10 });
});

test("expired and paused grants do not advertise spendable credits, failed reads can retry", async () => {
  state.query.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(result([
    { ...grant, expiresAt: "2020-01-01T00:00:00Z" }, { ...grant, id: "paused", campaignActive: false },
  ]));
  render(<ScopedCreditsPanel />);
  expect(await screen.findByRole("alert")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "刷新" }));
  expect(await screen.findByText("已到期")).toBeDefined();
  expect(screen.getByText("活动暂停或未开始")).toBeDefined();
  expect(screen.queryByText("30 可用")).toBeNull();
});

test("switching account discards an earlier in-flight balance response", async () => {
  let previous: (value: unknown) => void = () => {};
  state.query.mockReturnValueOnce(new Promise(resolve => { previous = resolve; })).mockResolvedValueOnce(result([]));
  const view = render(<ScopedCreditsPanel />);
  state.uid = "bob"; view.rerender(<ScopedCreditsPanel />);
  await screen.findByText("还没有模型赠款。");
  await act(async () => previous(result([grant])));
  expect(screen.queryByText("图片体验")).toBeNull();
  expect(screen.getByText("还没有模型赠款。")).toBeDefined();
});
