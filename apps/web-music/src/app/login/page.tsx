"use client";

// AI 音乐人登录页 — v0.43+：手机号 + 验证码 / 注册 / 体验账号三 tab（共享 AuthScreen）。
import { Music } from "lucide-react";
import { AuthScreen } from "@ai-star-eco/landing";

export default function LoginPage() {
  return (
    <AuthScreen
      platform="music"
      brandLabel="AI 音乐人"
      brandSub="AI Star Eco · Music"
      icon={Music}
      tagline="手机号 + 短信验证码登录；新用户用激活码 + 手机号完成注册，开通后即可孵化数字人歌手。"
      defaultPostLoginPath="/dashboard"
      theme={{
        bg: "var(--background)",
        surface: "var(--card)",
        surfaceAlt: "var(--muted)",
        fg: "var(--foreground)",
        fgMuted: "var(--muted-foreground)",
        fgFaint: "var(--muted-foreground)",
        accent: "var(--primary)",
        accentFg: "var(--primary-foreground)",
        danger: "var(--destructive)",
        border: "var(--border)",
        radius: "12px",
      }}
    />
  );
}
