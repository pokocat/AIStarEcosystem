import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOperationsDashboard } from "@ai-star-eco/types/studio-operations";
import { ApiError, StudioOperationsApi } from "@/lib/api";
import { StudioDashboard } from "./studio-dashboard";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: () => <div data-testid="chart" />,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => null,
  Line: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const dashboard: StudioOperationsDashboard = {
  generatedAt: new Date().toISOString(),
  timezone: "Asia/Shanghai",
  window: { days: 7, startInclusive: "2026-10-19T16:00:00Z", endExclusive: "2026-10-26T05:00:00Z", label: "近 7 天" },
  health: {
    status: "partial",
    checks: "ABCDEFGHI".split("").map((id) => ({ id, label: `检查 ${id}`, count: 0, status: "ok" as const, detailAvailable: false })),
    stuckHoldsOverSixHours: 0,
    abnormalModels: 0,
    reconciliationAgent: { status: "unavailable", observedAt: null, conclusion: null, note: "未接入", href: null },
  },
  business: {
    totals: { walletCredits: 100, grantCredits: 20, totalCredits: 120, yuanEquivalent: 1.2 },
    dailySpend: [{ date: "2026-10-26", walletCredits: 100, grantCredits: 20 }],
    models: [{ endpointId: "ep-1", name: "示例模型", jobs: 2, succeeded: 2, refunded: 0, inFlight: 0, credits: 120, walletCredits: 100, grantCredits: 20 }],
    features: [{ feature: "出图", jobs: 2, succeeded: 2, refunded: 0, inFlight: 0, credits: 120 }],
    issuance: { issuedCredits: 500, yuanEquivalent: 5, walletBalance: 8500, grantAvailable: 300, usageAttributionStatus: "unavailable", note: "无法逐笔归因" },
    consumerActivity: { activeConsumers: 8, firstTimeConsumers: 3, returningConsumers: 5, rechargeConsumerStatus: "unavailable", note: "已结算付费任务" },
    cashFlow: { paidUsers: 2, paidOrders: 3, paidAmountCents: 9900, refundedUsers: 1, refundedOrders: 1, refundedAmountCents: 1200, note: "非收入" },
    directorFunnel: { status: "available", projects: 10, projectsWithEpisodes: 8, projectsWithStoryboards: 6, projectsWithVideos: 4, episodes: 15, clips: 30, storyboards: 18, videos: 9, note: "当前快照" },
  },
  technology: {
    models: [{
      key: "model-a",
      supplier: "supplier-a",
      mediaType: "图片",
      jobs: 2,
      succeeded: 1,
      failed: 1,
      inFlight: 0,
      successRate: .5,
      ownership: "混合",
      successWindows: [{ label: "24 小时", samples: 2, successRate: .5 }, { label: "7 天", samples: 8, successRate: .75 }, { label: "30 天", samples: 20, successRate: .8 }],
      outcomeBuckets: Array.from({ length: 48 }, (_, index) => ({ startedAt: `2026-10-25T${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}:00Z`, minutes: 30, succeeded: index === 47 ? 1 : 0, failed: 0, inFlight: 0, status: index === 47 ? "ok" as const : "no_calls" as const })),
    }],
    failureReasons: [{ category: "timeout", label: "超时", count: 1, ownership: "供应商" }],
    imageLatency: { mediaType: "图片", p50Seconds: 4, p95Seconds: 9, samples: 2, note: "完整样本" },
    videoLatency: { mediaType: "视频", p50Seconds: null, p95Seconds: null, samples: 0, note: "没有完整样本" },
    queue: { queued: 0, averageWaitSeconds: null, concurrencyRemaining: null, concurrencyStatus: "unavailable", pendingReconciliation: 0, note: "未接入" },
    supplier: { platformRequestErrors: 0, supplierErrors: 1, unknownErrors: 0, rateLimited: null, dailyUsage: 2, quotaRemaining: null, quotaStatus: "linked", alerts: [{ severity: "warning", type: "failure", providerId: "supplier-a", providerName: "supplier-a", title: "失败率升高", message: "失败 1 / 2", metricValue: 1, threshold: 1, href: "/platform/ai-models?providerId=supplier-a" }], usageRanking: [{ providerId: "supplier-a", providerName: "supplier-a", calls: 2, estimatedCostMicros: 0 }] },
    outputs: { submittedTasks: 2, terminalSuccesses: 1, terminalFailures: 1, imageAssets: 1, videoAssets: 0, note: "任务与产物分开" },
  },
  integrations: {
    release: { status: "unavailable", observedAt: null, conclusion: null, note: "未接入", href: null },
    feishuAlerts: { status: "unavailable", observedAt: null, conclusion: null, note: "未接入", href: null },
    requestLogs: { status: "linked", observedAt: null, conclusion: "使用现有页面", note: "已接入", href: "/platform/error-logs" },
  },
};

describe("StudioDashboard", () => {
  beforeEach(() => {
    vi.spyOn(StudioOperationsApi, "dashboard").mockResolvedValue(dashboard);
    window.history.replaceState(null, "", "/?view=business&days=7");
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("renders the standalone business overview and switches to the technical monitor", async () => {
    render(<StudioDashboard />);
    expect(await screen.findByText("经营数据，一屏掌握")).toBeTruthy();
    expect(screen.getByText("赠送实际使用比例：未具备数据")).toBeTruthy();
    expect(screen.getByText("导演台创作推进")).toBeTruthy();
    expect(screen.getByText("窗口消费用户")).toBeTruthy();
    expect(screen.queryByText("当前在线 · 2分钟")).toBeNull();
    cleanup();
    window.history.replaceState(null, "", "/?view=technology&days=7");
    render(<StudioDashboard />);
    expect(await screen.findByText("供应商与模型运行情况")).toBeTruthy();
    expect(screen.getAllByText("supplier-a").length).toBeGreaterThan(0);
    expect(screen.getByText(/24h · 每格30分钟/)).toBeTruthy();
    expect(screen.getByText("实际图片产物")).toBeTruthy();
  });

  it("follows the URL after browser navigation and keeps health before page-specific metrics", async () => {
    const rendered = render(<StudioDashboard />);
    const health = await screen.findByText("共用健康状态");
    const hero = screen.getByText("经营数据，一屏掌握");
    expect(health.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    window.history.pushState(null, "", "/?view=technology&days=7");
    rendered.rerender(<StudioDashboard />);
    expect(await screen.findByText("供应商与模型运行情况")).toBeTruthy();
    expect(screen.queryByText("经营数据，一屏掌握")).toBeNull();
  });

  it("shows a permission-specific failure state for forbidden users", async () => {
    vi.spyOn(StudioOperationsApi, "dashboard").mockRejectedValue(new ApiError("无权访问", "FORBIDDEN", 403));
    render(<StudioDashboard />);
    expect(await screen.findByText("没有查看权限")).toBeTruthy();
    expect(screen.queryByText("经营数据，一屏掌握")).toBeNull();
  });

  it("uses an explicitly labelled local fixture only in development demo mode", async () => {
    window.history.replaceState(null, "", "/?view=business&days=7&demo=1");
    vi.spyOn(StudioOperationsApi, "dashboard").mockRejectedValue(new TypeError("backend unavailable"));
    render(<StudioDashboard />);
    expect(await screen.findByText("本地演示数据")).toBeTruthy();
    expect(screen.getByText("导演台创作推进")).toBeTruthy();
    expect(screen.queryByText("数据加载失败")).toBeNull();
  });
});
