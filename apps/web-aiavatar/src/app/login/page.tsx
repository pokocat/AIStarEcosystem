"use client";
// 登录页（P1）：复用老版 MLogin 屏（验证码 / 密码 / 注册 / 注册凭证整套逻辑不重写），
// 成功后回跳 ?next= 指定的站内页面。
import React, { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MLogin } from "@/proto/screen-login";
import { ToastHost } from "@/proto/ui";
import { auth, USE_MOCK } from "@/proto/api";
import { useLoginNext } from "@/components/hub/auth";

function LoginInner() {
  const router = useRouter();
  const next = useLoginNext();

  useEffect(() => {
    if (USE_MOCK || auth.isAuthed()) router.replace(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
