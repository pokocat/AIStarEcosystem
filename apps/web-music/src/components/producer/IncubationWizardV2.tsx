"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IncubationWizardV2 — AI 艺人孵化向导
//
// PRODUCT.md：confident / calm / professional · 反对 neon gimmicks 与 sci-fi
// 陈词。这一版剥离了上一代的内联设计系统（INK / MUTED / DIM / LINE 常量、罗马
// 数字章节轨、四角 corner bracket、旋转光环、glow shadow），改用 packages/ui
// shadcn 原语 + app.css 已重写的 token（--card / --border / --primary 等）。
// 视觉策略：Restrained。强调字段对齐、章节切换的可预期性、保存路径的清晰。
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, Shuffle, X, Loader2, Sparkles,
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from "recharts";
import type { Lang } from "../../translations";
import { toast } from "@/lib/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@ai-star-eco/ui/ui/alert-dialog";
import { Button } from "@ai-star-eco/ui/ui/button";
import { Input } from "@ai-star-eco/ui/ui/input";
import { Textarea } from "@ai-star-eco/ui/ui/textarea";
import { Slider } from "@ai-star-eco/ui/ui/slider";
import { Progress } from "@ai-star-eco/ui/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ai-star-eco/ui/ui/tabs";
import { WizardChatPanel } from "./WizardChatPanel";
import {
  type ArtistType,
  ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS, TALENT_LABELS,
  type TalentProfile,
  type TypeConfig,
} from "./ArtistTypes";
import { ArtistsApi, ConfigApi, ApiError } from "@/api";
import {
  type WizardState, type LabeledI18n, type FandomColor, type WizardTemplate,
  INITIAL_STATE, GENERATIONS, CREATOR_MODES,
  FALLBACK_TEMPLATES, FALLBACK_FACE_STYLES, FALLBACK_FASHION_STYLES,
  FALLBACK_MBTI_TYPES, FALLBACK_PERSONA_TAGS, FALLBACK_VOCAL_RANGES,
  FALLBACK_MUSIC_GENRES, FALLBACK_DANCE_STYLES, FALLBACK_FANDOM_COLORS,
  FALLBACK_BRAND_RESTRICTIONS,
  getTypeSpecificGate, buildIncubationParams, randomizeState,
} from "./IncubationWizardShared";
import { useIncubationDraft } from "./useIncubationDraft";

// ── 章节定义 ───────────────────────────────────────────────────────────────
interface SectionMeta { id: string; title: string; blurb: string; }
const SECTIONS: SectionMeta[] = [
  { id: "origin", title: "基础设定", blurb: "选择艺人类型，写下诞生宣言。" },
  { id: "form",   title: "外貌设计", blurb: "设定面相、时尚风格与签名色。" },
  { id: "psyche", title: "人格参数", blurb: "设定情绪光谱、MBTI 与人设标签。" },
  { id: "talent", title: "才艺培养", blurb: "为六项才艺能力分配初始点数。" },
  { id: "craft",  title: "专属特质", blurb: "按艺人类型激活的专属维度。" },
  { id: "fandom", title: "粉丝商业", blurb: "粉丝画像、应援色与商业禁区。" },
  { id: "lore",   title: "世界观",   blurb: "撰写背景故事与组合关系。" },
];

// ── 工具 ────────────────────────────────────────────────────────────────────
function hasUserData(s: WizardState): boolean {
  return Boolean(
    s.name.trim() || s.bio.trim() || s.signatureColor || s.mbti ||
    s.personaTags.length > 0 || s.speakingStyle.trim() ||
    s.vocalRange || s.voiceTone.trim() ||
    s.musicGenres.length > 0 || s.danceStyles.length > 0 ||
    s.hostingStyle.trim() || s.actingGenres.trim() ||
    s.targetAudience.trim() || s.fanColor || s.fandomName.trim() ||
    s.brandRestrictions.length > 0 || s.backstory.trim() || s.groupAffiliation.trim()
  );
}

function formatDraftTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function computeCompleteness(state: WizardState): { score: number; total: number; pct: number } {
  const items: boolean[] = [
    !!state.name.trim(), !!state.bio.trim(), !!state.mbti,
    state.personaTags.length > 0, !!state.speakingStyle.trim(),
    !!state.signatureColor, !!state.backstory.trim(),
    !!state.fandomName.trim(), !!state.fanColor,
    state.brandRestrictions.length > 0, !!state.targetAudience.trim(),
    !!state.groupAffiliation.trim(),
  ];
  const gate = getTypeSpecificGate(state.type);
  if (gate.music) {
    items.push(!!state.vocalRange);
    items.push(state.musicGenres.length > 0);
    items.push(!!state.voiceTone.trim());
  }
  if (gate.dance) items.push(state.danceStyles.length > 0);
  if (gate.hosting) items.push(!!state.hostingStyle.trim());
  if (gate.acting) items.push(!!state.actingGenres.trim());
  const score = items.filter(Boolean).length;
  const total = items.length;
  return { score, total, pct: Math.round((score / total) * 100) };
}

// ── 公共子件 ────────────────────────────────────────────────────────────────
function FieldLabel({ children, required, hint }: React.PropsWithChildren<{ required?: boolean; hint?: string }>) {
  return (
    <div className="flex items-baseline gap-2 mb-2">
      <span className="text-xs font-medium text-foreground">{children}</span>
      {required && <span className="text-xs text-destructive">*</span>}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function Chip({ on, onClick, disabled, children }: {
  on: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "px-3 py-1.5 text-xs rounded-md border transition-colors",
        on
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-secondary text-foreground border-border hover:bg-accent",
        disabled && "opacity-40 cursor-not-allowed",
      ].filter(Boolean).join(" ")}
    >
      {children}
    </button>
  );
}

function GSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs tabular-nums text-foreground">{value}</span>
      </div>
      <Slider value={[value]} onValueChange={(v) => onChange(v[0] ?? 0)} min={0} max={100} step={1} />
    </div>
  );
}

function LeaderRow({ label, value, accent }: { label: string; value?: string | null; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={[
        "min-w-0 truncate text-right tabular-nums",
        value ? (accent ? "text-primary" : "text-foreground") : "text-muted-foreground/60",
      ].join(" ")}>
        {value || "—"}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  lang: Lang;
  onClose: () => void;
  onCreated: () => void;
}

export const IncubationWizardV2: React.FC<Props> = ({ lang, onClose, onCreated }) => {
  void lang; // 中文单语，lang 仅维持 props 兼容
  const [section, setSection] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  // 远程可热更选项
  const [FACE_STYLES, setFaceStyles]       = useState<LabeledI18n[]>(FALLBACK_FACE_STYLES);
  const [FASHION_STYLES, setFashionStyles] = useState<LabeledI18n[]>(FALLBACK_FASHION_STYLES);
  const [MBTI_TYPES, setMbti]              = useState<LabeledI18n[]>(FALLBACK_MBTI_TYPES);
  const [PERSONA_TAGS, setPersonaTags]     = useState<LabeledI18n[]>(FALLBACK_PERSONA_TAGS);
  const [VOCAL_RANGES, setVocalRanges]     = useState<LabeledI18n[]>(FALLBACK_VOCAL_RANGES);
  const [MUSIC_GENRES, setMusicGenres]     = useState<LabeledI18n[]>(FALLBACK_MUSIC_GENRES);
  const [DANCE_STYLES, setDanceStyles]     = useState<LabeledI18n[]>(FALLBACK_DANCE_STYLES);
  const [FANDOM_COLORS, setFandomColors]   = useState<FandomColor[]>(FALLBACK_FANDOM_COLORS);
  const [BRAND_RESTRICTIONS, setBrand]     = useState<LabeledI18n[]>(FALLBACK_BRAND_RESTRICTIONS);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [TEMPLATES, setTemplates]          = useState<WizardTemplate[]>(FALLBACK_TEMPLATES);
  const [incubationCost, setIncubationCost] = useState<number>(100);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      ConfigApi.getConfig<LabeledI18n[]>("incubation.faceStyles", FALLBACK_FACE_STYLES),
      ConfigApi.getConfig<LabeledI18n[]>("incubation.fashionStyles", FALLBACK_FASHION_STYLES),
      ConfigApi.getConfig<WizardTemplate[]>("incubation.templates", FALLBACK_TEMPLATES),
      ConfigApi.getConfig<LabeledI18n[]>("incubation.mbtiTypes", FALLBACK_MBTI_TYPES),
      ConfigApi.getConfig<LabeledI18n[]>("incubation.personaTags", FALLBACK_PERSONA_TAGS),
      ConfigApi.getConfig<LabeledI18n[]>("incubation.vocalRanges", FALLBACK_VOCAL_RANGES),
      ConfigApi.getConfig<LabeledI18n[]>("incubation.musicGenres", FALLBACK_MUSIC_GENRES),
      ConfigApi.getConfig<LabeledI18n[]>("incubation.danceStyles", FALLBACK_DANCE_STYLES),
      ConfigApi.getConfig<FandomColor[]>("incubation.fandomColors", FALLBACK_FANDOM_COLORS),
      ConfigApi.getConfig<LabeledI18n[]>("incubation.brandRestrictions", FALLBACK_BRAND_RESTRICTIONS),
      ConfigApi.getConfig<number>("incubation.cost", 100),
    ]).then(([face, fashion, templates, mbti, tags, vocal, genres, dance, colors, brand, cost]) => {
      if (cancelled) return;
      if (face?.length) setFaceStyles(face);
      if (fashion?.length) setFashionStyles(fashion);
      if (templates?.length) setTemplates(templates);
      if (mbti?.length) setMbti(mbti);
      if (tags?.length) setPersonaTags(tags);
      if (vocal?.length) setVocalRanges(vocal);
      if (genres?.length) setMusicGenres(genres);
      if (dance?.length) setDanceStyles(dance);
      if (colors?.length) setFandomColors(colors);
      if (brand?.length) setBrand(brand);
      if (typeof cost === "number" && cost >= 0) setIncubationCost(cost);
    });
    return () => { cancelled = true; };
  }, []);

  const typeConf = ARTIST_TYPE_CONFIG[state.type];
  const gate = getTypeSpecificGate(state.type);
  const completeness = useMemo(() => computeCompleteness(state), [state]);

  // 草稿持久化
  const draft = useIncubationDraft(state, setState, hasUserData);
  const restoreToastFiredRef = useRef(false);
  useEffect(() => {
    if (!draft.restored || restoreToastFiredRef.current) return;
    restoreToastFiredRef.current = true;
    toast.info("已恢复未完成的草稿", {
      description: draft.savedAt ? `上次保存于 ${formatDraftTime(draft.savedAt)}` : undefined,
      duration: 8000,
      action: {
        label: "丢弃",
        onClick: () => {
          setState(INITIAL_STATE);
          draft.clear();
        },
      },
    });
  }, [draft.restored, draft.savedAt, draft.clear]);

  // 签名色（用于 Lore 章节预览的小色块；不再做发光光晕）
  const signatureColorHex = useMemo(() => {
    if (!state.signatureColor) return null;
    return FANDOM_COLORS.find(c => c.id === state.signatureColor)?.color ?? null;
  }, [state.signatureColor, FANDOM_COLORS]);

  const trimmedName = state.name.trim();
  const trimmedBio = state.bio.trim();
  const basicValid = trimmedName.length > 0 && trimmedBio.length > 0;
  const LAST = SECTIONS.length - 1;

  const toggle = (key: keyof WizardState, id: string, limit?: number) => {
    setState(s => {
      const cur = (s[key] as string[]) || [];
      const on = cur.includes(id);
      if (!on && typeof limit === "number" && cur.length >= limit) return s;
      return { ...s, [key]: on ? cur.filter(x => x !== id) : [...cur, id] } as WizardState;
    });
  };

  const updateType = (type: ArtistType) =>
    setState(s => ({ ...s, type, talents: { ...ARTIST_TYPE_CONFIG[type].initialTalents } }));

  // 随机生成 + 撤销
  const prevStateRef = useRef<WizardState | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const doRandomize = () => {
    prevStateRef.current = state;
    setState(s => randomizeState(s, {
      mbti: MBTI_TYPES, personaTags: PERSONA_TAGS, vocalRanges: VOCAL_RANGES,
      musicGenres: MUSIC_GENRES, danceStyles: DANCE_STYLES, fandomColors: FANDOM_COLORS,
    }));
    toast.info("已随机生成", {
      description: "如不满意可点击撤销恢复上一版",
      duration: 8000,
      action: {
        label: "撤销",
        onClick: () => { if (prevStateRef.current) setState(prevStateRef.current); },
      },
    });
  };

  const randomize = () => {
    if (hasUserData(state)) setConfirmOpen(true);
    else doRandomize();
  };

  const goNext = () => {
    if (section === 0 && !basicValid) { setShowValidation(true); return; }
    setShowValidation(false);
    setSection(s => Math.min(LAST, s + 1));
  };
  const goPrev = () => setSection(s => Math.max(0, s - 1));

  const handleCreate = async () => {
    if (!basicValid) { setShowValidation(true); setSection(0); return; }
    setCreating(true);
    setErrorMsg(null);
    try {
      await ArtistsApi.createArtist({
        name: trimmedName,
        type: state.type,
        quality: "common",
        status: "trainee",
        level: 1, exp: 0, maxExp: 100,
        avatar: "",
        talents: state.talents,
        stats: { songs: 0, dramas: 0, ads: 0, variety: 0, fans: 0, revenue: 0, monthlyRevenue: 0, popularity: 0 },
        bio: trimmedBio,
        domains: [],
        endorsements: 0,
        commercialValue: 0,
        incubationParams: buildIncubationParams(state),
      });
      draft.clear();
      setCreated(true);
    } catch (err) {
      let msg: string;
      if (err instanceof ApiError && err.status === 402) {
        msg = `积分余额不足：${err.message}`;
      } else if (err instanceof ApiError) {
        msg = `创建失败：${err.message}（${err.code}）`;
      } else {
        msg = `创建失败：${err instanceof Error ? err.message : String(err)}`;
      }
      setErrorMsg(msg);
    } finally {
      setCreating(false);
    }
  };

  // 键盘导航
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleCreate(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, state, creating]);

  const talentKeys = Object.keys(TALENT_LABELS) as (keyof TalentProfile)[];
  const radarData = talentKeys.map(k => ({
    subject: TALENT_LABELS[k].zh,
    value: state.talents[k],
    cap: typeConf.talentCaps[k],
  }));

  // ── 成功屏 ────────────────────────────────────────────────────────────────
  if (created) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-6">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-10 text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
            <Check className="h-5 w-5 text-primary" strokeWidth={3} />
          </div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">孵化完成</p>
          <h2 className="mt-3 text-2xl font-semibold">{trimmedName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ARTIST_TYPE_LABELS[state.type].zh}
          </p>
          <div className="mt-6 mx-auto h-px w-16 bg-border" />
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            艺人已登记入平台档案。<br />
            可前往「艺人管理」继续培养、锻造形象或发行作品。
          </p>
          <Button onClick={onCreated} className="mt-7">
            进入艺人管理 <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  const currentSection = SECTIONS[section]!;

  // ── 主渲染 ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card overflow-hidden">
      {/* 顶部状态条：只放对操作有价值的信息 */}
      <header className="shrink-0 flex items-center justify-between gap-4 border-b border-border bg-card px-5 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium text-foreground">艺人合成台</span>
          <span className="text-xs text-muted-foreground hidden md:inline">
            草稿 · {draft.saving ? "保存中…" : draft.savedAt ? `${formatDraftTime(draft.savedAt)} 已保存` : "未保存"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={randomize} className="gap-1.5">
            <Shuffle className="h-3.5 w-3.5" /> 随机生成
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭" className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* 步骤指示器 */}
      <nav
        aria-label="孵化章节"
        className="shrink-0 flex items-center gap-0 border-b border-border bg-background/40 px-5 py-3 overflow-x-auto"
      >
        {SECTIONS.map((s, i) => {
          const active = i === section;
          const done = i < section;
          return (
            <React.Fragment key={s.id}>
              <button
                type="button"
                onClick={() => setSection(i)}
                className="group flex items-center gap-2 shrink-0 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
              >
                <span
                  aria-hidden
                  className={[
                    "flex h-6 w-6 items-center justify-center rounded-full border text-xs tabular-nums transition-colors",
                    done && "bg-primary border-primary text-primary-foreground",
                    active && !done && "border-primary text-primary",
                    !active && !done && "border-border text-muted-foreground",
                  ].filter(Boolean).join(" ")}
                >
                  {done ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                </span>
                <span className={[
                  "text-xs whitespace-nowrap transition-colors",
                  active ? "font-medium text-foreground" : done ? "text-foreground" : "text-muted-foreground",
                ].join(" ")}>
                  {s.title}
                </span>
              </button>
              {i < SECTIONS.length - 1 && (
                <span aria-hidden className={[
                  "mx-1 h-px w-4 shrink-0",
                  done ? "bg-primary/60" : "bg-border",
                ].join(" ")} />
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* 主体：左 form / 右 summary + AI 顾问（Tabs 切换） */}
      <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0 overflow-y-auto px-6 py-6 lg:px-8 lg:py-8">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              第 {section + 1} 章 / 共 {SECTIONS.length}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold">{currentSection.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{currentSection.blurb}</p>
          </div>

          <div className="space-y-8 max-w-3xl">
            {section === 0 && (
              <SectionOrigin state={state} setState={setState} updateType={updateType} showValidation={showValidation} />
            )}
            {section === 1 && (
              <SectionForm state={state} setState={setState} faceStyles={FACE_STYLES} fashionStyles={FASHION_STYLES} fandomColors={FANDOM_COLORS} />
            )}
            {section === 2 && (
              <SectionPsyche state={state} setState={setState} mbti={MBTI_TYPES} tags={PERSONA_TAGS} typeConf={typeConf} typeKey={state.type} toggle={toggle} />
            )}
            {section === 3 && (
              <SectionTalent state={state} setState={setState} radarData={radarData} typeConf={typeConf} />
            )}
            {section === 4 && (
              <SectionCraft state={state} setState={setState} gate={gate} typeKey={state.type} vocalRanges={VOCAL_RANGES} genres={MUSIC_GENRES} dances={DANCE_STYLES} toggle={toggle} />
            )}
            {section === 5 && (
              <SectionFandom state={state} setState={setState} fandomColors={FANDOM_COLORS} restrictions={BRAND_RESTRICTIONS} toggle={toggle} />
            )}
            {section === 6 && (
              <SectionLore state={state} setState={setState} typeKey={state.type} mbti={MBTI_TYPES} personaTags={PERSONA_TAGS} signatureColorHex={signatureColorHex} />
            )}
          </div>
        </main>

        {/* 右侧：档案预览 + AI 顾问（Tabs 切换；advisor 步骤随 section 自动同步） */}
        <aside className="hidden lg:flex min-h-0 flex-col border-l border-border bg-background/30">
          <Tabs defaultValue="preview" className="flex flex-1 min-h-0 flex-col">
            <div className="shrink-0 px-3 pt-3">
              <TabsList className="grid h-9 w-full grid-cols-2">
                <TabsTrigger value="preview">档案预览</TabsTrigger>
                <TabsTrigger value="advisor" className="gap-1">
                  <Sparkles className="h-3 w-3" /> AI 顾问
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="preview" className="m-0 flex-1 min-h-0 overflow-y-auto">
              <SummaryPanel
                state={state}
                typeKey={state.type}
                faceStyles={FACE_STYLES}
                fashionStyles={FASHION_STYLES}
                mbti={MBTI_TYPES}
                personaTags={PERSONA_TAGS}
                fandomColors={FANDOM_COLORS}
                signatureColorHex={signatureColorHex}
                completeness={completeness}
              />
            </TabsContent>
            <TabsContent value="advisor" className="m-0 flex-1 min-h-0">
              <WizardChatPanel step={section} />
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      {/* 底部行动条 */}
      <footer className="shrink-0 flex flex-wrap items-center justify-between gap-4 border-t border-border bg-card px-5 py-4">
        <Button variant="outline" size="sm" onClick={section === 0 ? onClose : goPrev} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          {section === 0 ? "取消" : "上一章"}
        </Button>

        <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground min-w-0">
          <span className="shrink-0">完成度</span>
          <Progress value={completeness.pct} className="w-32 h-1.5" />
          <span className="tabular-nums shrink-0">{completeness.score} / {completeness.total}</span>
          <span className="hidden lg:inline">·</span>
          <span className="hidden lg:inline">← → 切章 · ⌘ ↵ 创建</span>
        </div>

        {section < LAST ? (
          <Button size="sm" onClick={goNext} className="gap-1.5">
            下一章 <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="flex flex-col items-end gap-1.5">
            {errorMsg && <span className="text-xs text-destructive">{errorMsg}</span>}
            {!basicValid && !errorMsg && (
              <span className="text-xs text-destructive">第一章艺人名称 / 简介尚未填写</span>
            )}
            {incubationCost > 0 && !errorMsg && (
              <span className="text-xs text-muted-foreground tabular-nums">
                本次将扣除 <span className="font-medium text-foreground">{incubationCost}</span> 积分
              </span>
            )}
            <Button onClick={handleCreate} disabled={creating || !basicValid} className="gap-1.5">
              {creating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> 孵化中</>
              ) : (
                <><Sparkles className="h-4 w-4" /> 开始孵化</>
              )}
            </Button>
          </div>
        )}
      </footer>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定随机覆盖？</AlertDialogTitle>
            <AlertDialogDescription>
              当前向导已有部分字段填写，随机生成会覆盖这些内容。覆盖后可在弹出的提示中点击「撤销」恢复上一版。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={doRandomize}>确定覆盖</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 章节：基础设定
// ─────────────────────────────────────────────────────────────────────────────
const SectionOrigin: React.FC<{
  state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>;
  updateType: (t: ArtistType) => void; showValidation: boolean;
}> = ({ state, setState, updateType, showValidation }) => {
  const nameErr = showValidation && !state.name.trim();
  const bioErr = showValidation && !state.bio.trim();
  return (
    <div className="grid lg:grid-cols-[1.15fr_1fr] gap-10">
      <div className="space-y-6">
        <div>
          <FieldLabel required>艺人名称</FieldLabel>
          <Input
            value={state.name}
            onChange={e => setState(s => ({ ...s, name: e.target.value }))}
            placeholder="例如：星澪 Xingli"
            aria-invalid={nameErr || undefined}
          />
          {nameErr && <p className="mt-1.5 text-xs text-destructive">艺人名称必填</p>}
        </div>
        <div>
          <FieldLabel required>艺人简介</FieldLabel>
          <Textarea
            value={state.bio}
            onChange={e => setState(s => ({ ...s, bio: e.target.value }))}
            placeholder="用一段话刻画艺人的出身、气质、代表作与独特质感…"
            rows={4}
            aria-invalid={bioErr || undefined}
          />
          {bioErr && <p className="mt-1.5 text-xs text-destructive">艺人简介必填</p>}
        </div>
        <div>
          <FieldLabel>世代</FieldLabel>
          <div className="flex gap-2 flex-wrap">
            {GENERATIONS.map(g => (
              <Chip key={g} on={state.generation === g} onClick={() => setState(s => ({ ...s, generation: g }))}>
                {g}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div>
        <FieldLabel>艺人类型</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(ARTIST_TYPE_LABELS) as ArtistType[]).map(type => {
            const selected = state.type === type;
            const conf = ARTIST_TYPE_CONFIG[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => updateType(type)}
                className={[
                  "text-left rounded-lg border p-3 transition-colors",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-secondary hover:bg-accent",
                ].join(" ")}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg leading-none">{conf.icon}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {ARTIST_TYPE_LABELS[type].zh}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {conf.workshop.zh}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 章节：外貌设计
// ─────────────────────────────────────────────────────────────────────────────
const SectionForm: React.FC<{
  state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>;
  faceStyles: LabeledI18n[]; fashionStyles: LabeledI18n[]; fandomColors: FandomColor[];
}> = ({ state, setState, faceStyles, fashionStyles, fandomColors }) => (
  <div className="grid lg:grid-cols-2 gap-10">
    <div className="space-y-6">
      <div>
        <FieldLabel>面相风格</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {faceStyles.map(f => (
            <Chip key={f.id} on={state.faceStyle === f.id} onClick={() => setState(s => ({ ...s, faceStyle: f.id }))}>
              {f.zh}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>时尚风格</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {fashionStyles.map(f => (
            <Chip key={f.id} on={state.fashionStyle === f.id} onClick={() => setState(s => ({ ...s, fashionStyle: f.id }))}>
              {f.zh}
            </Chip>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel>视觉年龄</FieldLabel>
          <Input
            type="number" inputMode="numeric"
            value={state.age || ""}
            onChange={e => setState(s => ({ ...s, age: Math.max(0, parseInt(e.target.value) || 0) }))}
            placeholder="20"
          />
        </div>
        <div>
          <FieldLabel>身高 (cm)</FieldLabel>
          <Input
            type="number" inputMode="numeric"
            value={state.height || ""}
            onChange={e => setState(s => ({ ...s, height: Math.max(0, parseInt(e.target.value) || 0) }))}
            placeholder="168"
          />
        </div>
      </div>
    </div>

    <div>
      <FieldLabel hint="渗透到形象锻造的色调主线">主视觉签名色</FieldLabel>
      <div className="grid grid-cols-2 gap-2">
        {fandomColors.map(c => {
          const on = state.signatureColor === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setState(s => ({ ...s, signatureColor: c.id }))}
              className={[
                "flex items-center gap-3 rounded-lg border p-3 transition-colors text-left",
                on ? "border-primary bg-primary/5" : "border-border bg-secondary hover:bg-accent",
              ].join(" ")}
            >
              <span className="h-6 w-6 shrink-0 rounded-md border border-border" style={{ background: c.color }} />
              <div className="min-w-0">
                <div className="text-sm text-foreground">{c.zh}</div>
                <div className="text-xs text-muted-foreground tabular-nums">{c.color.toUpperCase()}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 章节：人格参数
// ─────────────────────────────────────────────────────────────────────────────
const SectionPsyche: React.FC<{
  state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>;
  mbti: LabeledI18n[]; tags: LabeledI18n[]; typeConf: TypeConfig; typeKey: ArtistType;
  toggle: (k: keyof WizardState, id: string, limit?: number) => void;
}> = ({ state, setState, mbti, tags, typeConf, typeKey, toggle }) => {
  const selectedMbti = mbti.find(m => m.id === state.mbti);
  return (
    <div className="grid lg:grid-cols-2 gap-10">
      <div className="space-y-6">
        <FieldLabel>情绪光谱</FieldLabel>
        <div className="space-y-4">
          <GSlider label="甜度"   value={state.sweetness}  onChange={v => setState(s => ({ ...s, sweetness: v }))} />
          <GSlider label="能量"   value={state.energy}     onChange={v => setState(s => ({ ...s, energy: v }))} />
          <GSlider label="神秘感" value={state.mystery}    onChange={v => setState(s => ({ ...s, mystery: v }))} />
          <GSlider label="自信度" value={state.confidence} onChange={v => setState(s => ({ ...s, confidence: v }))} />
          {typeConf.extraPersona && (
            <div className="pt-3 border-t border-border">
              <p className="mb-3 text-xs text-primary">{ARTIST_TYPE_LABELS[typeKey].zh} 专属</p>
              <GSlider label={typeConf.extraPersona.zh} value={state.extraPersona} onChange={v => setState(s => ({ ...s, extraPersona: v }))} />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <FieldLabel>MBTI 人格</FieldLabel>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
            {mbti.map(m => {
              const on = state.mbti === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setState(s => ({ ...s, mbti: on ? "" : m.id }))}
                  className={[
                    "py-2 text-xs rounded-md border transition-colors",
                    on
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-foreground border-border hover:bg-accent",
                  ].join(" ")}
                  title={m.zh}
                >
                  {m.id}
                </button>
              );
            })}
          </div>
          {selectedMbti && (
            <p className="mt-2 text-sm text-primary">「{selectedMbti.zh}」</p>
          )}
        </div>

        <div>
          <FieldLabel hint="最多 5 个">人设关键词</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {tags.map(t => {
              const on = state.personaTags.includes(t.id);
              const disabled = !on && state.personaTags.length >= 5;
              return (
                <Chip key={t.id} on={on} disabled={disabled} onClick={() => toggle("personaTags", t.id, 5)}>
                  {t.zh}
                </Chip>
              );
            })}
          </div>
        </div>

        <div>
          <FieldLabel>说话风格</FieldLabel>
          <Input
            value={state.speakingStyle}
            onChange={e => setState(s => ({ ...s, speakingStyle: e.target.value }))}
            placeholder="如：语速偏快、爱接梗、带川渝口音…"
          />
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 章节：才艺培养
// ─────────────────────────────────────────────────────────────────────────────
const SectionTalent: React.FC<{
  state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>;
  radarData: Array<{ subject: string; value: number; cap: number }>; typeConf: TypeConfig;
}> = ({ state, setState, radarData, typeConf }) => {
  const talentKeys = Object.keys(TALENT_LABELS) as (keyof TalentProfile)[];
  return (
    <div className="grid lg:grid-cols-[1fr_1fr] gap-10">
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          六维才艺按艺人类型限定上限——主属性自然更高。
        </p>
        {talentKeys.map(k => {
          const lbl = TALENT_LABELS[k];
          const val = state.talents[k];
          const cap = typeConf.talentCaps[k];
          const isPrimary = typeConf.primaryTalents.includes(k);
          return (
            <div key={k} className="space-y-1.5">
              <div className="flex items-baseline justify-between text-xs">
                <span className={isPrimary ? "text-foreground font-medium" : "text-muted-foreground"}>
                  {lbl.zh}{isPrimary && " ·主"}
                </span>
                <span className="tabular-nums">
                  <span className="text-foreground">{val}</span>
                  <span className="text-muted-foreground"> / {cap}</span>
                </span>
              </div>
              <Slider
                value={[Math.min(val, cap)]}
                onValueChange={(v) => setState(s => ({ ...s, talents: { ...s.talents, [k]: v[0] ?? 0 } }))}
                min={0} max={cap} step={1}
              />
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-background/30 p-4 h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
            <Radar name="cap" dataKey="cap" stroke="var(--border)" fill="none" strokeWidth={1} strokeDasharray="3 3" />
            <Radar name="value" dataKey="value" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.18} strokeWidth={1.5} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 章节：专属特质
// ─────────────────────────────────────────────────────────────────────────────
const SectionCraft: React.FC<{
  state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>;
  gate: { music: boolean; dance: boolean; hosting: boolean; acting: boolean };
  typeKey: ArtistType;
  vocalRanges: LabeledI18n[]; genres: LabeledI18n[]; dances: LabeledI18n[];
  toggle: (k: keyof WizardState, id: string, limit?: number) => void;
}> = ({ state, setState, gate, typeKey, vocalRanges, genres, dances, toggle }) => {
  const none = !gate.music && !gate.dance && !gate.hosting && !gate.acting;
  const creatorLabel = (m: string) => m === "lyric" ? "参与作词" : m === "full" ? "全创作型" : "只演唱";
  return (
    <div className="space-y-8">
      <p className="text-xs text-muted-foreground">
        艺人类型 · <span className="text-foreground">{ARTIST_TYPE_LABELS[typeKey].zh}</span>
      </p>
      {none && (
        <p className="text-sm text-muted-foreground">
          当前艺人类型暂无专属特质维度，可直接进入下一章。
        </p>
      )}
      {gate.music && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <FieldLabel>音域</FieldLabel>
            <div className="grid grid-cols-3 gap-2">
              {vocalRanges.map(v => (
                <Chip key={v.id} on={state.vocalRange === v.id}
                  onClick={() => setState(s => ({ ...s, vocalRange: s.vocalRange === v.id ? "" : v.id }))}>
                  {v.zh}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>音色</FieldLabel>
            <Input value={state.voiceTone} onChange={e => setState(s => ({ ...s, voiceTone: e.target.value }))} placeholder="清亮 / 磁性 / 空灵 / 金属…" />
          </div>
          <div>
            <FieldLabel>主打曲风</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {genres.map(g => (
                <Chip key={g.id} on={state.musicGenres.includes(g.id)} onClick={() => toggle("musicGenres", g.id)}>{g.zh}</Chip>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>创作模式</FieldLabel>
            <div className="flex gap-2 flex-wrap">
              {CREATOR_MODES.map(m => (
                <Chip key={m} on={state.creatorMode === m} onClick={() => setState(s => ({ ...s, creatorMode: m }))}>
                  {creatorLabel(m)}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      )}
      {gate.dance && (
        <div>
          <FieldLabel>主打舞种</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {dances.map(d => (
              <Chip key={d.id} on={state.danceStyles.includes(d.id)} onClick={() => toggle("danceStyles", d.id)}>{d.zh}</Chip>
            ))}
          </div>
        </div>
      )}
      {gate.hosting && (
        <div>
          <FieldLabel>主持风格</FieldLabel>
          <Input value={state.hostingStyle} onChange={e => setState(s => ({ ...s, hostingStyle: e.target.value }))} placeholder="文艺访谈 / 新闻播报 / 直播带货…" />
        </div>
      )}
      {gate.acting && (
        <div>
          <FieldLabel>擅长戏路</FieldLabel>
          <Input value={state.actingGenres} onChange={e => setState(s => ({ ...s, actingGenres: e.target.value }))} placeholder="古装权谋 / 现代悬疑 / 校园青春…" />
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 章节：粉丝商业
// ─────────────────────────────────────────────────────────────────────────────
const SectionFandom: React.FC<{
  state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>;
  fandomColors: FandomColor[]; restrictions: LabeledI18n[];
  toggle: (k: keyof WizardState, id: string, limit?: number) => void;
}> = ({ state, setState, fandomColors, restrictions, toggle }) => (
  <div className="grid lg:grid-cols-2 gap-10">
    <div className="space-y-6">
      <div>
        <FieldLabel>目标受众</FieldLabel>
        <Input value={state.targetAudience} onChange={e => setState(s => ({ ...s, targetAudience: e.target.value }))} placeholder="如：18-24 岁女性 / 二次元圈层" />
      </div>
      <div>
        <FieldLabel>粉丝称号</FieldLabel>
        <Input value={state.fandomName} onChange={e => setState(s => ({ ...s, fandomName: e.target.value }))} placeholder="如：星星、月亮糖、小可乐…" />
      </div>
      <div>
        <FieldLabel>应援色</FieldLabel>
        <div className="grid grid-cols-4 gap-2">
          {fandomColors.map(c => {
            const on = state.fanColor === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setState(s => ({ ...s, fanColor: c.id }))}
                className={[
                  "flex flex-col items-center gap-1.5 p-2.5 rounded-md border transition-colors",
                  on ? "border-primary bg-primary/5" : "border-border bg-secondary hover:bg-accent",
                ].join(" ")}
              >
                <span className="h-7 w-7 rounded-full border border-border" style={{ background: c.color }} />
                <span className="text-xs text-foreground">{c.zh}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>

    <div>
      <FieldLabel hint="艺人拒接类别">商业禁区</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {restrictions.map(r => (
          <Chip key={r.id} on={state.brandRestrictions.includes(r.id)} onClick={() => toggle("brandRestrictions", r.id)}>{r.zh}</Chip>
        ))}
      </div>
      {state.brandRestrictions.length > 0 && (
        <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-xs text-destructive font-medium">已注册禁区</p>
          <p className="mt-1 text-xs text-muted-foreground">
            分发系统会自动屏蔽这些类别的商业代言与素材拼接。
          </p>
        </div>
      )}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 章节：世界观
// ─────────────────────────────────────────────────────────────────────────────
const SectionLore: React.FC<{
  state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>;
  typeKey: ArtistType;
  mbti: LabeledI18n[]; personaTags: LabeledI18n[];
  signatureColorHex: string | null;
}> = ({ state, setState, typeKey, mbti, personaTags, signatureColorHex }) => {
  const mbtiLabel = mbti.find(m => m.id === state.mbti)?.zh;
  const tagsLabel = state.personaTags
    .map(id => personaTags.find(p => p.id === id)?.zh)
    .filter(Boolean)
    .join(" / ");
  return (
    <div className="grid lg:grid-cols-[1.3fr_1fr] gap-10">
      <div className="space-y-6">
        <div>
          <FieldLabel>背景故事</FieldLabel>
          <p className="mb-2 text-xs text-muted-foreground">
            出身设定、成长经历、出道契机、梦想——越具体，LLM 锻造时越能抓到独特气质。
          </p>
          <Textarea
            value={state.backstory}
            onChange={e => setState(s => ({ ...s, backstory: e.target.value }))}
            rows={6}
            placeholder="例如：出身虚拟成都的老茶馆家庭，在数据雨季里学会第一支歌谣…"
          />
        </div>
        <div>
          <FieldLabel>所属组合 / 厂牌</FieldLabel>
          <Input
            value={state.groupAffiliation}
            onChange={e => setState(s => ({ ...s, groupAffiliation: e.target.value }))}
            placeholder="单飞则留空"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background/30 p-5 self-start">
        <p className="text-xs uppercase tracking-wider text-primary">档案预览</p>
        <div className="mt-4 space-y-1.5">
          <LeaderRow label="姓名" value={state.name || null} accent />
          <LeaderRow label="类型" value={ARTIST_TYPE_LABELS[typeKey].zh} accent />
          <LeaderRow label="世代" value={state.generation} />
          <LeaderRow label="MBTI" value={state.mbti && mbtiLabel ? `${state.mbti} · ${mbtiLabel}` : null} />
          <LeaderRow label="标签" value={tagsLabel || null} />
          <LeaderRow label="粉丝名" value={state.fandomName || null} />
          {signatureColorHex && (
            <div className="flex items-center justify-between gap-3 py-1 text-sm">
              <span className="text-xs text-muted-foreground">签名色</span>
              <span className="inline-block h-4 w-8 rounded-sm border border-border" style={{ background: signatureColorHex }} />
            </div>
          )}
        </div>
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          核验无误后，点击底部「开始孵化」完成艺人登记。<br />
          数据将写入平台档案与形象锻造 LLM 上下文。
        </p>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 右侧档案预览面板
// ─────────────────────────────────────────────────────────────────────────────
const SummaryPanel: React.FC<{
  state: WizardState;
  typeKey: ArtistType;
  faceStyles: LabeledI18n[]; fashionStyles: LabeledI18n[];
  mbti: LabeledI18n[]; personaTags: LabeledI18n[]; fandomColors: FandomColor[];
  signatureColorHex: string | null;
  completeness: { score: number; total: number; pct: number };
}> = ({ state, typeKey, faceStyles, fashionStyles, mbti, personaTags, fandomColors, signatureColorHex, completeness }) => {
  const faceLabel = faceStyles.find(f => f.id === state.faceStyle)?.zh;
  const fashionLabel = fashionStyles.find(f => f.id === state.fashionStyle)?.zh;
  const mbtiLabel = mbti.find(m => m.id === state.mbti)?.zh;
  const tagsLabel = state.personaTags
    .map(id => personaTags.find(p => p.id === id)?.zh)
    .filter(Boolean)
    .join(" / ");
  const fanColorHex = fandomColors.find(c => c.id === state.fanColor)?.color;

  return (
    <div className="p-5 space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">档案预览</p>
        <h3 className="mt-2 text-lg font-semibold leading-tight">
          {state.name || <span className="text-muted-foreground">未命名艺人</span>}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {ARTIST_TYPE_LABELS[typeKey].zh} · Lv.01 练习生
        </p>
      </div>

      {signatureColorHex && (
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border border-border" style={{ background: signatureColorHex }} />
          <span className="text-xs text-muted-foreground tabular-nums">{signatureColorHex.toUpperCase()}</span>
        </div>
      )}

      <div className="border-t border-border pt-4 space-y-1">
        <LeaderRow label="世代" value={state.generation} />
        <LeaderRow label="年龄" value={state.age ? `${state.age} 岁` : null} />
        <LeaderRow label="身高" value={state.height ? `${state.height} cm` : null} />
        <LeaderRow label="面相" value={faceLabel} />
        <LeaderRow label="时尚" value={fashionLabel} />
        {state.mbti && mbtiLabel && <LeaderRow label="MBTI" value={`${state.mbti} · ${mbtiLabel}`} accent />}
        {tagsLabel && <LeaderRow label="标签" value={tagsLabel} />}
        {state.vocalRange && <LeaderRow label="音域" value={state.vocalRange} />}
        {state.musicGenres.length > 0 && <LeaderRow label="曲风" value={`${state.musicGenres.length} 项`} />}
        {state.danceStyles.length > 0 && <LeaderRow label="舞种" value={`${state.danceStyles.length} 项`} />}
        {state.fandomName && <LeaderRow label="粉丝" value={state.fandomName} />}
        {fanColorHex && (
          <div className="flex items-center justify-between gap-3 py-1 text-sm">
            <span className="text-xs text-muted-foreground">应援色</span>
            <span className="inline-block h-3.5 w-7 rounded-sm border border-border" style={{ background: fanColorHex }} />
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">完成度</span>
          <span className="text-xs tabular-nums text-foreground">{completeness.score} / {completeness.total}</span>
        </div>
        <Progress value={completeness.pct} className="h-1.5" />
      </div>
    </div>
  );
};

export default IncubationWizardV2;
