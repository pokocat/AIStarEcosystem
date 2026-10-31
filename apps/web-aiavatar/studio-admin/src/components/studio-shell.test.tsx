import * as React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioShell } from "./studio-shell";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("@/lib/api", () => ({
  AuthApi: {
    me: vi.fn().mockResolvedValue({ id: "admin-1", username: "ops", displayName: "运营员", role: "OPERATOR", accountSource: "operator" }),
    logout: vi.fn(),
  },
}));

describe("StudioShell navigation", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/?view=business&days=7#health");
  });

  afterEach(() => cleanup());

  it("uses top tabs as the only view switch and keeps the sidebar as a page outline", async () => {
    const rendered = render(<StudioShell><div>页面内容</div></StudioShell>);

    expect(screen.getByRole("tab", { name: "经营" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("link", { name: /健康状态/ }).getAttribute("aria-current")).toBe("location");
    expect(screen.getByRole("link", { name: /经营概览/ }).hasAttribute("aria-current")).toBe(false);
    expect(screen.queryByText("技术监控")).toBeNull();

    const technologyTab = screen.getByRole("tab", { name: "技术" });
    expect(technologyTab.getAttribute("href")).toBe("/?view=technology&days=7");

    window.history.pushState(null, "", "/?view=technology&days=7");
    window.dispatchEvent(new PopStateEvent("popstate"));
    rendered.rerender(<StudioShell><div>页面内容</div></StudioShell>);

    await waitFor(() => expect(screen.getByText("技术看板")).toBeTruthy());
    expect(screen.getByRole("link", { name: /生成任务/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /发布与告警/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /积分发放/ })).toBeNull();
  });

  it("puts the editable scene templates under 运营配置 and shows the read-only badge only on dashboards", async () => {
    render(<StudioShell page="scenes"><div>场景</div></StudioShell>);
    expect(screen.getByRole("link", { name: /场景模板/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("heading", { name: "场景模板" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "经营" })).toBeNull();
    expect(screen.queryByText("只读查询")).toBeNull();
    expect(screen.getByRole("link", { name: /经营看板/ })).toBeTruthy();
  });
});
