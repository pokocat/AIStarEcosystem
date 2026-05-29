"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AppearanceForge.v3 — AI 形象锻造工作台
//
// PRODUCT.md：confident / calm / professional · 反对 neon gimmicks 与 sci-fi
// 陈词。这一版剥离了上一代的玻璃 card、扫描线、四角 corner bracket、三色霓虹
// ring、悬浮按钮 + 弹窗（chat/history overlay），改用稳定的 3 栏 + 底部 dock：
//   · 左栏：素材与约束（mode / 身份 / 照片 / 风格 / 微调）
//   · 中栏：工具条 → 模版条 → 主画布
//   · 右栏：对话 / 历史 / 流 三 tab
// 所有视觉用 packages/ui shadcn 原语 + app.css 已重写的 token；保留全部业务行为
// （Coze 流式、provider 检测、保存形象、采样进度、键入提示词）。
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  Bot,
  Check,
  History as HistoryIcon,
  Lock,
  MessageSquare,
  Play,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  Square,
  Unlock,
  Upload,
  X,
} from "lucide-react";

import { AppearanceForgeApi } from "@/api";
import { Badge } from "@ai-star-eco/ui/ui/badge";
import { Button } from "@ai-star-eco/ui/ui/button";
import { Input } from "@ai-star-eco/ui/ui/input";
import { Slider } from "@ai-star-eco/ui/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ai-star-eco/ui/ui/tabs";
import { Progress } from "@ai-star-eco/ui/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@ai-star-eco/ui/ui/sheet";
import {
  FORGE_HISTORY_MAX,
  MODE_CONFIG,
} from "@/constants/appearance-forge-ui";
import { buildAppearanceForgePrompt } from "@/lib/appearance-forge-prompt";
import {
  COLOR_SCHEMES,
  EYE_COLORS,
  FACE_SLIDERS,
  FORGE_TEMPLATES,
  HAIR_STYLES,
  STYLE_TAGS,
} from "@/mocks/appearance-forge";
import type { Lang } from "@/translations";
import type { ForgeMode, ForgeResult } from "@ai-star-eco/types/appearance-forge";

import { type Artist } from "./ArtistTypes";

interface Props {
  lang: Lang;
  activeArtist: Artist;
  onArtistAvatarSaved?: (nextAvatar: string) => void;
}

type StreamTone = "info" | "success" | "error";

interface ConversationTurn {
  id: string;
  role: "assistant" | "user" | "status";
  text: string;
  tone?: StreamTone;
  at: string; // HH:mm
  actions?: { label: string; onClick?: () => void; primary?: boolean }[];
}

interface HistoryVersion {
  id: string;
  label: string;
  at: string; // HH:mm
  image: string;
}

type ForgingStatus = "idle" | "streaming" | "completed" | "error" | "aborted";

// 12 款风格模版 —— 命名沿用原型。图片复用 FORGE_TEMPLATES 的 6 张，避免引入
// 占位图。accent 字段从前一版的三色霓虹改为"是否高亮"语义。
const TEMPLATE_STRIP: { id: string; name: string; image: string }[] = [
  { id: "t-01", name: "01 霓虹偶像", image: FORGE_TEMPLATES[0].image },
  { id: "t-02", name: "02 暗黑歌姬", image: FORGE_TEMPLATES[1].image },
  { id: "t-03", name: "03 街头赛博", image: FORGE_TEMPLATES[3].image },
  { id: "t-04", name: "04 全息幻影", image: FORGE_TEMPLATES[4].image },
  { id: "t-05", name: "05 哥特暗夜", image: FORGE_TEMPLATES[5].image },
  { id: "t-06", name: "06 未来超模", image: FORGE_TEMPLATES[2].image },
  { id: "t-07", name: "07 荧光耳锥", image: FORGE_TEMPLATES[0].image },
  { id: "t-08", name: "08 量子项链", image: FORGE_TEMPLATES[4].image },
  { id: "t-09", name: "09 机械义体", image: FORGE_TEMPLATES[3].image },
  { id: "t-10", name: "10 光绘纹路", image: FORGE_TEMPLATES[1].image },
  { id: "t-11", name: "11 暗黑斗篷", image: FORGE_TEMPLATES[5].image },
  { id: "t-12", name: "12 星辰皇冠", image: FORGE_TEMPLATES[2].image },
];

const GENDER_OPTIONS = ["女性", "男性", "中性"];
const AGE_OPTIONS = ["18 岁", "22 岁", "25 岁", "30 岁", "35 岁"];
const REGION_OPTIONS = ["东亚", "东南亚", "欧美", "拉美", "中东"];
const VIBE_OPTIONS = ["冷峻", "清甜", "飒爽", "柔和", "张扬"];
const QUICK_REFINES = ["瞳孔亮一点", "下巴再尖", "换个姿势", "换光照"];
const HAIR_LABELS = ["短直", "长直", "波浪", "双马尾"];
const STYLE_TAG_FALLBACK = [
  { id: "s1", label: "赛博纹身" },
  { id: "s2", label: "机械义体" },
  { id: "s4", label: "荧光耳锥" },
  { id: "s5", label: "故障面纹" },
  { id: "s3", label: "全息护目" },
  { id: "s6", label: "量子项链" },
  { id: "s7", label: "光绘纹路" },
  { id: "s8", label: "暗黑斗篷" },
];
const CONVERSATION_MODEL = "星辰模型 4.2";

function nowHHmm(offsetMinutes = 0) {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toneClasses(tone?: StreamTone) {
  if (tone === "success") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (tone === "error")   return "border-destructive/40 bg-destructive/10 text-destructive";
  return "border-border bg-muted text-foreground";
}

export const AppearanceForgeV3: React.FC<Props> = ({ activeArtist, onArtistAvatarSaved }) => {
  // ── 参数状态 ───────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<ForgeMode>("template_photo");
  const [selectedTemplate, setSelectedTemplate] = useState<string>(TEMPLATE_STRIP[0]!.id);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [fusionRatio, setFusionRatio] = useState(50);
  const [gender, setGender] = useState(GENDER_OPTIONS[0]!);
  const [age, setAge] = useState(AGE_OPTIONS[1]!);
  const [region, setRegion] = useState(REGION_OPTIONS[0]!);
  const [vibe, setVibe] = useState(VIBE_OPTIONS[0]!);
  const [selectedHair, setSelectedHair] = useState<string | null>(HAIR_STYLES[0]?.id ?? null);
  const [selectedEye, setSelectedEye] = useState<string | null>(EYE_COLORS[0]?.id ?? null);
  const [hairVolume, setHairVolume] = useState(70);
  const [selectedTags, setSelectedTags] = useState<string[]>(
    STYLE_TAGS.slice(0, 5).map(t => t.id),
  );
  const [faceValues, setFaceValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(FACE_SLIDERS.map(s => [s.id, 50])),
  );
  const [lockedFeatures, setLockedFeatures] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");

  // ── 对话 & 锻造状态 ───────────────────────────────────────────────────────
  const [providerStatus, setProviderStatus] = useState<AppearanceForgeApi.ForgeProviderStatus | null>(null);
  const [providerLoading, setProviderLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [forgingStatus, setForgingStatus] = useState<ForgingStatus>("idle");
  const [conversation, setConversation] = useState<ConversationTurn[]>(() => [
    {
      id: "seed-welcome",
      role: "assistant",
      at: "--:--",
      text: "在左侧选好参考与设定后点「开始锻造」，我会生成一版完整的形象方案；也可以直接在下面告诉我你的想法，我们一起来打磨。",
    },
  ]);
  const [dockTab, setDockTab] = useState<"chat" | "history" | "log">("chat");
  const [streamNotes, setStreamNotes] = useState<{ id: string; text: string; tone: StreamTone }[]>([]);
  const [composer, setComposer] = useState("");
  const [canvasPreview, setCanvasPreview] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [history, setHistory] = useState<HistoryVersion[]>(() => [
    { id: "v-01", label: "版本 01", at: "--:--", image: FORGE_TEMPLATES[0].image },
    { id: "v-02", label: "版本 02", at: "--:--", image: FORGE_TEMPLATES[1].image },
    { id: "v-03", label: "版本 03", at: "--:--", image: FORGE_TEMPLATES[3].image },
    { id: "v-04", label: "版本 04", at: "--:--", image: FORGE_TEMPLATES[4].image },
  ]);
  const [activeHistoryId, setActiveHistoryId] = useState<string>("v-01");
  // v0.40 · 「形象参数」侧抽屉开关（原 LEFT 列的素材与约束表单 stash 到这里）
  const [paramsOpen, setParamsOpen] = useState(false);
  const [promptStrength] = useState(8.5);
  const [seedLocked, setSeedLocked] = useState(true);
  const [seed] = useState("#7F3C");
  const [samplingStep, setSamplingStep] = useState<{ current: number; total: number; noise: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const replyBufferRef = useRef("");
  const conversationScrollRef = useRef<HTMLDivElement>(null);

  // Mount 后填充真实时间（避免 SSR/CSR 水合不匹配）
  useEffect(() => {
    const offsets = [-6, -5, -5];
    setConversation(prev => prev.map((t, i) => (t.at === "--:--" ? { ...t, at: nowHHmm(offsets[i] ?? 0) } : t)));
    const histOffsets = [0, -4, -11, -18];
    setHistory(prev => prev.map((h, i) => (h.at === "--:--" ? { ...h, at: nowHHmm(histOffsets[i] ?? 0) } : h)));
  }, []);

  // Provider 状态
  useEffect(() => {
    let cancelled = false;
    setProviderLoading(true);
    AppearanceForgeApi.getForgeProviderStatus()
      .then(s => { if (!cancelled) setProviderStatus(s); })
      .catch((err: unknown) => {
        if (!cancelled) setProviderStatus({
          configured: false,
          provider: "coze",
          message: (err as Error).message || "大模型状态获取失败",
        });
      })
      .finally(() => { if (!cancelled) setProviderLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // 切换艺人重置
  useEffect(() => {
    abortRef.current?.abort();
    setGenerating(false);
    setForgingStatus("idle");
    setCanvasPreview(null);
    setGeneratedImageUrl(null);
    setStreamNotes([]);
    setSamplingStep(null);
  }, [activeArtist.id]);

  useEffect(() => {
    if (!conversationScrollRef.current) return;
    conversationScrollRef.current.scrollTop = conversationScrollRef.current.scrollHeight;
  }, [conversation, streamNotes, dockTab]);

  // ── 派生 ───────────────────────────────────────────────────────────────────
  const selectedTemplateImage = useMemo(
    () => TEMPLATE_STRIP.find(t => t.id === selectedTemplate)?.image ?? FORGE_TEMPLATES[0].image,
    [selectedTemplate],
  );

  const canvasImage = generatedImageUrl || canvasPreview || selectedTemplateImage;

  const composedPrompt = useMemo(
    () =>
      buildAppearanceForgePrompt({
        artist: activeArtist,
        mode,
        templateId: null,
        uploadedPhoto: Boolean(uploadedPhoto),
        fusionRatio,
        prompt:
          prompt ||
          `身份：${gender}·${age}·${region}·${vibe}；发量：${hairVolume}`,
        hairId: selectedHair,
        eyeId: selectedEye,
        styleTagIds: selectedTags,
        faceValues,
        lockedFeatures,
        colorSchemeId: null,
        templates: FORGE_TEMPLATES,
        hairStyles: HAIR_STYLES,
        eyeColors: EYE_COLORS,
        styleTags: STYLE_TAGS,
        faceSliders: FACE_SLIDERS,
        colorSchemes: COLOR_SCHEMES,
      }),
    [activeArtist, mode, uploadedPhoto, fusionRatio, prompt, gender, age, region, vibe, hairVolume, selectedHair, selectedEye, selectedTags, faceValues, lockedFeatures],
  );

  // ── 事件 ───────────────────────────────────────────────────────────────────
  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setUploadedPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const toggleTag = (id: string) =>
    setSelectedTags(prev => (prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]));
  const toggleLock = (id: string) =>
    setLockedFeatures(prev => (prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]));

  const pushAssistant = useCallback((text: string, actions?: ConversationTurn["actions"]) => {
    const turn: ConversationTurn = {
      id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: "assistant",
      text,
      at: nowHHmm(0),
      actions,
    };
    setConversation(prev => [...prev, turn]);
  }, []);

  const pushUser = useCallback((text: string) => {
    const turn: ConversationTurn = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: "user",
      text,
      at: nowHHmm(0),
    };
    setConversation(prev => [...prev, turn]);
  }, []);

  const appendStreamNote = useCallback((text: string, tone: StreamTone = "info") => {
    setStreamNotes(prev => [...prev, { id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text, tone }]);
  }, []);

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
    setForgingStatus("aborted");
    appendStreamNote("已手动停止本次锻造", "error");
  };

  const handleSaveAppearance = async () => {
    const imageToSave = generatedImageUrl || canvasPreview || selectedTemplateImage;
    if (!imageToSave || savingAppearance) return;
    setSavingAppearance(true);
    try {
      const draft: ForgeResult = {
        id: `fr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        artistId: activeArtist.id,
        image: imageToSave,
        prompt: composedPrompt || "—",
        mode,
        createdAt: new Date().toISOString(),
        locked: [...lockedFeatures],
        status: "draft",
        usageCount: 0,
      };
      const saved = await AppearanceForgeApi.saveForgeResult(draft);
      onArtistAvatarSaved?.(saved.image);
      appendStreamNote(
        `已保存为艺人形象${saved.videoUrl ? " · 已关联 AI 短视频" : ""}`,
        "success",
      );
    } catch (error) {
      appendStreamNote((error as Error).message || "保存形象失败", "error");
    } finally {
      setSavingAppearance(false);
    }
  };

  const handleStart = async () => {
    if (generating) return;
    if (!providerLoading && providerStatus && !providerStatus.configured) {
      appendStreamNote(providerStatus.message, "error");
      setDockTab("log");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    replyBufferRef.current = "";

    setGenerating(true);
    setForgingStatus("streaming");
    setStreamNotes([]);
    setCanvasPreview(selectedTemplateImage);
    setGeneratedImageUrl(null);
    setSamplingStep({ current: 0, total: 48, noise: 0.9 });

    appendStreamNote(
      providerStatus?.provider === "mock"
        ? "演示模式：正在本地生成形象方案"
        : "正在调用平台大模型生成形象方案",
      "info",
    );

    try {
      await AppearanceForgeApi.streamForgeConversation(
        { artistId: activeArtist.id, prompt: composedPrompt },
        {
          signal: controller.signal,
          onEvent: event => {
            if (event.event === "status") {
              appendStreamNote(event.data.message, event.data.phase === "completed" ? "success" : "info");
              if (event.data.phase === "completed") setForgingStatus("completed");
              return;
            }
            if (event.event === "delta") {
              replyBufferRef.current = event.data.reply;
              startTransition(() => {
                setSamplingStep(prev => {
                  const total = prev?.total ?? 48;
                  const nextCurrent = Math.min(total, (prev?.current ?? 0) + 1);
                  return { current: nextCurrent, total, noise: Math.max(0.05, 0.9 - (nextCurrent / total) * 0.75) };
                });
                if (event.data.imageUrl) {
                  setCanvasPreview(event.data.imageUrl);
                  setGeneratedImageUrl(event.data.imageUrl);
                }
              });
              return;
            }
            if (event.event === "message") {
              replyBufferRef.current = event.data.content;
              if (event.data.imageUrl) {
                setCanvasPreview(event.data.imageUrl);
                setGeneratedImageUrl(event.data.imageUrl);
                appendStreamNote("已收到生成的形象图片", "success");
              }
              return;
            }
            if (event.event === "completed") {
              replyBufferRef.current = event.data.content;
              if (event.data.imageUrl) {
                setCanvasPreview(event.data.imageUrl);
                setGeneratedImageUrl(event.data.imageUrl);
              }
              startTransition(() => {
                setForgingStatus("completed");
                setSamplingStep(prev => prev ? { ...prev, current: prev.total, noise: 0.05 } : null);
              });
              return;
            }
            if (event.event === "error") {
              appendStreamNote(event.data.message, "error");
              setForgingStatus("error");
            }
          },
        },
      );

      const finalReply = replyBufferRef.current.trim();
      if (finalReply) {
        pushAssistant(finalReply);
      } else if (!controller.signal.aborted) {
        pushAssistant("锻造完成，但没有返回可读文本。");
      }
      if (!controller.signal.aborted) {
        setForgingStatus("completed");
        appendStreamNote("本次锻造响应已完整回写", "success");
        const nextVersion: HistoryVersion = {
          id: `v-${Date.now()}`,
          label: `版本 ${String(history.length + 1).padStart(2, "0")}`,
          at: nowHHmm(0),
          image: generatedImageUrl || selectedTemplateImage,
        };
        setHistory(prev => [nextVersion, ...prev].slice(0, FORGE_HISTORY_MAX));
        setActiveHistoryId(nextVersion.id);
      }
    } catch (error) {
      const message = (error as Error).message || "形象方案生成失败，请稍后重试";
      setForgingStatus(controller.signal.aborted ? "aborted" : "error");
      appendStreamNote(message, "error");
    } finally {
      abortRef.current = null;
      setGenerating(false);
    }
  };

  // 聊天追问：把用户的自由文本（带上当前方案上下文）发给大模型，流式回写到一条助手气泡里。
  const handleSend = async () => {
    const text = composer.trim();
    if (!text || generating) return;
    if (!providerLoading && providerStatus && !providerStatus.configured) {
      appendStreamNote(providerStatus.message, "error");
      setDockTab("log");
      return;
    }
    pushUser(text);
    setComposer("");

    // 上下文：带上最近一版完整方案，让模型在已有方案上迭代（后端无会话记忆）。
    const lastPlan = [...conversation].reverse().find(
      t => t.role === "assistant" && t.text.trim().length > 40,
    )?.text;
    const chatPrompt = [
      `你正在和「${activeArtist.name}」的形象锻造顾问对话。`,
      lastPlan ? `当前形象方案如下：\n${lastPlan}` : null,
      `用户的新要求：${text}`,
      "请基于以上给出更新后的形象建议，中文、简明可执行，必要时说明改了哪里。",
    ].filter(Boolean).join("\n\n");

    const assistantId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setConversation(prev => [
      ...prev,
      { id: assistantId, role: "assistant", text: "", at: nowHHmm(0) },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    try {
      await AppearanceForgeApi.streamForgeConversation(
        { artistId: activeArtist.id, prompt: chatPrompt },
        {
          signal: controller.signal,
          onEvent: event => {
            if (event.event === "delta") {
              setConversation(prev =>
                prev.map(t => (t.id === assistantId ? { ...t, text: event.data.reply } : t)));
            } else if (event.event === "message" || event.event === "completed") {
              const content = event.data.content;
              if (content) {
                setConversation(prev =>
                  prev.map(t => (t.id === assistantId ? { ...t, text: content } : t)));
              }
            } else if (event.event === "error") {
              appendStreamNote(event.data.message, "error");
            }
          },
        },
      );
      // 兜底：若没有任何 delta（极少见），给一句占位，避免空气泡。
      setConversation(prev =>
        prev.map(t =>
          t.id === assistantId && !t.text.trim()
            ? { ...t, text: "这次没有生成有效内容，请换个说法再试一次。" }
            : t,
        ));
    } catch (error) {
      const message = (error as Error).message || "回复生成失败，请稍后重试";
      setConversation(prev =>
        prev.map(t =>
          t.id === assistantId && !t.text.trim() ? { ...t, text: `（${message}）` } : t,
        ));
      appendStreamNote(message, "error");
    } finally {
      abortRef.current = null;
      setGenerating(false);
    }
  };

  const handleQuickRefine = (tag: string) => {
    pushUser(tag);
    setTimeout(() => pushAssistant(`已加入微调：${tag}。`), 260);
  };

  // 锻造完成且 canvas 上的图与艺人头像不同时，允许保存
  const canSaveAppearance = forgingStatus === "completed" && canvasImage !== activeArtist.avatar;
  const samplingPct = samplingStep ? Math.round((samplingStep.current / samplingStep.total) * 100) : 0;

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] flex-col gap-3 text-foreground">
      {/* 顶部页签 */}
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            AI 形象锻造
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          </h1>
          <span className="hidden md:inline text-sm text-muted-foreground truncate">
            为 {activeArtist.name} 设计形象
          </span>
        </div>
        <Badge variant={providerStatus?.configured ? "default" : "secondary"} className="gap-1.5">
          <Bot className="h-3 w-3" />
          {providerLoading
            ? "检测中"
            : providerStatus?.provider === "mock"
              ? "演示模式"
              : providerStatus?.configured
                ? "已接入大模型"
                : "大模型未配置"}
        </Badge>
      </div>

      {/* 主体：2 栏 · 左对话、右渲染（业界通用形象生成 UI 范式）。
          原 LEFT 列的「素材与约束」表单 stash 到 Sheet 抽屉，由工具条「形象参数」按钮唤起。*/}
      <Sheet open={paramsOpen} onOpenChange={setParamsOpen}>
        <SheetContent side="left" className="w-[360px] sm:w-[420px] flex flex-col p-0 gap-0">
          <SheetHeader className="shrink-0 border-b border-border px-4 py-3">
            <SheetTitle className="text-sm font-medium text-left">素材与约束</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground text-left">
              锻造模式 / 身份 / 参考照片 / 风格 / 面部微调，调整后实时影响下一次锻造。
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
            {/* 锻造模式 */}
            <Section title="锻造模式">
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(MODE_CONFIG) as [ForgeMode, typeof MODE_CONFIG[ForgeMode]][]).map(([key, conf]) => {
                  const Icon = conf.icon;
                  const active = mode === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMode(key)}
                      className={[
                        "rounded-md border px-3 py-2 text-left transition-colors",
                        active
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-secondary text-foreground hover:bg-accent",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon className={`h-3.5 w-3.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="text-xs font-medium">{conf.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* 身份与气质 */}
            <Section title="身份与气质">
              <div className="grid grid-cols-2 gap-2">
                <FieldBox label="性别" value={gender} options={GENDER_OPTIONS} onChange={setGender} />
                <FieldBox label="年龄" value={age}    options={AGE_OPTIONS}    onChange={setAge} />
                <FieldBox label="地区" value={region} options={REGION_OPTIONS} onChange={setRegion} />
                <FieldBox label="气质" value={vibe}   options={VIBE_OPTIONS}   onChange={setVibe} />
              </div>
            </Section>

            {/* 参考照片 */}
            <Section title="参考照片">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              {uploadedPhoto ? (
                <div className="relative">
                  <img src={uploadedPhoto} alt="" className="aspect-[4/3] w-full rounded-md object-cover border border-border" />
                  <button
                    type="button"
                    onClick={() => setUploadedPhoto(null)}
                    aria-label="移除参考照片"
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-muted-foreground border border-border hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full aspect-[4/3] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-secondary text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  <span className="text-xs">点击或拖入 · 不超过 8MB</span>
                </button>
              )}
            </Section>

            {/* 模版 ↔ 参考 */}
            <Section title="模版 ↔ 参考">
              <div className="flex items-baseline justify-between mb-2 text-xs text-muted-foreground tabular-nums">
                <span>模版强 {100 - fusionRatio}</span>
                <span>参考强 {fusionRatio}</span>
              </div>
              <Slider value={[fusionRatio]} onValueChange={(v) => setFusionRatio(v[0] ?? 50)} min={0} max={100} step={1} />
            </Section>

            {/* 发型 / 发量 */}
            <Section title="发型与发量">
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {HAIR_STYLES.slice(0, 4).map((h, i) => {
                  const active = selectedHair === h.id;
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setSelectedHair(active ? null : h.id)}
                      className={[
                        "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md border text-xs transition-colors",
                        active
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground",
                      ].join(" ")}
                      title={h.label}
                    >
                      <span className="text-base leading-none">{["✂", "～", "≈", "ɣ"][i]}</span>
                      <span className="text-[11px]">{HAIR_LABELS[i]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-baseline justify-between mb-1.5 text-xs text-muted-foreground">
                <span>发量</span>
                <span className="tabular-nums text-foreground">{hairVolume}</span>
              </div>
              <Slider value={[hairVolume]} onValueChange={(v) => setHairVolume(v[0] ?? 50)} min={0} max={100} step={1} />
            </Section>

            {/* 风格标签 */}
            <Section
              title="风格标签"
              hint={`已选 ${selectedTags.length}`}
            >
              <div className="flex flex-wrap gap-1.5">
                {STYLE_TAG_FALLBACK.map(tag => {
                  const active = selectedTags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={[
                        "rounded-md px-2.5 py-1 text-xs border transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent",
                      ].join(" ")}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* 面部微调 */}
            <Section title="面部微调">
              <div className="space-y-3">
                {FACE_SLIDERS.map(s => {
                  const locked = lockedFeatures.includes(s.id);
                  return (
                    <div key={s.id}>
                      <div className="flex items-baseline justify-between mb-1 text-xs">
                        <span className="text-muted-foreground">{s.label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="tabular-nums text-foreground">{faceValues[s.id] ?? 50}</span>
                          <button
                            type="button"
                            onClick={() => toggleLock(s.id)}
                            aria-label={locked ? "解锁该维度" : "锁定该维度"}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {locked ? <Lock className="h-3 w-3 text-primary" /> : <Unlock className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                      <Slider
                        value={[faceValues[s.id] ?? 50]}
                        onValueChange={(v) => setFaceValues(prev => ({ ...prev, [s.id]: v[0] ?? 50 }))}
                        min={0} max={100} step={1}
                        disabled={locked}
                      />
                    </div>
                  );
                })}
              </div>
            </Section>
          </div>
        </SheetContent>
      </Sheet>

      <div className="grid flex-1 min-h-0 gap-3 grid-cols-1 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* ───────── RIGHT · 工具条 + 模版条 + 画布（视觉上靠右） ───────── */}
        <section className="flex min-w-0 min-h-0 flex-col gap-3 lg:order-2">
          {/* 工具条 */}
          <div className="flex shrink-0 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => setParamsOpen(true)}
                variant="outline"
                size="sm"
                className="gap-1.5"
                title="打开素材与约束（左侧抽屉）"
              >
                <Settings2 className="h-3.5 w-3.5" /> 形象参数
              </Button>
              {generating ? (
                <Button onClick={handleStop} variant="destructive" size="sm" className="gap-1.5">
                  <Square className="h-3.5 w-3.5 fill-current" /> 终止锻造
                </Button>
              ) : (
                <Button onClick={handleStart} size="sm" className="gap-1.5">
                  <Play className="h-3.5 w-3.5 fill-current" />
                  {forgingStatus === "completed" ? "再次锻造" : "开始锻造"}
                </Button>
              )}
              {canSaveAppearance && (
                <Button
                  onClick={handleSaveAppearance}
                  disabled={savingAppearance}
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                >
                  {savingAppearance ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {savingAppearance ? "保存中…" : "保存为形象"}
                </Button>
              )}
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span>种子</span>
                <button type="button" onClick={() => setSeedLocked(v => !v)} aria-label="切换种子锁定" className="hover:text-foreground">
                  {seedLocked ? <Lock className="h-3 w-3 text-primary" /> : <Unlock className="h-3 w-3" />}
                </button>
                <span className="tabular-nums text-foreground">{seed}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>提示词强度</span>
                <span className="tabular-nums text-foreground">{promptStrength.toFixed(1)}</span>
              </div>
              {samplingStep && (
                <div className="flex items-center gap-1.5">
                  <span>采样</span>
                  <span className="tabular-nums text-foreground">{samplingStep.current} / {samplingStep.total}</span>
                </div>
              )}
            </div>
          </div>

          {/* 模版条（横向） */}
          <div className="shrink-0 rounded-xl border border-border bg-card px-3 py-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-medium text-foreground">风格模版</span>
              <span className="text-xs text-muted-foreground">共 {TEMPLATE_STRIP.length} 款 · 可滑动</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {TEMPLATE_STRIP.map(tpl => {
                const active = selectedTemplate === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => { setSelectedTemplate(tpl.id); setCanvasPreview(tpl.image); }}
                    className={[
                      "shrink-0 w-24 rounded-md overflow-hidden relative border transition-colors",
                      active ? "border-primary" : "border-border hover:border-primary/40",
                    ].join(" ")}
                  >
                    <div className="relative aspect-square bg-muted">
                      <img src={tpl.image} alt={tpl.name} className="h-full w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                        <span className="text-[11px] text-white truncate block">{tpl.name}</span>
                      </div>
                      {active && (
                        <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                          <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 画布 */}
          <div className="relative flex-1 min-h-0 rounded-xl border border-border bg-card overflow-hidden">
            {generating && (
              <div className="absolute inset-x-0 top-0 z-10">
                <Progress value={samplingPct} className="h-0.5 rounded-none" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <img
                src={canvasImage}
                alt={`${activeArtist.name} 当前预览`}
                className={[
                  "max-h-full max-w-full rounded-lg object-contain border border-border transition-opacity",
                  generating ? "opacity-80" : "opacity-100",
                ].join(" ")}
              />
            </div>
          </div>
        </section>

        {/* ───────── LEFT · 对话 / 历史 / 流（lg:order-1 视觉上靠左）───────── */}
        <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-card overflow-hidden lg:order-1">
          <Tabs value={dockTab} onValueChange={(v) => setDockTab(v as typeof dockTab)} className="flex flex-col flex-1 min-h-0">
            <div className="shrink-0 border-b border-border px-3 pt-3">
              <TabsList className="w-full grid grid-cols-3 h-9">
                <TabsTrigger value="chat" className="gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> 对话
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-1.5">
                  <HistoryIcon className="h-3.5 w-3.5" /> 历史
                  {history.length > 0 && (
                    <span className="ml-0.5 inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-muted text-[10px] tabular-nums text-muted-foreground">
                      {history.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="log">流日志</TabsTrigger>
              </TabsList>
            </div>

            {/* 对话 */}
            <TabsContent value="chat" className="flex-1 min-h-0 m-0 flex flex-col">
              <div ref={conversationScrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {conversation.map(turn => (
                  <ConversationBubble key={turn.id} turn={turn} artistName={activeArtist.name} />
                ))}
                {generating && (
                  <div className="flex items-start gap-2">
                    <AssistantAvatar />
                    <div className="flex-1 space-y-1">
                      <div className="text-[10px] text-muted-foreground">锻造助手 · {nowHHmm(0)}</div>
                      <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground flex items-center gap-2">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                        <span>
                          {samplingStep
                            ? `采样中 第 ${samplingStep.current} / ${samplingStep.total} 步 · 噪声 ${samplingStep.noise.toFixed(2)}`
                            : "正在等待第一段流式内容…"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 快捷微调 + 输入 */}
              <div className="shrink-0 border-t border-border px-3 py-3 space-y-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REFINES.map(q => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleQuickRefine(q)}
                      className="rounded-md px-2.5 py-1 text-xs border border-border bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="对 AI 说点什么…"
                    className="flex-1"
                  />
                  <Button onClick={handleSend} disabled={!composer.trim()} size="icon" className="h-9 w-9 shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-[10px] text-muted-foreground text-right">
                  {CONVERSATION_MODEL}
                </div>
              </div>
            </TabsContent>

            {/* 历史 */}
            <TabsContent value="history" className="flex-1 min-h-0 m-0 overflow-y-auto px-3 py-3">
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground px-1 py-4">尚未生成任何版本。</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {history.map(v => {
                    const active = activeHistoryId === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => { setActiveHistoryId(v.id); setCanvasPreview(v.image); }}
                        className={[
                          "flex flex-col gap-1.5 rounded-md border p-1.5 transition-colors text-left",
                          active ? "border-primary bg-primary/5" : "border-border bg-secondary hover:bg-accent",
                        ].join(" ")}
                      >
                        <img src={v.image} alt="" className="aspect-square w-full rounded object-cover border border-border" />
                        <div className="flex items-baseline justify-between px-0.5">
                          <span className={["text-xs", active ? "text-foreground font-medium" : "text-foreground"].join(" ")}>{v.label}</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">{v.at}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* 流日志 */}
            <TabsContent value="log" className="flex-1 min-h-0 m-0 overflow-y-auto px-3 py-3">
              {streamNotes.length === 0 ? (
                <p className="text-xs text-muted-foreground px-1 py-4">
                  尚未开始会话。点击「开始锻造」后，生成过程会按时序记录在此。
                </p>
              ) : (
                <div className="space-y-1.5">
                  {streamNotes.map(n => (
                    <div key={n.id} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${toneClasses(n.tone)}`}>
                      {n.tone === "error" ? <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                        : n.tone === "success" ? <Check className="h-3 w-3 mt-0.5 shrink-0" strokeWidth={3} />
                        : <RefreshCw className="h-3 w-3 mt-0.5 shrink-0" />}
                      <span className="whitespace-pre-wrap leading-5">{n.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
};

// ─── Subcomponents ──────────────────────────────────────────────────────────

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-xs font-medium text-foreground">{title}</h3>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function FieldBox({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={[
          "w-full rounded-md border px-3 py-2 text-left transition-colors",
          open
            ? "border-primary bg-primary/5"
            : "border-border bg-secondary hover:bg-accent",
        ].join(" ")}
      >
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className="text-sm text-foreground">{value}</div>
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 left-0 right-0 rounded-md border border-border bg-popover shadow-md overflow-hidden"
          role="listbox"
        >
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={opt === value}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={[
                "block w-full px-3 py-1.5 text-left text-xs transition-colors",
                opt === value
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              ].join(" ")}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-medium text-foreground">
      AI
    </div>
  );
}

function UserAvatar({ name }: { name: string }) {
  const glyph = name.slice(0, 1) || "用";
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
      {glyph}
    </div>
  );
}

function ConversationBubble({ turn, artistName }: { turn: ConversationTurn; artistName: string }) {
  if (turn.role === "user") {
    return (
      <div className="flex flex-row-reverse items-start gap-2">
        <UserAvatar name={artistName} />
        <div className="max-w-[85%] space-y-1">
          <div className="text-[10px] text-muted-foreground text-right">{turn.at}</div>
          <div className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-wrap leading-6">
            {turn.text}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <AssistantAvatar />
      <div className="max-w-[88%] space-y-1">
        <div className="text-[10px] text-muted-foreground">锻造助手 · {turn.at}</div>
        <div className={`rounded-md border px-3 py-2 text-sm whitespace-pre-wrap leading-6 ${toneClasses(turn.tone)}`}>
          {turn.text}
          {turn.actions && turn.actions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {turn.actions.map((a, i) => (
                <button
                  key={`${turn.id}-a-${i}`}
                  type="button"
                  onClick={a.onClick}
                  className={[
                    "rounded-md px-2.5 py-1 text-xs border transition-colors",
                    a.primary
                      ? "border-primary bg-primary/10 text-foreground hover:bg-primary/20"
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent",
                  ].join(" ")}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
