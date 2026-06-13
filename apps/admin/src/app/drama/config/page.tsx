"use client";

// 短剧专区 · 个性化配置（v0.66）
// 真值存 aep_platform_configs（key 前缀 drama.），web-drama 端经
// GET /api/me/drama/config 消费：扣费确认阈值（小额免打扰）+ 各 AI 动作单价。
// 注：「分镜视频（直出/动态）」单价沿用带货线 action 定价 material.video-generate，
// 在「明星带货 → 引擎价格」里调，此页只读展示入口。
import * as React from "react";
import Link from "next/link";
import { Save } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listConfigs, upsertConfig } from "@/api/platform-config";

interface FieldDef {
  key: string;
  label: string;
  hint: string;
  group: "threshold" | "price";
}

const FIELDS: FieldDef[] = [
  {
    key: "drama.credit.confirm-threshold",
    label: "扣费确认弹窗阈值",
    hint: "消耗 ≥ 该值才弹确认框；低于阈值小额免打扰，点击直接执行",
    group: "threshold",
  },
  { key: "drama.credit.outline-trial", label: "大纲 · 试铺（前 6 集）", hint: "大纲分集「先开个头试试」单次积分", group: "price" },
  { key: "drama.credit.outline-full", label: "大纲 · 完整设计", hint: "大纲分集「完整设计」单次积分", group: "price" },
  { key: "drama.credit.epscript", label: "整集分场分镜重写", hint: "剧集脚本「基于剧情重新生成分场分镜」/ AI 对话重写 单次积分", group: "price" },
  { key: "drama.credit.split-scene", label: "单场拆镜", hint: "「把这场拆成分镜表单」单次积分", group: "price" },
  { key: "drama.credit.cast", label: "重抽角色阵容", hint: "「从大纲重抽角色」单次积分", group: "price" },
  { key: "drama.credit.frame", label: "分镜首帧渲染", hint: "首帧图像渲染单次积分（一次出多版仍按单次计）", group: "price" },
];

const DEFAULTS: Record<string, number> = {
  "drama.credit.confirm-threshold": 10,
  "drama.credit.outline-trial": 6,
  "drama.credit.outline-full": 18,
  "drama.credit.epscript": 10,
  "drama.credit.split-scene": 6,
  "drama.credit.cast": 5,
  "drama.credit.frame": 2,
};

export default function DramaConfigPage() {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [saved, setSaved] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await listConfigs();
      const byKey: Record<string, number> = { ...DEFAULTS };
      for (const c of all) {
        if (c.key.startsWith("drama.credit.") && typeof c.value === "number") {
          byKey[c.key] = c.value;
        }
      }
      setSaved(byKey);
      setValues(Object.fromEntries(FIELDS.map((f) => [f.key, String(byKey[f.key] ?? DEFAULTS[f.key])])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "配置加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const save = async (f: FieldDef) => {
    const raw = values[f.key];
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      setNotice(`「${f.label}」需要填 ≥ 0 的整数`);
      return;
    }
    setSavingKey(f.key);
    setNotice(null);
    try {
      await upsertConfig(f.key, n, f.hint);
      setSaved((m) => ({ ...m, [f.key]: n }));
      setNotice(`「${f.label}」已保存为 ${n}`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setSavingKey(null);
    }
  };

  const renderField = (f: FieldDef) => {
    const cur = values[f.key] ?? "";
    const dirty = Number(cur) !== saved[f.key];
    return (
      <div key={f.key} className="flex items-start gap-4 py-3 border-b last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{f.label}</span>
            {dirty && <Badge tone="warning" className="text-xs">未保存</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{f.hint}</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5 font-mono">{f.key} · 默认 {DEFAULTS[f.key]}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Input
            value={cur}
            onChange={(e) => setValues((m) => ({ ...m, [f.key]: e.target.value }))}
            inputMode="numeric"
            className="w-24 text-right"
            disabled={loading}
          />
          <span className="text-xs text-muted-foreground w-6">积分</span>
          <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || savingKey === f.key} onClick={() => void save(f)}>
            <Save className="h-3.5 w-3.5 mr-1" />
            {savingKey === f.key ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="短剧专区 · 个性化配置"
        description="web-drama 工作台的扣费体验与各 AI 动作单价 —— 改完即刻生效（前端会话级缓存，刷新页面拉到新值）"
      />

      {notice && (
        <div className="rounded-md border bg-muted/40 px-4 py-2 text-sm">{notice}</div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => void load()}>重试</Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">扣费确认体验</CardTitle>
        </CardHeader>
        <CardContent>{FIELDS.filter((f) => f.group === "threshold").map(renderField)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI 动作单价（积分 / 次）</CardTitle>
        </CardHeader>
        <CardContent>
          {FIELDS.filter((f) => f.group === "price").map(renderField)}
          <div className="flex items-start gap-4 py-3">
            <div className="flex-1 min-w-0">
              <span className="font-medium text-sm">分镜视频（直出 / 动态渲染）</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                沿用带货线 action 定价 <span className="font-mono">material.video-generate</span>（hold→commit 计费）
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/celebrity/engine-pricing">去「引擎价格」调整</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
