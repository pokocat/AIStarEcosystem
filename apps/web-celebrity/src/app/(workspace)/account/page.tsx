"use client";

import * as React from "react";
import { Eye, EyeOff, Lock, Save, ShieldCheck, UserCog } from "lucide-react";
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

  // 资料编辑（昵称 / 头像 / 手机号 / 邮箱 / 简介）—— 后端 PATCH /me。
  const [profile, setProfile] = React.useState({
    displayName: "",
    avatarUrl: "",
    phone: "",
    email: "",
    bio: "",
  });
  const [profileDirty, setProfileDirty] = React.useState(false);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [profileMsg, setProfileMsg] = React.useState<string | null>(null);
  const [profileErr, setProfileErr] = React.useState<string | null>(null);

  const hydrateProfile = React.useCallback((u: { displayName?: string; avatarUrl?: string; phone?: string; email?: string; bio?: string }) => {
    setProfile({
      displayName: u.displayName ?? "",
      avatarUrl: u.avatarUrl ?? "",
      phone: u.phone ?? "",
      email: u.email ?? "",
      bio: u.bio ?? "",
    });
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    AccountApi.getMe()
      .then((me) => {
        if (cancelled) return;
        setHasPassword(Boolean(me.hasPassword));
        if (!profileDirty) hydrateProfile(me);
      })
      .catch(() => {
        /* AuthProvider 会处理登录态过期。 */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrateProfile]);

  function setProfileField<K extends keyof typeof profile>(key: K, value: string) {
    setProfile((p) => ({ ...p, [key]: value }));
    setProfileDirty(true);
    setProfileMsg(null);
    setProfileErr(null);
  }

  async function saveProfile() {
    setProfileErr(null);
    setProfileMsg(null);
    if (!profile.displayName.trim()) {
      setProfileErr("请填写昵称");
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await AccountApi.updateProfile({
        displayName: profile.displayName.trim(),
        avatarUrl: profile.avatarUrl.trim() || undefined,
        phone: profile.phone.trim() || undefined,
        email: profile.email.trim() || undefined,
        bio: profile.bio.trim() || undefined,
      });
      hydrateProfile(updated);
      setProfileDirty(false);
      setProfileMsg("资料已更新");
      await refresh();
    } catch (err) {
      const apiErr = err as { error?: { message?: string }; message?: string };
      setProfileErr(apiErr.error?.message ?? apiErr.message ?? "资料保存失败");
    } finally {
      setSavingProfile(false);
    }
  }

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

        {/* 资料编辑 */}
        <Card style={{ padding: 22 }}>
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
              <UserCog size={16} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>编辑资料</div>
              <div style={{ marginTop: 2, fontSize: 12, color: "var(--fg-2)" }}>
                昵称、头像、联系方式与简介，保存后全站生效。
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            <Field label="昵称">
              <TextInput value={profile.displayName} onChange={(v) => setProfileField("displayName", v)} placeholder="工作室 / 显示名称" />
            </Field>
            <Field label="头像链接">
              <TextInput value={profile.avatarUrl} onChange={(v) => setProfileField("avatarUrl", v)} placeholder="https://…（可留空）" />
            </Field>
            <Field label="手机号">
              <TextInput value={profile.phone} onChange={(v) => setProfileField("phone", v)} placeholder="联系手机号" />
            </Field>
            <Field label="邮箱">
              <TextInput value={profile.email} onChange={(v) => setProfileField("email", v)} placeholder="联系邮箱（可留空）" />
            </Field>
            <Field label="简介">
              <TextArea value={profile.bio} onChange={(v) => setProfileField("bio", v)} placeholder="一句话介绍你的工作室 / 主营品类" />
            </Field>
          </div>

          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <Button variant="accent" size="md" onClick={saveProfile} disabled={savingProfile || !profileDirty}>
              <Save size={13} />
              {savingProfile ? "保存中" : "保存资料"}
            </Button>
            {profileMsg && <span style={{ fontSize: 12, color: "var(--success)" }}>{profileMsg}</span>}
            {profileErr && <span style={{ fontSize: 12, color: "var(--danger)" }}>{profileErr}</span>}
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

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
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

function TextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      style={{
        width: "100%",
        background: "var(--bg-2)",
        border: "1px solid var(--line-2)",
        borderRadius: "var(--radius-md)",
        padding: "10px 12px",
        fontSize: 13,
        color: "var(--fg-0)",
        outline: "none",
        resize: "vertical",
        fontFamily: "inherit",
        lineHeight: 1.5,
      }}
    />
  );
}
