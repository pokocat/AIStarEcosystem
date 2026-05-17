"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 平台 · LLM 网关 API Key 管理（v0.6 §LLM 新增）
//   - 给业务侧（music/drama/celebrity 三端）发独立 sk-aep-* key 用于调 llm-gateway
//   - 创建时唯一一次返回明文，立即复制保存
//   - 列表显示前缀脱敏 + 累计 tokens / calls
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LlmKeysApi } from "@/api";
import type { LlmApiKey, LlmApiKeyUpsert } from "@/api/llm-keys";

interface FormState {
  userId: string;
  name: string;
  enabled: boolean;
}

const EMPTY_FORM: FormState = { userId: "", name: "", enabled: true };

export default function AdminLlmKeysPage() {
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
      alert("userId / name 必填");
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
    } catch (e) {
      alert(e instanceof Error ? e.message : "创建失败");
    }
  }

  async function onToggle(k: LlmApiKey) {
    try {
      await LlmKeysApi.update(k.id, { userId: k.userId, name: k.name, enabled: !k.enabled });
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "切换失败");
    }
  }

  async function onRevoke(id: string) {
    if (!confirm("吊销该 key？吊销后不可恢复。")) return;
    try {
      await LlmKeysApi.revoke(id);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "吊销失败");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="LLM 网关 · API Key"
        description="给业务侧发独立 sk-aep-* key，用于调用 llm-gateway（OpenAI 兼容）。创建瞬间唯一一次返回明文，请立刻复制保存。每次调用按 token 计费回写到用户 wallet ledger。"
      />

      {createdPlaintext && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-700">⚠ 明文 key（仅本次显示）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <code className="block break-all rounded bg-white px-3 py-2 font-mono text-sm">
              {createdPlaintext}
            </code>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigator.clipboard.writeText(createdPlaintext)}
              >
                复制
              </Button>
              <Button size="sm" onClick={() => setCreatedPlaintext(null)}>我已保存</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{form ? "新建 API Key" : "操作"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!form ? (
            <div className="flex gap-2">
              <Button onClick={() => setForm({ ...EMPTY_FORM })}>+ 新建 key</Button>
              <Button variant="outline" onClick={() => void refresh()}>刷新</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="userId（钱包扣费归属）">
                <Input
                  value={form.userId}
                  placeholder="例如 user-001"
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                />
              </Field>
              <Field label="name（备注）">
                <Input
                  value={form.name}
                  placeholder="例如 music 后端调用"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="enabled">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                />
              </Field>
              <div className="md:col-span-2 flex gap-2">
                <Button onClick={() => void onCreate()}>创建（生成明文）</Button>
                <Button variant="outline" onClick={() => setForm(null)}>取消</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>key 列表（{list.length}）</CardTitle></CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
          {err && <div className="text-sm text-rose-600">{err}</div>}
          {!loading && !err && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>name</TableHead>
                  <TableHead>userId</TableHead>
                  <TableHead>prefix</TableHead>
                  <TableHead>tokens</TableHead>
                  <TableHead>calls</TableHead>
                  <TableHead>lastUsed</TableHead>
                  <TableHead>enabled</TableHead>
                  <TableHead className="w-[200px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell>{k.name}</TableCell>
                    <TableCell className="text-xs font-mono">{k.userId}</TableCell>
                    <TableCell className="text-xs font-mono">{k.keyMasked}</TableCell>
                    <TableCell>{k.totalTokens.toLocaleString()}</TableCell>
                    <TableCell>{k.totalCalls.toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "—"}</TableCell>
                    <TableCell>{k.revokedAt ? "✗（已吊销）" : k.enabled ? "✓" : "✗"}</TableCell>
                    <TableCell className="space-x-1">
                      <Button size="sm" variant="outline" disabled={!!k.revokedAt} onClick={() => void onToggle(k)}>
                        {k.enabled ? "禁用" : "启用"}
                      </Button>
                      <Button size="sm" variant="destructive" disabled={!!k.revokedAt} onClick={() => void onRevoke(k.id)}>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
