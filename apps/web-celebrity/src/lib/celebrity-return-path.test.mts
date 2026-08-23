import assert from "node:assert/strict";
import test from "node:test";
import { celebrityReturnPath } from "./celebrity-return-path.ts";

test("keeps valid celebrity workspace return paths", () => {
  assert.equal(celebrityReturnPath("/dashboard"), "/dashboard");
  assert.equal(celebrityReturnPath("/products/p-1?tab=assets#video"), "/products/p-1?tab=assets#video");
  assert.equal(celebrityReturnPath(" /material/workshop "), "/material/workshop");
});

test("rejects admin, API and cross-origin return paths", () => {
  for (const value of [
    null,
    "",
    "/admin",
    "/admin/login",
    "/api/admin/auth/me",
    "https://admin.aibuzz.cn/admin",
    "//admin.aibuzz.cn/admin",
    "/products/../admin",
    "/products\\..\\admin",
    "%2Fadmin",
  ]) {
    assert.equal(celebrityReturnPath(value), "/dashboard", String(value));
  }
});
