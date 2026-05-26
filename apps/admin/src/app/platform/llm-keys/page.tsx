"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 平台 · LLM 网关 · API 密钥（v0.6 §LLM）
//   给业务侧（music / drama / celebrity 三端）发独立 sk-aep-* 密钥用于调 llm-gateway。
//   创建瞬间唯一一次返回明文；列表只显示前缀脱敏 + 累计 tokens / 调用次数。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Copy, ShieldAlert } from "lucide-react";
import { useConfirm, useToast } from "@/components/feedback";
import { LlmKeysApi } from "@/api";
import type { LlmApiKey, LlmApiKeyUpsert } from "@/api/llm-keys";

interface FormState {
  userId: string;
  name: string;
  enabled: boolean;
}

const EMPTY_FORM: FormState = { userId: "", name: "", enabled: true };

export default function AdminLlmKeysPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [list, setList] = React.useState<LlmApiKey[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState | null>(null);
  const [createdPlaintext, setCreatedPlaintext] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      setList(await LlmKeysApi.list());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onCreate() {
    if (!form) return;
    if (!form.userId.trim() || !form.name.trim()) {
      toast.warning({ title: "归属用户编号 / 密钥备注 必填" });
      return;
    }
    try {
      const body: LlmApiKeyUpsert = {
        userId: form.userId.trim(),
        name: form.name.trim(),
        enabled: form.enabled,
      };
      const created = await LlmKeysApi.create(body);
      setCreatedPlaintext(created.plaintext);
      setForm(null);
      await refresh();
      toast.success({ title: "密钥已创建", description: "请立即复制明文，离开本页后无法再查看。" });
    } catch (e) {
      toast.danger({ title: "创建失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  async function onToggle(k: LlmApiKey) {
    try {
      await LlmKeysApi.update(k.id, { userId: k.userId, name: k.name, enabled: !k.enabled });
      await refresh();
      toast.success({ title: k.enabled ? "已停用" : "已启用" });
    } catch (e) {
      toast.danger({ title: "切换失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  async function onRevoke(k: LlmApiKey) {
    const res = await confirm({
      title: "吊销密钥",
      tone: "danger",
      confirmLabel: "确认吊销",
      requireReason: true,
      reasonPlaceholder: "例如：密钥泄漏 / 业务下线 / 用户离职",
      description: "吊销后立刻失效且不可恢复。业务方需重新申请新密钥。",
      affected: (
        <div className="space-y-1">
          <div className="font-medium">{k.name}</div>
          <div className="text-xs text-muted-foreground">
            归属用户 <span className="font-mono">{k.userId}</span> · 前缀{" "}
            <span className="font-mono">{k.keyMasked}</span>
          </div>
        </div>
      ),
    });
    if (!res.ok) return;
    try {
      await LlmKeysApi.revoke(k.id);
      await refresh();
      toast.success({ title: "密钥已吊销" });
    } catch (e) {
      toast.danger({ title: "吊销失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  async function copyPlaintext() {
    if (!createdPlaintext) return;
    try {
      await navigator.clipboard.writeText(createdPlaintext);
      toast.success({ title: "已复制到剪贴板" });
    } catch {
      toast.warning({ title: "复制失败，请手动选中复制" });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="LLM 网关 · API 密钥"
        description="给业务方（music / drama / celebrity 三端后端）发独立的 sk-aep-* 密钥。每次调用按 token 计费回写到归属用户钱包。"
      />

      {createdPlaintext && (
        <div className="rounded-lg border border-warning/30 bg-warning/8 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="text-sm font-semibold text-foreground">密钥明文仅此一次显示</div>
              <p className="text-xs text-muted-foreground">
                离开本页或刷新后将无法再查看。请立即复制并交付给业务方安全保管。
              </p>
              <code className="block break-all rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm">
                {createdPlaintext}
              </code>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => void copyPlaintext()}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> 复制密钥
                </Button>
                <Button size="sm" onClick={() => setCreatedPlaintext(null)}>
                  我已保存
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">{form ? "新建密钥" : "操作"}</CardTitle>
          {!form && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void refresh()}>
                刷新
              </Button>
              <Button onClick={() => setForm({ ...EMPTY_FORM })}>新建密钥</Button>
            </div>
          )}
        </CardHeader>
        {form && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="归属用户编号" hint="按调用计费扣除该用户钱包，必须为现有 aep_user 编号">
                <Input
                  value={form.userId}
                  placeholder="例如 user-001"
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                />
              </Field>
              <Field label="密钥备注" hint="给运营自己看的，例如「music 后端 prod」">
                <Input
                  value={form.name}
                  placeholder="music 后端 prod"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="启用" hint="停用后业务方调用立即 401">
                <div className="flex h-9 items-center">
                  <Switch
                    checked={form.enabled}
                    onCheckedChange={(v) => setForm({ ...form, enabled: v })}
                  />
                  <span className="ml-2 text-sm text-muted-foreground">
                    {form.enabled ? "已启用" : "已停用"}
                  </span>
                </div>
              </Field>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void onCreate()}>
                <ShieldAlert className="mr-1 h-3.5 w-3.5" /> 创建并显示明文
              </Button>
              <Button variant="outline" onClick={() => setForm(null)}>
                取消
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">密钥列表（{list.length}）</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
          {err && <div className="text-sm text-destructive">{err}</div>}
          {!loading && !err && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>备注</TableHead>
                  <TableHead>归属用户</TableHead>
                  <TableHead>密钥前缀</TableHead>
                  <TableHead className="text-right">累计 tokens</TableHead>
                  <TableHead className="text-right">累计调用</TableHead>
                  <TableHead>最后调用</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="w-[200px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell className="text-xs font-mono">{k.userId}</TableCell>
                    <TableCell className="text-xs font-mono">{k.keyMasked}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {k.totalTokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {k.totalCalls.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      {k.revokedAt ? (
                        <Badge tone="danger" className="font-normal">
                          已吊销
                        </Badge>
                      ) : k.enabled ? (
                        <Badge tone="success" className="font-normal">
                          已启用
                        </Badge>
                      ) : (
                        <Badge tone="neutral" className="font-normal">
                          已停用
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!!k.revokedAt}
                        onClick={() => void onToggle(k)}
                      >
                        {k.enabled ? "停用" : "启用"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={!!k.revokedAt}
                        onClick={() => void onRevoke(k)}
                      >
                        吊销
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium">{label}</div>
      {children}
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
