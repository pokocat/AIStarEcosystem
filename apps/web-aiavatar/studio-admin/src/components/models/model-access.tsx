"use client";

// 模型接入：左边按服务商（基础地址）分组，右边是这组的模型。服务商只是显示上的分组，密钥还是存在每个模型上。

import * as React from "react";
import { Loader2, Pencil, Plus, Search, Zap } from "lucide-react";
import { Badge } from "@ai-star-eco/ui/ui/badge";
import { Button } from "@ai-star-eco/ui/ui/button";
import { Card } from "@ai-star-eco/ui/ui/card";
import { Input } from "@ai-star-eco/ui/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ai-star-eco/ui/ui/select";
import { Switch } from "@ai-star-eco/ui/ui/switch";
import { cn } from "@ai-star-eco/ui/ui/utils";
import type { AiModelAccessPolicy, AiModelEndpoint, AiModelTestResult } from "@ai-star-eco/types/ai-model-config";
import { ModelConfigApi } from "@/lib/api";
import { capabilityTags, KIND_LABEL, modelKind, modelUses, providerGroups, providerHost, providerName, toggleEnabled, type ModelUse } from "@/lib/model-config";
import { useConfirmDialog } from "@/components/use-confirm-dialog";
import { APP_LABEL, errorText, Notice, yuanCost, type ModelConfigData } from "./shared";
import { EndpointEditor } from "./endpoint-editor";

const ALL = "all";
const KIND_TONE: Record<string, string> = {
  text: "border-sky-200 bg-sky-50 text-sky-700",
  image: "border-violet-200 bg-violet-50 text-violet-700",
  video: "border-emerald-200 bg-emerald-50 text-emerald-700",
  audio: "border-amber-200 bg-amber-50 text-amber-700",
  unclassified: "border-slate-200 bg-slate-50 text-slate-500",
};

function scopeText(policy: AiModelAccessPolicy | undefined) {
  if (!policy || policy.scope === "all") return "全部产品";
  return policy.appCodes.map((code) => APP_LABEL[code] ?? code).join("、");
}

function costText(endpoint: AiModelEndpoint) {
  const { promptTokenPriceMicros: input, completionTokenPriceMicros: output, unitPriceMicros: unit, supplierBillingMode: mode } = endpoint;
  if (mode === "PER_SECOND" && unit) return `${yuanCost(unit)} / 秒`;
  if (mode === "PER_CALL" && unit) return `${yuanCost(unit)} / 次`;
  if (input || output) return `入 ${yuanCost(input)} · 出 ${yuanCost(output)} / 千 Token`;
  if (unit) return `${yuanCost(unit)} / 次或秒`;
  return "未配置";
}

/** instance 不随 id 变：新建到一半（模型已存、后面的设置失败）要留在原面板，报错和没存上的修改都不能丢。 */
type Editing = { instance: number } & ({ id: string } | { id: null; host: string | null });
type TestState = { running: true } | ({ running: false } & AiModelTestResult);

export function ModelAccess({ data, reload }: { data: ModelConfigData; reload: () => Promise<void> }) {
  const { confirm, dialog } = useConfirmDialog();
  const [host, setHost] = React.useState(ALL);
  const [kind, setKind] = React.useState(ALL);
  const [status, setStatus] = React.useState(ALL);
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<Editing | null>(null);
  const instances = React.useRef(0);
  const [tests, setTests] = React.useState<Record<string, TestState>>({});
  const [toggling, setToggling] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const groups = React.useMemo(() => providerGroups(data.endpoints), [data.endpoints]);
  const policies = React.useMemo(() => new Map(data.access.map((row) => [row.endpointId, row.policy])), [data.access]);
  const uses = React.useMemo(() => modelUses(data.functions, data.scenes), [data.functions, data.scenes]);
  const kinds = React.useMemo(() => [...new Set(data.endpoints.map((endpoint) => modelKind(endpoint, policies.get(endpoint.id))))], [data.endpoints, policies]);

  const rows = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.endpoints.filter((endpoint) => {
      if (host !== ALL && providerHost(endpoint.baseUrl) !== host) return false;
      if (kind !== ALL && modelKind(endpoint, policies.get(endpoint.id)) !== kind) return false;
      if (status === "enabled" && !endpoint.enabled) return false;
      if (status === "disabled" && endpoint.enabled) return false;
      return !needle || [endpoint.name, endpoint.model, endpoint.modelAlias, endpoint.id, endpoint.baseUrl].some((value) => value?.toLowerCase().includes(needle));
    });
  }, [data.endpoints, host, kind, status, query, policies]);

  const group = groups.find((item) => item.host === host);
  const filtered = kind !== ALL || status !== ALL || !!query.trim();
  const editingEndpoint = editing?.id ? data.endpoints.find((endpoint) => endpoint.id === editing.id) ?? null : null;

  const test = async (endpoint: AiModelEndpoint) => {
    setTests((all) => ({ ...all, [endpoint.id]: { running: true } }));
    try {
      const result = await ModelConfigApi.command<AiModelTestResult>("endpointTest", { id: endpoint.id });
      setTests((all) => ({ ...all, [endpoint.id]: { running: false, ...result } }));
    } catch (e) {
      setTests((all) => ({ ...all, [endpoint.id]: { running: false, ok: false, error: errorText(e) } }));
    }
  };

  const toggle = async (endpoint: AiModelEndpoint, enabled: boolean) => {
    const used = uses.get(endpoint.id) ?? [];
    const defaults = used.filter((use) => use.isDefault);
    const ok = await confirm(
      enabled ? `启用「${endpoint.name}」？` : `停用「${endpoint.name}」？`,
      enabled
        ? <p>已开放且已配置的产品会立刻用上这个模型。</p>
        : defaults.length
          ? <div><p>这个模型是 {defaults.length} 个功能的默认模型，停用后这些功能会无法生成：</p><p className="mt-2 text-slate-600">{defaults.slice(0, 8).map((use) => use.name).join("、")}{defaults.length > 8 ? " 等" : ""}</p></div>
          : <p>停用后不能再用它生成。进行中的任务不受影响。</p>,
      enabled ? "启用" : "停用",
    );
    if (!ok) return;
    setToggling(endpoint.id); setNotice(null);
    try {
      await ModelConfigApi.command("endpointSave", { id: endpoint.id, value: toggleEnabled(endpoint, enabled) });
      await reload();
      setNotice({ tone: "ok", text: `已${enabled ? "启用" : "停用"}「${endpoint.name}」。` });
    } catch (e) {
      setNotice({ tone: "error", text: errorText(e) });
    } finally { setToggling(null); }
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      {dialog}
      <Card className="gap-0 self-start p-2">
        <p className="px-2 pb-2 pt-1 text-xs font-medium text-slate-500">服务商</p>
        <nav aria-label="按服务商筛选" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          <ProviderItem active={host === ALL} name="全部模型" total={data.endpoints.length} enabled={data.endpoints.filter((endpoint) => endpoint.enabled).length} onClick={() => setHost(ALL)} />
          {groups.map((item) => <ProviderItem key={item.host} active={host === item.host} name={item.name} host={item.host} total={item.total} enabled={item.enabled} onClick={() => setHost(item.host)} />)}
        </nav>
      </Card>

      <Card className="min-w-0 gap-0 p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-slate-900">{group ? group.name : "全部模型"}</h2>
            <p className="truncate text-xs text-slate-500">{group ? `${group.sample.baseUrl} · ` : ""}{filtered ? `筛选出 ${rows.length} 个模型` : `${rows.length} 个模型`}</p>
          </div>
          <Button onClick={() => setEditing({ instance: ++instances.current, id: null, host: group?.host ?? null })}><Plus className="size-4" />新增模型</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50/60 px-4 py-2.5">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、模型标识或地址" aria-label="搜索模型" className="h-9 bg-white pl-8" />
          </div>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger aria-label="按类型筛选" className="h-9 w-28 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>全部类型</SelectItem>{kinds.map((item) => <SelectItem key={item} value={item}>{KIND_LABEL[item] ?? item}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="按状态筛选" className="h-9 w-28 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>全部状态</SelectItem><SelectItem value="enabled">已启用</SelectItem><SelectItem value="disabled">已停用</SelectItem></SelectContent>
          </Select>
        </div>
        {notice && <div className="border-b px-4 py-2.5"><Notice tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Notice></div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead><tr className="border-b text-left text-xs text-slate-500">
              <th className="px-4 py-2.5 font-medium">模型</th>
              <th className="px-3 py-2.5 font-medium">类型与能力</th>
              <th className="px-3 py-2.5 font-medium">开放与使用</th>
              <th className="px-3 py-2.5 font-medium">供应商成本</th>
              <th className="px-3 py-2.5 font-medium">启用</th>
              <th className="px-4 py-2.5 text-right font-medium">操作</th>
            </tr></thead>
            <tbody>
              {rows.map((endpoint) => {
                const endpointKind = modelKind(endpoint, policies.get(endpoint.id));
                const tags = capabilityTags(endpoint);
                const used: ModelUse[] = uses.get(endpoint.id) ?? [];
                const defaults = used.filter((use) => use.isDefault).length;
                const result = tests[endpoint.id];
                return (
                  <React.Fragment key={endpoint.id}>
                    <tr className={cn("border-b align-top last:border-b-0 hover:bg-slate-50/70", !endpoint.enabled && "bg-slate-50/50")}>
                      <td className="max-w-72 px-4 py-3">
                        <p className={cn("truncate font-medium", endpoint.enabled ? "text-slate-900" : "text-slate-500")} title={endpoint.name}>{endpoint.name}</p>
                        <p className="truncate font-mono text-xs text-slate-500" title={endpoint.model ?? endpoint.id}>{endpoint.model || "未填写模型标识"}</p>
                        {host === ALL && <p className="truncate text-xs text-slate-400" title={endpoint.baseUrl}>{providerName(providerHost(endpoint.baseUrl))}</p>}
                      </td>
                      <td className="max-w-56 px-3 py-3">
                        <Badge variant="outline" className={KIND_TONE[endpointKind] ?? KIND_TONE.unclassified}>{KIND_LABEL[endpointKind] ?? endpointKind}</Badge>
                        {tags.length > 0 && <p className="mt-1 truncate text-xs text-slate-500" title={tags.join(" · ")}>{tags.join(" · ")}</p>}
                      </td>
                      <td className="max-w-44 px-3 py-3">
                        <p className="truncate text-xs text-slate-700" title={scopeText(policies.get(endpoint.id))}>{scopeText(policies.get(endpoint.id))}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500" title={used.map((use) => `${APP_LABEL[use.appCode] ?? use.appCode} · ${use.name}${use.isDefault ? "（默认）" : ""}`).join("\n")}>
                          {used.length ? `${used.length} 个功能${defaults ? `，${defaults} 个默认` : ""}` : "没有功能在用"}
                        </p>
                      </td>
                      <td className="max-w-44 px-3 py-3"><p className={cn("text-xs", costText(endpoint) === "未配置" ? "text-amber-700" : "text-slate-700")}>{costText(endpoint)}</p></td>
                      <td className="px-3 py-3"><Switch checked={endpoint.enabled} disabled={toggling === endpoint.id} aria-label={`${endpoint.enabled ? "停用" : "启用"} ${endpoint.name}`} onCheckedChange={(checked) => void toggle(endpoint, checked)} /></td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        <Button variant="ghost" size="sm" disabled={result?.running} onClick={() => void test(endpoint)}>{result?.running ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}测试连接</Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing({ instance: ++instances.current, id: endpoint.id })}><Pencil className="size-3.5" />编辑</Button>
                      </td>
                    </tr>
                    {result && !result.running && (
                      <tr className="border-b last:border-b-0"><td colSpan={6} className="px-4 pb-2.5 pt-0">
                        <Notice tone={result.ok ? "ok" : "error"} onClose={() => setTests((all) => { const next = { ...all }; delete next[endpoint.id]; return next; })}>
                          {result.ok ? `连接正常${result.models?.length ? `，供应商有 ${result.models.length} 个模型` : ""}。` : `连接失败：${result.error ?? "请核对地址和密钥"}`}
                        </Notice>
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
              {!rows.length && <tr><td colSpan={6} className="px-4 py-14 text-center text-sm text-slate-500">{filtered ? "没有符合条件的模型" : "还没有模型"}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <EndpointEditor
          key={editing.instance}
          endpoint={editingEndpoint}
          initialHost={editing.id === null ? editing.host : null}
          data={data}
          reload={reload}
          onCreated={(id) => setEditing((current) => current && { instance: current.instance, id })}
          onClose={(message) => { setEditing(null); if (message) setNotice({ tone: "ok", text: message }); }}
        />
      )}
    </div>
  );
}

function ProviderItem({ active, name, host, total, enabled, onClick }: { active: boolean; name: string; host?: string; total: number; enabled: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? "true" : undefined} title={host}
      className={cn("flex w-44 shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring lg:w-full", active ? "bg-[#4f6692]/10" : "hover:bg-slate-50")}>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm", active ? "font-semibold text-[#3f5478]" : "font-medium text-slate-800")}>{name}</span>
        <span className="block text-xs text-slate-500">{enabled === total ? `${total} 个模型` : `${total} 个模型，${enabled} 个启用`}</span>
      </span>
    </button>
  );
}
