"use client";

// Prompt 管理 —— 素材运营文本三件的 system + user 模板（DB 真源，admin 可改/灰度/回滚）。
// 对应 server AdminPromptController（/api/admin/prompts/*）+ PromptService（1min 缓存，PUT 立即失效）。

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  ChevronRight,
  Clapperboard,
  FileText,
  FlaskConical,
  Music2,
  RotateCcw,
  Save,
  Settings2,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useToast } from "@/components/feedback";
import { PromptsApi } from "@/api";
import type { PromptTemplate, PromptDryRun } from "@/api/prompts";
import { cn, formatDateTimeCN } from "@/lib/utils";

// v0.53（审计 #7）：补全友好名，与 server PromptService.KNOWN_KEYS 对齐。
// 列表本身由服务端动态返回（新 key 自动出现）；这里只是展示用中文名，缺失时回退裸 key。
const KEY_LABEL: Record<string, string> = {
  "material.script_draft": "带货脚本起稿",
  "material.selling_points": "商品卖点提取",
  "material.variable_extract": "脚本变量抽取",
  "material.video_ref_analysis": "参考视频分析",
  "appearance.forge": "形象锻造对话",
  "drama.script_draft": "短视频脚本起草",
  "drama.outline": "短剧分集大纲",
  "drama.epscript": "整集分场分镜",
  "drama.split_scene": "单场拆镜",
  "drama.cast": "角色阵容生成",
  "drama.frame_image": "短剧分镜首帧出图",
  "drama.clip_video": "短剧分镜出片视频",
  "drama.short_frame_image": "短视频首帧出图",
  "drama.short_clip_video": "短视频出片视频",
  "drama.recipe_extract": "爆款配方抽取",
  "drama.interactive_draft": "互动剧分支起草",
  "dap.persona": "数字人 · 人设解析",
  "dap.translate_edit": "数字人 · 编辑指令翻译",
  "dap.image_generate": "数字人 · 形象生成（AI 原创）",
  "dap.image_clone": "数字人 · 真人照片复刻",
  "dap.image_iterate": "数字人 · AI 重绘迭代",
  "dap.image_warp": "数字人 · 几何精调（云端）",
  "dap.image_look": "数字人 · 造型生成",
  "dap.image_atlas": "数字人 · 标准图集",
  "dap.image_deriv": "数字人 · 衍生图（表情/场景/服装）",
  "dap.video_orbit": "数字人 · 运镜视频",
};

const KEY_DESCRIPTION: Record<string, string> = {
  "material.script_draft": "明星带货脚本生成，按商品、受众、语气和时长输出可执行脚本。",
  "material.selling_points": "解析商品链接和名称，提炼可用于带货脚本的卖点。",
  "material.variable_extract": "从脚本文案中抽取镜头变量，供模板视频和混剪使用。",
  "material.video_ref_analysis": "分析参考视频的镜头结构、节奏和口播模式，沉淀可复用的创作线索。",
  "appearance.forge": "音乐人和短剧角色共用的形象顾问对话，辅助生成外貌、人设和风格建议。",
  "drama.script_draft": "短视频工坊的主题起稿，按题材、时长和数量生成竖屏短剧脚本。",
  "drama.outline": "短剧项目的一句话主题起草，生成分集大纲、每集钩子和情绪转折。",
  "drama.epscript": "把单集剧情拆成分场和镜头表，作为后续分镜出图、出片的制作脚本。",
  "drama.split_scene": "把一场戏单独拆成镜头表，适合运营临时重写某个场面或补齐镜头。",
  "drama.cast": "基于短剧标题、大纲和分集梗概生成角色阵容、人物卡和成长弧线。",
  "drama.frame_image": "短剧工作台分镜首帧出图提示词，把镜头画面、景别、运镜和角色信息转成图像模型输入。",
  "drama.clip_video": "短剧工作台分镜出片提示词，结合首帧参考和镜头描述生成直出视频。",
  "drama.short_frame_image": "短视频工坊单镜首帧出图提示词，通过全片设定保持主角、场景和风格一致。",
  "drama.short_clip_video": "短视频工坊单镜视频生成提示词，承接画面描述、口播和风格后缀。",
  "drama.recipe_extract": "把已发布短剧反向蒸馏成可复用创意配方，用于创意市场套用和二次创作。",
  "drama.interactive_draft": "互动剧主题起草提示词，一次生成剧集分支、选择点、标记和可达结局。",
  "dap.persona": "数字人人设解析，把用户输入拆成角色设定、视觉方向和生成指令。",
  "dap.translate_edit": "数字人编辑指令翻译，把中文修图需求转成稳定的图像编辑提示词。",
  "dap.image_generate": "数字人原创形象生成，基于人设和风格约束产出初始头像或半身形象。",
  "dap.image_clone": "真人照片复刻数字人形象，保留身份特征并转换成可运营的数字资产。",
  "dap.image_iterate": "对已有数字人进行重绘迭代，调整风格、细节和一致性问题。",
  "dap.image_warp": "数字人几何精调和局部修正，用于面部比例、姿态和局部结构调整。",
  "dap.image_look": "生成数字人的造型方案，覆盖妆发、服装、气质和场景适配。",
  "dap.image_atlas": "生成数字人标准图集，用于头像、半身、全身和多角度资产沉淀。",
  "dap.image_deriv": "生成数字人衍生图，覆盖表情、场景、服装和营销素材延展。",
  "dap.video_orbit": "生成数字人环绕运镜视频，用于资产展示、发布预览和短视频素材。",
};

const PROMPT_APPS = [
  { key: "celebrity", label: "AI 明星带货", description: "商品卖点、脚本、变量、视频参考", icon: Sparkles },
  { key: "drama", label: "AI 短剧", description: "短剧和短视频脚本生成", icon: Clapperboard },
  { key: "aiavatar", label: "AiAvatar", description: "数字人人设、图像、视频生成", icon: UserRound },
  { key: "music", label: "AI 音乐人", description: "形象锻造与角色对话", icon: Music2 },
  { key: "platform", label: "平台通用", description: "全局兜底与共享模板", icon: Settings2 },
] as const satisfies readonly { key: string; label: string; description: string; icon: LucideIcon }[];

type PromptAppKey = (typeof PROMPT_APPS)[number]["key"];

function canonicalPromptKey(promptKey: string): string {
  if (promptKey.startsWith("aiavatar.")) return `dap.${promptKey.slice("aiavatar.".length)}`;
  return promptKey;
}

function promptAppOf(promptKey: string): PromptAppKey {
  if (promptKey.startsWith("material.")) return "celebrity";
  if (promptKey.startsWith("drama.")) return "drama";
  if (promptKey.startsWith("dap.") || promptKey.startsWith("aiavatar.")) return "aiavatar";
  if (promptKey.startsWith("appearance.")) return "music";
  return "platform";
}

function promptAppMeta(promptKey: string) {
  return PROMPT_APPS.find((app) => app.key === promptAppOf(promptKey)) ?? PROMPT_APPS[PROMPT_APPS.length - 1];
}

function promptLabel(promptKey: string): string {
  return KEY_LABEL[canonicalPromptKey(promptKey)] ?? promptKey;
}

function promptDescription(promptKey: string): string {
  const canonicalKey = canonicalPromptKey(promptKey);
  if (KEY_DESCRIPTION[canonicalKey]) return KEY_DESCRIPTION[canonicalKey];
  if (promptKey.startsWith("material.")) return "AI 明星带货流程提示词，服务商品解析、脚本生成、变量抽取或素材分析。";
  if (promptKey.startsWith("drama.")) return "AI 短剧工作台提示词，服务大纲、分镜、角色、配方或视频生产流程。";
  if (promptKey.startsWith("dap.") || promptKey.startsWith("aiavatar.")) return "AiAvatar 数字人资产平台提示词，服务人设解析、图像生成、修图或视频资产生产。";
  if (promptKey.startsWith("appearance.")) return "跨子应用形象锻造提示词，服务角色外貌、人设和风格方向生成。";
  return "平台通用 Prompt，供共享能力、实验能力或后续新增子应用复用。";
}

// 试运行的样例参数（与 server PromptService.fill 的占位符对齐）。
const KEY_SAMPLE: Record<string, Record<string, string>> = {
  "material.script_draft": {
    product_name: "便携颈部按摩仪",
    category: "个护健康",
    price: "¥229.00",
    selling_points: "轻便随身 / 久坐党救星 / 三档力度",
    audience: "打工人、宝妈",
    tone: "情感故事",
    duration_sec: "38",
    count: "3",
    banned_words: "最、第一、100%、根治",
  },
  "material.selling_points": {
    name: "便携颈部按摩仪",
    link: "https://haohuo.jinritemai.com/ecommerce/trade/detail/index.html?id=demo",
  },
  "material.variable_extract": {
    script_blocks: "镜0：修了 30 年车，第一次给老婆买按摩仪\n镜1：从口袋拿出 · 老婆惊讶反应",
  },
};

export default function PromptsPage() {
  const toast = useToast();
  const [list, setList] = React.useState<PromptTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeApp, setActiveApp] = React.useState<PromptAppKey>("celebrity");
  const [activeKey, setActiveKey] = React.useState<string | null>(null);

  // 编辑态
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [userTemplate, setUserTemplate] = React.useState("");
  const [temperature, setTemperature] = React.useState("");
  const [maxTokens, setMaxTokens] = React.useState("");
  const [jsonMode, setJsonMode] = React.useState(true);
  const [enabled, setEnabled] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // 试运行
  const [sampleVars, setSampleVars] = React.useState("{}");
  const [dryRun, setDryRun] = React.useState<PromptDryRun | null>(null);
  const [dryRunning, setDryRunning] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const rows = await PromptsApi.listPrompts();
      setList(rows);
      setActiveKey((prev) => prev ?? rows[0]?.promptKey ?? null);
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
  const visibleList = React.useMemo(
    () => list.filter((prompt) => promptAppOf(prompt.promptKey) === activeApp),
    [activeApp, list],
  );
  const activeAppMeta = React.useMemo(
    () => PROMPT_APPS.find((app) => app.key === activeApp) ?? PROMPT_APPS[PROMPT_APPS.length - 1],
    [activeApp],
  );
  const appCounts = React.useMemo(() => {
    const counts: Record<PromptAppKey, number> = { celebrity: 0, drama: 0, aiavatar: 0, music: 0, platform: 0 };
    for (const prompt of list) counts[promptAppOf(prompt.promptKey)] += 1;
    return counts;
  }, [list]);

  React.useEffect(() => {
    if (active && promptAppOf(active.promptKey) === activeApp) return;
    setActiveKey(visibleList[0]?.promptKey ?? null);
  }, [active, activeApp, visibleList]);

  // 选中 prompt 时把编辑态灌进表单
  React.useEffect(() => {
    if (!active) return;
    setSystemPrompt(active.systemPrompt ?? "");
    setUserTemplate(active.userTemplate ?? "");
    setTemperature(active.params?.temperature != null ? String(active.params.temperature) : "");
    setMaxTokens(active.params?.maxTokens != null ? String(active.params.maxTokens) : "");
    setJsonMode(active.params?.jsonMode !== false);
    setEnabled(active.enabled);
    setSampleVars(JSON.stringify(KEY_SAMPLE[canonicalPromptKey(active.promptKey)] ?? {}, null, 2));
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
      toast.success({ title: "已保存", description: "1 分钟内全节点生效" });
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
        title="Prompt 管理"
        description="按子应用管理 system + user 模板。每条 Prompt 都有业务描述，key 只作为调用标识。保存后立即失效缓存，无需重启。"
      />

      <section className="rounded-lg border border-border bg-card p-1.5">
        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-1" role="tablist" aria-orientation="horizontal" aria-label="Prompt 子应用筛选">
            {PROMPT_APPS.map((app) => {
              const selected = app.key === activeApp;
              const Icon = app.icon;
              return (
                <button
                  key={app.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  title={app.description}
                  onClick={() => setActiveApp(app.key)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap font-medium">{app.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs tabular-nums",
                      selected ? "bg-primary-foreground/15 text-primary-foreground" : "bg-surface-muted text-muted-foreground",
                    )}
                  >
                    {appCounts[app.key]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr] lg:gap-6">
        {/* 左：prompt 列表 */}
        <div className="space-y-3">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm">{activeAppMeta.label} Prompt</CardTitle>
                <span className="text-xs tabular-nums text-muted-foreground">{visibleList.length} 条</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading && <div className="px-3 py-4 text-sm text-muted-foreground">加载中…</div>}
              {!loading && visibleList.length === 0 && <div className="px-3 py-4 text-sm text-muted-foreground">该应用暂无 Prompt。</div>}
              <div role="listbox" aria-label={`${activeAppMeta.label} Prompt 列表`} className="divide-y divide-border">
                {visibleList.map((p) => {
                  const isActive = p.promptKey === activeKey;
                  return (
                    <button
                      key={p.promptKey}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => setActiveKey(p.promptKey)}
                      className={cn(
                        "group flex w-full items-start gap-3 px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        isActive ? "bg-primary/6" : "bg-card hover:bg-muted/45",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                          isActive ? "bg-primary/12 text-primary" : "bg-surface-muted text-muted-foreground",
                        )}
                      >
                        <FileText className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium">{promptLabel(p.promptKey)}</span>
                          {!p.enabled && <Badge tone="neutral" className="shrink-0 text-[10px]">已停用</Badge>}
                          {p.version > 1 && <Badge tone="warning" className="shrink-0 text-[10px]">运营已改</Badge>}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{promptDescription(p.promptKey)}</span>
                        <span className="mt-1 flex min-w-0 items-center gap-2 font-mono text-[10px] text-muted-foreground">
                          <span className="truncate">{p.promptKey}</span>
                          <span className="shrink-0">v{p.version}</span>
                        </span>
                      </span>
                      <span
                        className={cn(
                          "mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                          isActive ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground group-hover:bg-surface-muted",
                        )}
                        aria-hidden
                      >
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右：编辑器 */}
        {active ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex-col items-start gap-4 space-y-0 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral" className="font-normal">{promptAppMeta(active.promptKey).label}</Badge>
                    <Badge tone={active.enabled ? "success" : "neutral"} className="font-normal">
                      {active.enabled ? "已启用" : "已停用"}
                    </Badge>
                    {active.version > 1 && <Badge tone="warning" className="font-normal">运营已改</Badge>}
                  </div>
                  <CardTitle className="text-base">{promptLabel(active.promptKey)}</CardTitle>
                  <div className="max-w-3xl text-sm leading-6 text-muted-foreground">
                    {promptDescription(active.promptKey)}
                  </div>
                  <div className="flex flex-wrap gap-2 font-mono text-[11px] text-muted-foreground">
                    <span className="rounded-md bg-surface-muted px-2 py-1">{active.promptKey}</span>
                    <span className="rounded-md bg-surface-muted px-2 py-1">v{active.version}</span>
                    {active.updatedAt && <span className="rounded-md bg-surface-muted px-2 py-1">{formatDateTimeCN(active.updatedAt)}</span>}
                  </div>
                </div>
                <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
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
                <div>
                  <div className="mb-1.5 text-sm font-medium">System Prompt</div>
                  <Textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={6}
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex flex-wrap items-center gap-2 text-sm font-medium">
                    User 模板
                    <span className="font-mono text-[10px] font-normal text-muted-foreground">
                      占位符 {"{{key}}"} 调用时按业务参数填充
                    </span>
                  </div>
                  <Textarea
                    value={userTemplate}
                    onChange={(e) => setUserTemplate(e.target.value)}
                    rows={12}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <div className="mb-1.5 text-sm font-medium">temperature</div>
                    <Input
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      placeholder="0.7"
                      className="w-28"
                    />
                  </div>
                  <div>
                    <div className="mb-1.5 text-sm font-medium">max_tokens</div>
                    <Input
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(e.target.value)}
                      placeholder="2048"
                      className="w-28"
                    />
                  </div>
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <Switch checked={jsonMode} onCheckedChange={setJsonMode} />
                    JSON 模式（response_format）
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* 试运行 */}
            <Card>
              <CardHeader className="flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FlaskConical className="h-4 w-4" /> 试运行（仅填充，不调模型）
                </CardTitle>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSampleVars(JSON.stringify(KEY_SAMPLE[active.promptKey] ?? {}, null, 2))}
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
          !loading && <div className="text-sm text-muted-foreground">暂无可配置的 prompt</div>
        )}
      </div>
    </div>
  );
}
