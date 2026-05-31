"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth, AuthApi, ENABLE_DEV_LOGIN, USE_MOCK, ApiError } from "@ai-star-eco/api-client";
import { Btn, inputStyle } from "@/components/ui/primitives";
import { Icons } from "@/components/ui/icons";
import { toast } from "@/components/ui/toast";
import { isMockOperator, setMockOperator } from "@/mocks/auth-override";

type Mode = "sms" | "register" | "dev";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, loginAs, refresh } = useAuth();
  const [mode, setMode] = React.useState<Mode>(USE_MOCK || ENABLE_DEV_LOGIN ? "dev" : "sms");

  React.useEffect(() => {
    if (!loading && user) router.replace("/library");
  }, [user, loading, router]);

  const onDone = async () => {
    await refresh();
    router.replace("/library");
  };

  const tabs: { key: Mode; label: string }[] = [
    { key: "sms", label: "手机号登录" },
    { key: "register", label: "注册" },
  ];
  if (USE_MOCK || ENABLE_DEV_LOGIN) tabs.push({ key: "dev", label: "体验账号" });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", minHeight: "100vh" }}>
      {/* 品牌面板 */}
      <div className="tex-grid" style={{ position: "relative", background: "var(--bg-1)", borderRight: "1px solid var(--line)", padding: "56px 60px", display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -120, right: -120, width: 380, height: 380, borderRadius: 999, background: "radial-gradient(circle, var(--accent-glow), transparent 68%)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(140deg, var(--accent) 0%, var(--accent-dim) 100%)", display: "grid", placeItems: "center", color: "#1a1205", boxShadow: "var(--glow-accent)" }}>
            <Icons.sparkle size={22} stroke={2} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>数字人资产管理中心</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-2)", letterSpacing: "0.16em" }}>AVATAR STUDIO</div>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <h1 style={{ fontSize: 38, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.2, margin: "0 0 18px" }}>
            打造可复用的<br />
            <span style={{ color: "var(--accent-hi)" }}>数字人 IP 形象资产</span>
          </h1>
          <p style={{ color: "var(--ink-1)", fontSize: 15, lineHeight: 1.7, maxWidth: "44ch", margin: 0 }}>
            真人授权复刻 / 纯 AI 原创两条路径，统一经「打样 → 草稿迭代 → 精细化精调 → 模板美化 → 定稿 → 衍生」标准链路，沉淀标准图集、3D、视频与版本资产。
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
            {["InstantID 复刻", "MediaPipe 几何形变", "GFPGAN 美颜", "TripoSR 3D", "SVD 视频"].map((t) => (
              <span key={t} className="mono" style={{ fontSize: 11, padding: "5px 11px", borderRadius: 999, border: "1px solid var(--line-2)", color: "var(--ink-1)", background: "var(--bg-2)" }}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", position: "relative" }}>
          {USE_MOCK ? "● DEV MOCK · 离线演示数据" : "● 已连接后端服务"}
        </div>
      </div>

      {/* 表单面板 */}
      <div style={{ display: "grid", placeItems: "center", padding: 40 }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 26, background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 4 }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setMode(t.key)}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  borderRadius: 7,
                  border: "none",
                  background: mode === t.key ? "var(--bg-3)" : "transparent",
                  color: mode === t.key ? "var(--ink-0)" : "var(--ink-2)",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {mode === "sms" && <SmsLogin onDone={onDone} toRegister={() => setMode("register")} />}
          {mode === "register" && <Register onDone={onDone} />}
          {mode === "dev" && <DevLogin loginAs={loginAs} onDone={onDone} />}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12.5, color: "var(--ink-1)", marginBottom: 7 }}>{label}</label>
      {children}
    </div>
  );
}

function CodeRow({ phone, purpose }: { phone: string; purpose: "login" | "register" }) {
  const [cd, setCd] = React.useState(0);
  React.useEffect(() => {
    if (cd <= 0) return;
    const id = setTimeout(() => setCd((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cd]);
  const send = async () => {
    if (!/^1\d{10}$/.test(phone)) {
      toast("请输入正确的手机号", { icon: "!", tone: "var(--err)" });
      return;
    }
    try {
      await AuthApi.smsRequestCode(phone, purpose);
      setCd(60);
      toast(USE_MOCK ? "验证码已发送（mock：任意 6 位即可）" : "验证码已发送");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "发送失败", { icon: "!", tone: "var(--err)" });
    }
  };
  return (
    <Btn variant="line" size="sm" disabled={cd > 0} onClick={send} style={{ whiteSpace: "nowrap", height: 42 }}>
      {cd > 0 ? `${cd}s` : "获取验证码"}
    </Btn>
  );
}

function SmsLogin({ onDone, toRegister }: { onDone: () => void; toRegister: () => void }) {
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await AuthApi.smsLogin(phone, code);
      await onDone();
    } catch (e) {
      if (e instanceof ApiError && e.code === "USER_NOT_FOUND") {
        toast("该手机号未注册，请先注册", { icon: "!", tone: "var(--warn)" });
        toRegister();
      } else {
        toast(e instanceof ApiError ? e.message : "登录失败", { icon: "!", tone: "var(--err)" });
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <Field label="手机号">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="11 位手机号" style={inputStyle} />
      </Field>
      <Field label="验证码">
        <div style={{ display: "flex", gap: 10 }}>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 位验证码" style={inputStyle} />
          <CodeRow phone={phone} purpose="login" />
        </div>
      </Field>
      <Btn variant="pri" full size="lg" onClick={submit} disabled={busy || !phone || !code} style={{ marginTop: 8 }}>
        {busy ? "登录中…" : "登录"}
      </Btn>
    </div>
  );
}

function Register({ onDone }: { onDone: () => void }) {
  const [f, setF] = React.useState({ phone: "", code: "", licenseKey: "", studioName: "", displayName: "" });
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async () => {
    setBusy(true);
    try {
      await AuthApi.smsRegister({ ...f });
      await onDone();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "注册失败", { icon: "!", tone: "var(--err)" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <Field label="手机号">
        <input value={f.phone} onChange={set("phone")} placeholder="11 位手机号" style={inputStyle} />
      </Field>
      <Field label="验证码">
        <div style={{ display: "flex", gap: 10 }}>
          <input value={f.code} onChange={set("code")} placeholder="6 位验证码" style={inputStyle} />
          <CodeRow phone={f.phone} purpose="register" />
        </div>
      </Field>
      <Field label="激活码">
        <input value={f.licenseKey} onChange={set("licenseKey")} placeholder="License 激活码" style={inputStyle} />
      </Field>
      <Field label="工作室名称">
        <input value={f.studioName} onChange={set("studioName")} placeholder="例如：墨工作室" style={inputStyle} />
      </Field>
      <Btn variant="pri" full size="lg" onClick={submit} disabled={busy || !f.phone || !f.code || !f.licenseKey || !f.studioName} style={{ marginTop: 8 }}>
        {busy ? "注册中…" : "注册并进入"}
      </Btn>
    </div>
  );
}

function DevLogin({ loginAs, onDone }: { loginAs: (u?: string) => Promise<unknown>; onDone: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [asOperator, setAsOperator] = React.useState(false);
  const [accounts, setAccounts] = React.useState<{ username: string; displayName: string }[]>([]);
  React.useEffect(() => {
    setAsOperator(isMockOperator());
    AuthApi.listDevAccounts()
      .then((a) => setAccounts(a))
      .catch(() => setAccounts([]));
  }, []);
  const go = async (username?: string) => {
    setBusy(true);
    try {
      if (USE_MOCK) setMockOperator(asOperator); // mock：决定 /me 是否带 operatorRole
      await loginAs(username);
      await onDone();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "登录失败", { icon: "!", tone: "var(--err)" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--ink-1)", lineHeight: 1.6, margin: "0 0 18px" }}>
        {USE_MOCK ? "当前为离线演示模式，点击下方按钮即可进入工作台体验全链路。" : "开发期免密登录（dev profile）。"}
      </p>
      {USE_MOCK && (
        <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 14, borderRadius: "var(--r-md)", border: "1px solid " + (asOperator ? "var(--accent-line)" : "var(--line)"), background: asOperator ? "var(--accent-soft)" : "var(--bg-2)", cursor: "pointer" }}>
          <input type="checkbox" checked={asOperator} onChange={(e) => setAsOperator(e.target.checked)} style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
          <span style={{ flex: 1, fontSize: 13, color: asOperator ? "var(--accent-hi)" : "var(--ink-1)" }}>以平台运营身份进入</span>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-2)" }}>operatorRole</span>
        </label>
      )}
      <Btn variant="pri" full size="lg" icon={Icons.bolt} onClick={() => go()} disabled={busy}>
        {busy ? "进入中…" : asOperator ? "以运营身份进入" : "进入工作台"}
      </Btn>
      {accounts.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-2)", letterSpacing: "0.1em", marginBottom: 10 }}>切换账号</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {accounts.map((a) => (
              <button
                key={a.username}
                onClick={() => go(a.username)}
                disabled={busy}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--bg-2)", color: "var(--ink-0)", cursor: "pointer", fontSize: 13 }}
              >
                <span>{a.displayName}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>{a.username}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
