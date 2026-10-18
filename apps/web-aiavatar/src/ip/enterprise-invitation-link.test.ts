import { expect, test } from "vitest";
import { enterpriseInvitationLink, readEnterpriseInvitationToken } from "./enterprise-invitation-link";
const token = "a".repeat(43);
test("share token stays in the fragment and is not copied from untrusted URL query/path", () => {
  const link = new URL(enterpriseInvitationLink("https://studio.example/path?query=1", token));
  expect(link.pathname).toBe("/enterprise/invite"); expect(link.search).toBe("");
  expect(readEnterpriseInvitationToken(link.hash)).toBe(token);
  expect(readEnterpriseInvitationToken("#token=bad")).toBeNull();
  expect(readEnterpriseInvitationToken("#next=https://evil.example")).toBeNull();
  expect(() => enterpriseInvitationLink("https://studio.example", "invalid")).toThrow();
});
