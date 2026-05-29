"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 平台 · AI 模型配置（v0.5 §D8）
//   接入 OpenAI 兼容协议的大模型服务商，apiKey 由 server 用 AES-GCM 加密落库。
//   本期仅 OpenAI / OpenAI 兼容协议 真实可用；其他类型可建档，连通性测试会返回「暂不支持」。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Lock, ShieldCheck, ChevronRight, Settings2, Search, Wand2, Download, BarChart3 } from "lucide-react";
import { useConfirm, useToast } from "@/components/feedback";
import { AiModelsApi } from "@/api";
import { cn } from "@/lib/utils";
import type {
  AiModelProvider,
  AiModelProviderType,
  AiModelPurpose,
  AiModelEntry,
  AiModelProviderPreset,
  AiModelUsageReport,
  AiModelUsageStat,
} from "@/api/ai-models";

const PROVIDER_TYPES: AiModelProviderType[] = [
  "OPENAI",
  "OPENAI_COMPATIBLE",
  "ANTHROPIC",
  "AZURE_OPENAI",
  "MOONSHOT",
  "DEEPSEEK",
  "BAIDU",
  "ALIYUN",
  "TENCENT",
  "VOLCENGINE",
  "CUSTOM",
];

const PROVIDER_LABEL: Record<AiModelProviderType, string> = {
  OPENAI: "OpenAI 原生",
  OPENAI_COMPATIBLE: "OpenAI 兼容协议",
  ANTHROPIC: "Anthropic Claude",
  AZURE_OPENAI: "Azure OpenAI",
  MOONSHOT: "月之暗面 Kimi",
  DEEPSEEK: "DeepSeek",
  BAIDU: "百度文心",
  ALIYUN: "阿里通义",
  TENCENT: "腾讯混元",
  VOLCENGINE: "火山豆包",
  CUSTOM: "自定义",
};

const SUPPORTED_PROVIDERS = new Set<AiModelProviderType>(["OPENAI", "OPENAI_COMPATIBLE"]);

const PURPOSES: AiModelPurpose[] = [
  "SCRIPT_DRAFT",
  "SELLING_POINTS",
  "VARIABLE_EXTRACT",
  "SAFETY_REVIEW",
  "VIDEO_REF_ANALYSIS",
  "TEMPLATE_REWRITE",
  "GENERAL",
];

const PURPOSE_LABEL: Record<AiModelPurpose, string> = {
  SCRIPT_DRAFT: "脚本起草",
  SELLING_POINTS: "卖点提取",
  VARIABLE_EXTRACT: "变量抽取",
  SAFETY_REVIEW: "安全审核",
  VIDEO_REF_ANALYSIS: "参考视频解析",
  TEMPLATE_REWRITE: "模板改写",
  GENERAL: "通用",
};

interface FormState {
  id?: string;
  name: string;
  providerType: AiModelProviderType;
  baseUrl: string;
  apiKey: string;
  apiVersion: string;
  defaultModel: string;
  models: AiModelEntry[];
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
  models: [],
  purposes: ["SCRIPT_DRAFT", "TEMPLATE_REWRITE"],
  priority: 100,
  enabled: true,
};

type TestState = "idle" | "running" | "ok" | "fail";

export default function AdminAiModelsPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [list, setList] = React.useState<AiModelProvider[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<FormState | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [testing, setTesting] = React.useState<Record<string, { state: TestState; message?: string }>>({});
  const [presets, setPresets] = React.useState<AiModelProviderPreset[]>([]);
  const [fetchingModels, setFetchingModels] = React.useState(false);
  const [query, setQuery] = React.useState("");

  // v0.41：用量统计
  const [usage, setUsage] = React.useState<AiModelUsageReport | null>(null);
  const [usageDays, setUsageDays] = React.useState(30);
  const [usageLoading, setUsageLoading] = React.useState(true);
  const [usageErr, setUsageErr] = React.useState<string | null>(null);

  const loadUsage = React.useCallback(async (days: number) => {
    setUsageLoading(true);
    setUsageErr(null);
    try {
      setUsage(await AiModelsApi.getUsage(days));
    } catch (e) {
      setUsageErr(e instanceof Error ? e.message : "用量统计加载失败");
    } finally {
      setUsageLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadUsage(usageDays);
  }, [loadUsage, usageDays]);

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

  React.useEffect(() => {
    void AiModelsApi.listPresets()
      .then(setPresets)
      .catch(() => {
        /* 预设拉取失败不阻塞页面 */
      });
  }, []);

  function startFromPreset(p: AiModelProviderPreset) {
    setEditing({
      ...EMPTY_FORM,
      name: p.name,
      providerType: p.providerType,
      baseUrl: p.baseUrl,
      defaultModel: p.suggestedModel ?? "",
      models: [],
    });
    setShowAdvanced(false);
  }

  async function onFetchModels() {
    if (!editing) return;
    if (!editing.baseUrl.trim()) {
      toast.warning({ title: "请先填写调用地址" });
      return;
    }
    // 已存服务商且未重填密钥 → 用落库密钥；否则用表单里新填的密钥发现。
    const useStored = !!editing.id && !editing.apiKey.trim();
    if (!useStored && !editing.apiKey.trim()) {
      toast.warning({ title: "请先填写 API 密钥（已存服务商可留空，用已存密钥）" });
      return;
    }
    setFetchingModels(true);
    try {
      const r = useStored
        ? await AiModelsApi.fetchModels(editing.id!)
        : await AiModelsApi.discoverModels({
            providerType: editing.providerType,
            baseUrl: editing.baseUrl.trim(),
            apiKey: editing.apiKey.trim(),
          });
      if (r.ok) {
        const models = r.models ?? [];
        setEditing((prev) =>
          prev ? { ...prev, models, defaultModel: prev.defaultModel || (models[0]?.id ?? "") } : prev,
        );
        toast.success({ title: `已获取 ${models.length} 个模型`, description: "点选某个模型可设为默认；保存后写入配置。" });
      } else {
        toast.danger({ title: "获取模型失败", description: r.error ?? `HTTP ${r.statusCode ?? "?"}` });
      }
    } catch (e) {
      toast.danger({ title: "获取模型失败", description: e instanceof Error ? e.message : undefined });
    } finally {
      setFetchingModels(false);
    }
  }

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) =>
      [p.name, p.id, p.baseUrl, p.defaultModel ?? "", PROVIDER_LABEL[p.providerType] ?? p.providerType]
        .some((s) => s.toLowerCase().includes(q)),
    );
  }, [list, query]);

  async function onSave() {
    if (!editing) return;
    if (!editing.name.trim() || !editing.baseUrl.trim()) {
      toast.warning({ title: "服务商名称 / 调用地址 必填" });
      return;
    }
    if (!editing.id && !editing.apiKey.trim()) {
      toast.warning({ title: "新建时 API 密钥 必填" });
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
        models: editing.models,
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
      setShowAdvanced(false);
      await refresh();
      toast.success({ title: editing.id ? "已保存" : "服务商已创建" });
    } catch (e) {
      toast.danger({
        title: "保存失败",
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function onDelete(p: AiModelProvider) {
    const res = await confirm({
      title: "删除大模型服务商",
      tone: "danger",
      confirmLabel: "确认删除",
      requireReason: true,
      reasonPlaceholder: "例如：密钥泄漏 / 已迁移到新服务商",
      affected: (
        <div className="space-y-1">
          <div className="font-medium">{p.name}</div>
          <div className="text-xs text-muted-foreground">
            类型：{PROVIDER_LABEL[p.providerType]} · 用途：
            {(p.purposes ?? []).map((x) => PURPOSE_LABEL[x]).join("、") || "未指定"}
          </div>
          <div className="text-xs text-muted-foreground">
            服务商编号 <span className="font-mono">{p.id}</span>
          </div>
        </div>
      ),
      description:
        "删除后依赖该服务商的脚本起草、模板改写、安全审核能力会立即失效。请先确认有兜底服务商在线。",
    });
    if (!res.ok) return;
    try {
      await AiModelsApi.remove(p.id);
      await refresh();
      toast.success({ title: "服务商已删除" });
    } catch (e) {
      toast.danger({ title: "删除失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  async function onTest(id: string) {
    setTesting((t) => ({ ...t, [id]: { state: "running" } }));
    try {
      const r = await AiModelsApi.testConnection(id);
      if (r.ok) {
        setTesting((t) => ({
          ...t,
          [id]: { state: "ok", message: r.statusCode ? `HTTP ${r.statusCode}` : "联通" },
        }));
        toast.success({ title: "联通正常", description: r.statusCode ? `HTTP ${r.statusCode}` : undefined });
      } else {
        setTesting((t) => ({ ...t, [id]: { state: "fail", message: r.error ?? `HTTP ${r.statusCode ?? "?"}` } }));
        toast.danger({ title: "联通失败", description: r.error ?? `HTTP ${r.statusCode ?? "?"}` });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "未知错误";
      setTesting((t) => ({ ...t, [id]: { state: "fail", message: msg } }));
      toast.danger({ title: "联通失败", description: msg });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI 模型配置"
        description="管理对接的大模型服务商（脚本起草、模板改写、安全审核所用）。API 密钥由服务端加密存储，列表仅显示脱敏值。"
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">
            {editing ? (editing.id ? "编辑服务商" : "新建服务商") : "操作"}
          </CardTitle>
          {!editing && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void refresh()}>
                刷新
              </Button>
              <Button onClick={() => setEditing({ ...EMPTY_FORM })}>新建服务商</Button>
            </div>
          )}
        </CardHeader>
        {!editing && presets.length > 0 && (
          <CardContent className="pt-0">
            <div className="mb-2 text-xs text-muted-foreground">
              快速添加（内置常见服务商，选中后只需补 API 密钥）：
            </div>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => startFromPreset(p)}
                  title={p.apiKeyHint}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <Wand2 className="h-3.5 w-3.5 text-primary" />
                  {p.name}
                </button>
              ))}
            </div>
          </CardContent>
        )}
        {editing && (
          <CardContent className="space-y-5">
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="服务商名称" hint="给运营用的备注，例如「主用 GPT-4o」">
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="主用 GPT-4o"
                />
              </Field>
              <Field
                label="服务商类型"
                hint={
                  SUPPORTED_PROVIDERS.has(editing.providerType)
                    ? "本期 chat 接口已真实接通"
                    : "本期 chat 接口尚未接通，可建档但联通性测试不可用"
                }
              >
                <Select
                  value={editing.providerType}
                  onValueChange={(v) => setEditing({ ...editing, providerType: v as AiModelProviderType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        <div className="flex items-center gap-2">
                          <span>{PROVIDER_LABEL[t]}</span>
                          {!SUPPORTED_PROVIDERS.has(t) && (
                            <span className="text-[10px] text-muted-foreground">未接通</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="调用地址" hint="服务商提供的 API base URL">
                <Input
                  value={editing.baseUrl}
                  onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                />
              </Field>
              <Field
                label="API 密钥"
                hint={
                  editing.id
                    ? "留空表示不修改；填写则覆盖。服务端用 AES-GCM 加密落库。"
                    : "新建时必填。服务端用 AES-GCM 加密落库，仅在调用时解密。"
                }
              >
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    autoComplete="new-password"
                    className="pl-8"
                    placeholder={editing.id ? "***（不修改）" : "sk-..."}
                    value={editing.apiKey}
                    onChange={(e) => setEditing({ ...editing, apiKey: e.target.value })}
                  />
                </div>
              </Field>
              <Field label="默认模型" hint="例如 gpt-4o / claude-sonnet-4 / moonshot-v1-32k">
                <Input
                  value={editing.defaultModel}
                  onChange={(e) => setEditing({ ...editing, defaultModel: e.target.value })}
                  placeholder="gpt-4o"
                />
              </Field>
              <Field label="启用" hint="关闭后调度器会跳过该服务商">
                <div className="flex h-9 items-center">
                  <Switch
                    checked={editing.enabled}
                    onCheckedChange={(v) => setEditing({ ...editing, enabled: v })}
                  />
                  <span className="ml-2 text-sm text-muted-foreground">
                    {editing.enabled ? "已启用" : "已停用"}
                  </span>
                </div>
              </Field>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">可用模型</div>
                  <div className="text-xs text-muted-foreground">
                    从服务商接口拉取（GET /models），点选某个设为默认模型；保存后写入配置。
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={fetchingModels}
                  onClick={() => void onFetchModels()}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {fetchingModels ? "获取中…" : "获取模型列表"}
                </Button>
              </div>
              {editing.models.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  尚未获取。填好调用地址 + API 密钥后点「获取模型列表」（已存服务商可留空密钥，用已存密钥）。
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {editing.models.map((m) => {
                    const active = editing.defaultModel === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setEditing({ ...editing, defaultModel: m.id })}
                        aria-pressed={active}
                        title={m.label && m.label !== m.id ? m.label : undefined}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-mono transition-colors",
                          active
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border bg-surface text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {m.id}
                        {active && <span className="font-sans">· 默认</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 text-sm font-medium">用途</div>
              <div className="text-xs text-muted-foreground mb-2">
                标记该服务商可被哪些业务调度使用。可多选。
              </div>
              <div className="flex flex-wrap gap-2">
                {PURPOSES.map((p) => {
                  const checked = editing.purposes.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          purposes: checked
                            ? editing.purposes.filter((x) => x !== p)
                            : [...editing.purposes, p],
                        })
                      }
                      aria-pressed={checked}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        checked
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-surface text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {PURPOSE_LABEL[p]}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-md border border-border bg-surface-muted/40">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex w-full items-center justify-between px-3.5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  <Settings2 className="h-3.5 w-3.5" />
                  高级
                </span>
                <ChevronRight
                  className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-90")}
                />
              </button>
              {showAdvanced && (
                <div className="grid grid-cols-1 gap-4 border-t border-border p-3.5 md:grid-cols-2">
                  <Field label="API 版本" hint="仅 Azure OpenAI 需要，例如 2024-08-01-preview">
                    <Input
                      value={editing.apiVersion}
                      onChange={(e) => setEditing({ ...editing, apiVersion: e.target.value })}
                      placeholder="留空"
                    />
                  </Field>
                  <Field label="优先级" hint="数字越小越优先；同一用途有多个服务商时按此排序">
                    <Input
                      type="number"
                      value={editing.priority}
                      onChange={(e) =>
                        setEditing({ ...editing, priority: Number(e.target.value) || 100 })
                      }
                    />
                  </Field>
                </div>
              )}
            </section>

            <div className="flex gap-2 pt-1">
              <Button onClick={() => void onSave()}>{editing.id ? "保存修改" : "新建"}</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setShowAdvanced(false);
                }}
              >
                取消
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-1.5 text-base">
            <BarChart3 className="h-4 w-4 text-primary" /> 用量统计
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={String(usageDays)} onValueChange={(v) => setUsageDays(Number(v))}>
              <SelectTrigger className="h-8 w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">近 1 天</SelectItem>
                <SelectItem value="7">近 7 天</SelectItem>
                <SelectItem value="30">近 30 天</SelectItem>
                <SelectItem value="90">近 90 天</SelectItem>
                <SelectItem value="365">近 365 天</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => void loadUsage(usageDays)}>
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            按每次调用响应里返回的 token 用量自行汇总（对所有服务商通用，不依赖各家计费接口）。仅统计成功调用。
          </p>
          {usageLoading && <div className="text-sm text-muted-foreground">加载中…</div>}
          {usageErr && <div className="text-sm text-destructive">{usageErr}</div>}
          {!usageLoading && !usageErr && usage && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatBox label="调用次数" value={usage.totalCalls.toLocaleString()} />
                <StatBox label="总 Token" value={usage.totalTokens.toLocaleString()} />
                <StatBox label="输入 Token" value={usage.promptTokens.toLocaleString()} />
                <StatBox label="输出 Token" value={usage.completionTokens.toLocaleString()} />
              </div>
              {usage.totalCalls === 0 ? (
                <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  该时间窗内暂无调用记录。发起脚本起草 / 卖点提取 / 变量抽取等会调用大模型的操作后，这里会出现用量。
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <UsageTable title="按服务商" rows={usage.byProvider} total={usage.totalTokens} />
                  <UsageTable title="按模型" rows={usage.byModel} total={usage.totalTokens} />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>服务商列表（{filtered.length}）</span>
            <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> 密钥加密存储
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-3 max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="搜索名称 / 编号 / 地址 / 模型…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
          {err && <div className="text-sm text-destructive">{err}</div>}
          {!loading && !err && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>调用地址</TableHead>
                  <TableHead>密钥</TableHead>
                  <TableHead>默认模型</TableHead>
                  <TableHead>模型数</TableHead>
                  <TableHead>优先级</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>用途</TableHead>
                  <TableHead className="w-[260px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const t = testing[p.id];
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{p.id}</div>
                      </TableCell>
                      <TableCell>
                        <Badge tone="neutral" className="font-normal">
                          {PROVIDER_LABEL[p.providerType] ?? p.providerType}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs font-mono">
                        {p.baseUrl}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{p.apiKeyMasked}</TableCell>
                      <TableCell className="text-xs">{p.defaultModel ?? "—"}</TableCell>
                      <TableCell className="tabular-nums text-xs">{p.models?.length ?? 0}</TableCell>
                      <TableCell className="tabular-nums">{p.priority}</TableCell>
                      <TableCell>
                        {p.enabled ? (
                          <Badge tone="success" className="font-normal">
                            已启用
                          </Badge>
                        ) : (
                          <Badge tone="neutral" className="font-normal text-muted-foreground">
                            已停用
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {(p.purposes ?? []).map((x) => PURPOSE_LABEL[x]).join("、") || "—"}
                      </TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditing({
                              id: p.id,
                              name: p.name,
                              providerType: p.providerType,
                              baseUrl: p.baseUrl,
                              apiKey: "",
                              apiVersion: p.apiVersion ?? "",
                              defaultModel: p.defaultModel ?? "",
                              models: p.models ?? [],
                              purposes: p.purposes ?? [],
                              priority: p.priority,
                              enabled: p.enabled,
                            })
                          }
                        >
                          编辑
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void onTest(p.id)}
                          aria-live="polite"
                          className={cn(
                            t?.state === "ok" && "border-success/40 text-success",
                            t?.state === "fail" && "border-destructive/40 text-destructive"
                          )}
                        >
                          {t?.state === "running"
                            ? "测试中…"
                            : t?.state === "ok"
                            ? "已联通"
                            : t?.state === "fail"
                            ? "已失败"
                            : "测试连接"}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => void onDelete(p)}>
                          删除
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
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

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function UsageTable({ title, rows, total }: { title: string; rows: AiModelUsageStat[]; total: number }) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium">{title}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">无数据</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{title.includes("模型") ? "模型" : "服务商"}</TableHead>
              <TableHead className="text-right">调用</TableHead>
              <TableHead className="text-right">总 Token</TableHead>
              <TableHead className="text-right">占比</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="max-w-[180px] truncate text-xs font-medium" title={r.label}>
                  {r.label}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">{r.calls.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums text-xs">{r.totalTokens.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                  {total > 0 ? `${((r.totalTokens / total) * 100).toFixed(1)}%` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
