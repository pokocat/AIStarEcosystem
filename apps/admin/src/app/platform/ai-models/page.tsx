"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 平台 · AI 模型配置（v0.5 §D8 新增）
//   - 接入 OpenAI 兼容协议的 LLM provider（支持 Anthropic / Azure / 月之暗面 / 国产等 enum，
//     但本期 chat 调用仅 OPENAI / OPENAI_COMPATIBLE 真实跑通）
//   - apiKey 入口走明文，service 端 AES-GCM 加密落库；列表只显示脱敏值
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AiModelsApi } from "@/api";
import type { AiModelProvider, AiModelProviderType, AiModelPurpose } from "@/api/ai-models";

const PROVIDER_TYPES: AiModelProviderType[] = [
  "OPENAI", "OPENAI_COMPATIBLE", "ANTHROPIC", "AZURE_OPENAI",
  "MOONSHOT", "DEEPSEEK", "BAIDU", "ALIYUN", "TENCENT", "CUSTOM",
];
const PURPOSES: AiModelPurpose[] = [
  "SCRIPT_DRAFT", "SAFETY_REVIEW", "VIDEO_REF_ANALYSIS", "TEMPLATE_REWRITE", "GENERAL",
];

interface FormState {
  id?: string;
  name: string;
  providerType: AiModelProviderType;
  baseUrl: string;
  apiKey: string;
  apiVersion: string;
  defaultModel: string;
  purposes: AiModelPurpose[];
  priority: number;
  enabled: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  providerType: "OPENAI_COMPATIBLE",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  apiVersion: "",
  defaultModel: "gpt-4o",
  purposes: ["SCRIPT_DRAFT", "TEMPLATE_REWRITE"],
  priority: 100,
  enabled: true,
};

export default function AdminAiModelsPage() {
  const [list, setList] = React.useState<AiModelProvider[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<FormState | null>(null);
  const [testing, setTesting] = React.useState<Record<string, string>>({});

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      setList(await AiModelsApi.list());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onSave() {
    if (!editing) return;
    if (!editing.name.trim() || !editing.baseUrl.trim()) {
      alert("name / baseUrl 必填");
      return;
    }
    if (!editing.id && !editing.apiKey.trim()) {
      alert("新建时 apiKey 必填");
      return;
    }
    try {
      const body = {
        name: editing.name.trim(),
        providerType: editing.providerType,
        baseUrl: editing.baseUrl.trim(),
        ...(editing.apiKey.trim() ? { apiKey: editing.apiKey.trim() } : {}),
        apiVersion: editing.apiVersion.trim() || undefined,
        defaultModel: editing.defaultModel.trim() || undefined,
        purposes: editing.purposes,
        priority: editing.priority,
        enabled: editing.enabled,
      };
      if (editing.id) {
        await AiModelsApi.update(editing.id, body);
      } else {
        await AiModelsApi.create(body);
      }
      setEditing(null);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失败");
    }
  }
  async function onDelete(id: string) {
    if (!confirm("删除该 provider？")) return;
    try {
      await AiModelsApi.remove(id);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  }
  async function onTest(id: string) {
    setTesting((t) => ({ ...t, [id]: "测试中…" }));
    try {
      const r = await AiModelsApi.testConnection(id);
      setTesting((t) => ({ ...t, [id]: r.ok ? `OK (${r.statusCode ?? "?"})` : `FAIL: ${r.error ?? r.statusCode}` }));
    } catch (e) {
      setTesting((t) => ({ ...t, [id]: e instanceof Error ? `FAIL: ${e.message}` : "FAIL" }));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI 模型配置"
        description="管理 OpenAI 兼容 API（含 Anthropic / Azure / 月之暗面 / 国产等）。本期 chat 调用仅 OPENAI / OPENAI_COMPATIBLE 真实可用，其他 providerType CRUD 可建但 testConnection 会返回 'not yet supported'。apiKey 走 AES-GCM 加密落库。"
      />

      <Card>
        <CardHeader>
          <CardTitle>{editing ? (editing.id ? "编辑 provider" : "新建 provider") : "操作"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!editing ? (
            <div className="flex gap-2">
              <Button onClick={() => setEditing({ ...EMPTY_FORM })}>+ 新建 provider</Button>
              <Button variant="outline" onClick={() => void refresh()}>刷新</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="name（运营备注）"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="providerType">
                <Select value={editing.providerType} onValueChange={(v) => setEditing({ ...editing, providerType: v as AiModelProviderType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="baseUrl"><Input value={editing.baseUrl} onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value })} /></Field>
              <Field label={`apiKey${editing.id ? "（编辑模式留空表示不修改）" : "（必填）"}`}>
                <Input type="password" autoComplete="new-password" placeholder={editing.id ? "***（不修改）" : "sk-..."} value={editing.apiKey} onChange={(e) => setEditing({ ...editing, apiKey: e.target.value })} />
              </Field>
              <Field label="apiVersion（Azure 用）"><Input value={editing.apiVersion} onChange={(e) => setEditing({ ...editing, apiVersion: e.target.value })} /></Field>
              <Field label="defaultModel"><Input value={editing.defaultModel} onChange={(e) => setEditing({ ...editing, defaultModel: e.target.value })} /></Field>
              <Field label="priority（数字越小优先级越高）"><Input type="number" value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) || 100 })} /></Field>
              <Field label="enabled">
                <input type="checkbox" checked={editing.enabled} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} />
              </Field>
              <div className="md:col-span-2">
                <div className="mb-1 text-xs text-muted-foreground">purposes（多选）</div>
                <div className="flex flex-wrap gap-2">
                  {PURPOSES.map((p) => {
                    const checked = editing.purposes.includes(p);
                    return (
                      <label key={p} className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${checked ? "border-emerald-300 bg-emerald-50" : "border-slate-300"}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setEditing({
                            ...editing,
                            purposes: e.target.checked
                              ? [...editing.purposes, p]
                              : editing.purposes.filter((x) => x !== p),
                          })}
                        />{p}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button onClick={() => void onSave()}>{editing.id ? "保存修改" : "新建"}</Button>
                <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>provider 列表（{list.length}）</CardTitle></CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
          {err && <div className="text-sm text-rose-600">{err}</div>}
          {!loading && !err && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>name</TableHead>
                  <TableHead>type</TableHead>
                  <TableHead>baseUrl</TableHead>
                  <TableHead>apiKey</TableHead>
                  <TableHead>defaultModel</TableHead>
                  <TableHead>priority</TableHead>
                  <TableHead>enabled</TableHead>
                  <TableHead>purposes</TableHead>
                  <TableHead className="w-[260px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell><span className="rounded bg-slate-100 px-1 text-xs">{p.providerType}</span></TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs font-mono">{p.baseUrl}</TableCell>
                    <TableCell className="text-xs font-mono">{p.apiKeyMasked}</TableCell>
                    <TableCell className="text-xs">{p.defaultModel ?? "—"}</TableCell>
                    <TableCell>{p.priority}</TableCell>
                    <TableCell>{p.enabled ? "✓" : "✗"}</TableCell>
                    <TableCell className="text-xs">{(p.purposes ?? []).join(", ")}</TableCell>
                    <TableCell className="space-x-1">
                      <Button size="sm" variant="outline" onClick={() => setEditing({
                        id: p.id,
                        name: p.name,
                        providerType: p.providerType,
                        baseUrl: p.baseUrl,
                        apiKey: "",
                        apiVersion: p.apiVersion ?? "",
                        defaultModel: p.defaultModel ?? "",
                        purposes: p.purposes ?? [],
                        priority: p.priority,
                        enabled: p.enabled,
                      })}>编辑</Button>
                      <Button size="sm" variant="outline" onClick={() => void onTest(p.id)}>
                        {testing[p.id] ?? "测试"}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => void onDelete(p.id)}>删</Button>
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
