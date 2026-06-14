"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 平台 · AI 模型与 Key（v0.41 合并自「AI 模型」+「LLM 网关 Key」）
//   · 模型接入端点 = 固定 {上游密钥 + 单模型 + 地址}，自带网关 Key（sk-aep-*）。
//   · AI 应用绑定 = 每个用途（脚本起草 / 卖点提取 / 变量抽取…）固定指向一个端点。
//   上游密钥由 server AES-GCM 加密落库；网关 Key 仅铸造瞬间返回明文一次（DB 存 bcrypt）。
//   本期仅 OpenAI / OpenAI 兼容协议 真实可用；其它类型可建档，连通性测试返回「暂不支持」。
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Lock,
  ShieldCheck,
  ChevronRight,
  Settings2,
  Search,
  Wand2,
  Download,
  KeyRound,
  Copy,
  AlertTriangle,
  Link2,
  BarChart3,
} from "lucide-react";
import { useConfirm, useToast } from "@/components/feedback";
import { AiModelsApi } from "@/api";
import { cn } from "@/lib/utils";
import type {
  AiModelEndpoint,
  AiModelProviderType,
  AiModelPurpose,
  AiModelEntry,
  AiModelProviderPreset,
  AiAppBinding,
  AiModelUsageReport,
  AiModelUsageStat,
  AdminAiModelEndpointUpsert,
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
const NONE = "__none__";

type EditMode = "create" | "edit" | "copy";

interface FormDefaults {
  name?: string;
  baseUrl?: string;
  apiVersion?: string;
  model?: string;
  ownerUserId?: string;
  apiKeyHint?: string;
  sourceName?: string;
}

interface FormState {
  id?: string;
  mode: EditMode;
  name: string;
  providerType: AiModelProviderType;
  baseUrl: string;
  apiKey: string;
  apiVersion: string;
  model: string;
  models: AiModelEntry[];
  ownerUserId: string;
  clearOwnerUserId: boolean;
  enabled: boolean;
  defaults?: FormDefaults;
}

const EMPTY_FORM: FormState = {
  mode: "create",
  name: "",
  providerType: "OPENAI_COMPATIBLE",
  baseUrl: "",
  apiKey: "",
  apiVersion: "",
  model: "",
  models: [],
  ownerUserId: "",
  clearOwnerUserId: false,
  enabled: true,
  defaults: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
  },
};

type TestState = "idle" | "running" | "ok" | "fail";

type BindingGroupKey = "celebrity" | "drama" | "aiavatar" | "creator" | "platform";

const BINDING_GROUPS: Array<{
  key: BindingGroupKey;
  label: string;
  description: string;
  purposes: AiModelPurpose[];
}> = [
  {
    key: "celebrity",
    label: "明星带货",
    description: "模板脚本、商品卖点、变量抽取、参考分析与带货视频生成。",
    purposes: ["SCRIPT_DRAFT", "SELLING_POINTS", "VARIABLE_EXTRACT", "VIDEO_GENERATION", "VIDEO_REF_ANALYSIS", "TEMPLATE_REWRITE"],
  },
  {
    key: "drama",
    label: "AI 短剧",
    description:
      "短剧生成链路：分场景脚本起草、分镜首帧图像、短剧/短视频生成。其中「图像生成 / 视频生成」为跨产品共享端点（同一端点亦服务明星带货视频），在此改绑会同时影响其它产品线。",
    purposes: ["DRAMA_SCRIPT_DRAFT", "IMAGE_GENERATION", "VIDEO_GENERATION"],
  },
  {
    key: "aiavatar",
    label: "AiAvatar",
    description: "数字人人设解析、图片生成与视频生成的多模态调用。",
    purposes: ["DAP_PERSONA", "DAP_IMAGE", "DAP_VIDEO"],
  },
  {
    key: "creator",
    label: "音乐/短剧形象",
    description: "AI 音乐人与 AI 短剧共用的形象锻造顾问能力。",
    purposes: ["APPEARANCE_FORGE"],
  },
  {
    key: "platform",
    label: "平台通用",
    description: "风控复检与兜底通用能力。新增未归类用途也会先落在这里。",
    purposes: ["SAFETY_REVIEW", "GENERAL"],
  },
];

// 被任一分组显式声明的用途集合；未声明的用途落到「平台通用」兜底分组。
// 注意：一个用途可以出现在多个分组（如 VIDEO_GENERATION 同时服务明星带货与短剧），
// 故这里用集合判定「是否已声明」，而非 purpose→单一分组 的映射。
const DECLARED_PURPOSES = new Set<AiModelPurpose>(BINDING_GROUPS.flatMap((group) => group.purposes));

function valueOrDefault(form: FormState, key: keyof Pick<FormState, "name" | "baseUrl" | "apiVersion" | "model" | "ownerUserId">): string {
  const value = form[key].trim();
  if (value) return value;
  const fallback = form.defaults?.[key]?.trim();
  return fallback ?? "";
}

function placeholderFor(form: FormState, key: keyof FormDefaults, fallback: string): string {
  const value = form.defaults?.[key]?.trim();
  if (!value) return fallback;
  if (form.mode === "edit") return `当前：${value}`;
  if (form.mode === "copy") return `复制来源：${value}`;
  return value;
}

function formTitle(form: FormState | null): string {
  if (!form) return "操作";
  if (form.mode === "edit") return "编辑端点";
  if (form.mode === "copy") return "复制为新端点";
  return "新建端点";
}

function editFormFromEndpoint(p: AiModelEndpoint): FormState {
  return {
    ...EMPTY_FORM,
    id: p.id,
    mode: "edit",
    name: p.name,
    providerType: p.providerType,
    baseUrl: p.baseUrl,
    apiVersion: p.apiVersion ?? "",
    model: p.model ?? "",
    models: p.models ?? [],
    ownerUserId: p.ownerUserId ?? "",
    enabled: p.enabled,
    defaults: {
      name: p.name,
      baseUrl: p.baseUrl,
      apiVersion: p.apiVersion ?? "",
      model: p.model ?? "",
      ownerUserId: p.ownerUserId ?? "",
      sourceName: p.name,
    },
  };
}

function copyFormFromEndpoint(p: AiModelEndpoint): FormState {
  return {
    ...EMPTY_FORM,
    mode: "copy",
    providerType: p.providerType,
    models: p.models ?? [],
    enabled: p.enabled,
    defaults: {
      name: `${p.name} 副本`,
      baseUrl: p.baseUrl,
      apiVersion: p.apiVersion ?? "",
      model: p.model ?? "",
      ownerUserId: p.ownerUserId ?? "",
      sourceName: p.name,
    },
  };
}

export default function AdminAiModelsPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [endpoints, setEndpoints] = React.useState<AiModelEndpoint[]>([]);
  const [bindings, setBindings] = React.useState<AiAppBinding[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<FormState | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [bindingGroup, setBindingGroup] = React.useState<BindingGroupKey>("celebrity");
  const [testing, setTesting] = React.useState<Record<string, { state: TestState; message?: string }>>({});
  const [presets, setPresets] = React.useState<AiModelProviderPreset[]>([]);
  const [fetchingModels, setFetchingModels] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [mintedPlaintext, setMintedPlaintext] = React.useState<string | null>(null);
  // 用量统计（v0.41，合并自 goods_to_video）
  const [usage, setUsage] = React.useState<AiModelUsageReport | null>(null);
  const [usageDays, setUsageDays] = React.useState(30);
  const [usageLoading, setUsageLoading] = React.useState(true);
  const [usageErr, setUsageErr] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [eps, bs] = await Promise.all([AiModelsApi.list(), AiModelsApi.listBindings()]);
      setEndpoints(eps);
      setBindings(bs);
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

  const loadUsage = React.useCallback(async (days: number) => {
    setUsageLoading(true);
    setUsageErr(null);
    try {
      setUsage(await AiModelsApi.getUsage(days));
    } catch (e) {
      setUsageErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setUsageLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadUsage(usageDays);
  }, [loadUsage, usageDays]);

  function startFromPreset(p: AiModelProviderPreset) {
    setEditing({
      ...EMPTY_FORM,
      mode: "create",
      providerType: p.providerType,
      models: [],
      defaults: {
        name: p.name,
        baseUrl: p.baseUrl,
        model: p.suggestedModel ?? "",
        apiKeyHint: p.apiKeyHint,
      },
    });
    setShowAdvanced(false);
  }

  const bindingsByGroup = React.useMemo(() => {
    const grouped: Record<BindingGroupKey, AiAppBinding[]> = {
      celebrity: [],
      drama: [],
      aiavatar: [],
      creator: [],
      platform: [],
    };
    const byPurpose = new Map(bindings.map((b) => [b.purpose, b] as const));
    // 显式分组：一个用途可被多个分组声明（共享端点同时出现在各产品线 tab）。
    for (const group of BINDING_GROUPS) {
      for (const purpose of group.purposes) {
        const b = byPurpose.get(purpose);
        if (b) grouped[group.key].push(b);
      }
    }
    // 未被任何分组声明的用途 → 落到「平台通用」兜底。
    for (const b of bindings) {
      if (!DECLARED_PURPOSES.has(b.purpose)) grouped.platform.push(b);
    }
    return grouped;
  }, [bindings]);

  React.useEffect(() => {
    if (bindingsByGroup[bindingGroup]?.length) return;
    const firstNonEmpty = BINDING_GROUPS.find((group) => bindingsByGroup[group.key].length > 0);
    if (firstNonEmpty) setBindingGroup(firstNonEmpty.key);
  }, [bindingGroup, bindingsByGroup]);

  async function onFetchModels() {
    if (!editing) return;
    const baseUrl = valueOrDefault(editing, "baseUrl");
    if (!baseUrl) {
      toast.warning({ title: "请先填写调用地址" });
      return;
    }
    const useStored = !!editing.id && !editing.apiKey.trim();
    if (!useStored && !editing.apiKey.trim()) {
      toast.warning({ title: "请先填写 API 密钥（已存端点可留空，用已存密钥）" });
      return;
    }
    setFetchingModels(true);
    try {
      const r = useStored
        ? await AiModelsApi.fetchModels(editing.id!)
        : await AiModelsApi.discoverModels({
            providerType: editing.providerType,
            baseUrl,
            apiKey: editing.apiKey.trim(),
          });
      if (r.ok) {
        const models = r.models ?? [];
        setEditing((prev) =>
          prev ? { ...prev, models, model: prev.model || (models[0]?.id ?? "") } : prev,
        );
        toast.success({ title: `已获取 ${models.length} 个模型`, description: "点选一个模型设为本端点固定模型；保存后写入配置。" });
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
    if (!q) return endpoints;
    return endpoints.filter((p) =>
      [p.name, p.id, p.baseUrl, p.model ?? "", PROVIDER_LABEL[p.providerType] ?? p.providerType]
        .some((s) => s.toLowerCase().includes(q)),
    );
  }, [endpoints, query]);

  async function onSave() {
    if (!editing) return;
    const name = valueOrDefault(editing, "name");
    const baseUrl = valueOrDefault(editing, "baseUrl");
    const apiVersion = valueOrDefault(editing, "apiVersion");
    const model = valueOrDefault(editing, "model");
    const ownerUserId = valueOrDefault(editing, "ownerUserId");

    if (!name || !baseUrl) {
      toast.warning({ title: "端点名称 / 调用地址 必填" });
      return;
    }
    if (!editing.id && !editing.apiKey.trim()) {
      toast.warning({ title: "新建时上游 API 密钥 必填" });
      return;
    }
    try {
      const body: AdminAiModelEndpointUpsert = {
        name,
        providerType: editing.providerType,
        baseUrl,
        ...(editing.apiKey.trim() ? { apiKey: editing.apiKey.trim() } : {}),
        apiVersion: apiVersion || undefined,
        model: model || undefined,
        models: editing.models,
        enabled: editing.enabled,
      };
      if (editing.clearOwnerUserId) {
        body.ownerUserId = "";
      } else if (editing.ownerUserId.trim()) {
        body.ownerUserId = editing.ownerUserId.trim();
      } else if (ownerUserId) {
        body.ownerUserId = ownerUserId;
      }
      if (editing.id) {
        await AiModelsApi.update(editing.id, body);
      } else {
        await AiModelsApi.create(body);
      }
      setEditing(null);
      setShowAdvanced(false);
      await refresh();
      toast.success({ title: editing.id ? "已保存" : "端点已创建" });
    } catch (e) {
      toast.danger({ title: "保存失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  async function onDelete(p: AiModelEndpoint) {
    const boundPurposes = bindings.filter((b) => b.endpointId === p.id).map((b) => b.purposeLabel);
    const res = await confirm({
      title: "删除模型接入端点",
      tone: "danger",
      confirmLabel: "确认删除",
      requireReason: true,
      reasonPlaceholder: "例如：密钥泄漏 / 已迁移到新端点",
      affected: (
        <div className="space-y-1">
          <div className="font-medium">{p.name}</div>
          <div className="text-xs text-muted-foreground">
            类型：{PROVIDER_LABEL[p.providerType]} · 模型：{p.model ?? "未设置"}
          </div>
          <div className="text-xs text-muted-foreground">
            端点编号 <span className="font-mono">{p.id}</span>
          </div>
          {boundPurposes.length > 0 && (
            <div className="text-xs text-warning">
              当前被 {boundPurposes.join("、")} 绑定，需先解绑才能删除。
            </div>
          )}
        </div>
      ),
      description: "删除后依赖该端点的 AI 应用会立即失效。请先在「AI 应用绑定」改绑或解绑。",
    });
    if (!res.ok) return;
    try {
      await AiModelsApi.remove(p.id);
      await refresh();
      toast.success({ title: "端点已删除" });
    } catch (e) {
      toast.danger({ title: "删除失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  async function onTest(id: string) {
    setTesting((t) => ({ ...t, [id]: { state: "running" } }));
    try {
      const r = await AiModelsApi.testConnection(id);
      if (r.ok) {
        setTesting((t) => ({ ...t, [id]: { state: "ok", message: r.statusCode ? `HTTP ${r.statusCode}` : "联通" } }));
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

  async function onMintKey(p: AiModelEndpoint) {
    if (p.hasKey) {
      const res = await confirm({
        title: "重新生成网关 Key",
        tone: "danger",
        confirmLabel: "重新生成",
        description: "重新生成后，旧 Key 立即失效；正在用旧 Key 的业务方需更换。明文仅显示一次。",
        affected: <div className="font-medium">{p.name}</div>,
      });
      if (!res.ok) return;
    }
    try {
      const r = await AiModelsApi.mintKey(p.id);
      setMintedPlaintext(r.plaintext);
      await refresh();
      toast.success({ title: "网关 Key 已生成", description: "请立即复制明文，离开本页后无法再查看。" });
    } catch (e) {
      toast.danger({ title: "生成失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  async function onRevokeKey(p: AiModelEndpoint) {
    const res = await confirm({
      title: "撤销网关 Key",
      tone: "danger",
      confirmLabel: "确认撤销",
      requireReason: true,
      reasonPlaceholder: "例如：密钥泄漏 / 业务下线",
      description: "撤销后立即失效。该端点仍可用于内部 AI 应用绑定，但外部 sk-aep-* 调用会 401。",
      affected: (
        <div className="space-y-1">
          <div className="font-medium">{p.name}</div>
          <div className="text-xs text-muted-foreground">
            前缀 <span className="font-mono">{p.keyMasked ?? "—"}</span>
          </div>
        </div>
      ),
    });
    if (!res.ok) return;
    try {
      await AiModelsApi.revokeKey(p.id);
      await refresh();
      toast.success({ title: "网关 Key 已撤销" });
    } catch (e) {
      toast.danger({ title: "撤销失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  async function copyMinted() {
    if (!mintedPlaintext) return;
    try {
      await navigator.clipboard.writeText(mintedPlaintext);
      toast.success({ title: "已复制到剪贴板" });
    } catch {
      toast.warning({ title: "复制失败，请手动选中复制" });
    }
  }

  async function onBind(purpose: AiModelPurpose, value: string) {
    try {
      if (value === NONE) await AiModelsApi.unbind(purpose);
      else await AiModelsApi.bind(purpose, value);
      await refresh();
      toast.success({ title: value === NONE ? "已解绑" : "已绑定" });
    } catch (e) {
      toast.danger({ title: "操作失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  return (
    <div className="admin-page space-y-6">
      <PageHeader
        title="AI 模型与 Key"
        description="配置模型接入端点（固定上游密钥 + 单模型 + 地址，含网关 Key），并把每个 AI 应用绑定到一个端点。密钥由服务端加密存储，列表仅显示脱敏值。"
      />

      {mintedPlaintext && (
        <div className="rounded-lg border border-warning/30 bg-warning/8 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="text-sm font-semibold text-foreground">网关 Key 明文仅此一次显示</div>
              <p className="text-xs text-muted-foreground">
                离开本页或刷新后将无法再查看。请立即复制并交付给业务方安全保管。
              </p>
              <code className="block break-all rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm">
                {mintedPlaintext}
              </code>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => void copyMinted()}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> 复制 Key
                </Button>
                <Button size="sm" onClick={() => setMintedPlaintext(null)}>
                  我已保存
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="endpoints">
        <TabsList>
          <TabsTrigger value="endpoints">模型接入端点（含 Key）</TabsTrigger>
          <TabsTrigger value="bindings">AI 应用绑定</TabsTrigger>
          <TabsTrigger value="usage">用量统计</TabsTrigger>
        </TabsList>

        {/* ── Tab 1：模型接入端点 ── */}
        <TabsContent value="endpoints" className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">{formTitle(editing)}</CardTitle>
              {!editing && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => void refresh()}>
                    刷新
                  </Button>
                  <Button onClick={() => setEditing({ ...EMPTY_FORM })}>新建端点</Button>
                </div>
              )}
            </CardHeader>
            {!editing && presets.length > 0 && (
              <CardContent className="pt-0">
                <div className="mb-2 text-xs text-muted-foreground">
                  快速添加（内置常见服务商，选中后只需补上游 API 密钥）：
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
                {editing.mode !== "create" && (
                  <div className="rounded-md border border-border bg-surface-muted/50 px-3.5 py-2.5 text-xs text-muted-foreground">
                    {editing.mode === "edit" ? (
                      <>
                        正在编辑「{editing.defaults?.sourceName ?? editing.defaults?.name}」。当前配置已填入表单；上游 API 密钥不会回显，留空表示不修改。
                      </>
                    ) : (
                      <>
                        正在复制「{editing.defaults?.sourceName ?? editing.defaults?.name}」。placeholder 显示复制来源；上游 API 密钥不会复制，需要重新填写。
                      </>
                    )}
                  </div>
                )}
                <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="端点名称" hint="给运营用的备注，例如「主用 GPT-4o」">
                    <Input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      placeholder={placeholderFor(editing, "name", "主用 GPT-4o")}
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
                      placeholder={placeholderFor(editing, "baseUrl", "https://api.openai.com/v1")}
                    />
                  </Field>
                  <Field
                    label="上游 API 密钥"
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
                        placeholder={editing.defaults?.apiKeyHint ?? (editing.id ? "***（不修改）" : "sk-...")}
                        value={editing.apiKey}
                        onChange={(e) => setEditing({ ...editing, apiKey: e.target.value })}
                      />
                    </div>
                  </Field>
                  <Field label="固定模型" hint="本端点固定调用的模型，例如 gpt-4o / qwen-plus / doubao-1-5-pro-32k">
                    <Input
                      value={editing.model}
                      onChange={(e) => setEditing({ ...editing, model: e.target.value })}
                      placeholder={placeholderFor(editing, "model", "gpt-4o")}
                    />
                  </Field>
                  <Field label="启用" hint="停用后绑定到该端点的 AI 应用会报「未配置」">
                    <div className="flex h-9 items-center">
                      <Switch checked={editing.enabled} onCheckedChange={(v) => setEditing({ ...editing, enabled: v })} />
                      <span className="ml-2 text-sm text-muted-foreground">{editing.enabled ? "已启用" : "已停用"}</span>
                    </div>
                  </Field>
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">可用模型</div>
                      <div className="text-xs text-muted-foreground">
                        从服务商接口拉取（GET /models），点选一个设为本端点固定模型；保存后写入配置。
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" disabled={fetchingModels} onClick={() => void onFetchModels()}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      {fetchingModels ? "获取中…" : "获取模型列表"}
                    </Button>
                  </div>
                  {editing.models.length === 0 ? (
                    <div className="text-xs text-muted-foreground">
                      尚未获取。填好调用地址 + API 密钥后点「获取模型列表」（已存端点可留空密钥，用已存密钥）。
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {editing.models.map((m) => {
                        const activeModel = editing.model.trim() || editing.defaults?.model;
                        const active = activeModel === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setEditing({ ...editing, model: m.id })}
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
                            {active && <span className="font-sans">· {editing.model.trim() ? "固定" : "默认"}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
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
                    <ChevronRight className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-90")} />
                  </button>
                  {showAdvanced && (
                    <div className="grid grid-cols-1 gap-4 border-t border-border p-3.5 md:grid-cols-2">
                      <Field label="API 版本" hint="仅 Azure OpenAI 需要，例如 2024-08-01-preview">
                        <Input
                          value={editing.apiVersion}
                          onChange={(e) => setEditing({ ...editing, apiVersion: e.target.value })}
                          placeholder={placeholderFor(editing, "apiVersion", "留空")}
                        />
                      </Field>
                      <Field label="计费归属用户" hint="外部网关 Key 调用按 token 扣该用户钱包；留空 = 平台级，仅累计不扣费">
                        <div className="flex gap-2">
                          <Input
                            value={editing.ownerUserId}
                            onChange={(e) => setEditing({ ...editing, ownerUserId: e.target.value, clearOwnerUserId: false })}
                            placeholder={placeholderFor(editing, "ownerUserId", "留空 = 平台级（不计费）")}
                          />
                          {(editing.defaults?.ownerUserId || editing.ownerUserId) && (
                            <Button
                              type="button"
                              variant={editing.clearOwnerUserId ? "warning" : "outline"}
                              size="sm"
                              className="h-9 shrink-0"
                              onClick={() => setEditing({ ...editing, ownerUserId: "", clearOwnerUserId: !editing.clearOwnerUserId })}
                            >
                              {editing.clearOwnerUserId ? "将清空" : "平台级"}
                            </Button>
                          )}
                        </div>
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
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>端点列表（{filtered.length}）</span>
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
                <Table className="min-w-[1180px] table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[190px]">名称</TableHead>
                      <TableHead className="w-[132px]">类型</TableHead>
                      <TableHead className="w-[190px]">调用地址</TableHead>
                      <TableHead className="w-[132px]">上游密钥</TableHead>
                      <TableHead className="w-[150px]">固定模型</TableHead>
                      <TableHead className="w-[128px]">网关 Key</TableHead>
                      <TableHead className="w-[112px] text-right">累计 tokens</TableHead>
                      <TableHead className="w-[88px]">状态</TableHead>
                      <TableHead className="w-[258px] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => {
                      const t = testing[p.id];
                      return (
                        <TableRow key={p.id} className="h-[76px]">
                          <TableCell className="py-3">
                            <div className="truncate font-medium" title={p.name}>{p.name}</div>
                            <div className="truncate font-mono text-[10px] text-muted-foreground" title={p.id}>{p.id}</div>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge tone="neutral" className="font-normal">
                              {PROVIDER_LABEL[p.providerType] ?? p.providerType}
                            </Badge>
                          </TableCell>
                          <TableCell className="truncate py-3 font-mono text-xs" title={p.baseUrl}>{p.baseUrl}</TableCell>
                          <TableCell className="truncate py-3 font-mono text-xs" title={p.upstreamApiKeyMasked}>{p.upstreamApiKeyMasked}</TableCell>
                          <TableCell className="truncate py-3 text-xs" title={p.model ?? undefined}>{p.model ?? "—"}</TableCell>
                          <TableCell className="truncate py-3 text-xs">
                            {p.keyRevokedAt ? (
                              <Badge tone="danger" className="font-normal">
                                已撤销
                              </Badge>
                            ) : p.hasKey ? (
                              <span className="font-mono" title={p.keyMasked}>{p.keyMasked}</span>
                            ) : (
                              <span className="text-muted-foreground">未生成</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-right tabular-nums text-xs">
                            {p.totalTokens.toLocaleString()}
                            <div className="text-[10px] text-muted-foreground">{p.totalCalls.toLocaleString()} 次</div>
                          </TableCell>
                          <TableCell className="py-3">
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
                          <TableCell className="py-3 text-right">
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2"
                                onClick={() => setEditing(editFormFromEndpoint(p))}
                              >
                                编辑
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2"
                                onClick={() => setEditing(copyFormFromEndpoint(p))}
                              >
                                <Copy className="h-3.5 w-3.5" />
                                复制
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void onTest(p.id)}
                                aria-live="polite"
                                className={cn(
                                  "h-7 px-2",
                                  t?.state === "ok" && "border-success/40 text-success",
                                  t?.state === "fail" && "border-destructive/40 text-destructive",
                                )}
                              >
                                {t?.state === "running"
                                  ? "测试中"
                                  : t?.state === "ok"
                                  ? "已联通"
                                  : t?.state === "fail"
                                  ? "已失败"
                                  : "测试"}
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => void onMintKey(p)}>
                                <KeyRound className="h-3.5 w-3.5" />
                                {p.hasKey ? "重生成" : "生成 Key"}
                              </Button>
                              {p.hasKey && (
                                <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => void onRevokeKey(p)}>
                                  撤销
                                </Button>
                              )}
                              <Button size="sm" variant="destructive" className="h-7 px-2" onClick={() => void onDelete(p)}>
                                删除
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2：AI 应用绑定 ── */}
        <TabsContent value="bindings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="inline-flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary" /> AI 应用绑定
                </span>
                <Button variant="outline" size="sm" onClick={() => void refresh()}>
                  刷新
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 text-xs text-muted-foreground">
                每个 AI 应用固定指向一个模型接入端点。按业务应用分组后，运营可以直接看出这条绑定服务哪条产品线。
              </div>
              {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
              {err && <div className="text-sm text-destructive">{err}</div>}
              {!loading && !err && (
                <Tabs value={bindingGroup} onValueChange={(v) => setBindingGroup(v as BindingGroupKey)}>
                  <TabsList className="h-auto flex-wrap justify-start">
                    {BINDING_GROUPS.map((group) => (
                      <TabsTrigger key={group.key} value={group.key} className="gap-1.5">
                        {group.label}
                        <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {bindingsByGroup[group.key].length}
                        </span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {BINDING_GROUPS.map((group) => (
                    <TabsContent key={group.key} value={group.key} className="space-y-3">
                      <div className="rounded-md border border-border bg-surface-muted/45 px-3.5 py-2 text-xs text-muted-foreground">
                        {group.description}
                      </div>
                      <BindingTable bindings={bindingsByGroup[group.key]} endpoints={endpoints} onBind={onBind} />
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3：用量统计 ── */}
        <TabsContent value="usage" className="space-y-6">
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
                按每次调用响应里返回的 token 用量自行汇总（对所有端点通用，不依赖各家计费接口）。仅统计成功调用。
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
                      <UsageTable title="按端点" rows={usage.byProvider} total={usage.totalTokens} />
                      <UsageTable title="按模型" rows={usage.byModel} total={usage.totalTokens} />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BindingTable({
  bindings,
  endpoints,
  onBind,
}: {
  bindings: AiAppBinding[];
  endpoints: AiModelEndpoint[];
  onBind: (purpose: AiModelPurpose, value: string) => void | Promise<void>;
}) {
  if (bindings.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        当前分组暂无 AI 应用绑定。
      </div>
    );
  }

  return (
    <Table className="min-w-[760px] table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[220px]">AI 能力</TableHead>
          <TableHead>绑定端点</TableHead>
          <TableHead className="w-[140px]">状态</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bindings.map((binding) => (
          <TableRow key={binding.purpose} className="h-[68px]">
            <TableCell className="py-3">
              <div className="font-medium">{binding.purposeLabel}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{binding.purpose}</div>
            </TableCell>
            <TableCell className="py-3">
              <Select value={binding.endpointId ?? NONE} onValueChange={(value) => void onBind(binding.purpose, value)}>
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="未绑定" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>未绑定</SelectItem>
                  {endpoints.map((endpoint) => (
                    <SelectItem key={endpoint.id} value={endpoint.id}>
                      {endpoint.name}
                      {endpoint.model ? ` · ${endpoint.model}` : ""}
                      {!endpoint.enabled ? "（已停用）" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell className="py-3">
              <BindingStatusBadge binding={binding} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function BindingStatusBadge({ binding }: { binding: AiAppBinding }) {
  if (!binding.endpointId) {
    return (
      <Badge tone="neutral" className="font-normal text-muted-foreground">
        未绑定
      </Badge>
    );
  }
  if (binding.endpointEnabled === false) {
    return (
      <Badge tone="danger" className="font-normal">
        端点已停用
      </Badge>
    );
  }
  return (
    <Badge tone="success" className="font-normal">
      已绑定
    </Badge>
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
              <TableHead>{title.includes("模型") ? "模型" : "端点"}</TableHead>
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
