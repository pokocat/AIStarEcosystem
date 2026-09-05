"use client";
// 登录页（P1）：复用老版 MLogin 屏（验证码 / 密码 / 注册 / 注册凭证整套逻辑不重写），
// 成功后回跳 ?next= 指定的站内页面。
import React, { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IdCenterLoginScreen } from "@ai-star-eco/landing/IdCenterLoginScreen";
import { MLogin } from "@/proto/screen-login";
import { ToastHost } from "@/proto/ui";
import { auth, ID_MODE, USE_MOCK } from "@/proto/api";
import { useLoginNext } from "@/components/hub/auth";

function LoginInner() {
  const router = useRouter();
  const next = useLoginNext();

  useEffect(() => {
    if (USE_MOCK || auth.isAuthed()) router.replace(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v0.149：统一账号中心接管登录后，本页收敛成一个「去账号中心登录」按钮。
  // legacy / mock 模式下 ID_MODE 恒 false，下面的老登录屏原样保留。
  if (ID_MODE) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <IdCenterLoginScreen
          brandLabel="数字资产平台"
          tagline="登录由账号中心统一处理，一个账号通行全部产品。"
          postLoginPath={next}
          theme={{
            bg: "var(--canvas)",
            surface: "var(--surface)",
            fg: "var(--ink)",
            fgMuted: "var(--ink-2)",
            accent: "var(--primary)",
            accentFg: "#ffffff",
            border: "var(--line-2)",
            radius: "var(--r-md)",
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100dvh",
        background: "var(--canvas)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <MLogin onLoggedIn={() => router.replace(next)} />
      <ToastHost />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
