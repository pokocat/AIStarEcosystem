"use client";

import React, {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  Bot,
  Check,
  Eye,
  History,
  Image as ImageIcon,
  Layers,
  Lock,
  Palette,
  RefreshCw,
  Scissors,
  Shuffle,
  Sliders,
  Sparkles,
  Square,
  Type,
  Unlock,
  Upload,
  Wand2,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AppearanceForgeApi, ArtistsApi } from "@/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import type { ForgeMode } from "@/types/appearance-forge";

import { type Artist } from "./ArtistTypes";

interface Props {
  lang: Lang;
  activeArtist: Artist;
  onArtistAvatarSaved?: (nextAvatar: string) => void;
}

type StreamTone = "info" | "success" | "error";

interface StreamNote {
  id: string;
  tone: StreamTone;
  text: string;
}

interface ForgeConversationHistoryItem {
  id: string;
  createdAt: string;
  mode: ForgeMode;
  previewImage: string;
  generatedImageUrl?: string;
  prompt: string;
  reply: string;
  status: "completed" | "error" | "aborted";
  tokenCount?: number;
  inputTokens?: number;
  outputTokens?: number;
}

type TokenUsageState = {
  tokenCount?: number;
  inputTokens?: number;
  outputTokens?: number;
};

function toneClasses(tone: StreamTone) {
  if (tone === "success") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  if (tone === "error") return "border-red-400/20 bg-red-500/10 text-red-200";
  return "border-cyan-400/20 bg-cyan-500/10 text-cyan-100";
}

function buildNote(text: string, tone: StreamTone = "info"): StreamNote {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    tone,
  };
}

function pickPreviewImage(templateId: string | null, fallback: string): string {
  return FORGE_TEMPLATES.find(item => item.id === templateId)?.image ?? fallback;
}

export const AppearanceForgeV3: React.FC<Props> = ({ activeArtist, onArtistAvatarSaved }) => {
  const [mode, setMode] = useState<ForgeMode>("template_prompt");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(FORGE_TEMPLATES[0]?.id ?? null);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [fusionRatio, setFusionRatio] = useState(50);
  const [prompt, setPrompt] = useState("");
  const [selectedHair, setSelectedHair] = useState<string | null>(null);
  const [selectedEye, setSelectedEye] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedScheme, setSelectedScheme] = useState<string | null>(null);
  const [faceValues, setFaceValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(FACE_SLIDERS.map(slider => [slider.id, 50])),
  );
  const [lockedFeatures, setLockedFeatures] = useState<string[]>([]);
  const [providerStatus, setProviderStatus] = useState<AppearanceForgeApi.ForgeProviderStatus | null>(null);
  const [providerLoading, setProviderLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ForgeConversationHistoryItem[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [currentReply, setCurrentReply] = useState("");
  const [currentPreviewImage, setCurrentPreviewImage] = useState(activeArtist.avatar);
  const [currentNotes, setCurrentNotes] = useState<StreamNote[]>([]);
  const [currentStatus, setCurrentStatus] = useState<"idle" | "streaming" | "completed" | "error" | "aborted">("idle");
  const [currentTokens, setCurrentTokens] = useState<TokenUsageState | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const replyBufferRef = useRef("");
  const notesBufferRef = useRef<StreamNote[]>([]);
  const tokensBufferRef = useRef<TokenUsageState | null>(null);
  const previewImageBufferRef = useRef(activeArtist.avatar);
  const generatedImageBufferRef = useRef<string | null>(null);
  const conversationPanelRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    setProviderLoading(true);
    AppearanceForgeApi.getForgeProviderStatus()
      .then(status => {
        if (!cancelled) setProviderStatus(status);
      })
      .catch(err => {
        if (!cancelled) {
          setProviderStatus({
            configured: false,
            provider: "coze",
            message: (err as Error).message || "Coze 状态获取失败",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setProviderLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    setHistory([]);
    setCurrentPrompt("");
    setCurrentReply("");
    setCurrentNotes([]);
    notesBufferRef.current = [];
    replyBufferRef.current = "";
    tokensBufferRef.current = null;
    setCurrentTokens(null);
    setCurrentStatus("idle");
    setCurrentPreviewImage(activeArtist.avatar);
    previewImageBufferRef.current = activeArtist.avatar;
    generatedImageBufferRef.current = null;
    setGeneratedImageUrl(null);
  }, [activeArtist.id]);

  useEffect(() => {
    if (!conversationPanelRef.current) return;
    conversationPanelRef.current.scrollTop = conversationPanelRef.current.scrollHeight;
  }, [currentReply, currentNotes]);

  const draftPromptPreview = buildAppearanceForgePrompt({
    artist: activeArtist,
    mode,
    templateId: selectedTemplate,
    uploadedPhoto: Boolean(uploadedPhoto),
    fusionRatio,
    prompt,
    hairId: selectedHair,
    eyeId: selectedEye,
    styleTagIds: selectedTags,
    faceValues,
    lockedFeatures,
    colorSchemeId: selectedScheme,
    templates: FORGE_TEMPLATES,
    hairStyles: HAIR_STYLES,
    eyeColors: EYE_COLORS,
    styleTags: STYLE_TAGS,
    faceSliders: FACE_SLIDERS,
    colorSchemes: COLOR_SCHEMES,
  });

  const displayPrompt = draftPromptPreview;

  const appendNote = useCallback((text: string, tone: StreamTone = "info") => {
    const next = [...notesBufferRef.current, buildNote(text, tone)];
    notesBufferRef.current = next;
    startTransition(() => setCurrentNotes(next));
  }, []);

  const handleUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = loadEvent => setUploadedPhoto(loadEvent.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const toggleTag = (id: string) => {
    setSelectedTags(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const toggleLock = (feature: string) => {
    setLockedFeatures(prev => prev.includes(feature) ? prev.filter(item => item !== feature) : [...prev, feature]);
  };

  const applyRandomSelectionSnapshot = () => {
    const templateId = FORGE_TEMPLATES[Math.floor(Math.random() * FORGE_TEMPLATES.length)]?.id ?? null;
    const hairId = HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)]?.id ?? null;
    const eyeId = EYE_COLORS[Math.floor(Math.random() * EYE_COLORS.length)]?.id ?? null;
    const colorSchemeId = COLOR_SCHEMES[Math.floor(Math.random() * COLOR_SCHEMES.length)]?.id ?? null;
    const nextFaceValues = Object.fromEntries(
      FACE_SLIDERS.map(slider => [
        slider.id,
        lockedFeatures.includes(slider.id) ? (faceValues[slider.id] ?? 50) : 20 + Math.floor(Math.random() * 60),
      ]),
    );
    const shuffledTags = [...STYLE_TAGS]
      .sort(() => Math.random() - 0.5)
      .slice(0, 2 + Math.floor(Math.random() * 3))
      .map(item => item.id);

    setSelectedTemplate(templateId);
    setSelectedHair(hairId);
    setSelectedEye(eyeId);
    setSelectedScheme(colorSchemeId);
    setSelectedTags(shuffledTags);
    setFaceValues(nextFaceValues);

    return {
      templateId,
      hairId,
      eyeId,
      colorSchemeId,
      styleTagIds: shuffledTags,
      faceValues: nextFaceValues,
    };
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
    setCurrentStatus("aborted");
    appendNote("已手动停止本次锻造", "error");
  };

  const handleSaveAsArtistAvatar = async () => {
    if (!generatedImageUrl || savingAvatar) return;
    setSavingAvatar(true);
    try {
      await ArtistsApi.patchArtist(activeArtist.id, { avatar: generatedImageUrl });
      onArtistAvatarSaved?.(generatedImageUrl);
      appendNote("已将本次生成图保存为当前艺人头像", "success");
    } catch (error) {
      appendNote((error as Error).message || "保存头像失败", "error");
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleRun = async () => {
    if (generating) return;
    if (!providerLoading && providerStatus && !providerStatus.configured) {
      appendNote(providerStatus.message, "error");
      return;
    }

    const randomized = mode === "random" ? applyRandomSelectionSnapshot() : null;
    const finalTemplateId = randomized?.templateId ?? selectedTemplate;
    const finalHairId = randomized?.hairId ?? selectedHair;
    const finalEyeId = randomized?.eyeId ?? selectedEye;
    const finalStyleTagIds = randomized?.styleTagIds ?? selectedTags;
    const finalFaceValues = randomized?.faceValues ?? faceValues;
    const finalColorSchemeId = randomized?.colorSchemeId ?? selectedScheme;

    const composedPrompt = buildAppearanceForgePrompt({
      artist: activeArtist,
      mode,
      templateId: finalTemplateId,
      uploadedPhoto: Boolean(uploadedPhoto),
      fusionRatio,
      prompt,
      hairId: finalHairId,
      eyeId: finalEyeId,
      styleTagIds: finalStyleTagIds,
      faceValues: finalFaceValues,
      lockedFeatures,
      colorSchemeId: finalColorSchemeId,
      templates: FORGE_TEMPLATES,
      hairStyles: HAIR_STYLES,
      eyeColors: EYE_COLORS,
      styleTags: STYLE_TAGS,
      faceSliders: FACE_SLIDERS,
      colorSchemes: COLOR_SCHEMES,
    });

    const conversationId = `${Date.now()}`;
    const previewImage = pickPreviewImage(finalTemplateId, activeArtist.avatar);
    const controller = new AbortController();
    abortRef.current = controller;
    replyBufferRef.current = "";
    notesBufferRef.current = [];
    tokensBufferRef.current = null;

    setGenerating(true);
    setCurrentStatus("streaming");
    setCurrentPrompt(composedPrompt);
    setCurrentReply("");
    setCurrentNotes([]);
    setCurrentTokens(null);
    setCurrentPreviewImage(previewImage);
    previewImageBufferRef.current = previewImage;
    generatedImageBufferRef.current = null;
    setGeneratedImageUrl(null);

    appendNote(
      providerStatus?.provider === "mock"
        ? "当前使用本地 mock 流式回放"
        : "后端已接管请求，正在通过 Coze 官方 SDK 创建会话",
      "info",
    );

    try {
      await AppearanceForgeApi.streamForgeConversation(
        {
          artistId: activeArtist.id,
          prompt: composedPrompt,
        },
        {
          signal: controller.signal,
          onEvent: event => {
            if (event.event === "status") {
              appendNote(event.data.message, event.data.phase === "completed" ? "success" : "info");
              if (event.data.phase === "completed") {
                setCurrentStatus("completed");
              }
              return;
            }

            if (event.event === "delta") {
              replyBufferRef.current = event.data.reply;
              if (event.data.imageUrl) {
                previewImageBufferRef.current = event.data.imageUrl;
                generatedImageBufferRef.current = event.data.imageUrl;
                startTransition(() => {
                  setCurrentPreviewImage(event.data.imageUrl!);
                  setGeneratedImageUrl(event.data.imageUrl!);
                });
              }
              startTransition(() => setCurrentReply(event.data.reply));
              return;
            }

            if (event.event === "message") {
              replyBufferRef.current = event.data.content;
              startTransition(() => {
                setCurrentReply(event.data.content);
                if (event.data.imageUrl) {
                  setCurrentPreviewImage(event.data.imageUrl);
                  setGeneratedImageUrl(event.data.imageUrl);
                }
              });
              if (event.data.imageUrl) {
                previewImageBufferRef.current = event.data.imageUrl;
                generatedImageBufferRef.current = event.data.imageUrl;
                appendNote("已收到 Coze 返回的形象图片链接", "success");
              }
              return;
            }

            if (event.event === "completed") {
              replyBufferRef.current = event.data.content;
              if (event.data.imageUrl) {
                previewImageBufferRef.current = event.data.imageUrl;
                generatedImageBufferRef.current = event.data.imageUrl;
              }
              tokensBufferRef.current = {
                tokenCount: event.data.tokenCount,
                inputTokens: event.data.inputTokens,
                outputTokens: event.data.outputTokens,
              };
              startTransition(() => {
                setCurrentReply(event.data.content);
                if (event.data.imageUrl) {
                  setCurrentPreviewImage(event.data.imageUrl);
                  setGeneratedImageUrl(event.data.imageUrl);
                }
                setCurrentTokens(tokensBufferRef.current);
                setCurrentStatus("completed");
              });
              return;
            }

            if (event.event === "error") {
              appendNote(event.data.message, "error");
              setCurrentStatus("error");
            }
          },
        },
      );

      const finalStatus = controller.signal.aborted ? "aborted" : "completed";
      const finalReply = replyBufferRef.current.trim();
      const tokenUsage = tokensBufferRef.current as TokenUsageState | null;
      if (finalReply) {
        const historyItem: ForgeConversationHistoryItem = {
          id: conversationId,
          createdAt: new Date().toISOString(),
          mode,
          previewImage: previewImageBufferRef.current,
          generatedImageUrl: generatedImageBufferRef.current ?? undefined,
          prompt: composedPrompt,
          reply: finalReply,
          status: finalStatus,
          tokenCount: tokenUsage?.tokenCount,
          inputTokens: tokenUsage?.inputTokens,
          outputTokens: tokenUsage?.outputTokens,
        };
        startTransition(() => {
          setHistory(prev => [historyItem, ...prev].slice(0, FORGE_HISTORY_MAX));
        });
      }
      if (!controller.signal.aborted) {
        appendNote("本次锻造响应已完整回写到屏幕", "success");
      }
    } catch (error) {
      const message = (error as Error).message || "Coze 流式请求失败";
      setCurrentStatus(controller.signal.aborted ? "aborted" : "error");
      appendNote(message, "error");
      const tokenUsage = tokensBufferRef.current as TokenUsageState | null;
      if (replyBufferRef.current.trim()) {
        const historyItem: ForgeConversationHistoryItem = {
          id: conversationId,
          createdAt: new Date().toISOString(),
          mode,
          previewImage: previewImageBufferRef.current,
          generatedImageUrl: generatedImageBufferRef.current ?? undefined,
          prompt: composedPrompt,
          reply: replyBufferRef.current.trim(),
          status: controller.signal.aborted ? "aborted" : "error",
          tokenCount: tokenUsage?.tokenCount,
          inputTokens: tokenUsage?.inputTokens,
          outputTokens: tokenUsage?.outputTokens,
        };
        startTransition(() => {
          setHistory(prev => [historyItem, ...prev].slice(0, FORGE_HISTORY_MAX));
        });
      }
    } finally {
      abortRef.current = null;
      setGenerating(false);
    }
  };

  const restoreHistoryItem = (item: ForgeConversationHistoryItem) => {
    setCurrentPrompt(item.prompt);
    setCurrentReply(item.reply);
    setCurrentPreviewImage(item.previewImage);
    generatedImageBufferRef.current = item.generatedImageUrl ?? null;
    setGeneratedImageUrl(item.generatedImageUrl ?? null);
    setCurrentStatus(item.status);
    setCurrentTokens({
      tokenCount: item.tokenCount,
      inputTokens: item.inputTokens,
      outputTokens: item.outputTokens,
    });
    const text =
      item.status === "completed"
        ? "已载入一条完成的历史对话"
        : item.status === "aborted"
          ? "已载入一条手动终止的历史对话"
          : "已载入一条异常中断的历史对话";
    const tone = item.status === "completed" ? "success" : "error";
    const notes = [buildNote(text, tone)];
    notesBufferRef.current = notes;
    setCurrentNotes(notes);
  };

  const switchVariant = (variant: "v1" | "v2" | "v3") => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (variant === "v1") {
      params.delete("forge");
    } else {
      params.set("forge", variant);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : (pathname ?? "/"), { scroll: false });
  };

  const showTemplatePanel = mode === "template_photo" || mode === "template_prompt";
  const showUploadPanel = mode === "template_photo";
  const showPromptPanel = mode === "prompt_only" || mode === "template_prompt" || mode === "random";
  const providerBadgeCls = providerStatus?.configured
    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/20"
    : "bg-amber-500/15 text-amber-300 border border-amber-400/20";
  const canSaveAvatar = Boolean(generatedImageUrl) && generatedImageUrl !== activeArtist.avatar;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1
            className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span className="bg-gradient-to-r from-red-500 via-orange-400 to-amber-400 bg-clip-text text-transparent">
              AI 形象锻造炉
            </span>
            <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300/80 border border-cyan-400/30 rounded-full px-2 py-0.5">
              v3 · Coze Stream
            </span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">为 {activeArtist.name} 构建可流式回写的 Coze 锻造会话</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => switchVariant("v2")}
            className="text-[11px] text-gray-500 hover:text-amber-300 transition whitespace-nowrap"
            title="切回 v2 布局预览版"
          >
            切到 v2
          </button>
          <button
            onClick={() => switchVariant("v1")}
            className="text-[11px] text-gray-500 hover:text-gray-300 transition whitespace-nowrap"
            title="切回最初版本"
          >
            切到 v1
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(prev => !prev)}
            className="text-gray-400 hover:text-white hover:bg-white/10"
          >
            <History className="w-4 h-4 mr-1" /> 历史
            {history.length > 0 ? <Badge className="ml-1 bg-white/10 text-[10px]">{history.length}</Badge> : null}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.entries(MODE_CONFIG) as [ForgeMode, typeof MODE_CONFIG[ForgeMode]][]).map(([key, config]) => {
          const Icon = config.icon;
          const active = mode === key;
          return (
            <motion.button
              key={key}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setMode(key)}
              className={`relative overflow-hidden rounded-xl p-4 text-left transition-all border ${active ? "border-white/20 bg-white/[0.06]" : "border-white/5 bg-gray-900/40 hover:bg-white/[0.03]"}`}
            >
              {active ? (
                <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-10 transition-opacity`} />
              ) : null}
              <div className="relative z-10">
                <Icon className={`w-5 h-5 mb-2 ${active ? "text-white" : "text-gray-500"}`} />
                <div className={`text-sm font-semibold ${active ? "text-white" : "text-gray-400"}`}>{config.label}</div>
                <div className="text-[11px] text-gray-500 mt-1 line-clamp-1">{config.desc}</div>
              </div>
              {active ? <div className={`absolute top-2 right-2 w-2 h-2 rounded-full bg-gradient-to-r ${config.gradient}`} /> : null}
            </motion.button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[320px_1fr_280px] gap-4">
        <div className="space-y-4 order-2 lg:order-1">
          <div className="flex items-center gap-2 px-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-300/80">素材 · Inputs</span>
            <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/30 to-transparent" />
          </div>

          {showTemplatePanel ? (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-cyan-400" /> 风格模版
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {FORGE_TEMPLATES.map(template => (
                  <motion.button
                    key={template.id}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`relative rounded-lg overflow-hidden aspect-[3/4] ${selectedTemplate === template.id ? "ring-2 ring-cyan-400" : "ring-1 ring-white/5"}`}
                  >
                    <img src={template.image} alt={template.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-1.5">
                      <div className="text-[10px] font-medium text-white/90 truncate">{template.name}</div>
                    </div>
                    {selectedTemplate === template.id ? (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    ) : null}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : null}

          {showUploadPanel ? (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Upload className="w-4 h-4 text-purple-400" /> 上传参考照片
              </h3>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              {uploadedPhoto ? (
                <div className="relative">
                  <img src={uploadedPhoto} alt="上传参考" className="w-full aspect-square rounded-lg object-cover" />
                  <button
                    onClick={() => setUploadedPhoto(null)}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center hover:bg-red-500/60 transition"
                  >
                    <Square className="w-3 h-3 rotate-45" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-[4/3] rounded-lg border-2 border-dashed border-white/10 hover:border-white/20 transition flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-gray-400"
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-xs">点击上传参考照片</span>
                </button>
              )}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>模版 {100 - fusionRatio}%</span>
                  <span>照片 {fusionRatio}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={fusionRatio}
                  onChange={event => setFusionRatio(Number(event.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </div>
            </motion.div>
          ) : null}

          {showPromptPanel ? (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Type className="w-4 h-4 text-amber-400" /> 额外文本要求
              </h3>
              <textarea
                value={prompt}
                onChange={event => setPrompt(event.target.value)}
                placeholder="补充你想要的舞台气质、商业定位、镜头感、材质偏好等要求。"
                className={`w-full ${mode === "prompt_only" ? "h-48" : "h-32"} bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-gray-600 resize-none focus:outline-none focus:border-cyan-500/50 transition`}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {PROMPT_SUGGESTIONS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setPrompt(prev => prev + (prev ? "，" : "") + tag)}
                    className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : null}

          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4 text-amber-400" /> 风格标签
              {selectedTags.length > 0 ? (
                <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px]">{selectedTags.length}</Badge>
              ) : null}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {STYLE_TAGS.map(tag => {
                const active = selectedTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`text-[11px] px-2.5 py-1.5 rounded-full transition ${active ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-white/[0.03] text-gray-500 hover:bg-white/[0.06] border border-transparent"}`}
                  >
                    {active ? "✓ " : ""}
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="bg-gray-900/50 border border-white/5 rounded-xl overflow-hidden relative min-h-[760px]">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/5 relative z-20">
              <div className="flex items-center gap-2 min-w-0">
                <Badge className={`bg-gradient-to-r ${MODE_CONFIG[mode].gradient} text-white border-0 text-[10px] shrink-0`}>
                  {MODE_CONFIG[mode].label}
                </Badge>
                <Badge className={`text-[10px] shrink-0 ${providerBadgeCls}`}>
                  <Bot className="w-3 h-3 mr-1" />
                  {providerLoading ? "检测中" : providerStatus?.provider === "mock" ? "Mock Stream" : "Coze Live"}
                </Badge>
                <span className="text-[11px] text-gray-500 truncate">
                  {providerLoading ? "正在检查 Provider 状态..." : providerStatus?.message}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {generating ? (
                  <Button
                    onClick={handleStop}
                    size="sm"
                    variant="ghost"
                    className="text-red-200 hover:text-white hover:bg-red-500/15 border border-red-400/20"
                  >
                    <Square className="w-4 h-4 mr-1.5 fill-current" />
                    停止
                  </Button>
                ) : null}
                <Button
                  onClick={handleRun}
                  disabled={generating || (!providerLoading && providerStatus?.configured === false)}
                  size="sm"
                  className={`bg-gradient-to-r ${FORGE_BUTTON_GRADIENT} text-white border-0`}
                >
                  {generating ? (
                    <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : mode === "random" ? (
                    <Shuffle className="w-4 h-4 mr-1.5" />
                  ) : (
                    <Zap className="w-4 h-4 mr-1.5" />
                  )}
                  {providerLoading ? "准备中..." : generating ? "对话中..." : mode === "random" ? "随机锻造" : "开始锻造"}
                </Button>
              </div>
            </div>

            <div className="absolute inset-0 rounded-xl pointer-events-none z-10" style={{
              background: "linear-gradient(135deg, rgba(0,212,255,0.08) 0%, transparent 30%, transparent 70%, rgba(168,85,247,0.08) 100%)",
            }} />

            <div className="relative z-20 p-4 space-y-4">
              <div className="rounded-2xl border border-white/6 bg-black/20 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <div>
                    <p className="text-sm font-semibold text-white">当前参数生成的提示词</p>
                    <p className="text-[11px] text-gray-500">这里会随着模版、发型、标签和滑块实时重算；真正发送给 Coze 的版本保留在下方对话区</p>
                  </div>
                  <Badge className="bg-white/5 text-gray-300 border border-white/10 text-[10px]">
                    实时预览
                  </Badge>
                </div>
                <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap text-[12px] leading-6 text-gray-200 px-4 py-4 font-sans">
                  {displayPrompt}
                </pre>
              </div>

              <div className="grid xl:grid-cols-[280px_1fr] gap-4">
                <div className="rounded-2xl border border-white/6 bg-black/20 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-300" />
                    <div>
                      <p className="text-sm font-semibold text-white">锻造快照</p>
                      <p className="text-[11px] text-gray-500">当前会话绑定的视觉参考</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <img src={currentPreviewImage} alt="当前锻造预览" className="w-full aspect-[3/4] object-cover rounded-xl border border-white/5" />
                    <div className="grid grid-cols-2 gap-2">
                      <StatPill label="模式" value={MODE_CONFIG[mode].label} />
                      <StatPill label="状态" value={statusLabel(currentStatus)} />
                      <StatPill label="锁定项" value={String(lockedFeatures.length)} />
                      <StatPill label="标签数" value={String(selectedTags.length)} />
                    </div>
                    {currentTokens?.tokenCount ? (
                      <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100 space-y-1">
                        <div className="flex items-center justify-between">
                          <span>总 Token</span>
                          <span className="font-semibold tabular-nums">{currentTokens.tokenCount}</span>
                        </div>
                        {currentTokens.inputTokens ? (
                          <div className="flex items-center justify-between">
                            <span>输入</span>
                            <span className="tabular-nums">{currentTokens.inputTokens}</span>
                          </div>
                        ) : null}
                        {currentTokens.outputTokens ? (
                          <div className="flex items-center justify-between">
                            <span>输出</span>
                            <span className="tabular-nums">{currentTokens.outputTokens}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <Button
                      onClick={handleSaveAsArtistAvatar}
                      disabled={!canSaveAvatar || savingAvatar}
                      size="sm"
                      className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 disabled:opacity-50"
                    >
                      {savingAvatar ? (
                        <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-1.5" />
                      )}
                      {savingAvatar
                        ? "保存中..."
                        : canSaveAvatar
                          ? "保存为当前艺人头像"
                          : "等待 Coze 返回图片"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/6 bg-black/20 overflow-hidden min-h-[460px]">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Coze 对话流</p>
                      <p className="text-[11px] text-gray-500">开始锻造后，流式响应会逐字回写到这里</p>
                    </div>
                    <Badge className={`${currentStatus === "completed" ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/20" : currentStatus === "error" || currentStatus === "aborted" ? "bg-red-500/15 text-red-200 border border-red-400/20" : "bg-white/5 text-gray-300 border border-white/10"} text-[10px]`}>
                      {statusLabel(currentStatus)}
                    </Badge>
                  </div>

                  <div ref={conversationPanelRef} className="max-h-[560px] overflow-auto p-4 space-y-4">
                    {currentPrompt ? (
                      <>
                        <MessageBubble
                          role="user"
                          title="锻造指令"
                          body={currentPrompt}
                        />
                        <MessageBubble
                          role="assistant"
                          title={generating ? "Coze 正在回复" : "Coze 最终响应"}
                          body={currentReply || (generating ? "正在等待第一段流式内容..." : "尚未收到有效响应")}
                          loading={generating && !currentReply}
                        />
                      </>
                    ) : (
                      <div className="min-h-[380px] flex flex-col items-center justify-center gap-3 text-center px-6">
                        <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
                          <Wand2 className="w-7 h-7 text-gray-600" />
                        </div>
                        <p className="text-sm text-gray-400">设置好参数后点击“开始锻造”，中间区域会进入实时对话流。</p>
                        <p className="text-[11px] text-gray-600">v3 不再伪造一张结果图，而是把 Coze 的流式建议逐段显示出来。</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/6 bg-black/20 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-sm font-semibold text-white">流式状态时间线</p>
                  <p className="text-[11px] text-gray-500">后端事件、Coze 连接进度与完成状态都会记录在这里</p>
                </div>
                <div className="p-4 flex flex-wrap gap-2">
                  {currentNotes.length > 0 ? (
                    currentNotes.map(note => (
                      <div key={note.id} className={`px-3 py-2 rounded-xl border text-[11px] ${toneClasses(note.tone)}`}>
                        {note.text}
                      </div>
                    ))
                  ) : (
                    <div className="text-[11px] text-gray-600">尚未开始会话。</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 order-3">
          <div className="flex items-center gap-2 px-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-pink-300/80">约束 · Constraints</span>
            <div className="flex-1 h-px bg-gradient-to-r from-pink-500/30 to-transparent" />
          </div>

          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Scissors className="w-4 h-4 text-pink-400" /> 发型
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {HAIR_STYLES.map(style => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedHair(selectedHair === style.id ? null : style.id)}
                    className={`text-[11px] px-2.5 py-1.5 rounded-lg transition ${selectedHair === style.id ? "bg-pink-500/20 text-pink-300 border border-pink-500/30" : "bg-white/[0.03] text-gray-500 hover:bg-white/[0.06] border border-transparent"}`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-400" /> 瞳色
              </h3>
              <div className="flex flex-wrap gap-2">
                {EYE_COLORS.map(color => (
                  <button
                    key={color.id}
                    onClick={() => setSelectedEye(selectedEye === color.id ? null : color.id)}
                    className={`relative w-8 h-8 rounded-full transition ${selectedEye === color.id ? "ring-2 ring-offset-2 ring-offset-gray-900" : "ring-1 ring-white/10"}`}
                    style={{ background: color.color }}
                    title={color.label}
                  >
                    {selectedEye === color.id ? <Check className="w-4 h-4 text-white absolute inset-0 m-auto" /> : null}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" /> 面部微调
              {lockedFeatures.length > 0 ? (
                <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px]">
                  <Lock className="w-2.5 h-2.5 mr-0.5" />
                  {lockedFeatures.length}
                </Badge>
              ) : null}
            </h3>
            <div className="space-y-3">
              {FACE_SLIDERS.map(slider => (
                <div key={slider.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-gray-400">{slider.label}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500">{faceValues[slider.id] ?? 50}</span>
                      <button onClick={() => toggleLock(slider.id)} className="text-gray-600 hover:text-gray-400 transition">
                        {lockedFeatures.includes(slider.id) ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={faceValues[slider.id] ?? 50}
                    onChange={event => setFaceValues(prev => ({ ...prev, [slider.id]: Number(event.target.value) }))}
                    className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4 text-purple-400" /> 主题配色
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_SCHEMES.map(scheme => {
                const active = selectedScheme === scheme.id;
                return (
                  <button key={scheme.id} onClick={() => setSelectedScheme(active ? null : scheme.id)} className="flex flex-col items-center gap-1 group">
                    <div
                      className={`w-full aspect-square rounded-lg overflow-hidden ring-1 transition ${active ? "ring-white/40" : "ring-white/10 group-hover:ring-white/20"}`}
                      style={{ background: `linear-gradient(135deg, ${scheme.colors[0]}, ${scheme.colors[1]})` }}
                    />
                    <span className="text-[10px] text-gray-500 group-hover:text-gray-400 transition">{scheme.name}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {showHistory && history.length > 0 ? (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4 overflow-hidden">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-gray-400" /> 会话历史
            </h3>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {history.map(item => (
                <button
                  key={item.id}
                  onClick={() => restoreHistoryItem(item)}
                  className="rounded-xl border border-white/5 bg-black/20 hover:bg-white/[0.03] transition text-left overflow-hidden"
                >
                  <div className="grid grid-cols-[88px_1fr] min-h-[110px]">
                    <img src={item.previewImage} alt="" className="h-full w-full object-cover" />
                    <div className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-white/5 text-gray-300 border border-white/10 text-[10px]">
                          {MODE_CONFIG[item.mode].label}
                        </Badge>
                        <Badge className={`${item.status === "completed" ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/20" : "bg-red-500/15 text-red-200 border border-red-400/20"} text-[10px]`}>
                          {statusLabel(item.status)}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-200 line-clamp-2">{item.reply}</p>
                      <p className="text-[10px] text-gray-500">{new Date(item.createdAt).toLocaleString("zh-CN")}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

function MessageBubble({
  role,
  title,
  body,
  loading = false,
}: {
  role: "user" | "assistant";
  title: string;
  body: string;
  loading?: boolean;
}) {
  const bubbleCls =
    role === "user"
      ? "ml-auto bg-gradient-to-br from-cyan-500/18 to-blue-500/10 border-cyan-400/20 text-white"
      : "mr-auto bg-white/[0.03] border-white/8 text-gray-100";

  return (
    <div className={`max-w-[92%] rounded-2xl border px-4 py-3 ${bubbleCls}`}>
      <div className="flex items-center gap-2 mb-2">
        <Badge className="bg-black/20 text-[10px] text-gray-200 border border-white/10">{title}</Badge>
        {loading ? <RefreshCw className="w-3.5 h-3.5 text-cyan-300 animate-spin" /> : null}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-7">{body}</p>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-gray-500">{label}</div>
      <div className="text-sm text-white mt-1">{value}</div>
    </div>
  );
}

function statusLabel(status: "idle" | "streaming" | "completed" | "error" | "aborted") {
  if (status === "streaming") return "流式回写中";
  if (status === "completed") return "已完成";
  if (status === "error") return "异常中断";
  if (status === "aborted") return "已停止";
  return "待开始";
}

export default AppearanceForgeV3;
