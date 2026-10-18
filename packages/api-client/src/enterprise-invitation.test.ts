import { afterEach, expect, test, vi } from "vitest";
import { previewInvitation } from "./api/enterprise";
afterEach(() => { vi.unstubAllGlobals(); });
test("public enterprise preview uses a read-only anonymous POST and never puts the token in a URL", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { enterpriseId: "e", enterpriseName: "Studio", expiresAt: "2027-01-15T00:00:00Z" } }) });
  vi.stubGlobal("fetch", fetch);
  const result = await previewInvitation("private-invitation");
  expect(result.enterpriseId).toBe("e");
  const [url, request] = fetch.mock.calls[0];
  expect(url).not.toContain("private-invitation"); expect(url).toMatch(/enterprise-invitations\/preview$/);
  expect(request).toMatchObject({ method: "POST", credentials: "omit", cache: "no-store", body: JSON.stringify({ token: "private-invitation" }) });
  expect(request.headers.Authorization).toBeUndefined();
});
test("unavailable enterprise preview preserves the server error for the invitation page", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ success: false, error: { code: "ENTERPRISE_INVITATION_INVALID", message: "expired" } }) }));
  await expect(previewInvitation("expired")).rejects.toMatchObject({ code: "ENTERPRISE_INVITATION_INVALID", status: 409 });
});
