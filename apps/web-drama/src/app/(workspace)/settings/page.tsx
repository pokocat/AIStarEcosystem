"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Users } from "lucide-react";
import { AccountApi } from "@ai-star-eco/api-client";
import { Card } from "@/components/premium";
import { Button } from "@/components/premium";
import { EmptyState, Field, SectionHeader, TextInput, ViewHeader } from "@/components/common";

// 工作室设置：仅「登录密码」有真实后端（AccountApi）。早期这里还有 studioName/预算/水印/币种
// 与一份写死的团队名单（李雨萱等），全部只存浏览器 localStorage、假「已保存」——对所有用户展示
// 同一批编造成员。上线前移除编造数据：团队协作 / 工作室偏好暂无后端 → 老实标「建设中」。
export default function SettingsPage() {
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
      toast.error(apiErr.error?.message ?? apiErr.message ?? "密码保存失败");
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="工作室设置"
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
        meta="账户与登录 · 团队协作"
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        <Card style={{ padding: "26px 28px" }}>
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
            <span>设置后登录页可选择手机号 + 密码登录。</span>
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

        <Card style={{ padding: "26px 28px" }}>
          <SectionHeader eyebrow="团队" title="团队协作" />
          <EmptyState
            icon={<Users size={26} />}
            title="团队协作建设中"
            description="多成员协作（邀请成员、分配角色与权限）正在开发，上线后可在这里管理工作室团队。"
          />
        </Card>
      </div>
    </div>
  );
}
