"use client";

// 短剧专区 · 提示词设置 —— 短剧各 AI 动作（大纲/分场分镜/拆镜/选角/短视频脚本）的
// system + user 提示词与调参。统一走 server PromptService（DB 真源，1min 缓存，PUT 立即生效），
// 复用 /api/admin/prompts（与「平台 > Prompt 管理」同一后端），此页只过滤 drama.* 并补人性化说明。
//
// 角色门：/api/admin/prompts 已限 SUPER_ADMIN / OPERATOR。

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { FlaskConical, Save, RotateCcw } from "lucide-react";
import { useToast } from "@/components/feedback";
import { PromptsApi } from "@/api";
import type { PromptTemplate, PromptDryRun } from "@/api/prompts";

interface DramaPromptMeta {
  label: string;
  blurb: string;
  /** 该 prompt 调用时由后端填充的占位符，列给运营避免乱删。 */
  vars: string[];
  /** 推荐 temperature（留空即用，无需每次设）。仅文本类用。 */
  defaultTemp: number;
  /** 试运行样例参数。 */
  sample: Record<string, string>;
  /** text=对话生成（有 system + 调参）；media=图像/视频单 prompt（无 system / 不调温度）。默认 text。 */
  kind?: "text" | "media";
}

// 与 server PromptService 的 drama.* key 对齐（v0.71）。新 key 加进这里即出现友好名 + 说明。
const DRAMA_META: Record<string, DramaPromptMeta> = {
  "drama.outline": {
    label: "① 分集大纲",
    blurb: "按项目信息铺整部短剧的分集大纲（每集钩子 / 梗概 / 情绪转折）。",
    vars: ["{{title}} 剧名", "{{type}} 题材", "{{count}} 集数", "{{loglineClause}} 一句话简介（可空）", "{{mainlineClause}} 主线（可空）"],
    defaultTemp: 0.9,
    sample: {
      title: "落地窗后",
      type: "悬疑短剧",
      count: "6",
      loglineClause: "一句话简介：搬进新家的第一晚，她发现对楼有人在偷窥。",
      mainlineClause: "",
    },
  },
  "drama.epscript": {
    label: "② 整集分场分镜",
    blurb: "把某一集的剧情拆成「分场 + 每场镜头表」，供工作台逐镜出片。",
    vars: ["{{ep}} 集号", "{{plot}} 本集剧情", "{{styleClause}} 作品风格（可空）", "{{castClause}} 出场人物（可空）"],
    defaultTemp: 0.85,
    sample: {
      ep: "1",
      plot: "林夏搬入新公寓，夜里发现对楼窗口有诡异人影，越看越不对劲。",
      styleClause: "作品风格：悬疑压抑、快节奏。",
      castClause: "出场人物：林夏、神秘男。",
    },
  },
  "drama.split_scene": {
    label: "③ 单场拆镜",
    blurb: "把一场戏（场面描述 + 台词）单独拆成镜头表。",
    vars: ["{{place}} 场面", "{{action}} 描述", "{{linesClause}} 台词（可空）"],
    defaultTemp: 0.8,
    sample: {
      place: "内景 · 公寓客厅 · 深夜",
      action: "林夏拆完最后一个纸箱，抬头望向窗外，对楼忽然亮起一盏灯。",
      linesClause: "台词：\n旁白：她以为只是错觉。",
    },
  },
  "drama.cast": {
    label: "④ 角色阵容",
    blurb: "从大纲重抽一套角色阵容（主角 / 配角 + 人物卡 + 成长弧线）。",
    vars: ["{{title}} 剧名", "{{loglineClause}} 一句话剧情（可空）", "{{epsClause}} 分集梗概（可空）"],
    defaultTemp: 0.9,
    sample: {
      title: "落地窗后",
      loglineClause: "一句话剧情：搬进新家的女孩卷入对楼的失踪案。",
      epsClause: "分集梗概：\n第1集：发现人影\n第2集：邻居失踪",
    },
  },
  "drama.script_draft": {
    label: "短视频脚本起草",
    blurb: "短视频工坊「说句话出脚本」用：按主题出 1-3 个竖屏短剧脚本（分场 + 画面 + 台词）。",
    vars: ["{{theme}} 主题", "{{genre}} 题材", "{{duration}} 时长秒", "{{count}} 份数"],
    defaultTemp: 0.9,
    sample: { theme: "上班族手忙脚乱的早晨", genre: "都市喜剧", duration: "38", count: "1" },
  },
  "drama.frame_image": {
    label: "⑤ 分镜首帧出图（工作台）",
    blurb: "短剧工作台「视频工厂」点首帧时，把分镜镜头描述拼成图像生成提示词。这是给图像模型看的单条 prompt（无 system / 不吃温度参数）。",
    vars: ["{{visual}} 画面内容", "{{size}} 景别", "{{move}} 运镜", "{{lineClause}} 台词（可空）", "{{castClause}} 出场人物（可空）", "{{styleSuffix}} 题材风格后缀"],
    defaultTemp: 0,
    sample: { visual: "林夏在客厅拆纸箱，抬头望向窗外", size: "中近景", move: "缓慢推近", lineClause: "", castClause: "出场人物：林夏。", styleSuffix: "悬疑短剧风格。" },
    kind: "media",
  },
  "drama.clip_video": {
    label: "⑥ 分镜出片 / 直出视频（工作台）",
    blurb: "短剧工作台分镜「直出 / 动态」视频时的提示词（首帧参考由后端自动追加）。",
    vars: ["{{visual}} 画面内容", "{{size}} 景别", "{{move}} 运镜", "{{lineClause}} 台词（可空）", "{{castClause}} 出场人物（可空）", "{{styleSuffix}} 题材风格后缀"],
    defaultTemp: 0,
    sample: { visual: "对楼窗口人影一闪而过", size: "特写", move: "固定", lineClause: "", castClause: "", styleSuffix: "悬疑短剧风格。" },
    kind: "media",
  },
  "drama.short_frame_image": {
    label: "⑦ 短视频首帧出图",
    blurb: "短视频工坊单镜首帧出图提示词。`{{metaPrefix}}` 是全片设定（主角/场景/风格），保证跨镜一致。",
    vars: ["{{metaPrefix}} 全片设定前缀", "{{visual}} 画面内容", "{{styleSuffix}} 风格后缀"],
    defaultTemp: 0,
    sample: { metaPrefix: "主角：阿杰，年轻上班族。场景：清晨出租屋。", visual: "闹钟狂响，阿杰一个鲤鱼打挺弹起", styleSuffix: "竖屏短视频画面，口播带货风格。" },
    kind: "media",
  },
  "drama.short_clip_video": {
    label: "⑧ 短视频出片视频",
    blurb: "短视频工坊单镜出片视频提示词。",
    vars: ["{{metaPrefix}} 全片设定前缀", "{{visual}} 画面内容", "{{lineClause}} 口播（可空）", "{{styleSuffix}} 风格后缀"],
    defaultTemp: 0,
    sample: { metaPrefix: "主角：阿杰，年轻上班族。", visual: "阿杰举着保温杯对镜头比心", lineClause: "口播：家人们这个真的绝了。", styleSuffix: "竖屏短视频，口播带货风格。" },
    kind: "media",
  },
};

const DRAMA_KEY_ORDER = [
  "drama.outline", "drama.epscript", "drama.split_scene", "drama.cast", "drama.script_draft",
  "drama.frame_image", "drama.clip_video", "drama.short_frame_image", "drama.short_clip_video",
];

export default function DramaPromptsPage() {
  const toast = useToast();
  const [list, setList] = React.useState<PromptTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeKey, setActiveKey] = React.useState<string | null>(null);

  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [userTemplate, setUserTemplate] = React.useState("");
  const [temperature, setTemperature] = React.useState("");
  const [maxTokens, setMaxTokens] = React.useState("");
  const [jsonMode, setJsonMode] = React.useState(true);
  const [enabled, setEnabled] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [sampleVars, setSampleVars] = React.useState("{}");
  const [dryRun, setDryRun] = React.useState<PromptDryRun | null>(null);
  const [dryRunning, setDryRunning] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const rows = await PromptsApi.listPrompts();
      const drama = rows
        .filter((p) => p.promptKey.startsWith("drama."))
        .sort((a, b) => {
          const ia = DRAMA_KEY_ORDER.indexOf(a.promptKey);
          const ib = DRAMA_KEY_ORDER.indexOf(b.promptKey);
          return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
        });
      setList(drama);
      setActiveKey((prev) => prev ?? drama[0]?.promptKey ?? null);
    } catch (e) {
      toast.danger({ title: "加载失败", description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const active = list.find((p) => p.promptKey === activeKey) ?? null;
  const meta = activeKey ? DRAMA_META[activeKey] : undefined;
  // 图像/视频是单 prompt：无 system、不吃 temperature/maxTokens/jsonMode。
  const isMedia = meta?.kind === "media";

  React.useEffect(() => {
    if (!active) return;
    setSystemPrompt(active.systemPrompt ?? "");
    setUserTemplate(active.userTemplate ?? "");
    setTemperature(active.params?.temperature != null ? String(active.params.temperature) : "");
    setMaxTokens(active.params?.maxTokens != null ? String(active.params.maxTokens) : "");
    setJsonMode(active.params?.jsonMode !== false);
    setEnabled(active.enabled);
    setSampleVars(JSON.stringify(DRAMA_META[active.promptKey]?.sample ?? {}, null, 2));
    setDryRun(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  const save = async () => {
    if (!activeKey) return;
    setSaving(true);
    try {
      await PromptsApi.upsertPrompt(activeKey, {
        systemPrompt,
        userTemplate,
        params: {
          temperature: temperature.trim() === "" ? null : Number(temperature),
          maxTokens: maxTokens.trim() === "" ? null : Number(maxTokens),
          jsonMode,
        },
        enabled,
      });
      toast.success({ title: "已保存", description: "1 分钟内全节点生效，所有用户下次生成即用新提示词" });
      await load();
    } catch (e) {
      toast.danger({ title: "保存失败", description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const runDryRun = async () => {
    if (!activeKey) return;
    setDryRunning(true);
    try {
      let vars: Record<string, string> = {};
      try {
        vars = JSON.parse(sampleVars || "{}");
      } catch {
        toast.danger({ title: "样例参数不是合法 JSON" });
        setDryRunning(false);
        return;
      }
      const result = await PromptsApi.dryRunPrompt(activeKey, vars);
      setDryRun(result);
    } catch (e) {
      toast.danger({ title: "试运行失败", description: (e as Error).message });
    } finally {
      setDryRunning(false);
    }
  };

  return (
    <div className="admin-page space-y-6">
      <PageHeader
        title="短剧 · 提示词设置"
        description="短剧各 AI 动作的 system + user 提示词，改完保存即生效（无需改代码或重启）。占位符形如 {{title}}，生成时由系统按项目数据填充——别删占位符，只改措辞 / 结构 / 输出要求。"
      />

      <div className="grid grid-cols-[260px_1fr] gap-6">
        {/* 左：drama prompt 列表 */}
        <div className="space-y-2">
          {loading && <div className="px-2 text-sm text-muted-foreground">加载中…</div>}
          {!loading && list.length === 0 && (
            <div className="px-2 text-sm text-muted-foreground">
              暂无短剧提示词。若后端刚加 key，重启 server 由 PromptTemplateSeeder 自动 seed 后即出现。
            </div>
          )}
          {list.map((p) => {
            const isActive = p.promptKey === activeKey;
            return (
              <button
                key={p.promptKey}
                onClick={() => setActiveKey(p.promptKey)}
                className={
                  "w-full rounded-lg border px-3 py-2.5 text-left transition " +
                  (isActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50")
                }
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{DRAMA_META[p.promptKey]?.label ?? p.promptKey}</span>
                  {!p.enabled && <Badge tone="neutral" className="text-[10px]">已停用</Badge>}
                </div>
                <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  <span>{p.promptKey}</span>
                  <span>· v{p.version}</span>
                  {p.version > 1 && <span className="text-amber-600">运营已改</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* 右：编辑器 */}
        {active ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">
                  {meta?.label ?? active.promptKey}
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{active.promptKey}</span>
                </CardTitle>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={enabled} onCheckedChange={setEnabled} />
                    启用
                  </label>
                  <Button onClick={save} disabled={saving}>
                    <Save className="mr-1.5 h-4 w-4" />
                    {saving ? "保存中…" : "保存"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {meta && <p className="text-sm text-muted-foreground">{meta.blurb}</p>}

                {!isMedia && (
                  <div>
                    <div className="mb-1.5 text-sm font-medium">System Prompt（角色设定 / 总规则）</div>
                    <Textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      rows={4}
                      className="font-mono text-xs"
                    />
                  </div>
                )}

                <div>
                  <div className="mb-1.5 text-sm font-medium">
                    {isMedia ? "出图 / 出片提示词模板（给图像 / 视频模型的单条 prompt）" : "User 模板（具体指令 + 输出 JSON 结构）"}
                  </div>
                  <Textarea
                    value={userTemplate}
                    onChange={(e) => setUserTemplate(e.target.value)}
                    rows={12}
                    className="font-mono text-xs"
                  />
                  {meta && (
                    <div className="mt-2 rounded-md border border-dashed border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">可用占位符</span>（生成时自动填充，请勿删除）：
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono">
                        {meta.vars.map((v) => (
                          <span key={v}>{v}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 调参 + 人性化说明（仅文本生成；图像/视频不吃这些参数） */}
                {isMedia ? (
                  <p className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                    图像 / 视频生成只用上面这条提示词；不使用 temperature / max_tokens / JSON 模式。比例、版数、首帧参考由前端按镜头传入，单价在「短剧专区 · 个性化配置」里调。
                  </p>
                ) : (
                <div className="rounded-lg border border-border p-4">
                  <div className="mb-3 text-sm font-medium">调用参数（留空即用推荐默认，无需每次设置）</div>
                  <div className="flex flex-wrap items-start gap-6">
                    <div className="max-w-[280px]">
                      <div className="mb-1 text-sm font-medium">创意发散度 · temperature</div>
                      <Input
                        value={temperature}
                        onChange={(e) => setTemperature(e.target.value)}
                        placeholder={meta ? `留空=${meta.defaultTemp}` : "留空=默认"}
                        className="w-32"
                      />
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        0–1。越低越稳、越守结构（分镜 / 拆镜 / 选角这类要严格 JSON 的建议 0.8 上下）；越高越发散有想象力（铺大纲建议 0.9）。不确定就留空。
                      </p>
                    </div>
                    <div className="max-w-[280px]">
                      <div className="mb-1 text-sm font-medium">单次最长输出 · max_tokens</div>
                      <Input
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(e.target.value)}
                        placeholder="留空=4096"
                        className="w-32"
                      />
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        模型一次最多生成多少内容（≈ 字数 × 1.5）。整集分场分镜这种长输出可调高（如 6000）；调太高会更慢、更贵。
                      </p>
                    </div>
                    <div className="max-w-[280px]">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <Switch checked={jsonMode} onCheckedChange={setJsonMode} />
                        强制 JSON 输出
                      </label>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        开启后模型只能吐 JSON。短剧所有结构化生成都必须保持开启，否则会夹带解释文字、导致解析失败、白扣积分。
                      </p>
                    </div>
                  </div>
                </div>
                )}
              </CardContent>
            </Card>

            {/* 试运行 */}
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FlaskConical className="h-4 w-4" /> 试运行（仅填充占位符，不调模型 / 不扣费）
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSampleVars(JSON.stringify(meta?.sample ?? {}, null, 2))}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> 样例
                  </Button>
                  <Button size="sm" onClick={runDryRun} disabled={dryRunning}>
                    {dryRunning ? "运行中…" : "试运行"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="mb-1.5 text-sm font-medium">样例参数（JSON）</div>
                  <Textarea
                    value={sampleVars}
                    onChange={(e) => setSampleVars(e.target.value)}
                    rows={6}
                    className="font-mono text-xs"
                  />
                </div>
                {dryRun && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">填充后 system</div>
                    <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">{dryRun.system}</pre>
                    <div className="text-sm font-medium">填充后 user</div>
                    <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">{dryRun.user}</pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          !loading && <div className="text-sm text-muted-foreground">暂无可配置的短剧提示词</div>
        )}
      </div>
    </div>
  );
}
