import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock("next/navigation", () => navigation);

import HomePage from "./page";

describe("Studio admin root route", () => {
  beforeEach(() => navigation.redirect.mockReset());

  it("uses an app-relative redirect so Next adds the configured base path once", () => {
    HomePage();
    expect(navigation.redirect).toHaveBeenCalledWith("/business");
  });
});
