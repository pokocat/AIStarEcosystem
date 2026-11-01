import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioSupplierPerformance } from "@ai-star-eco/types/studio-operations";
import { StudioOperationsApi } from "@/lib/api";
import { SupplierPerformancePanel } from "./supplier-performance";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null, CartesianGrid: () => null, Legend: () => null,
  Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));

const result: StudioSupplierPerformance = {
  generatedAt: new Date().toISOString(), timezone: "Asia/Shanghai",
  window: { startInclusive: "2026-10-31T00:00:00Z", endExclusive: "2026-11-01T00:00:00Z", bucket: "hour", maxRangeDays: 31 },
  filters: { supplier: "", model: "", mediaType: "all", status: "all", excludedFailureCategories: [], query: "" },
  summary: { tasks: 8, succeeded: 5, failed: 2, inFlight: 1, cancelled: 0, unknown: 0, terminalSamples: 7, deliverySuccessRate: 5 / 7, p50Seconds: 90, p95Seconds: 240, maxSeconds: 300, latencySamples: 5, excludedTasks: 0, latencyDefinition: "成功任务完整时长", smallSample: true },
  trend: [{ start: "2026-11-01T00:00:00Z", succeeded: 5, failed: 2, inFlight: 1, cancelled: 0, unknown: 0, deliverySuccessRate: 5 / 7 }],
  latencyDistribution: [{ key: "61-180", label: "1–3 分钟", count: 5, percentage: 1 }],
  errors: [{ category: "moderation", label: "内容审核拒绝", ownership: "供应商", count: 2, percentage: 1 }],
  suppliers: ["CATech"], models: ["gpt-image-2"],
  details: { items: [{ id: "safe-task-id", source: "ip_run", supplier: "CATech", model: "gpt-image-2", mediaType: "image", status: "failed", failureCategory: "moderation", failureLabel: "内容审核拒绝", ownership: "供应商", errorCode: "CONTENT_MODERATION", createdAt: "2026-11-01T00:00:00Z", completedAt: null, durationSeconds: null }], page: 0, size: 20, total: 8, hasMore: false },
};

describe("SupplierPerformancePanel", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/?view=technology&days=7");
    vi.spyOn(StudioOperationsApi, "supplierPerformance").mockResolvedValue(result);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("loads the bounded query and keeps running work outside the failure denominator", async () => {
    render(<SupplierPerformancePanel />);
    expect(await screen.findByText("供应商性能观察")).toBeTruthy();
    expect(screen.getByText("71.4%")).toBeTruthy();
    expect(screen.getByText("均不计入失败率")).toBeTruthy();
    expect(StudioOperationsApi.supplierPerformance).toHaveBeenCalledWith(expect.objectContaining({
      timezone: "Asia/Shanghai", status: "all", page: 0, size: 20,
    }), expect.any(AbortSignal));
  });

  it("persists filters in the URL and links an error category to failed details", async () => {
    render(<SupplierPerformancePanel />);
    await screen.findByText("供应商性能观察");
    fireEvent.change(screen.getByLabelText("搜索任务、模型或错误码"), { target: { value: "gpt-image-2" } });
    fireEvent.click(screen.getByRole("button", { name: "应用筛选" }));
    await waitFor(() => expect(window.location.search).toContain("spQuery=gpt-image-2"));
    fireEvent.click(screen.getByRole("button", { name: /内容审核拒绝/ }));
    await waitFor(() => {
      expect(window.location.search).toContain("spStatus=failed");
      expect(window.location.search).toContain("spQuery=moderation");
      expect(window.location.search).toContain("tab=details");
    });
  });

  it("renders task rows only on the details tab", async () => {
    const { rerender } = render(<SupplierPerformancePanel mode="overview" />);
    await screen.findByText("供应商性能观察");
    expect(screen.queryByText("任务明细")).toBeNull();
    rerender(<SupplierPerformancePanel mode="details" />);
    expect(await screen.findByText("任务明细")).toBeTruthy();
    expect(screen.getByText("safe-task-id")).toBeTruthy();
    expect(screen.queryByText("成功与失败趋势")).toBeNull();
  });
});
