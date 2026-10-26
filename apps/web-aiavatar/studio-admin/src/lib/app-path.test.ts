import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_STUDIO_ADMIN_BASE_PATH;
  vi.resetModules();
});
describe("Studio admin base path", () => {
  it("prefixes production navigation and only accepts next paths inside /admin", async () => {
    process.env.NEXT_PUBLIC_STUDIO_ADMIN_BASE_PATH = "/admin";
    const { safeStudioAdminNext, studioAdminPath } = await import("./app-path");

    expect(studioAdminPath("/")).toBe("/admin");
    expect(studioAdminPath("/login")).toBe("/admin/login");
    expect(safeStudioAdminNext("/admin?view=technology")).toBe("/admin?view=technology");
    expect(safeStudioAdminNext("/admin/models#latest")).toBe("/admin/models#latest");
    expect(safeStudioAdminNext("/dashboard")).toBe("/admin");
    expect(safeStudioAdminNext("//example.com")).toBe("/admin");
    expect(safeStudioAdminNext("/admin\\@example.com")).toBe("/admin");
  });
});
