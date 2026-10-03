"use client";

// 短剧工坊登录页（共享 AuthScreen）。
// 两种形态：统一账号中心模式下只有一个「去账号中心登录」按钮；本地 / 旧模式下是手机号验证码、密码、注册几个页签。
// tagline 要和当前形态对得上（v0.197：之前统一写验证码 / 密码 / 激活码，账号中心模式下这几样页面上都没有）。
import { Clapperboard } from "lucide-react";
import { isIdMode } from "@ai-star-eco/api-client";
import { AuthScreen } from "@ai-star-eco/landing";

const TAGLINE_ID_CENTER = "登录后就能开始做短剧和短视频。同一个账号可以登录 AI Star Eco 的所有产品。";
const TAGLINE_LEGACY = "用手机号登录，验证码和密码都可以。第一次来需要激活码注册，没有激活码请联系 bd@aistareco.com。";

export default function LoginPage() {
  return (
    <AuthScreen
      platform="drama"
      brandLabel="短剧工坊"
      brandSub="AI 做短剧和短视频"
      brandLogoSrc="/brand/logo.svg"
      icon={Clapperboard}
      tagline={isIdMode() ? TAGLINE_ID_CENTER : TAGLINE_LEGACY}
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
