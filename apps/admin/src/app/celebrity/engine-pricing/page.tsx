"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AI 明星 · 权益扣减配置
//   - 引擎单价（v0.5 §D5；v0.33 起落 PlatformConfig）
//   - 动作单价（v0.35：混剪生成 / 分发上传 / 视频生成 各自单价，可选回退引擎价）
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/feedback";
import { CelebrityZoneApi } from "@/api";
import type { ActionPricing } from "@/api/celebrity-zone";
import type { VideoStudioMode, VideoStudioPricingConfig } from "@/types/video-studio";

type EnginePricing = Record<string, { creditPrice: number; cost: number }>;
const ENGINES = ["KeLing", "HiGen", "MiniMax"];

type ActionRow = { code: string; label: string; unit: string; allowEngineFallback: boolean };

const ACTIONS: ActionRow[] = [
  { code: "mixcut.generate",     label: "混剪生成",       unit: "积分 / 单变体", allowEngineFallback: false },
  { code: "publish.upload",      label: "分发上传",       unit: "积分 / 单任务", allowEngineFallback: false },
  { code: "celebrity.video",     label: "数字人视频生成", unit: "积分 / 单条",   allowEngineFallback: true },
  { code: "material.script-draft", label: "AI 脚本起稿",   unit: "积分 / 单稿（0=不计费）", allowEngineFallback: false },
  // v0.53 审计补：server v0.42 起已有该 action（默认 30/条），此前 admin 漏列导致运营无法改价
  { code: "material.video-generate", label: "带货视频生成", unit: "积分 / 单条", allowEngineFallback: false },
];

// v0.53：dap（数字人资产平台）动作单价后台化。0 / 缺失 = 走部署默认价
// （application.yml aep.dap.pricing.* / AEP_DAP_PRICING_* env），>0 = 覆盖默认价立即生效。
const DAP_ACTIONS: ActionRow[] = [
  { code: "dap.generate",        label: "AI 原创形象生成", unit: "积分 / 次（默认 20）", allowEngineFallback: false },
  { code: "dap.generate-upload", label: "上传照片复刻",     unit: "积分 / 次（默认 15）", allowEngineFallback: false },
  { code: "dap.iterate",         label: "AI 重绘迭代",      unit: "积分 / 次（默认 5）",  allowEngineFallback: false },
  { code: "dap.warp",            label: "几何精调（云端）", unit: "积分 / 次（默认 3）",  allowEngineFallback: false },
  { code: "dap.look",            label: "造型生成",         unit: "积分 / 次（默认 8）",  allowEngineFallback: false },
  { code: "dap.derive-atlas",    label: "标准图集",         unit: "积分 / 次（默认 12）", allowEngineFallback: false },
  { code: "dap.derive-expr",     label: "表情包",           unit: "积分 / 次（默认 10）", allowEngineFallback: false },
  { code: "dap.derive-scene",    label: "场景图",           unit: "积分 / 次（默认 8）",  allowEngineFallback: false },
  { code: "dap.derive-ward",     label: "服装造型图",       unit: "积分 / 次（默认 8）",  allowEngineFallback: false },
  { code: "dap.derive-d3",       label: "3D 预览",          unit: "积分 / 次（默认 10）", allowEngineFallback: false },
  { code: "dap.derive-video",    label: "运镜视频",         unit: "积分 / 次（默认 30）", allowEngineFallback: false },
  { code: "dap.voice-clone",     label: "声音克隆",         unit: "积分 / 次（默认 10）", allowEngineFallback: false },
  // v0.151 AI IP 工作台（前端 v0.190 起在 apps/web-aiavatar）：特征卡按次，形象出图按张（一个生成节点 1/2/4 张）
  { code: "dap.ip-identity",     label: "IP 人物特征卡抽取", unit: "积分 / 次（默认 2）",  allowEngineFallback: false },
  { code: "dap.ip-image",        label: "IP 形象出图",       unit: "积分 / 张（默认 8）",  allowEngineFallback: false },
];

export default function CelebrityPricingPage() {
  return (
    <div className="admin-page space-y-6">
      <PageHeader
        title="权益扣减配置"
        description="混剪生成 / 分发上传 / 数字人视频生成 各自的积分单价、引擎计价表，以及「AI 创作 → 视频生成」的每秒价与智能优化单价。修改后用户端立即生效。"
      />

      <Tabs defaultValue="action" className="space-y-4">
        <TabsList>
          <TabsTrigger value="action">动作单价（v0.35）</TabsTrigger>
          <TabsTrigger value="engine">引擎单价</TabsTrigger>
          <TabsTrigger value="video-studio">视频生成</TabsTrigger>
        </TabsList>

        <TabsContent value="action">
          <ActionPricingTab />
        </TabsContent>
        <TabsContent value="engine">
          <EnginePricingTab />
        </TabsContent>
        <TabsContent value="video-studio">
          <VideoStudioPricingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── 动作单价 Tab（v0.35） ────────────────────────────────────────────────────
function ActionPricingTab() {
  const toast = useToast();
  const [pricing, setPricing] = React.useState<Record<string, ActionPricing>>({});
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      setPricing(await CelebrityZoneApi.getActionPricing());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  function setPrice(code: string, val: number) {
    setPricing({
      ...pricing,
      [code]: { ...pricing[code], creditPrice: val, useEnginePricing: false },
    });
  }
  function setUseEngine(code: string, on: boolean) {
    setPricing({
      ...pricing,
      [code]: { ...pricing[code], useEnginePricing: on, creditPrice: on ? null : (pricing[code]?.creditPrice ?? 0) },
    });
  }

  async function onSave() {
    setSaving(true); setErr(null);
    try {
      await CelebrityZoneApi.replaceActionPricing(pricing);
      toast.success({ title: "已保存", description: "用户端扣点单价已立即生效。" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      setErr(msg);
      toast.danger({ title: "保存失败", description: msg });
    } finally {
      setSaving(false);
    }
  }

  function renderActionRow(a: ActionRow) {
    const row = pricing[a.code] ?? {};
    const useEngine = !!row.useEnginePricing;
    return (
      <TableRow key={a.code}>
        <TableCell>
          <div className="flex flex-col">
            <span className="font-medium">{a.label}</span>
            <span className="text-xs text-muted-foreground">{a.code}</span>
          </div>
        </TableCell>
        <TableCell>
          <Input
            type="number"
            className="w-32"
            value={useEngine ? "" : (row.creditPrice ?? 0)}
            onChange={(ev) => setPrice(a.code, Number(ev.target.value) || 0)}
            disabled={useEngine}
            placeholder={useEngine ? "—" : "0"}
          />
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">{a.unit}</TableCell>
        <TableCell>
          {a.allowEngineFallback ? (
            <div className="flex items-center gap-2">
              <Switch checked={useEngine} onCheckedChange={(v) => setUseEngine(a.code, v)} />
              <span className="text-xs text-muted-foreground">{useEngine ? "走引擎计价表" : "用左侧单价"}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">动作单价表</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
        {err && <div className="text-sm text-destructive">{err}</div>}
        {!loading && !err && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>动作</TableHead>
                <TableHead>单价</TableHead>
                <TableHead>单位</TableHead>
                <TableHead>沿用引擎价</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={4} className="bg-muted/40 py-2 text-xs font-medium text-muted-foreground">
                  明星带货 / 素材运营
                </TableCell>
              </TableRow>
              {ACTIONS.map((a) => renderActionRow(a))}
              <TableRow>
                <TableCell colSpan={4} className="bg-muted/40 py-2 text-xs font-medium text-muted-foreground">
                  数字人资产平台（dap）· 0 = 走部署默认价，&gt;0 = 覆盖默认价
                </TableCell>
              </TableRow>
              {DAP_ACTIONS.map((a) => renderActionRow(a))}
            </TableBody>
          </Table>
        )}
        <div className="mt-4 flex gap-2">
          <Button onClick={() => void onSave()} disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </Button>
          <Button variant="outline" onClick={() => void refresh()}>重新读取</Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          说明：单价缺失或为 0 时，对应动作回退到部署默认值（混剪 30 / 分发 20 / dap 走 aep.dap.pricing.*）；
          勾选「沿用引擎价」时调用方按 KeLing/HiGen/MiniMax 计价表算。dap 行修改后约 1 分钟内全量生效（缓存 TTL）。
        </p>
      </CardContent>
    </Card>
  );
}

// ── 视频生成 Tab（v0.199，web-celebrity「AI 创作 → 视频生成」） ─────────────────
// 我们自己定价，不照搬厂商价格（docs/video-studio-plan.md §3）。格子空着 = 按「AI 模型与 Key」里
// 给这个模型配的每秒价；模型也没配就是「未定价」，用户那边不报价、不能提交。

const STUDIO_MODES: { mode: VideoStudioMode; label: string; hint: string }[] = [
  { mode: "t2v", label: "文生视频", hint: "只写提示词" },
  { mode: "i2v", label: "首帧生视频", hint: "1 张首帧图" },
  { mode: "first_last_frame_video", label: "首尾帧生视频", hint: "首帧 + 尾帧" },
  { mode: "universal_reference_video", label: "全能参考", hint: "图 / 视频 / 音频参考" },
];
const STUDIO_TIERS = ["768p", "544p"] as const;
const PRICE_MAX = 100_000;

function emptyStudioPricing(): VideoStudioPricingConfig {
  const perSecond = {} as VideoStudioPricingConfig["perSecond"];
  for (const m of STUDIO_MODES) perSecond[m.mode] = { "768p": null, "544p": null };
  return { perSecond, freeRefImages: 0, extraRefImagePerSecond: 0, promptOptimizationPerCall: 0 };
}

/** 保存前的检查（服务端会再判一遍，这里只是让运营当场看到哪一格不对）。 */
function studioPricingProblems(c: VideoStudioPricingConfig): string[] {
  const out: string[] = [];
  const intIn = (v: number, lo: number, hi: number) => Number.isInteger(v) && v >= lo && v <= hi;
  for (const m of STUDIO_MODES) {
    for (const t of STUDIO_TIERS) {
      const v = c.perSecond[m.mode]?.[t];
      if (v != null && !intIn(v, 1, PRICE_MAX)) out.push(`${m.label} ${t} 的每秒价要填 1 到 ${PRICE_MAX} 的整数，或者留空`);
    }
  }
  if (!intIn(c.freeRefImages, 0, 9)) out.push("不加价的参考图张数要填 0 到 9");
  if (!intIn(c.extraRefImagePerSecond, 0, PRICE_MAX)) out.push(`参考图加价要填 0 到 ${PRICE_MAX} 的整数`);
  if (!intIn(c.promptOptimizationPerCall, 0, PRICE_MAX)) out.push(`智能优化单价要填 0 到 ${PRICE_MAX} 的整数`);
  return out;
}

/** 服务端少给了哪一格就按「留空」补上，表格始终是完整的 4 × 2。 */
function normalizeStudioPricing(got: VideoStudioPricingConfig): VideoStudioPricingConfig {
  const base = emptyStudioPricing();
  for (const m of STUDIO_MODES) base.perSecond[m.mode] = { ...base.perSecond[m.mode], ...(got.perSecond?.[m.mode] ?? {}) };
  return { ...base, ...got, perSecond: base.perSecond };
}

function VideoStudioPricingTab() {
  const toast = useToast();
  // null = 还没成功读到线上的配置。这时不给编辑也不给保存：保存是整份替换，
  // 拿一张空表（全部按模型单价、智能优化免费）去 PUT，等于把线上的定价整份抹掉。
  const [config, setConfig] = React.useState<VideoStudioPricingConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      setConfig(normalizeStudioPricing(await CelebrityZoneApi.getVideoStudioPricing()));
    } catch (e) {
      // 「重新读取」失败也回到没读到的状态：屏幕上那份已经说不清是不是线上的了
      setConfig(null);
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  function setCell(mode: VideoStudioMode, tier: string, raw: string) {
    const text = raw.trim();
    const value = text === "" ? null : Number(text);
    setConfig((c) => c && { ...c, perSecond: { ...c.perSecond, [mode]: { ...c.perSecond[mode], [tier]: value } } });
  }

  function setNumber(field: "freeRefImages" | "extraRefImagePerSecond" | "promptOptimizationPerCall", raw: string) {
    setConfig((c) => c && { ...c, [field]: raw.trim() === "" ? 0 : Number(raw) });
  }

  const problems = config ? studioPricingProblems(config) : [];

  async function onSave() {
    if (!config || problems.length > 0) return;
    setSaving(true); setErr(null);
    try {
      setConfig(normalizeStudioPricing(await CelebrityZoneApi.replaceVideoStudioPricing(config)));
      toast.success({ title: "已保存", description: "视频生成的价格约 1 分钟内对所有用户生效。" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      setErr(msg);
      toast.danger({ title: "保存失败", description: msg });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">视频生成（明星带货 · AI 创作）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
        {err && <div className="text-sm text-destructive">{err}</div>}
        {!loading && !config && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">没读到线上的价格配置。读到之前不能改，免得用一张空表把线上价格整份覆盖掉。</span>
            <Button variant="outline" onClick={() => void refresh()}>重试</Button>
          </div>
        )}
        {!loading && config && (
          <>
            <div>
              <div className="mb-2 text-sm font-medium">每秒价（积分 / 秒）</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>模式</TableHead>
                    {STUDIO_TIERS.map((t) => <TableHead key={t}>{t}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {STUDIO_MODES.map((m) => (
                    <TableRow key={m.mode}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{m.label}</span>
                          <span className="text-xs text-muted-foreground">{m.hint}</span>
                        </div>
                      </TableCell>
                      {STUDIO_TIERS.map((t) => {
                        const v = config.perSecond[m.mode]?.[t];
                        return (
                          <TableCell key={t}>
                            <Input
                              type="number"
                              min={1}
                              className="w-36"
                              aria-label={`${m.label} ${t} 每秒价`}
                              value={v == null ? "" : String(v)}
                              placeholder="按模型单价"
                              onChange={(ev) => setCell(m.mode, t, ev.target.value)}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-2 text-xs text-muted-foreground">
                总价 = 每秒价 × 秒数。空着的格子按「AI 模型与 Key」里给这个模型配的单价算；模型也没配单价时，用户选到这个组合会看到「还没定价」，不能提交。
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">全能参考：前几张图不加价</span>
                <Input type="number" min={0} max={9} value={String(config.freeRefImages)} onChange={(ev) => setNumber("freeRefImages", ev.target.value)} />
                <span className="text-xs text-muted-foreground">0 到 9 张</span>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">之后每张图，每秒加价</span>
                <Input type="number" min={0} value={String(config.extraRefImagePerSecond)} onChange={(ev) => setNumber("extraRefImagePerSecond", ev.target.value)} />
                <span className="text-xs text-muted-foreground">积分 / 秒 / 张，0 = 不加</span>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">智能优化，每次</span>
                <Input type="number" min={0} value={String(config.promptOptimizationPerCall)} onChange={(ev) => setNumber("promptOptimizationPerCall", ev.target.value)} />
                <span className="text-xs text-muted-foreground">积分 / 次，0 = 不收费；与生成分开扣</span>
              </label>
            </div>

            {problems.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
                {problems.map((p) => <li key={p}>{p}</li>)}
              </ul>
            )}

            <div className="flex gap-2">
              <Button onClick={() => void onSave()} disabled={saving || problems.length > 0}>
                {saving ? "保存中…" : "保存"}
              </Button>
              <Button variant="outline" onClick={() => void refresh()}>重新读取</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── 引擎单价 Tab ─────────────────────────────────────────────────────────────
function EnginePricingTab() {
  const toast = useToast();
  const [pricing, setPricing] = React.useState<EnginePricing>({});
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      setPricing(await CelebrityZoneApi.getEnginePricing());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  function setPrice(eng: string, field: "creditPrice" | "cost", val: number) {
    setPricing({
      ...pricing,
      [eng]: { ...(pricing[eng] ?? { creditPrice: 0, cost: 0 }), [field]: val },
    });
  }

  async function onSave() {
    setSaving(true); setErr(null);
    try {
      await CelebrityZoneApi.replaceEnginePricing(pricing);
      toast.success({ title: "已保存", description: "引擎计价已立即生效。" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      setErr(msg);
      toast.danger({ title: "保存失败", description: msg });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">引擎计价表</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
        {err && <div className="text-sm text-destructive">{err}</div>}
        {!loading && !err && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>引擎</TableHead>
                <TableHead>积分单价（积分 / 条）</TableHead>
                <TableHead>套餐扣减（条 / 次调用）</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ENGINES.map((e) => (
                <TableRow key={e}>
                  <TableCell className="font-medium">{e}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-32"
                      value={pricing[e]?.creditPrice ?? 0}
                      onChange={(ev) => setPrice(e, "creditPrice", Number(ev.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-32"
                      value={pricing[e]?.cost ?? 0}
                      onChange={(ev) => setPrice(e, "cost", Number(ev.target.value) || 0)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="mt-4 flex gap-2">
          <Button onClick={() => void onSave()} disabled={saving}>
            {saving ? "保存中…" : "保存整张表"}
          </Button>
          <Button variant="outline" onClick={() => void refresh()}>重新读取</Button>
        </div>
      </CardContent>
    </Card>
  );
}
