"use client";

import * as React from "react";
import { Settings2, Save, RefreshCw, Trash2, Plus, Code2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PlatformConfigApi } from "@/api";
import type { PlatformConfigDto } from "@/api/platform-config";

// ─────────────────────────────────────────────────────────────────────────────
// /base/presets — 孵化 / 锻造炉 预设
// 由原 /platform/config 并入，统一归在「基础数据」。
// 简单数组（string[] / {label,value}[] / {zh,en}[]）给结构化编辑；复杂对象回退到 JSON。
// ─────────────────────────────────────────────────────────────────────────────

type SimpleSchema = "string[]" | "labeled[]" | "labeledI18n[]" | "number" | "unknown";

interface KnownKeyMeta {
  key: string;
  label: string;
  schema: SimpleSchema;
  hint: string;
}

const GROUPS: { label: string; keys: KnownKeyMeta[] }[] = [
  {
    label: "孵化向导",
    keys: [
      { key: "incubation.cost",          label: "孵化费用",   schema: "number",        hint: "数字（积分）。每次孵化（创建一位 AI 艺人）扣除的积分；未配置默认 100" },
      { key: "incubation.faceStyles",    label: "面部风格",   schema: "labeledI18n[]", hint: "列表项：{ zh, en }" },
      { key: "incubation.fashionStyles", label: "服装风格",   schema: "labeledI18n[]", hint: "列表项：{ zh, en }" },
      { key: "incubation.templates",     label: "一键模版",   schema: "unknown",       hint: "WizardTemplate[]（结构复杂，使用 JSON）" },
    ],
  },
  {
    label: "形象锻造炉",
    keys: [
      { key: "forge.hairStyles",         label: "发型",       schema: "labeled[]",     hint: "列表项：{ label, value }" },
      { key: "forge.eyeColors",          label: "瞳色",       schema: "labeled[]",     hint: "列表项：{ label, value }" },
      { key: "forge.styleTags",          label: "风格标签",   schema: "labeled[]",     hint: "列表项：{ label, value }" },
      { key: "forge.faceSliders",        label: "面部滑块",   schema: "unknown",       hint: "FaceSlider[]（含 min/max/default，使用 JSON）" },
      { key: "forge.colorSchemes",       label: "配色",       schema: "unknown",       hint: "ColorScheme[]（含多色，使用 JSON）" },
      { key: "forge.promptSuggestions",  label: "推荐标签",   schema: "string[]",      hint: "字符串数组，每行一个" },
    ],
  },
];

const ALL_KNOWN: Record<string, KnownKeyMeta> = Object.fromEntries(
  GROUPS.flatMap((g) => g.keys.map((k) => [k.key, k])),
);

type Toast = { type: "ok" | "err"; msg: string } | null;

export default function PresetsPage() {
  const [configs, setConfigs] = React.useState<PlatformConfigDto[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<Toast>(null);
  const [newKey, setNewKey] = React.useState("");
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [draft, setDraft] = React.useState<{ value: unknown; description: string; dirty: boolean; jsonError?: string } | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await PlatformConfigApi.listConfigs();
      setConfigs(list);
      if (!active && list.length > 0) setActive(list[0].key);
    } catch (e: unknown) {
      setToast({ type: "err", msg: errMsg(e) ?? "加载失败" });
    } finally {
      setLoading(false);
    }
  }, [active]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const current = active ? configs.find((c) => c.key === active) ?? null : null;
  const meta = active ? ALL_KNOWN[active] ?? null : null;

  // 激活键变化时重置 draft
  // 后端尚未创建该 key（current 为 null）时仍按 meta.schema 给一个默认值，
  // 否则未创建的预设右侧只会显示占位文案，用户无法首次保存。
  React.useEffect(() => {
    if (!active) { setDraft(null); return; }
    if (current) {
      setDraft({
        value: current.value ?? defaultForSchema(meta?.schema ?? "unknown"),
        description: current.description ?? "",
        dirty: false,
      });
    } else if (meta) {
      setDraft({
        value: defaultForSchema(meta.schema),
        description: "",
        dirty: true,
      });
    } else {
      setDraft(null);
    }
  }, [active, current?.version, meta?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = <K extends keyof NonNullable<typeof draft>>(key: K, value: NonNullable<typeof draft>[K]) => {
    setDraft((prev) => prev ? { ...prev, [key]: value, dirty: true } : prev);
  };

  const save = async () => {
    if (!active || !draft) return;
    try {
      await PlatformConfigApi.upsertConfig(active, draft.value, draft.description || undefined);
      setToast({ type: "ok", msg: `已保存：${active}` });
      await refresh();
    } catch (e) {
      setToast({ type: "err", msg: errMsg(e) ?? "保存失败" });
    } finally {
      setTimeout(() => setToast(null), 2500);
    }
  };

  const remove = async (key: string) => {
    if (!confirm(`确定删除预设 ${key}？`)) return;
    try {
      await PlatformConfigApi.deleteConfig(key);
      if (active === key) setActive(null);
      await refresh();
      setToast({ type: "ok", msg: `已删除：${key}` });
    } catch (e) {
      setToast({ type: "err", msg: errMsg(e) ?? "删除失败" });
    } finally {
      setTimeout(() => setToast(null), 2500);
    }
  };

  const createNewKey = async () => {
    const k = newKey.trim();
    if (!k) return;
    try {
      await PlatformConfigApi.upsertConfig(k, [], "");
      setNewKey("");
      setActive(k);
      await refresh();
      setToast({ type: "ok", msg: `新建：${k}` });
    } catch (e) {
      setToast({ type: "err", msg: errMsg(e) ?? "新建失败" });
    } finally {
      setTimeout(() => setToast(null), 2500);
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="孵化 / 锻造炉 预设"
        description="面部风格 / 发型 / 瞳色 / 推荐标签 等预设列表。常用类型提供结构化编辑，复杂对象回退 JSON。"
        breadcrumb={[{ label: "基础数据" }, { label: "孵化 / 锻造炉 预设" }]}
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
        {/* 左侧：分组键清单 */}
        <Card className="col-span-12 md:col-span-4 lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4" /> 预设项
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-[calc(100vh-320px)] overflow-y-auto space-y-3 pr-1">
              {GROUPS.map((g) => (
                <div key={g.label} className="space-y-1">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-1">
                    {g.label}
                  </div>
                  {g.keys.map((k) => {
                    const existing = configs.find((c) => c.key === k.key);
                    const isActive = active === k.key;
                    return (
                      <button
                        key={k.key}
                        onClick={() => setActive(k.key)}
                        className={`w-full text-left rounded-md border px-3 py-2 text-xs transition-colors ${
                          isActive ? "bg-indigo-50 border-indigo-300 text-indigo-900" : "bg-card border-border hover:bg-surface-muted"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{k.label}</span>
                          {!existing && <span className="text-[10px] text-amber-600">未创建</span>}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate mt-0.5">{k.key}</div>
                      </button>
                    );
                  })}
                </div>
              ))}

              {/* 未知 key（后端存在但前端未登记） */}
              {configs.filter((c) => !ALL_KNOWN[c.key]).length > 0 && (
                <div className="space-y-1 pt-2 border-t border-border">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-1">
                    其他
                  </div>
                  {configs.filter((c) => !ALL_KNOWN[c.key]).map((c) => {
                    const isActive = active === c.key;
                    return (
                      <button
                        key={c.key}
                        onClick={() => setActive(c.key)}
                        className={`w-full text-left rounded-md border px-3 py-2 text-xs transition-colors ${
                          isActive ? "bg-indigo-50 border-indigo-300 text-indigo-900" : "bg-card border-border hover:bg-surface-muted"
                        }`}
                      >
                        <div className="truncate font-medium">{c.key}</div>
                        {c.description && (
                          <div className="text-[10px] text-muted-foreground truncate mt-0.5">{c.description}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
              <Input
                placeholder="新 key，如 forge.custom"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
              <Button size="sm" onClick={createNewKey} disabled={!newKey.trim()}>
                <Plus className="h-3.5 w-3.5" /> 新建
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 右侧：编辑器 */}
        <Card className="col-span-12 md:col-span-8 lg:col-span-9">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm">
                  {meta?.label ?? active ?? "选择一个预设"}
                </CardTitle>
                {meta && (
                  <div className="text-xs text-muted-foreground mt-1">
                    <code className="bg-surface-muted px-1 rounded">{meta.key}</code> · {meta.hint}
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
                  <Button size="sm" variant="ghost" onClick={() => setShowAdvanced((v) => !v)}>
                    <Code2 className="h-3.5 w-3.5" /> {showAdvanced ? "结构化" : "JSON"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(active)}>
                    <Trash2 className="h-3.5 w-3.5" /> 删除
                  </Button>
                  <Button size="sm" onClick={save} disabled={!draft?.dirty}>
                    <Save className="h-3.5 w-3.5" /> 保存
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!active || !draft ? (
              <div className="text-sm text-muted-foreground py-12 text-center">左侧选择一个预设</div>
            ) : (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">描述</label>
                  <Input
                    value={draft.description}
                    onChange={(e) => setField("description", e.target.value)}
                    placeholder="运营可见的说明"
                  />
                </div>

                {(() => {
                  const schema: SimpleSchema = meta?.schema ?? "unknown";
                  const effective: SimpleSchema = showAdvanced ? "unknown" : schema;
                  if (effective === "string[]")     return <StringArrayEditor value={toStringArr(draft.value)} onChange={(v) => setField("value", v)} />;
                  if (effective === "labeled[]")    return <LabeledArrayEditor value={toLabeledArr(draft.value)} onChange={(v) => setField("value", v)} fields={["label", "value"]} />;
                  if (effective === "labeledI18n[]") return <LabeledArrayEditor value={toLabeledArr(draft.value)} onChange={(v) => setField("value", v)} fields={["zh", "en"]} />;
                  if (effective === "number")       return <NumberEditor value={toNumber(draft.value)} onChange={(v) => setField("value", v)} />;
                  return <JsonEditor value={draft.value} onChange={(v, err) => { setField("value", v); setDraft((prev) => prev ? { ...prev, jsonError: err } : prev); }} error={draft.jsonError} />;
                })()}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 结构化编辑器
// ─────────────────────────────────────────────────────────────────────────────

function StringArrayEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = React.useState("");
  const add = () => {
    const v = input.trim();
    if (!v) return;
    onChange([...value, v]);
    setInput("");
  };
  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground">标签列表</label>
      <div className="flex flex-wrap gap-1.5 p-3 border border-border rounded-md bg-surface-muted min-h-[60px]">
        {value.length === 0 && <span className="text-xs text-muted-foreground">暂无</span>}
        {value.map((v, i) => (
          <Badge key={i} tone="neutral" className="gap-1">
            {v}
            <button
              type="button"
              aria-label="删除"
              className="hover:text-rose-600"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入后回车添加"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Button size="sm" onClick={add} disabled={!input.trim()}>
          <Plus className="h-3.5 w-3.5" /> 添加
        </Button>
      </div>
    </div>
  );
}

type LabeledItem = Record<string, string>;

function LabeledArrayEditor({
  value, onChange, fields,
}: {
  value: LabeledItem[];
  onChange: (v: LabeledItem[]) => void;
  fields: [string, string];
}) {
  const addRow = () => onChange([...value, { [fields[0]]: "", [fields[1]]: "" }]);
  const update = (i: number, field: string, v: string) =>
    onChange(value.map((item, j) => j === i ? { ...item, [field]: v } : item));
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">列表项（每行一个）</label>
        <Button size="sm" variant="ghost" onClick={addRow}>
          <Plus className="h-3.5 w-3.5" /> 新增一行
        </Button>
      </div>
      <div className="border border-border rounded-md divide-y divide-border">
        {value.length === 0 && (
          <div className="px-3 py-6 text-xs text-center text-muted-foreground">暂无，点上方「新增一行」</div>
        )}
        {value.map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2">
            <Input
              className="flex-1"
              placeholder={fields[0]}
              value={item[fields[0]] ?? ""}
              onChange={(e) => update(i, fields[0], e.target.value)}
            />
            <Input
              className="flex-1"
              placeholder={fields[1]}
              value={item[fields[1]] ?? ""}
              onChange={(e) => update(i, fields[1], e.target.value)}
            />
            <Button size="sm" variant="ghost" onClick={() => remove(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function NumberEditor({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = React.useState<string>(() => String(value));
  React.useEffect(() => { setText(String(value)); }, [value]);
  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground">数值</label>
      <Input
        type="number"
        value={text}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          if (t === "" || t === "-") return;
          const n = Number(t);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="font-mono"
      />
      <p className="text-xs text-muted-foreground">保存时以 JSON 数字字面量存储。</p>
    </div>
  );
}

function JsonEditor({ value, onChange, error }: {
  value: unknown;
  onChange: (v: unknown, err?: string) => void;
  error?: string;
}) {
  const [text, setText] = React.useState<string>(() => safeStringify(value));
  React.useEffect(() => {
    setText(safeStringify(value));
  }, [value]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">JSON 值（高级）</label>
        {error && <Badge tone="danger">{error}</Badge>}
      </div>
      <Textarea
        value={text}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          try {
            const parsed = JSON.parse(t);
            onChange(parsed, undefined);
          } catch (err: unknown) {
            onChange(value, errMsg(err) ?? "JSON 解析失败");
          }
        }}
        rows={22}
        className="font-mono text-xs"
      />
      <p className="text-xs text-muted-foreground">保存会自动校验；version 自增、updatedAt 刷新。</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

function defaultForSchema(s: SimpleSchema): unknown {
  if (s === "string[]" || s === "labeled[]" || s === "labeledI18n[]") return [];
  if (s === "number") return 0;
  return null;
}

function toStringArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function toLabeledArr(v: unknown): LabeledItem[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is LabeledItem => typeof x === "object" && x !== null);
}

function toNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function safeStringify(v: unknown): string {
  try { return JSON.stringify(v ?? null, null, 2); } catch { return "null"; }
}

function errMsg(e: unknown): string | undefined {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return undefined;
}
