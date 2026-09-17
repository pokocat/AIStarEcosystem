"use client";

// 这个应用保留独立的 legacy 登录适配器；在根布局加载时接入同一份标签页附身会话。
// 不修改原账号 localStorage，不影响普通登录路径。
import { auth } from "./api";
import { getAuthToken } from "@ai-star-eco/api-client/token-store";
import { isImpersonating, expireImpersonation, exitImpersonation } from "@ai-star-eco/api-client/impersonation-session";

const original = { token: auth.token, user: auth.user, clear: auth.clear, logout: auth.logout, startIdLogin: auth.startIdLogin };
auth.token = () => isImpersonating() ? getAuthToken() : original.token();
auth.user = () => isImpersonating() ? null : original.user();
auth.clear = () => { if (isImpersonating()) expireImpersonation(); else original.clear(); };
auth.logout = () => {
  if (isImpersonating()) { void exitImpersonation().catch(() => expireImpersonation()); return; }
  original.logout();
};
auth.startIdLogin = path => {
  if (isImpersonating()) { expireImpersonation(); return Promise.resolve(true); }
  return original.startIdLogin(path);
};

export function ImpersonationBridge() { return null; }
