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
  "drama.short_prompt_parse": {
    label: "短视频提示词拆解",
    blurb: "短视频「提示词直出」用：把用户粘贴的整段提示词忠实拆成人物卡 / 场景 / 全片画面基调 / 逐镜分镜。要求只还原不二次创作；人物的外貌与台词性格必须分开（外貌进每镜画面，台词不进），否则一句台词会污染所有镜头。",
    vars: ["{{prompt}} 用户提示词原文", "{{instructionClause}} 本次调整要求（可空）", "{{maxShots}} 分镜上限", "{{maxShotSec}} 单镜时长上限秒"],
    defaultTemp: 0.4,
    sample: {
      prompt: "【角色】阿宁：齐耳短发，米白针织开衫。【场景】老城咖啡馆，午后逆光。【分镜】00:00-00:04 远景推近：阿宁抱纸箱进门。台词：旁白：搬来第七天。",
      instructionClause: "",
      maxShots: "40",
      maxShotSec: "15",
    },
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
    sample: { metaPrefix: "全片视觉设定：固定主角阿杰；固定场景清晨出租屋。", visual: "闹钟狂响，阿杰一个鲤鱼打挺弹起", styleSuffix: "竖屏风格短片，邵氏港片喜剧风格。" },
    kind: "media",
  },
  "drama.short_clip_video": {
    label: "⑧ 短视频出片视频",
    blurb: "短视频工坊单镜出片视频提示词。",
    vars: ["{{metaPrefix}} 全片设定前缀", "{{visual}} 画面内容", "{{lineClause}} 口播（可空）", "{{styleSuffix}} 风格后缀"],
    defaultTemp: 0,
    sample: { metaPrefix: "全片视觉设定：固定主角阿杰；固定场景清晨出租屋。", visual: "阿杰听见门外异响，迅速贴墙回头", lineClause: "本镜表演对白：阿杰说“门外有人。”；画面中不要显示对白文字或字幕。", styleSuffix: "竖屏风格短片，邵氏港片喜剧风格。" },
    kind: "media",
  },
  // ── v0.198 画布（web-drama /canvas）：文字类共用「短剧脚本起草」端点、一律 JSON 输出，服务端按形状校验，
  //    不合格退款；出图 / 出视频是给图像 / 视频模型的单条 prompt。参考图由后端按连线 / @ 引用带上，模板里不写地址。
  "drama.canvas_script_setting": {
    label: "画布 · 故事大纲",
    blurb: "画布里「让 AI 写剧本」的第一步：由用户的一句话想法写题材、主线和人物小传。输出 JSON {text}。",
    vars: ["{{idea}} 用户的想法", "{{targetEpisodes}} 计划集数", "{{episodeDurationSec}} 每集秒数", "{{styleClause}} 全剧风格（可空）", "{{currentClause}} 重写时的上一版（可空）", "{{instructionClause}} 这次的要求（可空）"],
    defaultTemp: 0.9,
    sample: { idea: "老中学拆除前，女老师在旧教室发现一封十七年前的信", targetEpisodes: "10", episodeDurationSec: "60", styleClause: "", currentClause: "", instructionClause: "" },
  },
  "drama.canvas_script_outline": {
    label: "画布 · 分集剧情",
    blurb: "按故事大纲写每集的标题、开场钩子和梗概。集数多时后端每 20 集一批，后一批会带上前一批最后几集（{{prevClause}}）。输出 JSON {episodes:[{no,title,hook,summary}]}，条数必须正好。",
    vars: ["{{setting}} 故事大纲", "{{total}} 全剧集数", "{{fromNo}} / {{toNo}} 这一批从第几集到第几集", "{{count}} 这一批集数", "{{episodeDurationSec}} 每集秒数", "{{prevClause}} 前一批最后几集（可空）", "{{styleClause}} 全剧风格（可空）", "{{instructionClause}} 这次的要求（可空）"],
    defaultTemp: 0.85,
    sample: { setting: "题材与基调：悬疑情感……", total: "10", fromNo: "1", toNo: "10", count: "10", episodeDurationSec: "60", prevClause: "", styleClause: "", instructionClause: "" },
  },
  "drama.canvas_script_episode": {
    label: "画布 · 分集剧本",
    blurb: "把某一集写成标准剧本格式（场次、时间地点、出场人物、△ 动作、台词）。锁上的集后端直接拒绝，不会调到这里。输出 JSON {title,text}。",
    vars: ["{{no}} 集号", "{{total}} 全剧集数", "{{settingClause}} 故事大纲（可空）", "{{outlineClause}} 这一集的分集剧情（可空）", "{{prevClause}} 上一集结尾（可空）", "{{currentClause}} 重写时的现有正文（可空）", "{{instructionClause}} 这次的要求（可空）", "{{episodeDurationSec}} 每集秒数", "{{styleClause}} 全剧风格（可空）"],
    defaultTemp: 0.85,
    sample: { no: "1", total: "10", settingClause: "", outlineClause: "这一集的分集剧情：\n标题：旧教室重逢\n钩子：……\n梗概：……\n", prevClause: "", currentClause: "", instructionClause: "", episodeDurationSec: "60", styleClause: "" },
  },
  "drama.canvas_extract": {
    label: "画布 · 拆角色和场景",
    blurb: "从全部分集剧本里拆出角色（含造型、出现集数、六段式外貌描述）和场景。剧本长时后端按集分批，结果按名字合并；{{knownClause}} 是已有 / 前几批拆出的名字，让模型沿用同一叫法。",
    vars: ["{{scriptText}} 这一批的剧本正文", "{{episodeRange}} 这一批是第几集", "{{maxEpisodeNo}} 全剧最后一集", "{{knownClause}} 已有的角色和场景名字（可空）", "{{styleClause}} 全剧风格（可空）"],
    defaultTemp: 0.3,
    sample: { scriptText: "## 第 1 集\n### 场1-1\n日 内 旧教室\n出场人物：林微\n△ 林微蹲在地上整理旧物。", episodeRange: "第 1 集", maxEpisodeNo: "10", knownClause: "", styleClause: "" },
  },
  "drama.canvas_storyboard": {
    label: "画布 · 分镜脚本",
    blurb: "把一集剧本切成片段（每段 1–4 个镜头，逐行「（N 秒）……」），角色和场景用 @[名字](look:id) 引用。后端会校验：片段时长不超过上限、引用的 id 必须在画布里（不在的改成纯文字）。",
    vars: ["{{no}} 集号", "{{title}} 集标题", "{{scriptText}} 这一集剧本", "{{assetTable}} 画布里的造型 / 场景对照表", "{{maxSec}} 单个片段时长上限", "{{minSec}} 建议最短", "{{episodeDurationSec}} 每集秒数", "{{styleClause}} 全剧风格（可空）"],
    defaultTemp: 0.5,
    sample: { no: "1", title: "旧教室重逢", scriptText: "### 场1-1\n日 内 旧教室\n△ 林微蹲在地上整理旧物。", assetTable: "- 林微·基础造型（角色「林微」的造型「基础造型」）→ @[林微·基础造型](look:lk_demo)", maxSec: "10", minSec: "4", episodeDurationSec: "60", styleClause: "" },
  },
  "drama.canvas_look_image": {
    label: "画布 · 造型出图",
    blurb: "角色造型卡出图（全身立绘）。连进来的造型 / 场景 / 素材图由后端当参考图带上，文字素材拼进 {{textClause}}。",
    vars: ["{{name}} 角色·造型名", "{{prompt}} 外貌描述", "{{textClause}} 连进来的文字素材（可空）", "{{refClause}} 参考图说明（可空）", "{{styleClause}} 全剧风格（可空）", "{{ratioClause}} 画幅"],
    defaultTemp: 0,
    sample: { name: "林微·基础造型", prompt: "基本信息：女，30 岁左右……", textClause: "", refClause: "", styleClause: "风格：90 年代写实电影风格。", ratioClause: "竖屏 9:16 构图。" },
    kind: "media",
  },
  "drama.canvas_scene_image": {
    label: "画布 · 场景出图",
    blurb: "场景卡出图（空景，不画人）。",
    vars: ["{{name}} 场景名", "{{prompt}} 环境描述", "{{textClause}} 连进来的文字素材（可空）", "{{refClause}} 参考图说明（可空）", "{{styleClause}} 全剧风格（可空）", "{{ratioClause}} 画幅"],
    defaultTemp: 0,
    sample: { name: "旧教室", prompt: "老中学教室，木课桌，午后阳光透过灰尘……", textClause: "", refClause: "", styleClause: "", ratioClause: "竖屏 9:16 构图。" },
    kind: "media",
  },
  "drama.canvas_material_image": {
    label: "画布 · 素材图出图",
    blurb: "画布上自由素材图按用户写的提示词出图。",
    vars: ["{{prompt}} 素材图提示词", "{{textClause}} 连进来的文字素材（可空）", "{{refClause}} 参考图说明（可空）", "{{styleClause}} 全剧风格（可空）", "{{ratioClause}} 画幅"],
    defaultTemp: 0,
    sample: { prompt: "一个生锈的铁皮饼干盒，放在旧课桌抽屉里", textClause: "", refClause: "", styleClause: "", ratioClause: "竖屏 9:16 构图。" },
    kind: "media",
  },
  "drama.canvas_frame_image": {
    label: "画布 · 片段首帧",
    blurb: "单集编辑器里给片段出首帧：画第一个镜头的开场画面，参考片段里 @ 到的造型 / 场景 / 素材图。画幅强制跟画布。",
    vars: ["{{firstShot}} 第一个镜头", "{{segmentText}} 整个片段（换掉了 @ 标记）", "{{refClause}} 参考图说明（可空）", "{{styleClause}} 全剧风格（可空）", "{{ratioClause}} 画幅"],
    defaultTemp: 0,
    sample: { firstShot: "日，旧教室。近景，平视。林微·成年 蹲在地上整理旧物。", segmentText: "（4 秒）日，旧教室。近景，平视。林微·成年 蹲在地上整理旧物。", refClause: "", styleClause: "", ratioClause: "竖屏 9:16 构图。" },
    kind: "media",
  },
  "drama.canvas_segment_video": {
    label: "画布 · 片段出视频",
    blurb: "片段首帧 + 分镜脚本 → 一条视频。每行保留「（N 秒）」让模型按时长切镜头；首帧由后端随任务带给视频模型，模板里不用写图片地址。",
    vars: ["{{segmentText}} 片段分镜脚本（换掉了 @ 标记）", "{{styleClause}} 全剧风格（可空）", "{{ratioClause}} 画幅"],
    defaultTemp: 0,
    sample: { segmentText: "（4 秒）日，旧教室。近景。林微蹲在地上整理旧物。\n（3 秒）特写，林微拉开抽屉。", styleClause: "", ratioClause: "竖屏 9:16 构图。" },
    kind: "media",
  },
};

const DRAMA_KEY_ORDER = [
  "drama.outline", "drama.epscript", "drama.split_scene", "drama.cast", "drama.script_draft",
  "drama.short_prompt_parse",
  "drama.frame_image", "drama.clip_video", "drama.short_frame_image", "drama.short_clip_video",
  "drama.canvas_script_setting", "drama.canvas_script_outline", "drama.canvas_script_episode",
  "drama.canvas_extract", "drama.canvas_storyboard",
  "drama.canvas_look_image", "drama.canvas_scene_image", "drama.canvas_material_image",
  "drama.canvas_frame_image", "drama.canvas_segment_video",
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

      <div className="grid gap-4 lg:grid-cols-[260px_1fr] lg:gap-6">
        {/* 左：drama prompt 列表 */}
        <div className="grid gap-2 sm:grid-cols-2 lg:block lg:space-y-2">
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
              <CardHeader className="flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="min-w-0 text-base">
                  {meta?.label ?? active.promptKey}
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{active.promptKey}</span>
                </CardTitle>
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
                    <div className="w-full sm:max-w-[280px]">
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
                    <div className="w-full sm:max-w-[280px]">
                      <div className="mb-1 text-sm font-medium">单次最长输出 · max_tokens</div>
                      <Input
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(e.target.value)}
                        placeholder={
                          activeKey === "drama.short_prompt_parse"
                            ? "留空=8192"
                            : activeKey === "drama.script_draft"
                              ? "留空=6144"
                              : "留空=4096"
                        }
                        className="w-32"
                      />
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        模型一次最多生成多少内容（≈ 字数 × 1.5）。整集分场分镜这种长输出可调高（如 6000）；调太高会更慢、更贵。
                      </p>
                    </div>
                    <div className="w-full sm:max-w-[280px]">
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
              <CardHeader className="flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FlaskConical className="h-4 w-4" /> 试运行（仅填充占位符，不调模型 / 不扣费）
                </CardTitle>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
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
