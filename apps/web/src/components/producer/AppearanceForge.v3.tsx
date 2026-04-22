"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AppearanceForge.v3 — 三列全高流式锻造工作台
//   · 左栏：素材与约束（锻造模式 · 身份气质 · 参考照片 · 发型发色 · 风格标签）
//   · 中栏：顶部主 CTA 工具条 + 中央画布 + 右侧 12 款风格模版条 + 底部历史轨
//   · 右栏：对话 / 生成日志（流式回写 + 快捷微调 + 输入）
//   整页顶住浏览器视口高度，内部面板各自独立滚动。
//   图片一律复用 mocks/appearance-forge 中的 FORGE_TEMPLATES，不使用占位图。
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
  Eye,
  History as HistoryIcon,
  Image as ImageIcon,
  Layers,
  Lock,
  MessageSquare,
  Play,
  RefreshCw,
  Scissors,
  Send,
  Shuffle,
  Sparkles,
  Square,
  Type,
  Unlock,
  Upload,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AppearanceForgeApi } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FORGE_BUTTON_GRADIENT,
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
  PROMPT_SUGGESTIONS,
  STYLE_TAGS,
} from "@/mocks/appearance-forge";
import type { Lang } from "@/translations";
import type { ForgeMode, ForgeResult } from "@/types/appearance-forge";

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
  actions?: { label: string; onClick?: () => void; accent?: boolean }[];
}

interface HistoryVersion {
  id: string;
  label: string;
  at: string; // HH:mm
  image: string;
}

type ForgingStatus = "idle" | "streaming" | "completed" | "error" | "aborted";

// 12 款风格模版（图片循环复用 FORGE_TEMPLATES，名称按原型卡片命名）
const TEMPLATE_STRIP: { id: string; name: string; image: string; accent: "cyan" | "purple" | "amber" }[] = [
  { id: "t-01", name: "01 · 霓虹偶像", accent: "cyan", image: FORGE_TEMPLATES[0].image },
  { id: "t-02", name: "02 · 暗黑歌姬", accent: "purple", image: FORGE_TEMPLATES[1].image },
  { id: "t-03", name: "03 · 街头赛博", accent: "cyan", image: FORGE_TEMPLATES[3].image },
  { id: "t-04", name: "04 · 全息幻影", accent: "amber", image: FORGE_TEMPLATES[4].image },
  { id: "t-05", name: "05 · 哥特暗夜", accent: "purple", image: FORGE_TEMPLATES[5].image },
  { id: "t-06", name: "06 · 未来超模", accent: "cyan", image: FORGE_TEMPLATES[2].image },
  { id: "t-07", name: "07 · 荧光耳锥", accent: "amber", image: FORGE_TEMPLATES[0].image },
  { id: "t-08", name: "08 · 量子项链", accent: "purple", image: FORGE_TEMPLATES[4].image },
  { id: "t-09", name: "09 · 机械义体", accent: "cyan", image: FORGE_TEMPLATES[3].image },
  { id: "t-10", name: "10 · 光绘纹路", accent: "amber", image: FORGE_TEMPLATES[1].image },
  { id: "t-11", name: "11 · 暗黑斗篷", accent: "purple", image: FORGE_TEMPLATES[5].image },
  { id: "t-12", name: "12 · 星辰皇冠", accent: "cyan", image: FORGE_TEMPLATES[2].image },
];

const GENDER_OPTIONS = ["女性", "男性", "中性"];
const AGE_OPTIONS = ["18 岁", "22 岁", "25 岁", "30 岁", "35 岁"];
const REGION_OPTIONS = ["东亚", "东南亚", "欧美", "拉美", "中东"];
const VIBE_OPTIONS = ["冷峻", "清甜", "飒爽", "柔和", "张扬"];
const QUICK_REFINES = ["瞳孔亮一点", "下巴再尖", "换个姿势", "换光照"];
const CONVERSATION_MODEL = "星辰模型 4.2";

function nowHHmm(offsetMinutes = 0) {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toneBg(tone?: StreamTone) {
  if (tone === "success") return "border-emerald-400/25 bg-emerald-500/8 text-emerald-100";
  if (tone === "error") return "border-red-400/25 bg-red-500/10 text-red-200";
  return "border-white/5 bg-white/[0.03] text-gray-200";
}

function accentRing(accent: "cyan" | "purple" | "amber", active: boolean) {
  if (!active) return "ring-1 ring-white/5 hover:ring-white/15";
  if (accent === "purple") return "ring-2 ring-purple-400/80 shadow-[0_0_18px_rgba(168,85,247,0.25)]";
  if (accent === "amber") return "ring-2 ring-amber-400/80 shadow-[0_0_18px_rgba(245,158,11,0.25)]";
  return "ring-2 ring-cyan-400/80 shadow-[0_0_18px_rgba(34,211,238,0.25)]";
}

export const AppearanceForgeV3: React.FC<Props> = ({ activeArtist, onArtistAvatarSaved }) => {
  // ── 参数状态 ───────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<ForgeMode>("template_photo");
  const [selectedTemplate, setSelectedTemplate] = useState<string>(TEMPLATE_STRIP[0].id);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [fusionRatio, setFusionRatio] = useState(50);
  const [gender, setGender] = useState(GENDER_OPTIONS[0]);
  const [age, setAge] = useState(AGE_OPTIONS[1]);
  const [region, setRegion] = useState(REGION_OPTIONS[0]);
  const [vibe, setVibe] = useState(VIBE_OPTIONS[0]);
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
  // 初始时间用占位符，避免 SSR/CSR 水合不匹配；在 mount 后 useEffect 填入真实时间。
  const [conversation, setConversation] = useState<ConversationTurn[]>(() => [
    {
      id: "seed-1",
      role: "assistant",
      at: "--:--",
      text: `已应用 霓虹偶像 模版 + 参考照片 50:50 融合。\n建议：试试 "机械义体" 或调整颧骨。`,
    },
    {
      id: "seed-2",
      role: "user",
      at: "--:--",
      text: "让下颌再收一点，加个右颧的机械义体",
    },
    {
      id: "seed-3",
      role: "assistant",
      at: "--:--",
      text: "已调 下颌 -0.44，添加 右颧义体配件。",
      actions: [
        { label: "确认锻造", accent: true },
        { label: "再激进些" },
        { label: "撤回" },
      ],
    },
  ]);
  const [tabView, setTabView] = useState<"chat" | "stream">("chat");
  // 对话 / 历史都改为按需呼出的悬浮面板，不占版位。
  const [conversationOverlayOpen, setConversationOverlayOpen] = useState(false);
  const [historyOverlayOpen, setHistoryOverlayOpen] = useState(false);
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
  const [promptStrength] = useState(8.5);
  const [seedLocked, setSeedLocked] = useState(true);
  const [seed] = useState("#7F3C");
  const [samplingStep, setSamplingStep] = useState<{ current: number; total: number; noise: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const replyBufferRef = useRef("");
  const conversationScrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
          message: (err as Error).message || "Coze 状态获取失败",
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
  }, [conversation, streamNotes, tabView]);

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
    // 优先保存真实生成的图；没有则兜底 canvas 当前预览（含选中模版）。
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
      // 后端 / mock 会自动补 videoUrl（从 public/videos 的 demo 池中挑一个）。
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
      setTabView("stream");
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
        ? "当前使用本地 mock 流式回放"
        : "后端已接管请求，正在通过 Coze 官方 SDK 创建会话",
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
                appendStreamNote("已收到 Coze 返回的形象图片链接", "success");
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
        // 显式兜底：即便提供方未发 completed 事件，流 await 正常结束也视为锻造完成
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
      const message = (error as Error).message || "Coze 流式请求失败";
      setForgingStatus(controller.signal.aborted ? "aborted" : "error");
      appendStreamNote(message, "error");
    } finally {
      abortRef.current = null;
      setGenerating(false);
    }
  };

  const handleSend = () => {
    const text = composer.trim();
    if (!text) return;
    pushUser(text);
    setComposer("");
    // Auto-assistant ack (本地回显，不占用 Coze 配额)
    setTimeout(() => {
      pushAssistant(`已记录指令：${text}\n将在下一次「开始锻造」时合并到提示词中。`);
    }, 280);
  };

  const handleQuickRefine = (tag: string) => {
    pushUser(tag);
    setTimeout(() => pushAssistant(`已加入微调：${tag}。`), 260);
  };

  const switchVariant = (variant: "v1" | "v2" | "v3") => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (variant === "v1") params.delete("forge");
    else params.set("forge", variant);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : (pathname ?? "/"), { scroll: false });
  };

  // ── 渲染 ───────────────────────────────────────────────────────────────────
  const providerBadgeCls = providerStatus?.configured
    ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/30"
    : "bg-amber-500/15 text-amber-200 border-amber-400/30";

  // 锻造完成 & canvas 上展示的图与当前头像不同时，允许保存为形象
  const canSaveAppearance = forgingStatus === "completed" && canvasImage !== activeArtist.avatar;

  return (
    <div
      className="flex flex-col gap-3 text-white"
      style={{ height: "calc(100dvh - 7.5rem)" }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1
            className="text-xl md:text-2xl font-extrabold tracking-tight flex items-center gap-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span className="bg-gradient-to-r from-red-500 via-orange-400 to-amber-400 bg-clip-text text-transparent">
              AI 形象锻造炉
            </span>
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300/80 border border-cyan-400/30 rounded-full px-2 py-0.5">
              v3 · 顶满视口
            </span>
          </h1>
          <span className="text-xs text-gray-500 hidden md:inline">为 {activeArtist.name} 设计形象</span>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={`text-[10px] border ${providerBadgeCls}`}>
            <Bot className="w-3 h-3 mr-1" />
            {providerLoading ? "检测中" : providerStatus?.provider === "mock" ? "Mock Stream" : "Coze Live"}
          </Badge>
          <button onClick={() => switchVariant("v2")} className="text-[11px] text-gray-500 hover:text-amber-300">切到 v2</button>
          <button onClick={() => switchVariant("v1")} className="text-[11px] text-gray-500 hover:text-gray-300">切到 v1</button>
        </div>
      </div>

      {/* 主体：永远 2 列（左 · 素材，中 · canvas 焦点区）；对话 / 历史改为按需悬浮 */}
      <div className="grid grid-cols-[minmax(280px,340px)_minmax(500px,1fr)] gap-3 min-h-0 flex-1">
        {/* ═════════ LEFT · 素材与约束 ═════════ */}
        <div className="bg-gray-900/50 border border-white/5 rounded-xl flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2 shrink-0">
            <span className="inline-block w-0.5 h-4 bg-cyan-400/80 rounded-full" />
            <span className="text-sm font-semibold">素材与约束</span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 bg-white/[0.015]">
            {/* 锻造模式 */}
            <section>
              <SectionTitle text="锻造模式" />
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(MODE_CONFIG) as [ForgeMode, typeof MODE_CONFIG[ForgeMode]][]).map(([key, conf]) => {
                  const Icon = conf.icon;
                  const active = mode === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setMode(key)}
                      className={`relative text-left rounded-lg px-3 py-2.5 border transition ${active ? "border-cyan-400/60 bg-cyan-500/10" : "border-white/10 bg-black/20 hover:bg-white/[0.04]"}`}
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <Icon className={`w-3.5 h-3.5 ${active ? "text-cyan-300" : "text-gray-400"}`} />
                        <span className={active ? "text-cyan-200" : "text-gray-200"}>{conf.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 风格模版（12 款） */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <SectionTitle text="风格模版" inline />
                <span className="text-[10px] text-gray-500">共 {TEMPLATE_STRIP.length} 款 · 可滑动</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 max-h-[232px] overflow-y-auto pr-1 rounded-lg bg-white/[0.05] ring-1 ring-inset ring-white/10 p-2">
                {TEMPLATE_STRIP.map(tpl => {
                  const active = selectedTemplate === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => { setSelectedTemplate(tpl.id); setCanvasPreview(tpl.image); }}
                      className={`w-full rounded-md overflow-hidden relative block transition ${accentRing(tpl.accent, active)}`}
                    >
                      <div className="relative aspect-square bg-black/40">
                        <img src={tpl.image} alt={tpl.name} className="w-full h-full object-cover opacity-85" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                        <div className="absolute bottom-1 left-1.5 right-1.5 text-[9px] font-medium text-white/90 truncate">{tpl.name}</div>
                        {active && (
                          <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-cyan-500 flex items-center justify-center">
                            <Check className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 身份与气质 */}
            <section>
              <SectionTitle text="身份与气质" />
              <div className="grid grid-cols-2 gap-2">
                <FieldBox label="性别" value={gender} options={GENDER_OPTIONS} onChange={setGender} />
                <FieldBox label="年龄" value={age} options={AGE_OPTIONS} onChange={setAge} />
                <FieldBox label="地区" value={region} options={REGION_OPTIONS} onChange={setRegion} />
                <FieldBox label="气质" value={vibe} options={VIBE_OPTIONS} onChange={setVibe} active />
              </div>
            </section>

            {/* 参考照片 */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <SectionTitle text="参考照片" inline />
                <span className="text-[10px] text-gray-500">融合 {100 - fusionRatio} / {fusionRatio}</span>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              {uploadedPhoto ? (
                <div className="relative">
                  <img src={uploadedPhoto} alt="" className="w-full aspect-[4/3] rounded-lg object-cover border border-white/10" />
                  <button
                    onClick={() => setUploadedPhoto(null)}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center hover:bg-red-500/60"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-[4/3] rounded-lg border border-dashed border-white/10 hover:border-cyan-400/40 transition flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-gray-300"
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-[11px]">点击或拖入 · 不超过 8MB</span>
                </button>
              )}
            </section>

            {/* 模版 ↔ 参考 */}
            <section>
              <div className="flex items-center justify-between mb-1.5">
                <SectionTitle text="模版 ↔ 参考" inline />
                <span className="text-[10px] text-gray-500 tabular-nums">{100 - fusionRatio} / {fusionRatio}</span>
              </div>
              <input
                type="range" min={0} max={100} value={fusionRatio}
                onChange={e => setFusionRatio(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-cyan-400/70 via-white/30 to-pink-400/70 ring-1 ring-inset ring-white/15 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(255,255,255,0.6)] [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>模版强</span>
                <span>参考强</span>
              </div>
            </section>

            {/* 发型 / 发色 */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <SectionTitle text="发型 / 发色" inline />
                <span className="text-[10px] text-gray-500">已加载 {HAIR_STYLES.length}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {HAIR_STYLES.slice(0, 4).map((h, i) => {
                  const active = selectedHair === h.id;
                  const labelPool = ["短直", "长直", "波浪", "双马尾"];
                  return (
                    <button
                      key={h.id}
                      onClick={() => setSelectedHair(active ? null : h.id)}
                      className={`aspect-square rounded-lg border transition flex flex-col items-center justify-center gap-0.5 ${active ? "border-cyan-400/60 bg-cyan-500/10" : "border-white/10 bg-black/20 hover:bg-white/[0.04]"}`}
                      title={h.label}
                    >
                      <HairIcon index={i} active={active} />
                      <span className={`text-[10px] ${active ? "text-cyan-200" : "text-gray-400"}`}>{labelPool[i]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                {["#ffffff", "#c084fc", "#22d3ee", "#fbbf24", "#8b5cf6", "#1f2937"].map(c => (
                  <button
                    key={c}
                    className="w-7 h-7 rounded-md border border-white/10 hover:ring-2 hover:ring-white/40 transition"
                    style={{ background: c }}
                  />
                ))}
              </div>
            </section>

            {/* 发量 */}
            <section>
              <div className="flex items-center justify-between mb-1.5">
                <SectionTitle text="发量" inline />
                <span className="text-[10px] text-gray-500">蓬松</span>
              </div>
              <input
                type="range" min={0} max={100} value={hairVolume}
                onChange={e => setHairVolume(Number(e.target.value))}
                className="w-full h-2 bg-white/[0.18] rounded-full appearance-none cursor-pointer ring-1 ring-inset ring-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(34,211,238,0.7)] [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>稀疏</span>
                <span>蓬松</span>
              </div>
            </section>

            {/* 风格标签 */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <SectionTitle text="风格标签" inline />
                <span className="text-[10px] text-gray-500">已选 {selectedTags.length} / {STYLE_TAGS.length}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "s1", label: "赛博纹身" },
                  { id: "s2", label: "机械义体" },
                  { id: "s4", label: "荧光耳锥" },
                  { id: "s5", label: "故障面纹" },
                  { id: "s3", label: "全息护目" },
                  { id: "s6", label: "量子项链" },
                  { id: "s7", label: "光绘纹路" },
                  { id: "s8", label: "暗黑斗篷" },
                ].map(tag => {
                  const active = selectedTags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition ${active ? "bg-gradient-to-r from-purple-500/30 to-pink-500/20 text-purple-100 border-purple-400/40" : "bg-white/[0.03] text-gray-400 border-white/10 hover:text-gray-200 hover:bg-white/[0.06]"}`}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 面部微调（精简） */}
            <section>
              <SectionTitle text="面部微调" />
              <div className="space-y-2.5">
                {FACE_SLIDERS.map(s => (
                  <div key={s.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-gray-400">{s.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-500 tabular-nums">{faceValues[s.id] ?? 50}</span>
                        <button onClick={() => toggleLock(s.id)} className="text-gray-600 hover:text-gray-300">
                          {lockedFeatures.includes(s.id) ? <Lock className="w-3 h-3 text-amber-300" /> : <Unlock className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                    <input
                      type="range" min={0} max={100} value={faceValues[s.id] ?? 50}
                      onChange={e => setFaceValues(prev => ({ ...prev, [s.id]: Number(e.target.value) }))}
                      className="w-full h-1.5 bg-white/[0.18] rounded-full appearance-none cursor-pointer ring-1 ring-inset ring-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-[0_0_5px_rgba(34,211,238,0.6)]"
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* ═════════ CENTER · 画布 ═════════ */}
        <div className="bg-gray-900/50 border border-white/5 rounded-xl flex flex-col min-h-0 overflow-hidden relative">
          {/* 顶部工具条 */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-2">
              {generating ? (
                <Button
                  onClick={handleStop}
                  size="sm"
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white border-0 h-9 px-4 font-semibold"
                >
                  <Square className="w-4 h-4 mr-1.5 fill-current" />
                  终止锻造
                </Button>
              ) : (
                <Button
                  onClick={handleStart}
                  size="sm"
                  className={`bg-gradient-to-r ${FORGE_BUTTON_GRADIENT} text-white border-0 h-9 px-4 font-semibold`}
                >
                  <Play className="w-4 h-4 mr-1.5 fill-current" />
                  {forgingStatus === "completed" ? "再次锻造" : "开始锻造"}
                </Button>
              )}
              {canSaveAppearance && (
                <Button
                  onClick={handleSaveAppearance}
                  disabled={savingAppearance}
                  size="sm"
                  className="h-9 px-4 bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/30 font-semibold"
                >
                  {savingAppearance ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
                  {savingAppearance ? "保存中…" : "保存为形象"}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-4 text-[11px] text-gray-400">
              <div className="flex items-center gap-1.5">
                <span>种子</span>
                <button onClick={() => setSeedLocked(v => !v)} className="hover:text-white">
                  {seedLocked ? <Lock className="w-3 h-3 text-amber-300" /> : <Unlock className="w-3 h-3" />}
                </button>
                <span className="tabular-nums text-gray-200">{seed}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>提示词强度</span>
                <span className="tabular-nums text-gray-200">{promptStrength.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* 主体：画布（占满整列） */}
          <div className="flex-1 min-h-0 p-3">
            {/* 画布 */}
            <div className="relative min-h-0 h-full w-full rounded-lg overflow-hidden border border-white/5 bg-[radial-gradient(ellipse_at_center,rgba(30,58,138,0.25),rgba(0,0,0,0.85))]">
              {/* 网格底纹 */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
              />
              {/* 四角装饰 */}
              <CornerBrackets />

              {/* 画布内容 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={canvasImage}
                    src={canvasImage}
                    alt=""
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: generating ? 0.7 : 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="h-[75%] max-h-[78%] rounded-lg object-contain shadow-[0_0_80px_rgba(34,211,238,0.15)]"
                  />
                </AnimatePresence>
              </div>

              {/* 流式扫描线 */}
              {generating && (
                <motion.div
                  className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent"
                  initial={{ top: "0%" }}
                  animate={{ top: ["0%", "100%", "0%"] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
                />
              )}

              {/* 采样计数（右上） */}
              {samplingStep && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[11px] text-cyan-100 bg-black/50 backdrop-blur rounded-md border border-white/10 px-2.5 py-1">
                  <Zap className="w-3 h-3 text-cyan-300" />
                  采样中 第 {samplingStep.current} / {samplingStep.total} 步 · 噪声 {samplingStep.noise.toFixed(2)}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ═════════ 对话悬浮面板（右侧按钮 · 对话 切换） ═════════ */}
        <div
          className={`fixed top-20 right-[88px] bottom-4 w-[380px] max-w-[calc(100vw-110px)] z-40
            bg-gray-900/95 backdrop-blur border border-white/10 rounded-xl shadow-2xl
            flex-col min-h-0 overflow-hidden
            ${conversationOverlayOpen ? "flex" : "hidden"}`}
        >
          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2 shrink-0">
            <span className="inline-block w-0.5 h-4 bg-purple-400/80 rounded-full" />
            <span className="text-sm font-semibold flex-1">对话 / 生成日志</span>
            <button
              onClick={() => setConversationOverlayOpen(false)}
              className="text-gray-500 hover:text-white"
              aria-label="关闭对话面板"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 border-b border-white/5 shrink-0">
            {(["chat", "stream"] as const).map(k => {
              const active = tabView === k;
              const label = k === "chat" ? "对话微调" : "生成流";
              return (
                <button
                  key={k}
                  onClick={() => setTabView(k)}
                  className={`py-2.5 text-xs font-medium transition border-b-2 ${active ? "border-purple-400 text-white" : "border-transparent text-gray-500 hover:text-gray-300"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* 对话流区域 */}
          <div ref={conversationScrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-white/[0.015]">
            {tabView === "chat" ? (
              <>
                {conversation.map(turn => (
                  <ConversationBubble key={turn.id} turn={turn} artistName={activeArtist.name} />
                ))}
                {generating && (
                  <div className="flex items-start gap-2">
                    <AssistantAvatar />
                    <div className="flex-1 space-y-1">
                      <div className="text-[10px] text-gray-500">锻造助手 · {nowHHmm(0)}</div>
                      <div className={`rounded-lg border px-3 py-2 text-sm ${toneBg("info")} flex items-center gap-2`}>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-300" />
                        <span className="text-gray-200">
                          {samplingStep
                            ? <>采样中 第 {samplingStep.current} / {samplingStep.total} 步 · 噪声 {samplingStep.noise.toFixed(2)}</>
                            : "正在等待第一段流式内容…"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                {streamNotes.length === 0 ? (
                  <div className="text-[11px] text-gray-500">尚未开始会话。点击「开始锻造」后，Coze 事件会按时序记录在此。</div>
                ) : (
                  streamNotes.map(n => (
                    <div key={n.id} className={`text-[11px] rounded-md border px-3 py-2 ${toneBg(n.tone)} flex items-start gap-2`}>
                      {n.tone === "error" ? <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" /> : n.tone === "success" ? <Check className="w-3 h-3 mt-0.5 shrink-0" /> : <Layers className="w-3 h-3 mt-0.5 shrink-0" />}
                      <span className="whitespace-pre-wrap leading-5">{n.text}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 快捷微调 */}
          <div className="shrink-0 border-t border-white/5 px-4 py-3 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REFINES.map(q => (
                <button
                  key={q}
                  onClick={() => handleQuickRefine(q)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-gray-300 hover:bg-white/[0.08] hover:text-white transition"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2">
                <Type className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <input
                  value={composer}
                  onChange={e => setComposer(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="对 AI 说点什么…"
                  className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-gray-600 min-w-0"
                />
                <span className="text-[10px] text-purple-300/80 shrink-0 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-purple-400" />
                  {CONVERSATION_MODEL}
                </span>
              </div>
              <button
                onClick={handleSend}
                disabled={!composer.trim()}
                className="h-9 w-9 rounded-lg bg-purple-500/20 border border-purple-400/30 text-purple-100 hover:bg-purple-500/30 flex items-center justify-center disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═════════ 右侧竖排悬浮按钮（历史 / 对话 切换） ═════════ */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
        <button
          onClick={() => setHistoryOverlayOpen(v => !v)}
          aria-label="历史记录"
          className={`group relative w-14 h-14 rounded-2xl border flex flex-col items-center justify-center gap-0.5 backdrop-blur transition shadow-lg ${
            historyOverlayOpen
              ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100 shadow-cyan-500/20"
              : "border-white/10 bg-gray-900/80 text-gray-300 hover:border-cyan-400/40 hover:text-cyan-200 hover:bg-gray-900"
          }`}
        >
          <HistoryIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-none">历史</span>
          {history.length > 0 && (
            <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center border ${
              historyOverlayOpen ? "bg-cyan-500 text-white border-cyan-400" : "bg-gray-900 text-cyan-200 border-cyan-400/40"
            }`}>
              {history.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setConversationOverlayOpen(v => !v)}
          aria-label="对话 / 生成日志"
          className={`group relative w-14 h-14 rounded-2xl border flex flex-col items-center justify-center gap-0.5 backdrop-blur transition shadow-lg ${
            conversationOverlayOpen
              ? "border-purple-400/60 bg-purple-500/20 text-purple-100 shadow-purple-500/20"
              : "border-white/10 bg-gray-900/80 text-gray-300 hover:border-purple-400/40 hover:text-purple-200 hover:bg-gray-900"
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-none">对话</span>
          {generating && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 border-2 border-gray-900 animate-pulse" />
          )}
        </button>
      </div>

      {/* ═════════ 历史悬浮面板（右侧按钮 · 历史 切换） ═════════
          底部通栏抽屉；若对话面板已展开，自动收缩右侧留出空间避免重叠。 */}
      <div
        className={`fixed bottom-4 left-4 z-30
          ${conversationOverlayOpen ? "right-[488px]" : "right-[88px]"}
          bg-gray-900/95 backdrop-blur border border-white/10 rounded-xl shadow-2xl
          ${historyOverlayOpen ? "block" : "hidden"}`}
      >
        <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
          <HistoryIcon className="w-3.5 h-3.5 text-cyan-300" />
          <span className="text-sm font-semibold flex-1">历史 · {history.length}</span>
          <span className="text-[10px] text-gray-500 hidden md:inline">点击回到版本</span>
          <button
            onClick={() => setHistoryOverlayOpen(false)}
            className="text-gray-500 hover:text-white ml-2"
            aria-label="关闭历史面板"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-3 py-3 flex items-center gap-2 overflow-x-auto rounded-b-xl bg-white/[0.02]">
          {history.map(v => {
            const active = activeHistoryId === v.id;
            return (
              <button
                key={v.id}
                onClick={() => { setActiveHistoryId(v.id); setCanvasPreview(v.image); }}
                className={`shrink-0 flex items-center gap-2 rounded-lg border px-2 py-1.5 transition ${active ? "border-cyan-400/60 bg-cyan-500/15" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"}`}
              >
                <img src={v.image} alt="" className="w-10 h-10 rounded-md object-cover border border-white/10" />
                <div className="flex flex-col items-start leading-tight pr-1">
                  <span className={`text-[11px] font-semibold ${active ? "text-cyan-200" : "text-gray-200"}`}>{v.label}</span>
                  <span className="text-[10px] text-gray-500">{v.at}{active ? " · 当前" : ""}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Subcomponents ──────────────────────────────────────────────────────────

function SectionTitle({ text, inline = false }: { text: string; inline?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${inline ? "" : "mb-2"}`}>
      <span className="inline-block w-0.5 h-3 bg-cyan-400/70 rounded-full" />
      <span className="text-xs font-semibold text-gray-200">{text}</span>
    </div>
  );
}

function FieldBox({
  label, value, options, onChange, active = false,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full text-left px-3 py-2 rounded-lg border transition ${active || open ? "border-cyan-400/60 bg-cyan-500/10" : "border-white/10 bg-black/20 hover:bg-white/[0.04]"}`}
      >
        <div className="text-[10px] text-gray-500">{label}</div>
        <div className={`text-sm font-medium ${active || open ? "text-cyan-200" : "text-gray-100"}`}>{value}</div>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 left-0 right-0 bg-gray-900 border border-white/10 rounded-lg shadow-xl overflow-hidden">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-white/[0.06] ${opt === value ? "text-cyan-200" : "text-gray-300"}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HairIcon({ index, active }: { index: number; active: boolean }) {
  const color = active ? "#67e8f9" : "#9ca3af";
  const common = { stroke: color, strokeWidth: 1.4, fill: "none" } as const;
  // 四款简形：短直 / 长直 / 波浪 / 双马尾
  if (index === 0) return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
      <path d="M5 11c0-4 3-7 7-7s7 3 7 7v5" />
      <path d="M5 11v6" />
    </svg>
  );
  if (index === 1) return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
      <path d="M6 10c0-4 2.5-6 6-6s6 2 6 6v10" />
      <path d="M6 10v10" />
    </svg>
  );
  if (index === 2) return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
      <path d="M5 11c1-3 3-5 7-5s6 2 7 5" />
      <path d="M5 11c1 2 2 3 2 6" />
      <path d="M19 11c-1 2-2 3-2 6" />
    </svg>
  );
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
      <path d="M6 10c0-4 2.5-6 6-6s6 2 6 6" />
      <path d="M6 10c-2 4-2 6-2 10" />
      <path d="M18 10c2 4 2 6 2 10" />
    </svg>
  );
}

function CornerBrackets() {
  const size = "w-8 h-8";
  const color = "border-cyan-300/70";
  return (
    <>
      <div className={`absolute top-4 left-4 ${size} border-t-2 border-l-2 ${color} rounded-tl-md`} />
      <div className={`absolute top-4 right-4 ${size} border-t-2 border-r-2 ${color} rounded-tr-md`} />
      <div className={`absolute bottom-4 left-4 ${size} border-b-2 border-l-2 ${color} rounded-bl-md`} />
      <div className={`absolute bottom-4 right-4 ${size} border-b-2 border-r-2 ${color} rounded-br-md`} />
    </>
  );
}

function AssistantAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-500/40 border border-cyan-400/30 flex items-center justify-center text-[10px] font-bold text-cyan-100 shrink-0">
      AI
    </div>
  );
}

function UserAvatar({ name }: { name: string }) {
  const glyph = name.slice(0, 1) || "用";
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500/40 to-pink-500/40 border border-purple-400/30 flex items-center justify-center text-[11px] font-bold text-purple-100 shrink-0">
      {glyph}
    </div>
  );
}

function ConversationBubble({ turn, artistName }: { turn: ConversationTurn; artistName: string }) {
  if (turn.role === "user") {
    return (
      <div className="flex items-start gap-2 flex-row-reverse">
        <UserAvatar name={artistName} />
        <div className="max-w-[85%] space-y-1">
          <div className="text-[10px] text-gray-500 text-right">{turn.at}</div>
          <div className="rounded-lg bg-gradient-to-br from-purple-500/25 to-pink-500/15 border border-purple-400/30 text-white px-3 py-2 text-sm whitespace-pre-wrap leading-6">
            {turn.text}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <AssistantAvatar />
      <div className="flex-1 max-w-[88%] space-y-1">
        <div className="text-[10px] text-gray-500">锻造助手 · {turn.at}</div>
        <div className={`rounded-lg border px-3 py-2 text-sm whitespace-pre-wrap leading-6 ${toneBg(turn.tone)}`}>
          {turn.text}
          {turn.actions && turn.actions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {turn.actions.map((a, i) => (
                <button
                  key={`${turn.id}-a-${i}`}
                  onClick={a.onClick}
                  className={`text-[11px] px-2.5 py-1 rounded-md border transition ${a.accent ? "bg-purple-500/20 border-purple-400/40 text-purple-100 hover:bg-purple-500/30" : "bg-white/[0.03] border-white/10 text-gray-300 hover:bg-white/[0.08]"}`}
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

export default AppearanceForgeV3;
