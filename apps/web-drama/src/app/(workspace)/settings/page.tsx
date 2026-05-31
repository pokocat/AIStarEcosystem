"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Save, UserPlus } from "lucide-react";
import { AccountApi } from "@ai-star-eco/api-client";
import { Button, Card } from "@/components/premium";
import {
  Dialog,
  Field,
  SectionHeader,
  Select,
  StatusBadge,
  TextInput,
  ViewHeader,
} from "@/components/common";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  chip: "owner" | "writer" | "editor" | "guest";
}

const STORAGE_KEY = "drama:settings";

interface StudioSettings {
  studioName: string;
  budget: number; // 积分 / 月
  watermark: string;
  currency: "CNY" | "USD";
  team: TeamMember[];
}

const DEFAULT_SETTINGS: StudioSettings = {
  studioName: "星光工作室",
  budget: 100_000,
  watermark: "© 星光",
  currency: "CNY",
  team: [
    { id: "u-1", name: "李雨萱", role: "工作室运营", chip: "owner" },
    { id: "u-2", name: "陈陌", role: "主创 / 脚本", chip: "writer" },
    { id: "u-3", name: "周亦凡", role: "剪辑 / 上线", chip: "editor" },
    { id: "u-4", name: "Aiko", role: "外协 / 演员", chip: "guest" },
  ],
};

function loadSettings(): StudioSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StudioSettings) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function SettingsPage() {
  const [settings, setSettings] = React.useState<StudioSettings>(DEFAULT_SETTINGS);
  const [draft, setDraft] = React.useState<StudioSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [hasPassword, setHasPassword] = React.useState(false);
  const [passwordForm, setPasswordForm] = React.useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = React.useState(false);
  const [passwordSaving, setPasswordSaving] = React.useState(false);

  React.useEffect(() => {
    const cur = loadSettings();
    setSettings(cur);
    setDraft(cur);
    AccountApi.getMe()
      .then((me) => setHasPassword(Boolean(me.hasPassword)))
      .catch(() => {
        /* 登录态兜底由 AuthProvider 处理。 */
      });
  }, []);

  const dirty = JSON.stringify(settings) !== JSON.stringify(draft);

  async function save() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setSettings(draft);
    setSaving(false);
    toast.success("设置已保存");
  }

  function addMember(name: string, role: string, chip: TeamMember["chip"]) {
    const m: TeamMember = { id: `u-${Date.now()}`, name, role, chip };
    setDraft({ ...draft, team: [...draft.team, m] });
    toast.success(`已邀请 ${name}`);
  }

  function removeMember(id: string) {
    setDraft({ ...draft, team: draft.team.filter((m) => m.id !== id) });
    toast.success("成员已移除");
  }

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
        meta="账户 · 团队 · 偏好"
        action={
          <Button variant="primary" size="md" loading={saving} disabled={!dirty} onClick={save}>
            <Save size={13} />
            {dirty ? "保存修改" : "已保存"}
          </Button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        <Card style={{ padding: "26px 28px" }}>
          <SectionHeader eyebrow="账户" title="账户与计费" />
          <Field label="工作室名称">
            <TextInput
              value={draft.studioName}
              onChange={(e) => setDraft({ ...draft, studioName: e.target.value })}
              maxLength={32}
            />
          </Field>
          <Field label="每月积分预算">
            <TextInput
              type="number"
              min={0}
              value={draft.budget}
              onChange={(e) => setDraft({ ...draft, budget: Number(e.target.value) })}
            />
          </Field>
          <Field label="结算币种">
            <Select
              value={draft.currency}
              onChange={(e) => setDraft({ ...draft, currency: e.target.value as "CNY" | "USD" })}
            >
              <option value="CNY">¥ 人民币</option>
              <option value="USD">$ 美元</option>
            </Select>
          </Field>
          <Field label="默认水印" hint="发布到平台时附加（可空）">
            <TextInput
              value={draft.watermark}
              onChange={(e) => setDraft({ ...draft, watermark: e.target.value })}
              maxLength={32}
            />
          </Field>
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
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
          </div>
        </Card>

        <Card style={{ padding: "26px 28px" }}>
          <SectionHeader
            eyebrow="团队"
            title={`团队成员（${draft.team.length}）`}
            right={
              <Button variant="ghost" size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus size={11} />
                邀请
              </Button>
            }
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {draft.team.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--surface-1)",
                  border: "1px solid var(--line)",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "var(--bg-3)",
                    border: "1px solid var(--line-2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--fg-1)",
                  }}
                >
                  {m.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: "var(--fg-2)" }}>{m.role}</div>
                </div>
                <StatusBadge tone={m.chip === "owner" ? "accent" : "neutral"}>{m.chip}</StatusBadge>
                {m.chip !== "owner" && (
                  <Button variant="ghost" size="sm" onClick={() => removeMember(m.id)}>
                    移除
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvite={(name, role, chip) => addMember(name, role, chip)}
      />
    </div>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  onInvite,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onInvite: (name: string, role: string, chip: TeamMember["chip"]) => void;
}) {
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState("");
  const [chip, setChip] = React.useState<TeamMember["chip"]>("writer");

  React.useEffect(() => {
    if (!open) {
      setName("");
      setRole("");
      setChip("writer");
    }
  }, [open]);

  function submit() {
    if (!name.trim()) {
      toast.error("请填写名字");
      return;
    }
    onInvite(name.trim(), role.trim() || "—", chip);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="邀请新成员"
      description="填写姓名、岗位、角色即可。"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="primary" size="md" onClick={submit}>
            邀请
          </Button>
        </>
      }
    >
      <Field label="姓名" required>
        <TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
      </Field>
      <Field label="岗位">
        <TextInput value={role} onChange={(e) => setRole(e.target.value)} placeholder="如：主创 / 脚本" />
      </Field>
      <Field label="角色">
        <Select value={chip} onChange={(e) => setChip(e.target.value as TeamMember["chip"])}>
          <option value="writer">writer</option>
          <option value="editor">editor</option>
          <option value="guest">guest</option>
        </Select>
      </Field>
    </Dialog>
  );
}
