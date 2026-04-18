"use client";

import * as React from "react";
import { Settings2, Save, RefreshCw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PlatformConfigApi } from "@/api";
import type { PlatformConfigDto } from "@/api/platform-config";

type Draft = { value: string; description: string; dirty: boolean; error?: string };

const KNOWN_KEYS: { key: string; label: string; description: string }[] = [
  { key: "incubation.faceStyles", label: "孵化 · 面部风格", description: "LabeledI18n[]" },
  { key: "incubation.fashionStyles", label: "孵化 · 服装风格", description: "LabeledI18n[]" },
  { key: "incubation.templates", label: "孵化 · 一键模版", description: "WizardTemplate[]" },
  { key: "forge.hairStyles", label: "锻造炉 · 发型", description: "LabeledOption[]" },
  { key: "forge.eyeColors", label: "锻造炉 · 瞳色", description: "LabeledOption[]" },
  { key: "forge.styleTags", label: "锻造炉 · 风格标签", description: "LabeledOption[]" },
  { key: "forge.faceSliders", label: "锻造炉 · 面部滑块", description: "FaceSlider[]" },
  { key: "forge.colorSchemes", label: "锻造炉 · 配色", description: "ColorScheme[]" },
  { key: "forge.promptSuggestions", label: "锻造炉 · 推荐标签", description: "string[]" },
];

export default function PlatformConfigPage() {
  const [configs, setConfigs] = React.useState<PlatformConfigDto[]>([]);
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({});
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [newKey, setNewKey] = React.useState("");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await PlatformConfigApi.listConfigs();
      setConfigs(list);
      const next: Record<string, Draft> = {};
      for (const c of list) {
        next[c.key] = {
          value: c.value == null ? "null" : JSON.stringify(c.value, null, 2),
          description: c.description ?? "",
          dirty: false,
        };
      }
      setDrafts(next);
      if (!active && list.length > 0) setActive(list[0].key);
    } catch (e: any) {
      setToast({ type: "err", msg: typeof e?.message === "string" ? e.message : "加载失败" });
    } finally {
      setLoading(false);
    }
  }, [active]);

  React.useEffect(() => { refresh(); }, [refresh]);

  const current = active ? configs.find((c) => c.key === active) : null;
  const draft = active ? drafts[active] : null;

  const updateDraft = (key: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...(prev[key] ?? { value: "", description: "", dirty: false }), ...patch, dirty: true } }));
  };

  const validate = (raw: string): { ok: boolean; parsed?: unknown; error?: string } => {
    try {
      return { ok: true, parsed: JSON.parse(raw) };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "JSON 解析失败" };
    }
  };

  const save = async (key: string) => {
    const d = drafts[key];
    if (!d) return;
    const r = validate(d.value);
    if (!r.ok) {
      updateDraft(key, { error: r.error });
      setToast({ type: "err", msg: `JSON 无效：${r.error}` });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    try {
      await PlatformConfigApi.upsertConfig(key, r.parsed, d.description || undefined);
      setToast({ type: "ok", msg: `已保存：${key}` });
      await refresh();
    } catch (e: any) {
      setToast({ type: "err", msg: typeof e?.message === "string" ? e.message : "保存失败" });
    } finally {
      setTimeout(() => setToast(null), 2500);
    }
  };

  const remove = async (key: string) => {
    if (!confirm(`确定删除配置 ${key}？`)) return;
    try {
      await PlatformConfigApi.deleteConfig(key);
      setToast({ type: "ok", msg: `已删除：${key}` });
      if (active === key) setActive(null);
      await refresh();
    } catch (e: any) {
      setToast({ type: "err", msg: typeof e?.message === "string" ? e.message : "删除失败" });
    } finally {
      setTimeout(() => setToast(null), 2500);
    }
  };

  const createNewKey = async () => {
    const key = newKey.trim();
    if (!key) return;
    try {
      await PlatformConfigApi.upsertConfig(key, [], "");
      setNewKey("");
      setActive(key);
      await refresh();
      setToast({ type: "ok", msg: `新建：${key}` });
    } catch (e: any) {
      setToast({ type: "err", msg: typeof e?.message === "string" ? e.message : "新建失败" });
    } finally {
      setTimeout(() => setToast(null), 2500);
    }
  };

  const presetDescription = React.useMemo(() => {
    if (!active) return "";
    return KNOWN_KEYS.find((k) => k.key === active)?.description ?? "";
  }, [active]);

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="平台配置"
        description="孵化向导 / 形象锻造炉 等 JSON 配置项的在线维护；保存后立即对前端生效。"
        breadcrumb={[{ label: "平台账户" }, { label: "平台配置" }]}
        actions={
          <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
          </Button>
        }
      />

      {toast && (
        <div className={`mb-4 rounded-md px-3 py-2 text-sm ${toast.type === "ok"
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
          {toast.msg}
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 md:col-span-4 lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4" /> 配置键
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="新建 key，如 forge.xxx"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
              <Button size="sm" onClick={createNewKey} disabled={!newKey.trim()}>新建</Button>
            </div>
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto space-y-1 pr-1">
              {configs.map((c) => {
                const isActive = active === c.key;
                const dirty = drafts[c.key]?.dirty;
                return (
                  <button
                    key={c.key}
                    onClick={() => setActive(c.key)}
                    className={`w-full text-left rounded-md border px-3 py-2 text-xs transition-colors ${
                      isActive ? "bg-indigo-50 border-indigo-300 text-indigo-900" : "bg-card border-border hover:bg-surface-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{c.key}</span>
                      {dirty && <span className="text-amber-600 text-[10px]">● 未保存</span>}
                    </div>
                    {c.description && (
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">{c.description}</div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-0.5">v{c.version}</div>
                  </button>
                );
              })}
              {configs.length === 0 && !loading && (
                <div className="text-xs text-muted-foreground py-6 text-center">暂无配置，可新建 key</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-12 md:col-span-8 lg:col-span-9">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm">{active ?? "选择一个配置键"}</CardTitle>
                {presetDescription && (
                  <div className="text-xs text-muted-foreground mt-1">
                    期望类型：<code className="bg-surface-muted px-1 rounded">{presetDescription}</code>
                  </div>
                )}
                {current && (
                  <div className="text-[11px] text-muted-foreground mt-1">
                    v{current.version} · 上次更新 {current.updatedAt ?? "—"} by {current.updatedBy ?? "system"}
                  </div>
                )}
              </div>
              {active && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => remove(active)}>
                    <Trash2 className="h-3.5 w-3.5" /> 删除
                  </Button>
                  <Button size="sm" onClick={() => save(active)} disabled={!draft?.dirty}>
                    <Save className="h-3.5 w-3.5" /> 保存
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!active || !draft ? (
              <div className="text-sm text-muted-foreground py-12 text-center">左侧选择一个配置键</div>
            ) : (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">描述</label>
                  <Input
                    value={draft.description}
                    onChange={(e) => updateDraft(active, { description: e.target.value })}
                    placeholder="运营可见的说明"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground">JSON 值</label>
                    {draft.error && <Badge tone="neutral">{draft.error}</Badge>}
                  </div>
                  <Textarea
                    value={draft.value}
                    onChange={(e) => updateDraft(active, { value: e.target.value, error: undefined })}
                    rows={24}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground mt-1">保存会自动校验 JSON；version 自增、updatedAt/updatedBy 刷新。</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
