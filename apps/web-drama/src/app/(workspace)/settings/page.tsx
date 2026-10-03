"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { toast } from "sonner";
import { ExternalLink, Eye, EyeOff, Lock, Users } from "lucide-react";
import { AccountApi, idIssuer, isIdMode } from "@ai-star-eco/api-client";
import { Card } from "@/components/premium";
import { Button } from "@/components/premium";
import { Field, SectionHeader, TextInput, ViewHeader } from "@/components/common";

// 工作室设置：仅「登录密码」有真实后端（AccountApi）。早期这里还有 studioName/预算/水印/币种
// 与一份写死的团队名单（李雨萱等），全部只存浏览器 localStorage、假「已保存」——对所有用户展示
// 同一批编造成员。上线前移除编造数据：团队协作 / 工作室偏好暂无后端 → 老实标「还没上线」。
// v0.197：团队协作只剩一行说明，不再占半页；密码卡在手机上占满宽度。
// 统一账号中心模式下登录走账号中心，这里改的本地密码登录时用不上 → 不再显示表单，改成去账号中心的入口。
export default function SettingsPage() {
  const idMode = isIdMode();
  const issuer = idIssuer();
  const [hasPassword, setHasPassword] = React.useState(false);
  const [passwordForm, setPasswordForm] = React.useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = React.useState(false);
  const [passwordSaving, setPasswordSaving] = React.useState(false);

  React.useEffect(() => {
    AccountApi.getMe()
      .then((me) => setHasPassword(Boolean(me.hasPassword)))
      .catch(() => {
        /* 登录态兜底由 AuthProvider 处理。 */
      });
  }, []);

  async function savePassword() {
    if (hasPassword && !passwordForm.currentPassword.trim()) {
      toast.error("请填写当前密码");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error("新密码至少 6 位");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }

    setPasswordSaving(true);
    try {
      await AccountApi.changePassword({
        currentPassword: hasPassword ? passwordForm.currentPassword : undefined,
        newPassword: passwordForm.newPassword,
      });
      setHasPassword(true);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success(hasPassword ? "密码已更新" : "密码已设置");
    } catch (err) {
      const apiErr = err as { error?: { message?: string }; message?: string };
      toast.error(apiErr.error?.message ?? apiErr.message ?? "密码没保存上，请重试");
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="账户"
        title={
          <>
            工作室{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              设置
            </span>
          </>
        }
        meta="登录密码"
      />

      <div className="acct-settings">
        {idMode ? (
          <Card style={{ padding: "24px 26px" }}>
            <SectionHeader eyebrow="登录" title="登录密码" />
            <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.7, marginBottom: issuer ? 14 : 0 }}>
              现在用统一账号登录。登录密码、手机号和微信绑定都在账号中心改，改完所有产品一起生效。
            </div>
            {issuer && (
              <a href={`${issuer}/`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <Button variant="secondary" size="md">
                  去账号中心 <ExternalLink size={12} />
                </Button>
              </a>
            )}
          </Card>
        ) : (
        <Card style={{ padding: "24px 26px" }}>
          <SectionHeader
            eyebrow="登录"
            title={hasPassword ? "修改登录密码" : "设置登录密码"}
            right={
              <Button variant="ghost" size="sm" onClick={() => setShowPasswords((v) => !v)}>
                {showPasswords ? <EyeOff size={11} /> : <Eye size={11} />}
                {showPasswords ? "隐藏" : "显示"}
              </Button>
            }
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, color: "var(--fg-2)", fontSize: 12 }}>
            <Lock size={13} />
            <span>设好后，登录时可以用手机号加密码，不用每次等验证码。</span>
          </div>
          {hasPassword && (
            <Field label="当前密码">
              <TextInput
                type={showPasswords ? "text" : "password"}
                value={passwordForm.currentPassword}
                autoComplete="current-password"
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              />
            </Field>
          )}
          <Field label="新密码">
            <TextInput
              type={showPasswords ? "text" : "password"}
              value={passwordForm.newPassword}
              autoComplete="new-password"
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            />
          </Field>
          <Field label="确认新密码">
            <TextInput
              type={showPasswords ? "text" : "password"}
              value={passwordForm.confirmPassword}
              autoComplete="new-password"
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            />
          </Field>
          <Button variant="secondary" size="md" loading={passwordSaving} onClick={savePassword}>
            {hasPassword ? "更新密码" : "设置密码"}
          </Button>
        </Card>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px dashed var(--line)",
            color: "var(--ink-3)",
            fontSize: 12.5,
            lineHeight: 1.6,
          }}
        >
          <Users size={15} style={{ flex: "none", marginTop: 2 }} />
          <span style={{ minWidth: 0 }}>
            团队协作还没上线：邀请同事一起做剧、分配权限的功能还在做，上线后在这里加成员。
          </span>
        </div>
      </div>
    </div>
  );
}
