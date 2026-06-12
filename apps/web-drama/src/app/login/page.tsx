"use client";

// AI 短剧登录页 — v0.43+：手机号 + 验证码 / 注册 / 体验账号三 tab（共享 AuthScreen）。
import { Clapperboard } from "lucide-react";
import { AuthScreen } from "@ai-star-eco/landing";

export default function LoginPage() {
  return (
    <AuthScreen
      platform="drama"
      brandLabel="AI 短剧"
      brandSub="AI Star Eco · Cinematic"
      brandLogoSrc="/brand/logo.svg"
      icon={Clapperboard}
      tagline="手机号支持验证码或密码登录；新用户用激活码 + 手机号完成注册，开通后即可搭建短剧流水线。"
      defaultPostLoginPath="/dashboard"
      theme={{
        bg: "var(--bg-0)",
        surface: "var(--bg-1)",
        surfaceAlt: "var(--bg-2)",
        fg: "var(--fg-0)",
        fgMuted: "var(--fg-2)",
        fgFaint: "var(--fg-3)",
        accent: "var(--accent)",
        accentFg: "#1a1410",
        danger: "var(--danger)",
        border: "var(--line)",
        radius: "var(--radius-md)",
      }}
    />
  );
}
