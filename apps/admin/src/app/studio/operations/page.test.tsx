// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { StudioOperationsDashboard } from "@/types/studio-operations";

const mocks = vi.hoisted(() => ({ dashboard: vi.fn(), details: vi.fn(), events: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock("@/api", () => ({ StudioOperationsApi: {
  dashboard: mocks.dashboard,
  reconciliationDetails: mocks.details,
  creditEvents: mocks.events,
} }));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null, Legend: () => null, Line: () => null, Tooltip: () => null,
  XAxis: () => null, YAxis: () => null,
}));
import Page from "./page";

const dashboard: StudioOperationsDashboard = {
  generatedAt: new Date().toISOString(), timezone: "Asia/Shanghai",
  window: { days: 7, startInclusive: "2026-10-19T16:00:00Z", endExclusive: "2026-10-26T02:00:00Z", label: "近 7 天" },
  health: {
    status: "partial", stuckHoldsOverSixHours: 0, abnormalModels: 0,
    checks: "ABCDEFGHI".split("").map((id) => ({ id, label: `${id} 项`, count: 0, status: "ok", detailAvailable: false })),
    reconciliationAgent: { status: "unavailable", observedAt: null, conclusion: null, note: "未接入", href: null },
  },
  business: {
    totals: { walletCredits: 800, grantCredits: 120, totalCredits: 920, yuanEquivalent: 9.2 },
    dailySpend: [{ date: "2026-10-26", walletCredits: 800, grantCredits: 120 }],
    models: [], features: ["出图","视频","对话","导演台","短剧","其他"].map((feature) => ({ feature, jobs: 0, succeeded: 0, refunded: 0, inFlight: 0, credits: 0 })),
    issuance: { issuedCredits: 1000, yuanEquivalent: 10, walletBalance: 4000, grantAvailable: 300, usageAttributionStatus: "unavailable", note: "无法严谨归因" },
  },
  technology: {
    models: [], failureReasons: [], imageLatency: { mediaType: "图片", p50Seconds: null, p95Seconds: null, samples: 0, note: "无样本" },
    videoLatency: { mediaType: "视频", p50Seconds: 30, p95Seconds: 80, samples: 2, note: "终态样本" },
    queue: { queued: 0, averageWaitSeconds: null, concurrencyRemaining: null, concurrencyStatus: "unavailable", pendingReconciliation: 0, note: "未接入" },
    supplier: { platformRequestErrors: 0, supplierErrors: 0, unknownErrors: 0, rateLimited: null, dailyUsage: null, quotaRemaining: null, quotaStatus: "unavailable" },
  },
  integrations: {
    release: { status: "unavailable", observedAt: null, conclusion: null, note: "未接入发布清单", href: null },
    feishuAlerts: { status: "unavailable", observedAt: null, conclusion: null, note: "未接入发送记录", href: "/platform/ai-models#generation-alerts" },
    requestLogs: { status: "linked", observedAt: null, conclusion: "使用现有页面", note: "已有入口", href: "/platform/error-logs" },
  },
};

beforeEach(() => {
  vi.clearAllMocks(); window.history.replaceState({}, "", "/studio/operations?view=business&days=7");
  mocks.dashboard.mockResolvedValue(dashboard);
  mocks.details.mockResolvedValue({ checkId: "A", items: [{ user_id: "user-1", total_balance: "-1" }], page: 0, size: 20, total: 1, hasMore: false });
  mocks.events.mockResolvedValue({ items: [], page: 0, size: 20, total: 0, hasMore: false });
});
afterEach(cleanup);

test("shows partial health instead of green when the agent source is unavailable and syncs the technology tab to the URL", async () => {
  render(<Page />);
  expect(await screen.findByText("部分数据未接入")).toBeDefined();
  expect(screen.queryByText("全部正常")).toBeNull();
  const technology = screen.getByRole("tab", { name: "技术" });
  fireEvent.mouseDown(technology, { button: 0, ctrlKey: false });
  fireEvent.click(technology);
  expect(await screen.findByText("各模型生成表现")).toBeDefined();
  expect(window.location.search).toContain("view=technology");
  expect(screen.getByText("并发余量").parentElement?.textContent).toContain("未接入");
  expect(screen.getByText("线上版本 / 发布时间").parentElement?.parentElement?.textContent)
    .toContain("未接入发布清单");
});

test("keeps a request failure distinct from an empty or healthy response and supports retry", async () => {
  mocks.dashboard.mockRejectedValueOnce(new Error("网络中断")).mockResolvedValueOnce(dashboard);
  render(<Page />);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("网络中断");
  expect(screen.queryByText("全部正常")).toBeNull();
  fireEvent.click(within(alert).getByRole("button", { name: "重试" }));
  expect(await screen.findByText("部分数据未接入")).toBeDefined();
});

test("opens read-only reconciliation details and the paged credit-event empty state", async () => {
  const issueData = structuredClone(dashboard);
  issueData.health.checks[0] = { id: "A", label: "钱包不平", count: 1, status: "issue", detailAvailable: true };
  mocks.dashboard.mockResolvedValue(issueData);
  render(<Page />);
  fireEvent.click(await screen.findByRole("button", { name: /A · 钱包不平/ }));
  const detail = await screen.findByRole("dialog");
  expect(within(detail).getByText("user-1")).toBeDefined();
  fireEvent.click(within(detail).getByRole("button", { name: "关闭" }));
  fireEvent.click(screen.getByRole("button", { name: "查看只读发放明细" }));
  expect(await screen.findByText("当前窗口没有发出积分记录")).toBeDefined();
  expect(mocks.events).toHaveBeenCalledWith(7, 0, undefined, undefined);
});
