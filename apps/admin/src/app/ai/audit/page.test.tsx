// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { AiModelUsageReport, AiModelUsageStat } from "@/api/ai-models";

const mocks = vi.hoisted(() => ({ records: vi.fn() }));
vi.mock("@/api", () => ({ AiModelsApi: {
  getUsage: async () => report,
  getUsageRecords: mocks.records,
  list: async () => [],
} }));
import AiAuditPage from "./page";

const stat = (key: string, label: string, units = 0, seconds = 0, tokens = 0): AiModelUsageStat => ({
  key, label, calls: 1, totalTokens: tokens, promptTokens: tokens, completionTokens: 0,
  billableUnits: units, billableSeconds: seconds, estimatedCostMicros: 100_000,
});
const report: AiModelUsageReport = {
  windowDays: 30, since: "2026-10-01T00:00:00Z", totalCalls: 2, failedCalls: 0,
  totalTokens: 0, promptTokens: 0, completionTokens: 0, totalBillableUnits: 2,
  totalBillableSeconds: 12, estimatedCostMicros: 200_000, alerts: [], byFailureCategory: [],
  byUser: [stat("unassigned", "未归属用户", 2, 12, 0)], byTenant: [stat("unassigned", "未归属租户")],
  byAppCode: [stat("aiavatar", "数字资产平台", 2, 12, 0)], byProvider: [], byModel: [],
  byPurpose: [stat("DAP_IMAGE", "图片生成", 1)],
  byModality: [stat("image", "图片生成", 1), stat("audio", "音频与音乐", 1, 12)],
  byDay: [{ date: "2026-10-21", calls: 2, totalTokens: 0, promptTokens: 0, completionTokens: 0,
    billableUnits: 2, billableSeconds: 12, estimatedCostMicros: 200_000 }],
};

beforeEach(() => { mocks.records.mockReset().mockResolvedValue([]); });
afterEach(cleanup);

test("clicking unassigned selects only null-owner records and clearing restores all users", async () => {
  render(<AiAuditPage />);
  fireEvent.click(await screen.findByText("未归属用户", { selector: "span" }));
  await waitFor(() => expect(mocks.records).toHaveBeenLastCalledWith(expect.objectContaining({
    userId: undefined, unassignedUser: true,
  })));
  fireEvent.click(screen.getByRole("button", { name: "清除用户" }));
  await waitFor(() => expect(mocks.records).toHaveBeenLastCalledWith(expect.objectContaining({
    userId: undefined, unassignedUser: undefined,
  })));
});

test("non-token usage stays visible and the trend can switch to seconds and cost", async () => {
  render(<AiAuditPage />);
  const modalities = await screen.findByRole("region", { name: "多模态消耗" });
  expect(within(modalities).getByText(/0 Token · 1 计费单位 · 12 计费秒/)).toBeDefined();
  expect(screen.getAllByRole("columnheader", { name: "计费秒" }).length).toBeGreaterThan(0);
  fireEvent.change(screen.getByRole("combobox", { name: "趋势指标" }), { target: { value: "billableSeconds" } });
  expect(screen.getByRole("img", { name: "计费秒用量趋势曲线" })).toBeDefined();
  expect(screen.getByText("峰值 12 计费秒")).toBeDefined();
  fireEvent.change(screen.getByRole("combobox", { name: "趋势指标" }), { target: { value: "estimatedCostMicros" } });
  expect(screen.getByText("峰值 ¥0.2000 估算成本")).toBeDefined();
});
