"use client";

// 统一账号中心登录回调（v0.149+）。薄壳：整套换令牌逻辑在共享的 AuthCallbackScreen。
// 走子路径导入，避免把 landing 的其余原语（依赖 lucide-react）拖进本 app。

import { AuthCallbackScreen } from "@ai-star-eco/landing/AuthCallbackScreen";

export default function AuthCallbackPage() {
  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <AuthCallbackScreen
        fallbackPath="/"
        theme={{
          bg: "var(--canvas)",
          fg: "var(--ink)",
          fgMuted: "var(--ink-2)",
          accent: "var(--primary)",
          accentFg: "#ffffff",
          radius: "var(--r-md)",
        }}
      />
    </div>
  );
}
