"use client";

// 统一账号中心登录回调（v0.149+）。薄壳：整套换令牌逻辑在共享的 AuthCallbackScreen。
// 该路径是公开路径（AuthProvider 内置放行）。

import { AuthCallbackScreen } from "@ai-star-eco/landing";

export default function AuthCallbackPage() {
  return <AuthCallbackScreen fallbackPath="/dashboard" />;
}
