"use client";

import * as React from "react";
import { API_BASE_URL } from "./config";
import { exitImpersonation, getImpersonation, setImpersonation, validImpersonation, type ImpersonationSession } from "./impersonation-session";

export function ImpersonationBar() {
  const [session, setSession] = React.useState<ImpersonationSession | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => { setSession(getImpersonation()); }, []);
  if (!session) return null;
  return <aside aria-label="附身登录状态" style={{ position: "fixed", zIndex: 10000,
    bottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)", right: 12, maxWidth: "calc(100vw - 24px)",
    padding: "12px 16px", borderRadius: 10, background: "#213c31", color: "#fff", boxShadow: "0 4px 18px #0003", fontSize: 13 }}>
    <div style={{ overflowWrap: "anywhere" }}>正在以 <strong>{session.targetName}</strong> 操作</div>
    <div style={{ marginTop: 4 }}>权限、权益和扣费与该用户一致。</div>
    <button type="button" disabled={busy} style={{ marginTop: 8, minHeight: 44, padding: "6px 12px", cursor: "pointer" }}
      onClick={() => { setBusy(true); setError(""); void exitImpersonation().catch(e => { setError(e.message); setBusy(false); }); }}>
      {busy ? "正在退出…" : "退出附身"}
    </button>
    {error && <div role="alert">{error}</div>}
  </aside>;
}

/** 五个产品复用同一回调；React StrictMode 不重复消费一次性交接码。 */
export function ImpersonationLogin({ product }: { product: string }) {
  const ran = React.useRef(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
    window.history.replaceState(null, "", window.location.pathname);
    if (!code || !/^[A-Za-z0-9_-]{43}$/.test(code)) { setError("附身链接已失效，请从后台账号列表重新发起。"); return; }
    void (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/impersonation/exchange`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, product }), cache: "no-store", signal: AbortSignal.timeout(15000),
      });
      const body = await response.json();
      if (!response.ok || body.success !== true || !validImpersonation(body.data)
          || body.data.product !== product) throw new Error(body.error?.message || "附身登录失败，请从后台重试。");
      setImpersonation(body.data);
      window.location.replace("/dashboard");
    })().catch(e => setError(e instanceof Error ? e.message : "登录失败，请重试。"));
  }, [product]);
  return <main style={{ minHeight: "70vh", display: "grid", placeContent: "center", padding: 24, textAlign: "center" }}>
    <h1 style={{ fontSize: 22 }}>附身登录</h1>
    <p role={error ? "alert" : "status"}>{error || "正在以目标用户身份登录…"}</p>
    {error && <p>可关闭此标签页返回管理后台；已有附身会话可使用“退出附身”结束。</p>}
  </main>;
}
