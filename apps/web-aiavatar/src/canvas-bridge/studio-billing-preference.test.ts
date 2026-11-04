// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";

const api = vi.hoisted(() => ({ getMe: vi.fn(), mine: vi.fn(), setBillingDefault: vi.fn() }));
vi.mock("@ai-star-eco/api-client", () => ({ AccountApi: { getMe: api.getMe }, ApiError: class extends Error { status = 0; } }));
vi.mock("./enterprise-api", () => ({ EnterpriseApi: { mine: api.mine, setBillingDefault: api.setBillingDefault } }));
import { loadStudioBillingAccount, readStudioBillingPreference } from "./studio-billing-preference";

const team = (billingDefault: string | null, member = "active") => ({ enterprise: { id: "team", name: "创作公司", status: "active" }, member: { status: member }, billingDefault });
const legacyKey = "ipstudio:billing-default:user:team";
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  api.getMe.mockResolvedValue({ id: "user" });
});

test("a default saved in this browser before moves to the membership once", async () => {
  localStorage.setItem(legacyKey, "enterprise");
  api.mine.mockResolvedValue([team(null)]);
  api.setBillingDefault.mockResolvedValue(team("enterprise"));
  const account = await loadStudioBillingAccount();
  expect(api.setBillingDefault).toHaveBeenCalledWith("team", "enterprise");
  expect(readStudioBillingPreference(account)).toEqual({ mode: "enterprise", enterpriseId: "team" });
  expect(localStorage.getItem(legacyKey)).toBeNull();
});

test("the membership's own default wins over an old browser value", async () => {
  localStorage.setItem(legacyKey, "enterprise");
  api.mine.mockResolvedValue([team("personal")]);
  const account = await loadStudioBillingAccount();
  expect(api.setBillingDefault).not.toHaveBeenCalled();
  expect(readStudioBillingPreference(account)).toEqual({ mode: "personal" });
});

test("a failed move keeps asking rather than guessing a payer", async () => {
  localStorage.setItem(legacyKey, "enterprise");
  api.mine.mockResolvedValue([team(null)]);
  api.setBillingDefault.mockRejectedValue(new Error("网络暂时中断"));
  const account = await loadStudioBillingAccount();
  expect(readStudioBillingPreference(account)).toBeUndefined();
  expect(localStorage.getItem(legacyKey)).toBe("enterprise");
});

test("an enterprise default only applies while the member can spend", () => {
  expect(readStudioBillingPreference({ userId: "user", context: team("enterprise", "suspended") as never })).toBeUndefined();
  expect(readStudioBillingPreference({ userId: "user", context: team("enterprise") as never })).toEqual({ mode: "enterprise", enterpriseId: "team" });
  expect(readStudioBillingPreference({ userId: "user" })).toBeUndefined();
});
