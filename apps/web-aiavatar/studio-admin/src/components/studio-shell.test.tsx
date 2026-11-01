import * as React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioShell } from "./studio-shell";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  usePathname: () => window.location.pathname,
}));

vi.mock("@/lib/api", () => ({
  AuthApi: {
    me: vi.fn().mockResolvedValue({ id: "admin-1", username: "ops", displayName: "运营员", role: "OPERATOR", accountSource: "operator" }),
    logout: vi.fn(),
  },
}));

describe("StudioShell navigation", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/business?tab=spend&days=7");
  });

  afterEach(() => cleanup());

  it("uses the sidebar for real modules and the top row for module tabs", async () => {
    const rendered = render(<StudioShell module="business"><div>页面内容</div></StudioShell>);
    expect(screen.getByRole("link", { name: /经营分析/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /消耗分析/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /技术监控/ }).getAttribute("href")).toBe("/technology?days=7");
    expect(screen.queryByRole("link", { name: /健康状态/ })).toBeNull();

    window.history.pushState(null, "", "/technology?tab=quality&days=7");
    window.dispatchEvent(new PopStateEvent("popstate"));
    rendered.rerender(<StudioShell module="technology"><div>页面内容</div></StudioShell>);
    await waitFor(() => expect(screen.getByText("生成与稳定性")).toBeTruthy());
    expect(screen.getByRole("link", { name: /技术监控/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /失败与耗时/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("link", { name: /积分发放/ })).toBeNull();
  });

  it("puts the editable scene templates under 运营配置 and shows the read-only badge only on dashboards", async () => {
    render(<StudioShell module="scenes"><div>场景</div></StudioShell>);
    expect(screen.getByRole("link", { name: /场景模板/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("heading", { name: "场景模板" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: /子页面/ })).toBeNull();
    expect(screen.queryByText("只读查询")).toBeNull();
    expect(screen.getByRole("link", { name: /经营分析/ })).toBeTruthy();
  });
});
