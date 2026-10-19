import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { EnterpriseFinancialReport } from "../../../apps/admin/src/app/finance/(money)/recharge-orders/enterprise-financial-report";

const api = vi.hoisted(() => ({ enterprises: vi.fn(), enterpriseSummary: vi.fn(), enterpriseMembers: vi.fn(), enterpriseTransfers: vi.fn(), enterpriseUsage: vi.fn() }));
vi.mock("@/api/enterprise-recharges", () => api);
const pagination = { page: 0, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false };
const member = { memberId: "member-1", userId: "user-1", displayName: "本地成员", role: "member", status: "active", totalBalance: 200, pendingBalance: 8 };
const usage = { id: "usage-1", actorUserId: "user-1", actorName: "本地操作者", modelName: "本地图片模型", referenceType: "ip-run", referenceId: "run-original", cost: 8, pendingCredits: 0, status: "completed", createdAt: "2026-10-15T12:00:00Z" };
const envelope = (data: unknown[]) => ({ success: true, data, pagination });
function deferred() {
  let resolve: (value: ReturnType<typeof envelope>) => void = () => {};
  const promise = new Promise<ReturnType<typeof envelope>>(finish => { resolve = finish; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.resetAllMocks();
  api.enterprises.mockResolvedValue(envelope([{ id: "enterprise-1", name: "本地验收企业" }]));
  api.enterpriseSummary.mockResolvedValue({ enterpriseId: "enterprise-1", unallocated: 600, allocated: 400, pending: 8, spent: 16, totalBalance: 1000 });
  api.enterpriseMembers.mockResolvedValue(envelope([member]));
  api.enterpriseTransfers.mockResolvedValue(envelope([]));
  api.enterpriseUsage.mockResolvedValue(envelope([usage]));
});
afterEach(cleanup);

test("members to usage clears the old DTO before rendering and ignores a late member refresh", async () => {
  const staleMembers = deferred(), nextUsage = deferred();
  api.enterpriseMembers.mockResolvedValueOnce(envelope([member])).mockReturnValueOnce(staleMembers.promise);
  api.enterpriseUsage.mockReturnValueOnce(nextUsage.promise);
  render(<EnterpriseFinancialReport />);
  fireEvent.click(await screen.findByRole("button", { name: "本地验收企业" }));
  await screen.findByText(member.displayName);
  fireEvent.click(screen.getByRole("button", { name: "刷新核对数据" }));
  await waitFor(() => expect(api.enterpriseMembers).toHaveBeenCalledTimes(2));
  // This synchronous switch used to interpret member.totalBalance as usage.cost and throw.
  fireEvent.click(screen.getByRole("button", { name: "消费与在途" }));
  expect(screen.queryByText(member.displayName)).toBeNull();
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.getByRole("status")).toBeDefined();
  await act(async () => nextUsage.resolve(envelope([usage])));
  const table = await screen.findByRole("table");
  expect(within(table).getByText(usage.actorName)).toBeDefined();
  expect(within(table).getByText(String(usage.cost))).toBeDefined();
  await act(async () => staleMembers.resolve(envelope([{ ...member, displayName: "过期成员响应" }])));
  expect(screen.queryByText("过期成员响应")).toBeNull();
  expect(within(screen.getByRole("table")).getByText(usage.actorName)).toBeDefined();
  expect(api.enterpriseUsage).toHaveBeenCalledWith("enterprise-1", 0);
});

test("usage request wins even if the initial member response arrives last", async () => {
  const initialMembers = deferred(), nextUsage = deferred();
  api.enterpriseMembers.mockReturnValueOnce(initialMembers.promise);
  api.enterpriseUsage.mockReturnValueOnce(nextUsage.promise);
  render(<EnterpriseFinancialReport />);
  fireEvent.click(await screen.findByRole("button", { name: "本地验收企业" }));
  await waitFor(() => expect(api.enterpriseMembers).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "消费与在途" }));
  await waitFor(() => expect(api.enterpriseUsage).toHaveBeenCalledTimes(1));
  await act(async () => nextUsage.resolve(envelope([usage])));
  await screen.findByText(usage.actorName);
  await act(async () => initialMembers.resolve(envelope([member])));
  expect(screen.queryByText(member.displayName)).toBeNull();
  expect(within(screen.getByRole("table")).getByText(usage.actorName)).toBeDefined();
});

test("transfer recipients show their human name and historical missing names use the member fallback instead of an internal ID", async () => {
  const transfer = { id: "transfer-named", batchId: "batch-local", memberId: "internal-member-id-1", memberName: "林小满", direction: "allocate", amount: 50, outLedgerId: "ledger-out", inLedgerId: "ledger-in", createdAt: "2026-10-15T12:00:00Z" };
  api.enterpriseTransfers.mockResolvedValue(envelope([transfer, { ...transfer, id: "transfer-historical", memberId: "internal-member-id-2", memberName: undefined }]));
  render(<EnterpriseFinancialReport />);
  fireEvent.click(await screen.findByRole("button", { name: "本地验收企业" }));
  await screen.findByText(member.displayName);
  fireEvent.click(screen.getByRole("button", { name: "划拨流水" }));
  const namedCell = await screen.findByRole("cell", { name: transfer.memberName, exact: true });
  const table = within(namedCell.closest("table")!);
  // Displayed identity is the contract under test: legacy rows must never expose the member UUID as a name.
  expect(table.getByRole("cell", { name: "成员", exact: true })).toBeDefined();
  expect(table.queryByText("internal-member-id-1")).toBeNull();
  expect(table.queryByText("internal-member-id-2")).toBeNull();
  expect(api.enterpriseTransfers).toHaveBeenCalledWith("enterprise-1", 0);
});
