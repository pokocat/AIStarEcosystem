"use client";

// 编辑一个模型。保存时只发改过的字段（规则在 lib/model-config.ts）：
// 规格整份当文本编辑，这里不认识的字段也在文本里，保存不会丢。

import * as React from "react";
import { ChevronRight, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@ai-star-eco/ui/ui/button";
import { Checkbox } from "@ai-star-eco/ui/ui/checkbox";
import { Input } from "@ai-star-eco/ui/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ai-star-eco/ui/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@ai-star-eco/ui/ui/sheet";
import { Switch } from "@ai-star-eco/ui/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ai-star-eco/ui/ui/tabs";
import { Textarea } from "@ai-star-eco/ui/ui/textarea";
import type { AiModelAccessPolicy, AiModelEndpoint, AiModelTestResult } from "@ai-star-eco/types/ai-model-config";
import { ModelConfigApi } from "@/lib/api";
import {
  blankDraft, draftOf, imageSpecSummary, KIND_LABEL, modelKind, modelUses, opensStudioVideo, planCosts, planEndpointCreate, planEndpointUpdate,
  providerGroups, sameAccess, supplierChanged, videoSpecSummary, type EndpointDraft, type SaveProblem, type SpecChoice,
} from "@/lib/model-config";
import { useConfirmDialog } from "@/components/use-confirm-dialog";
import { AffectedList, APP_CODES, APP_LABEL, errorText, Field, functionNames, Notice, type ModelConfigData } from "./shared";

const PROVIDER_TYPES: [string, string][] = [
  ["OPENAI_COMPATIBLE", "OpenAI 兼容"], ["OPENAI", "OpenAI"], ["ANTHROPIC", "Anthropic"], ["AZURE_OPENAI", "Azure OpenAI"], ["DEEPSEEK", "DeepSeek"],
  ["MOONSHOT", "Moonshot"], ["VOLCENGINE", "火山方舟"], ["ALIYUN", "阿里云"], ["BAIDU", "百度"], ["TENCENT", "腾讯"], ["CUSTOM", "自定义"],
];
const BILLING_MODES: [string, string][] = [["AUTO", "自动（文本按 Token，图片按次，视频按秒）"], ["TOKENS", "按 Token"], ["PER_CALL", "按次"], ["PER_SECOND", "按秒"]];
const KIND_CHOICES = ["text", "image", "video", "audio"];
const PRESET = "preset:", GROUP = "group:";

const TAB = "data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-[#3f5478] data-[state=active]:shadow-sm";

type Tab = "basic" | "capability" | "limits" | "access" | "cost" | "usage";

function specProbeFields(videoSpecText: string): Record<string, unknown> {
  try {
    const spec = JSON.parse(videoSpecText) as Record<string, unknown>;
    return { modelsPath: spec.modelsPath, authHeader: spec.authHeader, catalogSpec: spec.catalogSpec };
  } catch { return {}; }
}

export function EndpointEditor({ endpoint, initialHost, data, reload, onCreated, onClose }: {
  endpoint: AiModelEndpoint | null;
  initialHost: string | null;
  data: ModelConfigData;
  reload: () => Promise<void>;
  onCreated: (id: string) => void;
  onClose: (message?: string) => void;
}) {
  const creating = !endpoint;
  const { confirm, dialog } = useConfirmDialog();
  const groups = React.useMemo(() => providerGroups(data.endpoints), [data.endpoints]);
  const [draft, setDraft] = React.useState<EndpointDraft>(() => {
    if (endpoint) return draftOf(endpoint);
    const sample = groups.find((group) => group.host === initialHost)?.sample;
    return sample ? { ...blankDraft(), baseUrl: sample.baseUrl, providerType: sample.providerType } : blankDraft();
  });
  const [initial] = React.useState(draft);
  const savedAccess = data.access.find((row) => row.endpointId === endpoint?.id)?.policy ?? null;
  const [access, setAccess] = React.useState<AiModelAccessPolicy>(savedAccess ?? { categories: ["unclassified"], scope: "all", appCodes: [] });
  const [specChoice, setSpecChoice] = React.useState<SpecChoice | null>(null);
  const [tab, setTab] = React.useState<Tab>("basic");
  const [problems, setProblems] = React.useState<SaveProblem[]>([]);
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [presetHint, setPresetHint] = React.useState("");
  const [catalog, setCatalog] = React.useState<{ running: boolean; message?: string; ok?: boolean }>({ running: false });

  const set = <K extends keyof EndpointDraft>(key: K, value: EndpointDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const names = React.useMemo(() => functionNames(data.functions), [data.functions]);
  const uses = React.useMemo(() => (endpoint ? modelUses(data.functions, data.scenes).get(endpoint.id) ?? [] : []), [data.functions, data.scenes, endpoint]);
  const needsSpecChoice = !!endpoint && supplierChanged(endpoint, draft) && !!(endpoint.imageRequestSpec || endpoint.videoRequestSpec);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial) || (savedAccess ? !sameAccess(access, savedAccess) : access.scope !== "all" || access.categories[0] !== "unclassified");

  const close = async () => {
    if (saving) return;
    if (dirty && !await confirm("放弃修改？", <p>这次的修改还没有保存。</p>, "放弃修改")) return;
    onClose();
  };

  const applyStart = (value: string) => {
    if (value.startsWith(PRESET)) {
      const preset = data.presets.find((item) => item.code === value.slice(PRESET.length));
      if (!preset) return;
      setDraft((current) => ({ ...current, baseUrl: preset.baseUrl, providerType: preset.providerType, model: current.model || preset.suggestedModel || "" }));
      setPresetHint(preset.apiKeyHint ?? "");
    } else {
      const group = groups.find((item) => item.host === value.slice(GROUP.length));
      if (!group) return;
      setDraft((current) => ({ ...current, baseUrl: group.sample.baseUrl, providerType: group.sample.providerType }));
      setPresetHint("");
    }
  };

  const fetchCatalog = async () => {
    setCatalog({ running: true });
    try {
      const unchanged = endpoint && !draft.apiKey.trim() && draft.baseUrl.trim() === endpoint.baseUrl && draft.providerType === endpoint.providerType;
      const result = unchanged
        ? await ModelConfigApi.command<AiModelTestResult>("endpointFetchModels", { id: endpoint.id })
        : await ModelConfigApi.command<AiModelTestResult>("endpointProbe", {
            ...(endpoint ? { id: endpoint.id } : {}), providerType: draft.providerType, baseUrl: draft.baseUrl.trim(),
            ...(draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {}),
            ...Object.fromEntries(Object.entries(specProbeFields(draft.videoSpecText)).filter(([, value]) => value !== undefined && value !== null)),
          });
      if (result.ok) {
        set("fetchedModels", result.models ?? []);
        setCatalog({ running: false, ok: true, message: `获取到 ${result.models?.length ?? 0} 个模型，可以在模型标识里选择。` });
      } else setCatalog({ running: false, ok: false, message: result.error ?? "没有获取到模型列表，请核对地址和密钥" });
    } catch (e) { setCatalog({ running: false, ok: false, message: errorText(e) }); }
  };

  const save = async () => {
    if (saving) return;
    const plan = endpoint ? planEndpointUpdate(endpoint, draft, specChoice) : planEndpointCreate(draft);
    const costs = planCosts(endpoint, draft);
    const found = [...plan.problems, ...costs.problems];
    setProblems(found); setError("");
    if (found.length) { setTab(found[0].tab); return; }
    if (access.scope === "selected" && !access.appCodes.length) { setError("请选择要开放的产品"); setTab("access"); return; }
    const accessChanged = savedAccess ? !sameAccess(access, savedAccess) : access.scope !== "all" || access.categories[0] !== "unclassified";

    // 开给 IP Studio 的视频模型如果还不是共享候选，服务端会自动加入，影响所有用视频候选的功能。
    const videoRow = data.functions.find((row) => row.appCode === "studio" && row.feature === "video");
    const alreadyVideoCandidate = !!endpoint && !!videoRow?.candidates?.some((candidate) => candidate.endpointId === endpoint.id && candidate.enabled);
    let acknowledged: string[] = [];
    if (accessChanged && opensStudioVideo(access)) {
      acknowledged = videoRow?.affectedFeatures ?? [];
      if (!alreadyVideoCandidate && acknowledged.length) {
        const ok = await confirm("加入共用的视频模型列表？", <div><p>开放给 IP Studio 的视频模型会加入共用列表，这些功能都可以选到它：</p><AffectedList keys={acknowledged} names={names} /></div>, "确认保存");
        if (!ok) return;
      }
    }

    setSaving(true);
    let id = endpoint?.id ?? null;
    try {
      if (plan.value) {
        const saved = await ModelConfigApi.command<AiModelEndpoint>("endpointSave", { ...(id ? { id } : {}), value: plan.value });
        if (!id) { id = saved.id; }
      }
      if (costs.value && id) await ModelConfigApi.command("endpointCosts", { id, value: costs.value });
      if (accessChanged && id) await ModelConfigApi.command("modelAccessSave", { endpointId: id, value: access, acknowledgedAffectedFeatures: acknowledged });
      await reload();
      onClose(plan.value || costs.value || accessChanged ? "已保存。" : undefined);
    } catch (e) {
      // 前面几步可能已经成功：刷新后对比基准变成新值，再点保存只会发还没存上的部分。
      await reload();
      if (!endpoint && id) onCreated(id);
      setError(`${id && !endpoint ? "模型已创建，后续设置没有保存：" : ""}${errorText(e)}`);
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!endpoint) return;
    const ok = await confirm(`删除「${endpoint.name}」？`, <p>删除后不能恢复，密钥也会一起删除。{uses.length ? `它现在用在 ${uses.length} 个功能里，请先改掉这些功能的默认模型。` : ""}</p>, "删除");
    if (!ok) return;
    setSaving(true); setError("");
    try {
      await ModelConfigApi.command("endpointDelete", { id: endpoint.id });
      await reload();
      onClose(`已删除「${endpoint.name}」。`);
    } catch (e) { setError(errorText(e)); } finally { setSaving(false); }
  };

  const toggleCategory = (kind: string, checked: boolean) => setAccess((current) => {
    const rest = current.categories.filter((item) => item !== kind && item !== "unclassified");
    const next = checked ? [...rest, kind] : rest;
    return { ...current, categories: next.length ? next : ["unclassified"] };
  });
  const toggleApp = (code: string, checked: boolean) => setAccess((current) => ({
    ...current, appCodes: checked ? [...current.appCodes, code] : current.appCodes.filter((item) => item !== code),
  }));

  const specStatus = (summary: string[], text: string) => (text.trim() ? (summary.length ? summary.join(" · ") : "已配置") : "未配置");
  const parsedSpec = (text: string) => { try { return JSON.parse(text) as Record<string, unknown>; } catch { return null; } };

  return (
    <Sheet open onOpenChange={(open) => { if (!open) void close(); }}>
      {/* 不把焦点放到第一个页签上：焦点框会让它看起来像选中项。 */}
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[720px]" onOpenAutoFocus={(event) => { event.preventDefault(); (event.currentTarget as HTMLElement).focus(); }}>
        {dialog}
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>{creating ? "新增模型" : `编辑「${endpoint.name}」`}</SheetTitle>
          <SheetDescription>{creating ? "新模型默认停用，配好价格和开放范围后再启用。" : <span className="font-mono text-xs">{endpoint.id}</span>}</SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="overflow-x-auto border-b px-5 py-2">
            <TabsList>
              <TabsTrigger value="basic" className={TAB}>基本信息</TabsTrigger>
              <TabsTrigger value="capability" className={TAB}>能力与规格</TabsTrigger>
              <TabsTrigger value="limits" className={TAB}>运行限制</TabsTrigger>
              <TabsTrigger value="access" className={TAB}>开放范围</TabsTrigger>
              <TabsTrigger value="cost" className={TAB}>计费与成本</TabsTrigger>
              {!creating && <TabsTrigger value="usage" className={TAB}>使用情况</TabsTrigger>}
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {(error || problems.length > 0) && <div className="mb-4 space-y-2">
              {error && <Notice tone="error">{error}</Notice>}
              {problems.map((problem) => <Notice key={problem.message} tone="error">{problem.message}</Notice>)}
            </div>}

            <TabsContent value="basic" className="space-y-4">
              {creating && (
                <Field label="从已有服务商填入">
                  <Select value="" onValueChange={applyStart}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="选择后自动填写协议和地址" /></SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => <SelectItem key={group.host} value={GROUP + group.host}>{group.name}（已有 {group.total} 个模型）</SelectItem>)}
                      {data.presets.map((preset) => <SelectItem key={preset.code} value={PRESET + preset.code}>{preset.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="模型名称"><Input value={draft.name} onChange={(event) => set("name", event.target.value)} placeholder="例如 聚算 · MiniMax H3" /></Field>
                <Field label="协议">
                  <Select value={draft.providerType} onValueChange={(value) => set("providerType", value)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROVIDER_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                      {!PROVIDER_TYPES.some(([value]) => value === draft.providerType) && <SelectItem value={draft.providerType}>{draft.providerType}</SelectItem>}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="基础地址"><Input value={draft.baseUrl} onChange={(event) => set("baseUrl", event.target.value)} placeholder="https://api.example.com/v1" className="font-mono text-sm" /></Field>
              {draft.providerType === "AZURE_OPENAI" && <Field label="API 版本"><Input value={draft.apiVersion} onChange={(event) => set("apiVersion", event.target.value)} placeholder="2024-08-01-preview" className="font-mono text-sm" /></Field>}
              <Field label="密钥" hint={presetHint || (creating ? undefined : `当前 ${endpoint.upstreamApiKeyMasked ?? "未配置"}。留空不修改。`)}>
                <Input type="password" autoComplete="new-password" value={draft.apiKey} onChange={(event) => set("apiKey", event.target.value)} placeholder={creating ? "每个模型单独保存一份" : "填写后替换当前密钥"} className="font-mono text-sm" />
              </Field>
              <div className="grid items-start gap-4 sm:grid-cols-2">
                <Field label="模型标识" hint="发给供应商的 model 字段。">
                  <Input list="endpoint-model-options" value={draft.model} onChange={(event) => set("model", event.target.value)} placeholder="例如 minimax-h3" className="font-mono text-sm" />
                  <datalist id="endpoint-model-options">{(draft.fetchedModels ?? endpoint?.models ?? []).map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</datalist>
                </Field>
                <Field label="别名" hint="选填，只用于显示。"><Input value={draft.modelAlias} onChange={(event) => set("modelAlias", event.target.value)} /></Field>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" size="sm" disabled={catalog.running || !draft.baseUrl.trim()} onClick={() => void fetchCatalog()}>
                  {catalog.running ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}获取模型列表
                </Button>
                {catalog.message && <span className={catalog.ok ? "text-xs text-emerald-700" : "text-xs text-rose-600"}>{catalog.message}</span>}
              </div>
              {needsSpecChoice && (
                <fieldset className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <legend className="px-1 text-sm font-medium text-amber-900">协议、地址或模型标识变了，现有规格怎么处理？</legend>
                  <label className="flex items-center gap-2 text-sm text-slate-700"><input type="radio" name="spec-choice" checked={specChoice === "keep"} onChange={() => setSpecChoice("keep")} />保留现有规格</label>
                  <label className="flex items-center gap-2 text-sm text-slate-700"><input type="radio" name="spec-choice" checked={specChoice === "clear"} onChange={() => setSpecChoice("clear")} />清除规格（换了模型时选这项）</label>
                </fieldset>
              )}
              <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="text-sm font-medium text-slate-800">启用</span>
                <Switch checked={draft.enabled} onCheckedChange={(checked) => set("enabled", checked)} aria-label="启用这个模型" />
              </label>
            </TabsContent>

            <TabsContent value="capability" className="space-y-5">
              {/* 图片和视频模型用不到这一块，默认收起。 */}
              <details className="group space-y-3" open={!(draft.imageSpecText.trim() || draft.videoSpecText.trim())}>
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-slate-900"><ChevronRight aria-hidden className="size-4 text-slate-400 transition-transform group-open:rotate-90" />文本能力</summary>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    ["chatSupportsStreaming", "流式返回"], ["chatSupportsTools", "工具调用"], ["chatSupportsResponseFormat", "指定返回格式"],
                    ["chatSupportsTemperature", "温度参数"], ["chatSupportsTopP", "Top P 参数"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm text-slate-700">
                      {label}<Switch checked={draft[key]} onCheckedChange={(checked) => set(key, checked)} aria-label={label} />
                    </label>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="单次输出 Token 上限" hint="留空不限。"><Input inputMode="numeric" value={draft.chatMaxOutputTokens} onChange={(event) => set("chatMaxOutputTokens", event.target.value)} /></Field>
                  <Field label="默认输出 Token" hint="留空由调用方决定。"><Input inputMode="numeric" value={draft.defaultMaxTokens} onChange={(event) => set("defaultMaxTokens", event.target.value)} /></Field>
                  <Field label="默认温度" hint="0 到 2。"><Input inputMode="decimal" value={draft.defaultTemperature} onChange={(event) => set("defaultTemperature", event.target.value)} /></Field>
                  <Field label="默认 Top P" hint="0 到 1。"><Input inputMode="decimal" value={draft.defaultTopP} onChange={(event) => set("defaultTopP", event.target.value)} /></Field>
                </div>
              </details>
              <SpecEditor title="图片规格" status={specStatus(imageSpecSummary(parsedSpec(draft.imageSpecText)), draft.imageSpecText)} value={draft.imageSpecText} onChange={(value) => set("imageSpecText", value)} />
              <SpecEditor title="视频规格" status={specStatus(videoSpecSummary(parsedSpec(draft.videoSpecText)), draft.videoSpecText)} value={draft.videoSpecText} onChange={(value) => set("videoSpecText", value)} />
            </TabsContent>

            <TabsContent value="limits" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="并发上限" hint="同时生成的任务数。留空不限。"><Input inputMode="numeric" value={draft.concurrencyLimit} onChange={(event) => set("concurrencyLimit", event.target.value)} /></Field>
                <Field label="失败率告警" hint="百分比，1 到 100。留空用系统默认值。"><Input inputMode="numeric" value={draft.alertFailureRatePct} onChange={(event) => set("alertFailureRatePct", event.target.value)} /></Field>
                <Field label="每分钟请求数" hint="留空不限。"><Input inputMode="numeric" value={draft.rpmLimit} onChange={(event) => set("rpmLimit", event.target.value)} /></Field>
                <Field label="每分钟 Token" hint="留空不限。"><Input inputMode="numeric" value={draft.tpmLimit} onChange={(event) => set("tpmLimit", event.target.value)} /></Field>
                <Field label="每日 Token 额度" hint="按北京时间自然日统计。留空不限。"><Input inputMode="numeric" value={draft.dailyTokenQuota} onChange={(event) => set("dailyTokenQuota", event.target.value)} /></Field>
                <Field label="每日成本额度（元）" hint="按北京时间自然日统计。留空不限。"><Input inputMode="decimal" value={draft.dailyCostQuotaYuan} onChange={(event) => set("dailyCostQuotaYuan", event.target.value)} /></Field>
              </div>
            </TabsContent>

            <TabsContent value="access" className="space-y-5">
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-slate-900">模型类型</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {KIND_CHOICES.map((kind) => (
                    <label key={kind} className="flex items-center gap-2 text-sm text-slate-700">
                      <Checkbox checked={access.categories.includes(kind)} onCheckedChange={(checked) => toggleCategory(kind, checked === true)} />{KIND_LABEL[kind]}
                    </label>
                  ))}
                </div>
                {access.categories[0] === "unclassified" && endpoint && <p className="text-xs text-slate-500">还没有标记类型，列表上按规格显示为{KIND_LABEL[modelKind(endpoint)]}。</p>}
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-slate-900">开放给</legend>
                <label className="flex items-center gap-2 text-sm text-slate-700"><input type="radio" name="access-scope" checked={access.scope === "all"} onChange={() => setAccess((current) => ({ ...current, scope: "all", appCodes: [] }))} />全部产品</label>
                <label className="flex items-center gap-2 text-sm text-slate-700"><input type="radio" name="access-scope" checked={access.scope === "selected"} onChange={() => setAccess((current) => ({ ...current, scope: "selected" }))} />指定产品</label>
                {access.scope === "selected" && (
                  <div className="flex flex-wrap gap-x-5 gap-y-2 pl-6">
                    {APP_CODES.map((code) => (
                      <label key={code} className="flex items-center gap-2 text-sm text-slate-700">
                        <Checkbox checked={access.appCodes.includes(code)} onCheckedChange={(checked) => toggleApp(code, checked === true)} />{APP_LABEL[code]}
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
              {opensStudioVideo(access) && <Notice tone="warn">保存后立刻生效：已启用的视频模型会出现在 IP Studio 的模型列表里。还没配好价格的话，先保持停用。</Notice>}
            </TabsContent>

            <TabsContent value="cost" className="space-y-4">
              <Field label="用户计费方式">
                <Select value={draft.billingMode} onValueChange={(value) => set("billingMode", value)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{BILLING_MODES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="供应商成本计量" hint="只用于算成本和毛利，不影响用户的扣费。">
                <Select value={draft.supplierBillingMode} onValueChange={(value) => set("supplierBillingMode", value)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{BILLING_MODES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="输入成本（元 / 千 Token）"><Input inputMode="decimal" value={draft.promptPriceYuan} onChange={(event) => set("promptPriceYuan", event.target.value)} /></Field>
                <Field label="输出成本（元 / 千 Token）"><Input inputMode="decimal" value={draft.completionPriceYuan} onChange={(event) => set("completionPriceYuan", event.target.value)} /></Field>
                <Field label="按次或按秒成本（元）"><Input inputMode="decimal" value={draft.unitPriceYuan} onChange={(event) => set("unitPriceYuan", event.target.value)} /></Field>
              </div>
            </TabsContent>

            {!creating && (
              <TabsContent value="usage" className="space-y-4">
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {([["累计调用", endpoint.totalCalls], ["累计 Token", endpoint.totalTokens], ["累计计费次数", endpoint.totalBillableUnits], ["累计计费秒数", endpoint.totalBillableSeconds]] as const).map(([label, value]) => (
                    <div key={label} className="rounded-lg border p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-base font-semibold text-slate-900">{value.toLocaleString("zh-CN")}</dd></div>
                  ))}
                </dl>
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-slate-900">用在这些功能</h3>
                  {uses.length
                    ? <ul className="divide-y rounded-lg border text-sm">{uses.map((use) => (
                        <li key={use.key} className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="min-w-0 truncate text-slate-700">{APP_LABEL[use.appCode] ?? use.appCode} · {use.name}</span>
                          {use.isDefault && <span className="shrink-0 text-xs text-[#4f6692]">默认模型</span>}
                        </li>
                      ))}</ul>
                    : <p className="text-sm text-slate-500">还没有功能用这个模型。</p>}
                </section>
              </TabsContent>
            )}
          </div>
        </Tabs>

        <SheetFooter className="flex-row items-center justify-between gap-2 border-t px-5 py-3">
          {creating ? <span /> : <Button type="button" variant="ghost" className="text-rose-600 hover:text-rose-700" disabled={saving} onClick={() => void remove()}><Trash2 className="size-4" />删除</Button>}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => void close()}>取消</Button>
            <Button type="button" disabled={saving || !dirty} onClick={() => void save()}>{saving && <Loader2 className="size-4 animate-spin" />}保存</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function SpecEditor({ title, status, value, onChange }: { title: string; status: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const invalid = React.useMemo(() => { if (!value.trim()) return false; try { JSON.parse(value); return false; } catch { return true; } }, [value]);
  const format = () => { try { onChange(JSON.stringify(JSON.parse(value), null, 2)); } catch { /* 不合法时保留原文，由下方提示 */ } };
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="truncate text-xs text-slate-500" title={status}>{status}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen((current) => !current)} aria-expanded={open}>{open ? "收起" : "编辑 JSON"}</Button>
      </div>
      {open && <>
        <Textarea aria-label={`${title} JSON`} rows={14} spellCheck={false} value={value} onChange={(event) => onChange(event.target.value)} className="max-h-[50vh] font-mono text-xs leading-5" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={invalid ? "text-xs text-rose-600" : "text-xs text-slate-500"}>{invalid ? "不是有效的 JSON" : "内容清空后保存，会清除这份规格。"}</p>
          <Button type="button" variant="ghost" size="sm" disabled={invalid || !value.trim()} onClick={format}>整理格式</Button>
        </div>
      </>}
    </section>
  );
}
