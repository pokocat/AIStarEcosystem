"use client";

import * as React from "react";
import { Eye, EyeOff, Lock, Save, ShieldCheck } from "lucide-react";
import { AccountApi, useAuth } from "@ai-star-eco/api-client";
import { Avatar, Button, Card } from "@/components/creator";

export const dynamic = "force-dynamic";

export default function AccountPage() {
  const { user, refresh } = useAuth();
  const [hasPassword, setHasPassword] = React.useState(Boolean(user?.hasPassword));
  const [form, setForm] = React.useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    AccountApi.getMe()
      .then((me) => {
        if (!cancelled) setHasPassword(Boolean(me.hasPassword));
      })
      .catch(() => {
        /* AuthProvider 会处理登录态过期。 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function savePassword() {
    setError(null);
    setMessage(null);
    if (hasPassword && !form.currentPassword.trim()) {
      setError("请填写当前密码");
      return;
    }
    if (form.newPassword.length < 6) {
      setError("新密码至少 6 位");
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }

    setSaving(true);
    try {
      await AccountApi.changePassword({
        currentPassword: hasPassword ? form.currentPassword : undefined,
        newPassword: form.newPassword,
      });
      setHasPassword(true);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage(hasPassword ? "密码已更新" : "密码已设置，下次可用手机号 + 密码登录");
      await refresh();
    } catch (err) {
      const apiErr = err as { error?: { message?: string }; message?: string };
      setError(apiErr.error?.message ?? apiErr.message ?? "密码保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 920 }}>
      <div>
        <div className="mono" style={{ fontSize: 11, color: "var(--fg-2)", letterSpacing: 0.4 }}>
          ACCOUNT
        </div>
        <h1 style={{ margin: "8px 0 6px", fontSize: 30, fontFamily: "var(--font-display)", letterSpacing: -0.3 }}>
          账户设置
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--fg-2)" }}>
          管理当前工作室账号的登录方式。
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <Card style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar seed={user?.username ?? user?.displayName ?? "account"} size={48} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{user?.displayName ?? "当前账号"}</div>
              <div className="mono" style={{ marginTop: 3, fontSize: 11, color: "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis" }}>
                @{user?.username ?? "unknown"}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
            <InfoRow label="手机号" value={user?.phone ?? "未绑定"} />
            <InfoRow label="工作室" value={user?.studio?.name ?? "未绑定"} />
            <InfoRow label="密码登录" value={hasPassword ? "已启用" : "未设置"} />
          </div>
        </Card>

        <Card style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "var(--radius-md)",
                  background: "var(--accent-soft)",
                  color: "var(--accent-strong)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Lock size={16} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{hasPassword ? "修改登录密码" : "设置登录密码"}</div>
                <div style={{ marginTop: 2, fontSize: 12, color: "var(--fg-2)" }}>
                  验证码登录保持可用，密码登录用于日常快速进入工作台。
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowPasswords((v) => !v)}>
              {showPasswords ? <EyeOff size={12} /> : <Eye size={12} />}
              {showPasswords ? "隐藏" : "显示"}
            </Button>
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            {hasPassword && (
              <Field label="当前密码">
                <PasswordInput
                  value={form.currentPassword}
                  onChange={(currentPassword) => setForm((v) => ({ ...v, currentPassword }))}
                  visible={showPasswords}
                  autoComplete="current-password"
                />
              </Field>
            )}
            <Field label="新密码">
              <PasswordInput
                value={form.newPassword}
                onChange={(newPassword) => setForm((v) => ({ ...v, newPassword }))}
                visible={showPasswords}
                autoComplete="new-password"
              />
            </Field>
            <Field label="确认新密码">
              <PasswordInput
                value={form.confirmPassword}
                onChange={(confirmPassword) => setForm((v) => ({ ...v, confirmPassword }))}
                visible={showPasswords}
                autoComplete="new-password"
              />
            </Field>
          </div>

          <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 12 }}>
            <Button variant="accent" size="md" onClick={savePassword} disabled={saving}>
              <Save size={13} />
              {saving ? "保存中" : hasPassword ? "更新密码" : "设置密码"}
            </Button>
            {message && <span style={{ fontSize: 12, color: "var(--success)" }}>{message}</span>}
            {error && <span style={{ fontSize: 12, color: "var(--danger)" }}>{error}</span>}
          </div>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "var(--fg-2)",
              fontSize: 12,
              padding: "10px 12px",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-md)",
              background: "var(--bg-2)",
            }}
          >
            <ShieldCheck size={13} />
            <span>改密只影响本平台账号，不会触碰已绑定的抖音 / 小红书等社交账号凭据。</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
      <span style={{ color: "var(--fg-2)" }}>{label}</span>
      <span style={{ color: "var(--fg-0)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 11, color: "var(--fg-2)", fontFamily: "var(--font-mono)", letterSpacing: 0.3 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function PasswordInput({
  value,
  onChange,
  visible,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  autoComplete: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      style={{
        width: "100%",
        background: "var(--bg-2)",
        border: "1px solid var(--line-2)",
        borderRadius: "var(--radius-md)",
        padding: "10px 12px",
        fontSize: 13,
        color: "var(--fg-0)",
        outline: "none",
      }}
    />
  );
}
