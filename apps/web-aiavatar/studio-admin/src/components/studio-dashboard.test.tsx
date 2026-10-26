import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOperationsDashboard } from "@ai-star-eco/types/studio-operations";
import { ApiError, StudioOperationsApi } from "@/lib/api";
import { StudioDashboard } from "./studio-dashboard";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
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
      hourlyOutcomes: Array.from({ length: 24 }, (_, index) => ({ hour: `2026-10-25T${String(index).padStart(2, "0")}:00:00Z`, succeeded: index === 23 ? 1 : 0, failed: 0, inFlight: 0, status: index === 23 ? "ok" as const : "no_calls" as const })),
    }],
    failureReasons: [{ category: "timeout", label: "超时", count: 1, ownership: "供应商" }],
    imageLatency: { mediaType: "图片", p50Seconds: 4, p95Seconds: 9, samples: 2, note: "完整样本" },
    videoLatency: { mediaType: "视频", p50Seconds: null, p95Seconds: null, samples: 0, note: "没有完整样本" },
    queue: { queued: 0, averageWaitSeconds: null, concurrencyRemaining: null, concurrencyStatus: "unavailable", pendingReconciliation: 0, note: "未接入" },
    supplier: { platformRequestErrors: 0, supplierErrors: 1, unknownErrors: 0, rateLimited: null, dailyUsage: null, quotaRemaining: null, quotaStatus: "unavailable" },
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
    cleanup();
    window.history.replaceState(null, "", "/?view=technology&days=7");
    render(<StudioDashboard />);
    expect(await screen.findByText("供应商与模型运行情况")).toBeTruthy();
    expect(screen.getByText("supplier-a")).toBeTruthy();
    expect(screen.getByText(/近24小时任务/)).toBeTruthy();
  });

  it("shows a permission-specific failure state for forbidden users", async () => {
    vi.spyOn(StudioOperationsApi, "dashboard").mockRejectedValue(new ApiError("无权访问", "FORBIDDEN", 403));
    render(<StudioDashboard />);
    expect(await screen.findByText("没有查看权限")).toBeTruthy();
    expect(screen.queryByText("经营数据，一屏掌握")).toBeNull();
  });
});
