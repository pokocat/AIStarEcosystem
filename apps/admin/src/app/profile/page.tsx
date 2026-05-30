"use client";

import * as React from "react";
import { KeyRound, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getMe, changePassword, type AdminMeUser } from "@/api/auth";
import { formatDateCN } from "@/lib/utils";
import { useToast } from "@/components/feedback";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "超级管理员",
  OPERATOR: "平台运营",
  super_admin: "超级管理员",
  operator: "平台运营",
};

const SOURCE_LABEL: Record<string, string> = {
  admin: "管理员账号",
  operator: "平台运营账号",
};

export default function AdminProfilePage() {
  const toast = useToast();
  const [me, setMe] = React.useState<AdminMeUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    getMe()
      .then((user) => {
        if (alive) setMe(user);
      })
      .catch(() => {
        if (alive) setMe(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);
    if (newPassword.length < 6) {
      setFormError("新密码至少 6 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError("两次输入的新密码不一致");
      return;
    }
    if (currentPassword === newPassword) {
      setFormError("新密码不能与当前密码相同");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success({ title: "密码已更新", description: "下次登录请使用新密码。" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "修改密码失败");
    } finally {
      setSubmitting(false);
    }
  }

  const role = me?.role ? ROLE_LABEL[me.role] ?? me.role : "—";
  const source = me?.accountSource ? SOURCE_LABEL[me.accountSource] ?? me.accountSource : "—";

  return (
    <div className="mx-auto max-w-screen-xl">
      <PageHeader
        title="个人设置"
        description="查看当前后台登录身份，修改自己的登录密码。"
        breadcrumb={[{ label: "全局" }, { label: "个人设置" }]}
      />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              登录身份
            </CardTitle>
            <CardDescription>该信息来自当前 JWT 对应的后台账号。</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在读取账号信息
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoField label="显示名" value={me?.displayName || "—"} />
                <InfoField label="用户名" value={me?.username || "—"} />
                <InfoField label="邮箱" value={me?.email || "—"} />
                <InfoField label="账号来源" value={source} />
                <div>
                  <div className="text-xs text-muted-foreground">角色</div>
                  <div className="mt-1">
                    <Badge tone={me?.role?.toUpperCase() === "SUPER_ADMIN" ? "primary" : "neutral"}>
                      {role}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">状态</div>
                  <div className="mt-1">
                    <Badge tone={me?.status === "active" ? "success" : "warning"}>
                      {me?.status === "active" ? "正常" : me?.status ?? "—"}
                    </Badge>
                  </div>
                </div>
                <InfoField label="上次登录" value={me?.lastLoginAt ? formatDateCN(me.lastLoginAt) : "—"} />
                <InfoField label="账号编号" value={me?.id || "—"} className="sm:col-span-2" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              修改密码
            </CardTitle>
            <CardDescription>适用于管理员账号和平台运营账号。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3.5" onSubmit={handlePasswordSubmit}>
              <Field
                id="currentPassword"
                label="当前密码"
                value={currentPassword}
                autoComplete="current-password"
                onChange={setCurrentPassword}
              />
              <Field
                id="newPassword"
                label="新密码"
                value={newPassword}
                autoComplete="new-password"
                onChange={setNewPassword}
              />
              <Field
                id="confirmPassword"
                label="确认新密码"
                value={confirmPassword}
                autoComplete="new-password"
                onChange={setConfirmPassword}
              />

              {formError && (
                <div role="alert" className="rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || !currentPassword || !newPassword || !confirmPassword}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                保存新密码
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function InfoField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-all text-sm font-medium">{value}</div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  autoComplete,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  autoComplete: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground/80" htmlFor={id}>
        {label}
      </label>
      <Input
        id={id}
        type="password"
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
