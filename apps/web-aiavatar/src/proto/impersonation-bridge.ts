"use client";

import type { ReactNode } from "react";
import { auth } from "./api";
import { getAuthToken } from "@ai-star-eco/api-client/token-store";
import { isImpersonating, expireImpersonation, exitImpersonation } from "@ai-star-eco/api-client/impersonation-session";

// 本应用保留 legacy 认证适配器；只委托附身状态，普通登录路径不变。
const original = { token: auth.token, user: auth.user, clear: auth.clear,
  logout: auth.logout, startIdLogin: auth.startIdLogin, setSession: auth.setSession };
auth.token = () => isImpersonating() ? getAuthToken() : original.token();
auth.user = () => isImpersonating() ? null : original.user();
auth.clear = () => { if (isImpersonating()) expireImpersonation(); else original.clear(); };
auth.setSession = (token, user) => {
  if (isImpersonating()) throw new Error("请先退出附身，再切换登录账号");
  original.setSession(token, user);
};
auth.logout = () => {
  if (isImpersonating()) { void exitImpersonation().catch(() => expireImpersonation()); return; }
  original.logout();
};
auth.startIdLogin = path => {
  if (isImpersonating()) { expireImpersonation(); return Promise.resolve(true); }
  return original.startIdLogin(path);
};
export function ImpersonationBridge({ children }: { children: ReactNode }) { return children; }
