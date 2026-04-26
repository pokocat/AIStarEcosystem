"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IncubationWizardV2 — "艺人合成台" 版
// ─────────────────────────────────────────────────────────────────────────────
// 视觉：沿用项目 var(--font-sans) / var(--font-display) + 青紫主色，杂志级
// 章节标号 + 左侧罗马数字轨 + 右侧活态合成舱。所有英文 UI 文案改中文。
// 数据：继续走 IncubationWizardShared 的 WizardState；创建接口不变。
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, Shuffle, X, Loader2, CheckCircle2, Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
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
} from "@/components/ui/alert-dialog";
import {
  type ArtistType,
  ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS, TALENT_LABELS,
  type TalentProfile,
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

// ── 视觉 token（与项目基调一致） ─────────────────────────────────────────────
const ACCENT = "#22d3ee";  // cyan-400，匹配项目主色
const ACCENT_SECONDARY = "#a855f7"; // purple-500
const INK = "#E8E8F0";
const MUTED = "#8A8A9A";
const DIM = "#6A6A7A";
const LINE = "rgba(255,255,255,0.08)";
const LINE_SOFT = "rgba(255,255,255,0.05)";
const CANVAS = "#000";

const ROMAN = ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ"] as const;

interface SectionMeta {
  id: string;
  title: string;   // 章节 2 字中文标题
  blurb: string;   // 一句说明
}

const SECTIONS: SectionMeta[] = [
  { id: "origin", title: "基础设定", blurb: "选择艺人类型，写下诞生宣言。" },
  { id: "form",   title: "外貌设计", blurb: "设定面相、时尚风格与签名色。" },
  { id: "psyche", title: "人格参数", blurb: "设定情绪光谱、MBTI 与人设标签。" },
  { id: "talent", title: "才艺培养", blurb: "为六项才艺能力分配初始点数。" },
  { id: "craft",  title: "专属特质", blurb: "按艺人类型激活的专属维度。" },
  { id: "fandom", title: "粉丝商业", blurb: "粉丝画像、应援色与商业禁区。" },
  { id: "lore",   title: "世界观",   blurb: "撰写背景故事与组合关系。" },
];

const FONT_DISPLAY = "var(--font-display)";
const FONT_SANS = "var(--font-sans)";

// 判断用户是否在向导中填写过任何信息（仅检查默认值为 "" 或 [] 的字段，
// 那些有合理默认值的字段如 type/age/height/sweetness 不计入，否则首次进入就会
// 误报"已有用户数据"）
function hasUserData(s: WizardState): boolean {
  return Boolean(
    s.name.trim() ||
    s.bio.trim() ||
    s.signatureColor ||
    s.mbti ||
    s.personaTags.length > 0 ||
    s.speakingStyle.trim() ||
    s.vocalRange ||
    s.voiceTone.trim() ||
    s.musicGenres.length > 0 ||
    s.danceStyles.length > 0 ||
    s.hostingStyle.trim() ||
    s.actingGenres.trim() ||
    s.targetAudience.trim() ||
    s.fanColor ||
    s.fandomName.trim() ||
    s.brandRestrictions.length > 0 ||
    s.backstory.trim() ||
    s.groupAffiliation.trim()
  );
}

// ── 辅助函数 ────────────────────────────────────────────────────────────────
function hashSessionId(name: string): string {
  const seed = name || "未命名";
  const n = Array.from(seed).reduce((a, c) => (a * 131 + c.charCodeAt(0)) >>> 0, 0);
  return n.toString(16).toUpperCase().padStart(6, "0").slice(-6);
}

function useClock(): string {
  // SSR 初始返回空串，避免服务端/客户端时间不一致的水合警告。
  const [clock, setClock] = useState<string>("");
  useEffect(() => {
    const tick = () => setClock(new Date().toTimeString().slice(0, 8));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return clock;
}

function computeCompleteness(state: WizardState): { score: number; total: number; pct: number } {
  const items: Array<boolean> = [
    !!state.name.trim(),
    !!state.bio.trim(),
    !!state.mbti,
    state.personaTags.length > 0,
    !!state.speakingStyle.trim(),
    !!state.signatureColor,
    !!state.backstory.trim(),
    !!state.fandomName.trim(),
    !!state.fanColor,
    state.brandRestrictions.length > 0,
    !!state.targetAudience.trim(),
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

// ── 小组件 ──────────────────────────────────────────────────────────────────
const CornerBracket = ({ pos, color, size = 12 }: { pos: "tl" | "tr" | "bl" | "br"; color: string; size?: number }) => {
  const s: Record<string, React.CSSProperties> = {
    tl: { top: -1, left: -1, borderTop: `1px solid ${color}`, borderLeft: `1px solid ${color}` },
    tr: { top: -1, right: -1, borderTop: `1px solid ${color}`, borderRight: `1px solid ${color}` },
    bl: { bottom: -1, left: -1, borderBottom: `1px solid ${color}`, borderLeft: `1px solid ${color}` },
    br: { bottom: -1, right: -1, borderBottom: `1px solid ${color}`, borderRight: `1px solid ${color}` },
  };
  return <span className="absolute pointer-events-none" style={{ ...s[pos], width: size, height: size }} />;
};

/** 小字号上标签：10px / tracking-wider / uppercase 对 Chinese 没影响，留做规整 */
const SmallLabel: React.FC<React.PropsWithChildren<{ color?: string; size?: number }>> = ({ children, color = MUTED, size = 10 }) => (
  <span
    style={{
      fontFamily: FONT_SANS,
      fontSize: size,
      letterSpacing: "0.18em",
      color,
    }}
  >
    {children}
  </span>
);

const DottedLeader = ({ label, value, valueColor = INK }: { label: string; value: string | null | undefined; valueColor?: string }) => (
  <div className="flex items-baseline gap-2 text-[11px]" style={{ fontFamily: FONT_SANS }}>
    <span className="shrink-0" style={{ color: DIM, letterSpacing: "0.1em" }}>{label}</span>
    <span className="flex-1 mb-1" style={{ borderBottom: `1px dotted ${LINE}` }} />
    <span className="shrink-0 max-w-[180px] truncate tabular-nums" style={{ color: value ? valueColor : DIM }}>
      {value || "—"}
    </span>
  </div>
);

// 输入框基础样式：浅底 + 实体边框 + 圆角，hover/focus 有明显反馈
const INPUT_BG = "rgba(255,255,255,0.03)";
const INPUT_BG_HOVER = "rgba(255,255,255,0.06)";
const INPUT_BORDER = "rgba(255,255,255,0.12)";
const INPUT_BORDER_HOVER = "rgba(255,255,255,0.22)";

const TextInput: React.FC<{
  value: string; onChange: (v: string) => void;
  placeholder?: string; error?: boolean; accent?: string;
}> = ({ value, onChange, placeholder, error, accent = ACCENT }) => (
  <input
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full text-[14px] rounded-lg px-3.5 py-2.5 focus:outline-none transition"
    style={{
      color: INK,
      fontFamily: FONT_SANS,
      background: INPUT_BG,
      border: `1px solid ${error ? "#ef4444" : INPUT_BORDER}`,
      caretColor: accent,
    }}
    onMouseEnter={e => {
      if (document.activeElement !== e.currentTarget) {
        e.currentTarget.style.background = INPUT_BG_HOVER;
        e.currentTarget.style.borderColor = error ? "#ef4444" : INPUT_BORDER_HOVER;
      }
    }}
    onMouseLeave={e => {
      if (document.activeElement !== e.currentTarget) {
        e.currentTarget.style.background = INPUT_BG;
        e.currentTarget.style.borderColor = error ? "#ef4444" : INPUT_BORDER;
      }
    }}
    onFocus={e => {
      e.currentTarget.style.background = INPUT_BG_HOVER;
      e.currentTarget.style.borderColor = accent;
      e.currentTarget.style.boxShadow = `0 0 0 3px ${accent}22`;
    }}
    onBlur={e => {
      e.currentTarget.style.background = INPUT_BG;
      e.currentTarget.style.borderColor = error ? "#ef4444" : INPUT_BORDER;
      e.currentTarget.style.boxShadow = "none";
    }}
  />
);

const TextArea: React.FC<{
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; accent?: string;
}> = ({ value, onChange, placeholder, rows = 3, accent = ACCENT }) => (
  <textarea
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    className="w-full text-[14px] rounded-lg px-3.5 py-2.5 focus:outline-none transition resize-none leading-relaxed"
    style={{
      color: INK,
      fontFamily: FONT_SANS,
      background: INPUT_BG,
      border: `1px solid ${INPUT_BORDER}`,
      caretColor: accent,
    }}
    onMouseEnter={e => {
      if (document.activeElement !== e.currentTarget) {
        e.currentTarget.style.background = INPUT_BG_HOVER;
        e.currentTarget.style.borderColor = INPUT_BORDER_HOVER;
      }
    }}
    onMouseLeave={e => {
      if (document.activeElement !== e.currentTarget) {
        e.currentTarget.style.background = INPUT_BG;
        e.currentTarget.style.borderColor = INPUT_BORDER;
      }
    }}
    onFocus={e => {
      e.currentTarget.style.background = INPUT_BG_HOVER;
      e.currentTarget.style.borderColor = accent;
      e.currentTarget.style.boxShadow = `0 0 0 3px ${accent}22`;
    }}
    onBlur={e => {
      e.currentTarget.style.background = INPUT_BG;
      e.currentTarget.style.borderColor = INPUT_BORDER;
      e.currentTarget.style.boxShadow = "none";
    }}
  />
);

const GSlider: React.FC<{ label: string; value: number; onChange: (v: number) => void; accent?: string }> = ({ label, value, onChange, accent = ACCENT }) => (
  <div className="space-y-1.5">
    <div className="flex items-baseline justify-between">
      <SmallLabel>{label}</SmallLabel>
      <span className="tabular-nums" style={{ fontFamily: FONT_SANS, color: accent, fontSize: 12, letterSpacing: "0.05em" }}>
        {String(value).padStart(3, "0")}
      </span>
    </div>
    <div className="relative h-[2px] bg-white/5">
      <div className="absolute inset-y-0 left-0" style={{ width: `${value}%`, background: accent }} />
      <input
        type="range" min={0} max={100} value={value} onChange={e => onChange(+e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <span
        className="absolute -top-[4px] w-[10px] h-[10px] border"
        style={{
          left: `calc(${value}% - 5px)`,
          background: CANVAS,
          borderColor: accent,
          transform: "rotate(45deg)",
          pointerEvents: "none",
        }}
      />
    </div>
  </div>
);

const Chip: React.FC<{ on: boolean; onClick: () => void; disabled?: boolean; accent?: string; children: React.ReactNode }> = ({ on, onClick, disabled, accent = ACCENT, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="px-3 py-1.5 text-xs transition-all"
    style={{
      fontFamily: FONT_SANS,
      letterSpacing: "0.04em",
      color: disabled ? "#4A4A5A" : on ? CANVAS : INK,
      background: on ? accent : "rgba(255,255,255,0.025)",
      border: `1px solid ${on ? accent : LINE}`,
      boxShadow: on ? `0 0 0 2px ${accent}33, 0 0 14px ${accent}55` : "none",
      cursor: disabled ? "not-allowed" : "pointer",
    }}
  >
    {children}
  </button>
);

const FieldLabel: React.FC<React.PropsWithChildren<{ required?: boolean; hint?: string }>> = ({ children, required, hint }) => (
  <div className="flex items-baseline gap-2 mb-2">
    <SmallLabel>{children}</SmallLabel>
    {required && <span className="text-[10px]" style={{ color: "#ef4444" }}>*</span>}
    {hint && <span className="text-[10px]" style={{ color: DIM }}>{hint}</span>}
  </div>
);

// ── 主组件 ─────────────────────────────────────────────────────────────────
interface Props {
  lang: Lang;
  onClose: () => void;
  onCreated: () => void;
}

export const IncubationWizardV2: React.FC<Props> = ({ lang, onClose, onCreated }) => {
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
  // 孵化费用（积分），admin 在 /base/presets 配置 incubation.cost
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
  const clock = useClock();
  const sessionId = useMemo(() => hashSessionId(state.name), [state.name]);
  const completeness = useMemo(() => computeCompleteness(state), [state]);

  // 艺人签名色 → 活态光晕；未选用默认青色
  const artistColor = useMemo(() => {
    if (!state.signatureColor) return ACCENT;
    const found = FANDOM_COLORS.find(c => c.id === state.signatureColor);
    return found?.color ?? ACCENT;
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

  // 随机生成：保留上一版供撤销，命中 hasUserData 时先弹确认
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
        onClick: () => {
          if (prevStateRef.current) setState(prevStateRef.current);
        },
      },
    });
  };

  const randomize = () => {
    if (hasUserData(state)) {
      setConfirmOpen(true);
    } else {
      doRandomize();
    }
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

  // 键盘导航：← → 切章节，⌘+↵ 提交
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
      <div className="flex items-center justify-center min-h-[70vh] px-6" style={{ fontFamily: FONT_SANS }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative w-full max-w-xl p-12 text-center rounded-2xl"
          style={{ background: "#0B0B14", border: `1px solid ${LINE}` }}
        >
          <CornerBracket pos="tl" color={artistColor} size={18} />
          <CornerBracket pos="tr" color={artistColor} size={18} />
          <CornerBracket pos="bl" color={artistColor} size={18} />
          <CornerBracket pos="br" color={artistColor} size={18} />

          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring" }}
            className="w-24 h-24 mx-auto mb-8 rounded-full flex items-center justify-center"
            style={{
              border: `1px solid ${artistColor}`,
              boxShadow: `0 0 80px ${artistColor}40, inset 0 0 30px ${artistColor}20`,
            }}
          >
            <CheckCircle2 size={32} style={{ color: artistColor }} />
          </motion.div>

          <SmallLabel color={artistColor}>孵化完成</SmallLabel>
          <h2 className="mt-4 text-4xl" style={{ color: INK, fontFamily: FONT_DISPLAY, fontWeight: 600 }}>{trimmedName}</h2>
          <p className="mt-2 text-sm" style={{ color: MUTED, fontFamily: FONT_SANS }}>
            {typeConf.icon} {ARTIST_TYPE_LABELS[state.type].zh} · 会话 {sessionId}
          </p>
          <div className="mt-8 h-px w-24 mx-auto" style={{ background: LINE }} />
          <p className="mt-6 text-sm leading-relaxed" style={{ color: MUTED }}>
            艺人已登记入平台档案。<br />
            你可以前往 <span style={{ color: INK }}>MCN 矩阵</span> 继续培养、锻造形象或发行作品。
          </p>
          <button
            onClick={onCreated}
            className="mt-8 inline-flex items-center gap-2 px-6 py-2.5 rounded-lg transition"
            style={{
              fontFamily: FONT_SANS,
              fontSize: 13,
              color: CANVAS,
              background: artistColor,
            }}
          >
            进入 MCN 矩阵 <ArrowRight size={14} />
          </button>
        </motion.div>
      </div>
    );
  }

  // ── 主渲染 ────────────────────────────────────────────────────────────────
  const currentSection = SECTIONS[section];
  const currentRoman = ROMAN[section];

  return (
    <div
      className="relative flex flex-col h-full rounded-2xl overflow-hidden"
      style={{
        fontFamily: FONT_SANS,
        color: INK,
        background: "#0B0B14",
        backgroundImage: `
          radial-gradient(900px 500px at 85% 5%, ${artistColor}22, transparent 60%),
          radial-gradient(700px 400px at 10% 95%, ${ACCENT_SECONDARY}18, transparent 55%)
        `,
        border: `1px solid ${LINE}`,
      }}
    >
      {/* 顶部状态条 */}
      <header
        className="shrink-0 flex items-center justify-between px-6 py-3 backdrop-blur-md"
        style={{ borderBottom: `1px solid ${LINE}`, background: "rgba(0,0,0,0.6)" }}
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <motion.span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: ACCENT }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
            <span style={{ fontFamily: FONT_DISPLAY, color: ACCENT, fontSize: 13, letterSpacing: "0.12em", fontWeight: 600 }}>
              艺人合成台
            </span>
          </div>
          <div className="hidden md:flex items-center gap-4 text-[11px]" style={{ fontFamily: FONT_SANS }}>
            <span style={{ color: DIM }}>会话 <span className="ml-1 tabular-nums" style={{ color: INK }}>{sessionId}</span></span>
            <span style={{ color: DIM }}>时刻 <span className="ml-1 tabular-nums" style={{ color: MUTED }}>{clock || "--:--:--"}</span></span>
            <span style={{ color: DIM }}>状态 <span className="ml-1" style={{ color: ACCENT }}>{creating ? "合成中" : "起草中"}</span></span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={randomize}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition text-xs"
            style={{
              fontFamily: FONT_SANS,
              color: MUTED,
              border: `1px solid ${LINE}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = INK; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.color = MUTED; }}
          >
            <Shuffle size={12} /> 随机生成
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition"
            style={{ color: MUTED, border: `1px solid ${LINE}` }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.color = MUTED; }}
            title="关闭"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      {/* 三栏主区 */}
      <div className="grid grid-cols-[100px_1fr] lg:grid-cols-[128px_1fr_340px] gap-0 flex-1 min-h-0">
        {/* 左：章节轨 */}
        <aside
          className="py-6 overflow-y-auto"
          style={{ borderRight: `1px solid ${LINE}` }}
        >
          <div className="flex flex-col">
            {SECTIONS.map((s, i) => {
              const active = i === section;
              const done = i < section;
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(i)}
                  className="relative flex items-center gap-3 w-full pl-4 pr-3 py-2.5 transition-colors group"
                  title={s.title}
                >
                  {/* 连接线（除最后一个） */}
                  {i < SECTIONS.length - 1 && (
                    <span
                      className="absolute left-[calc(1rem+10px)] top-[calc(50%+11px)] w-px h-[20px] -translate-x-1/2"
                      style={{ background: done ? ACCENT : LINE, opacity: done ? 0.7 : 1 }}
                    />
                  )}
                  {/* 数字徽章 */}
                  <span
                    className="relative shrink-0 flex items-center justify-center transition-all"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 9999,
                      background: done ? ACCENT : "transparent",
                      border: `${active ? 2 : 1}px solid ${done || active ? ACCENT : LINE}`,
                      boxShadow: active ? `0 0 12px ${ACCENT}66` : "none",
                    }}
                  >
                    {done ? (
                      <Check size={12} strokeWidth={3} style={{ color: CANVAS }} />
                    ) : (
                      <span
                        className="tabular-nums"
                        style={{
                          fontFamily: FONT_SANS,
                          fontSize: 11,
                          fontWeight: active ? 600 : 500,
                          color: active ? ACCENT : DIM,
                          lineHeight: 1,
                        }}
                      >
                        {i + 1}
                      </span>
                    )}
                  </span>
                  {/* 章节标题 */}
                  <span
                    className="transition truncate text-left"
                    style={{
                      fontFamily: FONT_SANS,
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      color: active ? ACCENT : done ? INK : DIM,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {s.title}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* 中：内容区（独立滚动） */}
        <main className="px-6 md:px-8 py-6 min-w-0 overflow-y-auto">
          {/* 章节标题头 */}
          <div className="flex items-end justify-between gap-4 mb-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2 text-[11px]" style={{ fontFamily: FONT_SANS, letterSpacing: "0.12em" }}>
                <span style={{ color: ACCENT }}>第 {section + 1} 章</span>
                <span style={{ color: LINE }}>/</span>
                <span style={{ color: MUTED }}>共 7 章</span>
              </div>
              <h1
                className="leading-[1] flex items-baseline gap-4"
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 600,
                  fontSize: "clamp(28px, 3.4vw, 38px)",
                  color: INK,
                  letterSpacing: "-0.02em",
                }}
              >
                {currentSection.title}
              </h1>
              <p className="mt-2 text-sm max-w-lg" style={{ color: MUTED, lineHeight: 1.7 }}>
                {currentSection.blurb}
              </p>
            </div>
            {/* 巨型半透罗马数字 */}
            <div
              className="hidden sm:block select-none shrink-0"
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 500,
                fontSize: "clamp(60px, 8vw, 110px)",
                lineHeight: 1,
                color: ACCENT,
                opacity: 0.12,
                textShadow: `0 0 24px ${ACCENT}44`,
                letterSpacing: "-0.08em",
              }}
            >
              {currentRoman}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.section
              key={section}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="space-y-8"
            >
              {section === 0 && (
                <SectionOrigin
                  state={state} setState={setState} updateType={updateType}
                  showValidation={showValidation} accent={artistColor}
                />
              )}
              {section === 1 && (
                <SectionForm
                  state={state} setState={setState}
                  faceStyles={FACE_STYLES} fashionStyles={FASHION_STYLES} fandomColors={FANDOM_COLORS}
                  accent={artistColor}
                />
              )}
              {section === 2 && (
                <SectionPsyche
                  state={state} setState={setState}
                  mbti={MBTI_TYPES} tags={PERSONA_TAGS}
                  typeConf={typeConf} typeKey={state.type}
                  accent={artistColor}
                  toggle={toggle}
                />
              )}
              {section === 3 && (
                <SectionTalent
                  state={state} setState={setState} radarData={radarData}
                  typeConf={typeConf} accent={artistColor}
                />
              )}
              {section === 4 && (
                <SectionCraft
                  state={state} setState={setState}
                  gate={gate} typeKey={state.type}
                  vocalRanges={VOCAL_RANGES} genres={MUSIC_GENRES} dances={DANCE_STYLES}
                  accent={artistColor}
                  toggle={toggle}
                />
              )}
              {section === 5 && (
                <SectionFandom
                  state={state} setState={setState}
                  fandomColors={FANDOM_COLORS} restrictions={BRAND_RESTRICTIONS}
                  accent={artistColor}
                  toggle={toggle}
                />
              )}
              {section === 6 && (
                <SectionLore
                  state={state} setState={setState} accent={artistColor}
                />
              )}
            </motion.section>
          </AnimatePresence>
        </main>

        {/* 右：合成舱（独立滚动） */}
        <aside className="hidden lg:block overflow-y-auto" style={{ borderLeft: `1px solid ${LINE}` }}>
          <div className="p-6">
            <GenesisCapsule
              state={state} typeConf={typeConf} typeKey={state.type}
              artistColor={artistColor}
              radarData={radarData}
              completeness={completeness}
              faceStyles={FACE_STYLES}
              fashionStyles={FASHION_STYLES}
              mbti={MBTI_TYPES}
              personaTags={PERSONA_TAGS}
              fandomColors={FANDOM_COLORS}
            />
          </div>
        </aside>
      </div>

      {/* 底部行动条 */}
      <footer
        className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 backdrop-blur-md"
        style={{ borderTop: `1px solid ${LINE}`, background: "rgba(0,0,0,0.7)" }}
      >
        <button
          onClick={section === 0 ? onClose : goPrev}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition text-xs"
          style={{
            fontFamily: FONT_SANS,
            color: MUTED,
            border: `1px solid ${LINE}`,
            letterSpacing: "0.05em",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = INK; e.currentTarget.style.color = INK; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.color = MUTED; }}
        >
          <ArrowLeft size={14} /> {section === 0 ? "取消" : "上一章"}
        </button>

        <div className="hidden md:flex items-center gap-3 text-[11px]" style={{ fontFamily: FONT_SANS, color: MUTED, letterSpacing: "0.04em" }}>
          <span>完成度</span>
          <div className="relative w-40 h-1 rounded-full bg-white/5">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ background: ACCENT, boxShadow: `0 0 8px ${ACCENT}66` }}
              animate={{ width: `${completeness.pct}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <span className="tabular-nums" style={{ color: ACCENT }}>
            {completeness.score} / {completeness.total}
          </span>
          <span className="hidden lg:inline" style={{ color: DIM }}>·</span>
          <span className="hidden lg:inline" style={{ color: DIM }}>← → 切换章节 · ⌘+↵ 创建</span>
        </div>

        {section < LAST ? (
          <button
            onClick={goNext}
            className="flex items-center gap-2 px-5 py-2 rounded-lg transition text-xs"
            style={{
              fontFamily: FONT_SANS,
              color: CANVAS,
              background: ACCENT,
              letterSpacing: "0.05em",
            }}
          >
            下一章 <ArrowRight size={14} />
          </button>
        ) : (
          <div className="flex flex-col items-end gap-1">
            {errorMsg && <span className="text-[11px]" style={{ color: "#ef4444", fontFamily: FONT_SANS }}>{errorMsg}</span>}
            {!basicValid && !errorMsg && (
              <span className="text-[11px]" style={{ color: "#ef4444", fontFamily: FONT_SANS }}>
                第一章艺人名称 / 简介尚未填写
              </span>
            )}
            {incubationCost > 0 && !errorMsg && (
              <span className="text-[11px] tabular-nums" style={{ color: MUTED, fontFamily: FONT_SANS }}>
                本次将扣除 <span style={{ color: ACCENT, fontWeight: 600 }}>{incubationCost}</span> 积分
              </span>
            )}
            <button
              onClick={handleCreate}
              disabled={creating || !basicValid}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg transition text-xs"
              style={{
                fontFamily: FONT_SANS,
                color: basicValid && !creating ? CANVAS : "#4A4A5A",
                background: basicValid && !creating ? ACCENT : "rgba(255,255,255,0.05)",
                letterSpacing: "0.05em",
                cursor: basicValid && !creating ? "pointer" : "not-allowed",
              }}
            >
              {creating ? (
                <><Loader2 size={14} className="animate-spin" /> 孵化中</>
              ) : (
                <><Sparkles size={14} /> 开始孵化</>
              )}
            </button>
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
// Section: 基础设定
// ─────────────────────────────────────────────────────────────────────────────
const SectionOrigin = ({
  state, setState, updateType, showValidation, accent,
}: {
  state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>;
  updateType: (t: ArtistType) => void; showValidation: boolean; accent: string;
}) => {
  const nameErr = showValidation && !state.name.trim();
  const bioErr = showValidation && !state.bio.trim();
  return (
    <div className="grid lg:grid-cols-[1.2fr_1fr] gap-12">
      <div className="space-y-8">
        <div>
          <FieldLabel required>艺人名称</FieldLabel>
          <TextInput value={state.name} onChange={v => setState(s => ({ ...s, name: v }))} placeholder="例如：星澪 Xingli" error={nameErr} accent={accent} />
          {nameErr && <span className="text-[11px] mt-2 block" style={{ color: "#ef4444", fontFamily: FONT_SANS }}>艺人名称必填</span>}
        </div>
        <div>
          <FieldLabel required>艺人简介</FieldLabel>
          <TextArea value={state.bio} onChange={v => setState(s => ({ ...s, bio: v }))} placeholder="用一段话刻画艺人的出身、气质、代表作与独特质感…" rows={4} accent={accent} />
          {bioErr && <span className="text-[11px] mt-2 block" style={{ color: "#ef4444", fontFamily: FONT_SANS }}>艺人简介必填</span>}
        </div>
        <div>
          <FieldLabel>世代</FieldLabel>
          <div className="flex gap-2">
            {GENERATIONS.map(g => (
              <Chip key={g} on={state.generation === g} onClick={() => setState(s => ({ ...s, generation: g }))} accent={accent}>
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
                onClick={() => updateType(type)}
                className="relative text-left p-3 rounded-lg transition group"
                style={{
                  background: selected ? `${accent}10` : "transparent",
                  border: `1px solid ${selected ? accent : LINE}`,
                }}
              >
                {selected && (
                  <>
                    <CornerBracket pos="tl" color={accent} size={8} />
                    <CornerBracket pos="br" color={accent} size={8} />
                  </>
                )}
                <div className="flex items-start gap-2">
                  <span className="text-xl leading-none">{conf.icon}</span>
                  <div className="min-w-0">
                    <div className="text-sm" style={{ color: INK, fontFamily: FONT_DISPLAY, fontWeight: 500 }}>
                      {ARTIST_TYPE_LABELS[type].zh}
                    </div>
                    <div className="text-[11px] mt-0.5 truncate" style={{ color: DIM, fontFamily: FONT_SANS, letterSpacing: "0.04em" }}>
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
// Section: 外貌设计
// ─────────────────────────────────────────────────────────────────────────────
const SectionForm = ({
  state, setState, faceStyles, fashionStyles, fandomColors, accent,
}: {
  state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>;
  faceStyles: LabeledI18n[]; fashionStyles: LabeledI18n[]; fandomColors: FandomColor[]; accent: string;
}) => (
  <div className="grid lg:grid-cols-2 gap-10">
    <div className="space-y-8">
      <div>
        <FieldLabel>面相风格</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {faceStyles.map(f => (
            <Chip key={f.id} on={state.faceStyle === f.id} onClick={() => setState(s => ({ ...s, faceStyle: f.id }))} accent={accent}>
              {f.zh}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>时尚风格</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {fashionStyles.map(f => (
            <Chip key={f.id} on={state.fashionStyle === f.id} onClick={() => setState(s => ({ ...s, fashionStyle: f.id }))} accent={accent}>
              {f.zh}
            </Chip>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <FieldLabel>视觉年龄</FieldLabel>
          <TextInput
            value={String(state.age)}
            onChange={v => setState(s => ({ ...s, age: Math.max(0, parseInt(v) || 0) }))}
            placeholder="20" accent={accent}
          />
        </div>
        <div>
          <FieldLabel>身高 (cm)</FieldLabel>
          <TextInput
            value={String(state.height)}
            onChange={v => setState(s => ({ ...s, height: Math.max(0, parseInt(v) || 0) }))}
            placeholder="168" accent={accent}
          />
        </div>
      </div>
    </div>

    <div>
      <FieldLabel>主视觉签名色</FieldLabel>
      <p className="text-xs mb-4" style={{ color: MUTED, fontFamily: FONT_SANS }}>
        签名色会渗透到右侧合成舱的光晕与艺人形象资产中。
      </p>
      <div className="grid grid-cols-2 gap-2">
        {fandomColors.map(c => {
          const on = state.signatureColor === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setState(s => ({ ...s, signatureColor: c.id }))}
              className="relative flex items-center gap-3 p-3 rounded-lg transition"
              style={{
                background: on ? `${c.color}12` : "transparent",
                border: `1px solid ${on ? c.color : LINE}`,
              }}
            >
              {on && <CornerBracket pos="tl" color={c.color} size={8} />}
              {on && <CornerBracket pos="br" color={c.color} size={8} />}
              <span
                className="w-6 h-6 shrink-0 rounded"
                style={{ background: c.color, boxShadow: on ? `0 0 20px ${c.color}88` : "none" }}
              />
              <div className="min-w-0">
                <div className="text-sm" style={{ color: INK, fontFamily: FONT_SANS }}>{c.zh}</div>
                <div className="text-[11px] tabular-nums" style={{ color: DIM, fontFamily: FONT_SANS }}>{c.color.toUpperCase()}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Section: 人格参数
// ─────────────────────────────────────────────────────────────────────────────
const SectionPsyche = ({
  state, setState, mbti, tags, typeConf, typeKey, accent, toggle,
}: {
  state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>;
  mbti: LabeledI18n[]; tags: LabeledI18n[]; typeConf: any; typeKey: ArtistType; accent: string;
  toggle: (k: keyof WizardState, id: string, limit?: number) => void;
}) => {
  const selectedMbti = mbti.find(m => m.id === state.mbti);
  return (
    <div className="grid lg:grid-cols-2 gap-10">
      <div className="space-y-8">
        <div>
          <FieldLabel>情绪光谱</FieldLabel>
          <div className="space-y-5 mt-2">
            <GSlider label="甜度" value={state.sweetness} onChange={v => setState(s => ({ ...s, sweetness: v }))} accent={accent} />
            <GSlider label="能量" value={state.energy} onChange={v => setState(s => ({ ...s, energy: v }))} accent={accent} />
            <GSlider label="神秘感" value={state.mystery} onChange={v => setState(s => ({ ...s, mystery: v }))} accent={accent} />
            <GSlider label="自信度" value={state.confidence} onChange={v => setState(s => ({ ...s, confidence: v }))} accent={accent} />
            {typeConf.extraPersona && (
              <div className="pt-2" style={{ borderTop: `1px dashed ${LINE}` }}>
                <div className="mb-3 flex items-center gap-2">
                  <SmallLabel color={accent}>{ARTIST_TYPE_LABELS[typeKey].zh} 专属</SmallLabel>
                </div>
                <GSlider label={typeConf.extraPersona.zh} value={state.extraPersona} onChange={v => setState(s => ({ ...s, extraPersona: v }))} accent={accent} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <FieldLabel>MBTI 人格</FieldLabel>
          <div className="grid grid-cols-5 gap-1.5">
            {mbti.map(m => {
              const on = state.mbti === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setState(s => ({ ...s, mbti: on ? "" : m.id }))}
                  className="py-2 text-[11px] rounded transition"
                  style={{
                    fontFamily: FONT_SANS,
                    color: on ? CANVAS : INK,
                    background: on ? accent : "transparent",
                    border: `1px solid ${on ? accent : LINE}`,
                    letterSpacing: "0.04em",
                  }}
                  title={m.zh}
                >
                  {m.id}
                </button>
              );
            })}
          </div>
          {selectedMbti && (
            <p className="mt-2 text-sm" style={{ color: accent, fontFamily: FONT_SANS }}>
              「{selectedMbti.zh}」
            </p>
          )}
        </div>

        <div>
          <FieldLabel hint="最多 5 个">人设关键词</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {tags.map(t => {
              const on = state.personaTags.includes(t.id);
              const disabled = !on && state.personaTags.length >= 5;
              return (
                <Chip key={t.id} on={on} disabled={disabled} onClick={() => toggle("personaTags", t.id, 5)} accent={accent}>
                  {t.zh}
                </Chip>
              );
            })}
          </div>
        </div>

        <div>
          <FieldLabel>说话风格</FieldLabel>
          <TextInput
            value={state.speakingStyle}
            onChange={v => setState(s => ({ ...s, speakingStyle: v }))}
            placeholder="如：语速偏快、爱接梗、带川渝口音…"
            accent={accent}
          />
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Section: 才艺培养
// ─────────────────────────────────────────────────────────────────────────────
const SectionTalent = ({
  state, setState, radarData, typeConf, accent,
}: {
  state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>;
  radarData: any[]; typeConf: any; accent: string;
}) => {
  const talentKeys = Object.keys(TALENT_LABELS) as (keyof TalentProfile)[];
  return (
    <div className="grid lg:grid-cols-[1fr_1fr] gap-12">
      <div className="space-y-5">
        <p className="text-sm" style={{ color: MUTED, fontFamily: FONT_SANS }}>
          六维才艺按艺人类型限定上限——主属性天然更高。
        </p>
        {talentKeys.map(k => {
          const lbl = TALENT_LABELS[k];
          const val = state.talents[k];
          const cap = typeConf.talentCaps[k];
          const isPrimary = typeConf.primaryTalents.includes(k);
          return (
            <div key={k} className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="flex items-center gap-2">
                  <SmallLabel color={isPrimary ? accent : MUTED}>{lbl.zh}</SmallLabel>
                  {isPrimary && <span style={{ color: accent, fontSize: 10 }}>★</span>}
                </span>
                <span className="tabular-nums" style={{ fontFamily: FONT_SANS, color: INK, fontSize: 12 }}>
                  {String(val).padStart(3, "0")}<span style={{ color: DIM }}> / {cap}</span>
                </span>
              </div>
              <div className="relative h-[2px] bg-white/5">
                <div className="absolute inset-y-0 left-0" style={{ width: `${(val / cap) * 100}%`, background: isPrimary ? accent : INK }} />
                <input
                  type="range" min={0} max={cap} value={Math.min(val, cap)}
                  onChange={e => setState(s => ({ ...s, talents: { ...s.talents, [k]: +e.target.value } }))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative rounded-lg" style={{ height: 380, border: `1px solid ${LINE}`, background: "rgba(255,255,255,0.015)" }}>
        <CornerBracket pos="tl" color={LINE} />
        <CornerBracket pos="tr" color={LINE} />
        <CornerBracket pos="bl" color={LINE} />
        <CornerBracket pos="br" color={LINE} />
        <div className="absolute inset-4">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke={LINE} />
              <PolarAngleAxis dataKey="subject" tick={{ fill: MUTED, fontSize: 11 }} />
              <Radar name="cap" dataKey="cap" stroke={LINE} fill="none" strokeWidth={1} strokeDasharray="3 3" />
              <Radar name="value" dataKey="value" stroke={accent} fill={accent} fillOpacity={0.18} strokeWidth={1.5} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Section: 专属特质
// ─────────────────────────────────────────────────────────────────────────────
const SectionCraft = ({
  state, setState, gate, typeKey, vocalRanges, genres, dances, accent, toggle,
}: {
  state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>;
  gate: { music: boolean; dance: boolean; hosting: boolean; acting: boolean };
  typeKey: ArtistType;
  vocalRanges: LabeledI18n[]; genres: LabeledI18n[]; dances: LabeledI18n[];
  accent: string;
  toggle: (k: keyof WizardState, id: string, limit?: number) => void;
}) => {
  const none = !gate.music && !gate.dance && !gate.hosting && !gate.acting;
  const creatorLabel = (m: string) => m === "lyric" ? "参与作词" : m === "full" ? "全创作型" : "只演唱";
  return (
    <div className="space-y-10">
      <div className="flex items-center gap-3">
        <SmallLabel color={accent}>艺人类型 · {ARTIST_TYPE_LABELS[typeKey].zh}</SmallLabel>
      </div>
      {none && (
        <p className="text-sm" style={{ color: MUTED, fontFamily: FONT_SANS }}>
          当前艺人类型暂无专属特质维度，可直接进入下一章。
        </p>
      )}
      {gate.music && (
        <div className="grid lg:grid-cols-2 gap-8">
          <div>
            <FieldLabel>音域</FieldLabel>
            <div className="grid grid-cols-3 gap-2">
              {vocalRanges.map(v => (
                <Chip key={v.id} on={state.vocalRange === v.id} onClick={() => setState(s => ({ ...s, vocalRange: s.vocalRange === v.id ? "" : v.id }))} accent={accent}>
                  {v.zh}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>音色</FieldLabel>
            <TextInput value={state.voiceTone} onChange={v => setState(s => ({ ...s, voiceTone: v }))} placeholder="清亮 / 磁性 / 空灵 / 金属…" accent={accent} />
          </div>
          <div>
            <FieldLabel>主打曲风</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {genres.map(g => (
                <Chip key={g.id} on={state.musicGenres.includes(g.id)} onClick={() => toggle("musicGenres", g.id)} accent={accent}>
                  {g.zh}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>创作模式</FieldLabel>
            <div className="flex gap-2">
              {CREATOR_MODES.map(m => (
                <Chip key={m} on={state.creatorMode === m} onClick={() => setState(s => ({ ...s, creatorMode: m }))} accent={accent}>
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
              <Chip key={d.id} on={state.danceStyles.includes(d.id)} onClick={() => toggle("danceStyles", d.id)} accent={accent}>
                {d.zh}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {gate.hosting && (
        <div>
          <FieldLabel>主持风格</FieldLabel>
          <TextInput value={state.hostingStyle} onChange={v => setState(s => ({ ...s, hostingStyle: v }))} placeholder="文艺访谈 / 新闻播报 / 直播带货…" accent={accent} />
        </div>
      )}
      {gate.acting && (
        <div>
          <FieldLabel>擅长戏路</FieldLabel>
          <TextInput value={state.actingGenres} onChange={v => setState(s => ({ ...s, actingGenres: v }))} placeholder="古装权谋 / 现代悬疑 / 校园青春…" accent={accent} />
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Section: 粉丝商业
// ─────────────────────────────────────────────────────────────────────────────
const SectionFandom = ({
  state, setState, fandomColors, restrictions, accent, toggle,
}: {
  state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>;
  fandomColors: FandomColor[]; restrictions: LabeledI18n[]; accent: string;
  toggle: (k: keyof WizardState, id: string, limit?: number) => void;
}) => (
  <div className="grid lg:grid-cols-2 gap-10">
    <div className="space-y-8">
      <div>
        <FieldLabel>目标受众</FieldLabel>
        <TextInput value={state.targetAudience} onChange={v => setState(s => ({ ...s, targetAudience: v }))} placeholder="如：18-24 岁女性 / 二次元圈层" accent={accent} />
      </div>
      <div>
        <FieldLabel>粉丝称号</FieldLabel>
        <TextInput value={state.fandomName} onChange={v => setState(s => ({ ...s, fandomName: v }))} placeholder="如：星星、月亮糖、小可乐…" accent={accent} />
      </div>
      <div>
        <FieldLabel>应援色</FieldLabel>
        <div className="grid grid-cols-4 gap-2">
          {fandomColors.map(c => {
            const on = state.fanColor === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setState(s => ({ ...s, fanColor: c.id }))}
                className="relative flex flex-col items-center gap-1.5 p-2 rounded transition"
                style={{
                  background: on ? `${c.color}14` : "transparent",
                  border: `1px solid ${on ? c.color : LINE}`,
                }}
              >
                <span
                  className="w-8 h-8 rounded-full"
                  style={{ background: c.color, boxShadow: on ? `0 0 18px ${c.color}88` : "none" }}
                />
                <span className="text-[10px]" style={{ color: INK, fontFamily: FONT_SANS, letterSpacing: "0.04em" }}>
                  {c.zh}
                </span>
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
          <Chip key={r.id} on={state.brandRestrictions.includes(r.id)} onClick={() => toggle("brandRestrictions", r.id)} accent={accent}>
            {r.zh}
          </Chip>
        ))}
      </div>
      {state.brandRestrictions.length > 0 && (
        <div className="mt-6 p-4 rounded-lg" style={{ border: `1px dashed ${LINE}`, background: "rgba(239,68,68,0.04)" }}>
          <SmallLabel color="#ef4444">注意 · 已注册禁区</SmallLabel>
          <p className="text-xs mt-2" style={{ color: MUTED, lineHeight: 1.7 }}>
            分发系统会自动屏蔽这些类别的商业代言与素材拼接。
          </p>
        </div>
      )}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Section: 世界观
// ─────────────────────────────────────────────────────────────────────────────
const SectionLore = ({
  state, setState, accent,
}: {
  state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>; accent: string;
}) => (
  <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12">
    <div className="space-y-8">
      <div>
        <FieldLabel>背景故事</FieldLabel>
        <p className="text-xs mb-2" style={{ color: MUTED, fontFamily: FONT_SANS }}>
          出身设定、成长经历、出道契机、梦想——越具体，LLM 锻造时越能抓到独特气质。
        </p>
        <TextArea value={state.backstory} onChange={v => setState(s => ({ ...s, backstory: v }))} rows={6} placeholder="例如：出身虚拟成都的老茶馆家庭，在数据雨季里学会第一支歌谣…" accent={accent} />
      </div>
      <div>
        <FieldLabel>所属组合 / 厂牌</FieldLabel>
        <TextInput value={state.groupAffiliation} onChange={v => setState(s => ({ ...s, groupAffiliation: v }))} placeholder="单飞则留空" accent={accent} />
      </div>
    </div>

    <div className="relative p-6 rounded-lg" style={{ background: "#0B0B14", border: `1px solid ${LINE}` }}>
      <CornerBracket pos="tl" color={accent} />
      <CornerBracket pos="br" color={accent} />
      <SmallLabel color={accent}>档案预览</SmallLabel>
      <div className="mt-4 space-y-3">
        <DottedLeader label="姓名" value={state.name || "—"} valueColor={INK} />
        <DottedLeader label="类型" value={ARTIST_TYPE_LABELS[state.type].zh} valueColor={INK} />
        <DottedLeader label="世代" value={state.generation} valueColor={MUTED} />
        <DottedLeader label="MBTI" value={state.mbti || "—"} valueColor={MUTED} />
        <DottedLeader label="标签" value={state.personaTags.join(" / ") || "—"} valueColor={MUTED} />
        <DottedLeader label="粉丝名" value={state.fandomName || "—"} valueColor={MUTED} />
      </div>
      <p className="mt-6 text-xs" style={{ color: DIM, fontFamily: FONT_SANS, lineHeight: 1.7 }}>
        核验无误后，点击底部「开始孵化」完成艺人登记。<br />
        数据将写入平台档案 & 形象锻造 LLM 上下文。
      </p>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 合成舱 — 右侧活态预览
// ─────────────────────────────────────────────────────────────────────────────
const GenesisCapsule = ({
  state, typeConf, typeKey, artistColor, radarData, completeness,
  faceStyles, fashionStyles, mbti, personaTags, fandomColors,
}: {
  state: WizardState; typeConf: any; typeKey: ArtistType;
  artistColor: string;
  radarData: any[];
  completeness: { score: number; total: number; pct: number };
  faceStyles: LabeledI18n[]; fashionStyles: LabeledI18n[];
  mbti: LabeledI18n[]; personaTags: LabeledI18n[]; fandomColors: FandomColor[];
}) => {
  const faceLabel = faceStyles.find(f => f.id === state.faceStyle)?.zh;
  const fashionLabel = fashionStyles.find(f => f.id === state.fashionStyle)?.zh;
  const mbtiLabel = mbti.find(m => m.id === state.mbti)?.zh;
  const tagsLabel = state.personaTags.map(id => personaTags.find(p => p.id === id)?.zh).filter(Boolean).join(" / ");
  const fanColorHex = fandomColors.find(c => c.id === state.fanColor)?.color;

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center gap-2">
        <motion.span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: artistColor }}
          animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <SmallLabel color={artistColor}>合成舱</SmallLabel>
      </div>

      {/* 形象占位 + 光晕 */}
      <div className="relative w-full aspect-square max-w-[220px] mx-auto">
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            border: `1px solid ${artistColor}`,
            boxShadow: `0 0 50px ${artistColor}55, inset 0 0 30px ${artistColor}22`,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        />
        <div
          className="absolute inset-[14%] rounded-full flex items-center justify-center"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${artistColor}30, ${CANVAS} 70%)`,
            border: `1px solid ${LINE}`,
          }}
        >
          <span style={{ fontSize: 52, filter: `drop-shadow(0 0 20px ${artistColor}88)` }}>
            {typeConf.icon}
          </span>
        </div>
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded" style={{ background: CANVAS, border: `1px solid ${LINE}` }}>
          <SmallLabel size={10}>Lv.01 · 练习生</SmallLabel>
        </div>
      </div>

      {/* 姓名 */}
      <div className="text-center">
        <h3
          className="leading-tight"
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 26, fontWeight: 600, color: INK, letterSpacing: "-0.01em",
          }}
        >
          {state.name || "（未命名艺人）"}
        </h3>
        <p className="mt-1" style={{ fontFamily: FONT_SANS, color: MUTED, fontSize: 12, letterSpacing: "0.04em" }}>
          {ARTIST_TYPE_LABELS[typeKey].zh}
        </p>
      </div>

      {/* 规格表 */}
      <div className="space-y-2" style={{ paddingTop: 16, borderTop: `1px dashed ${LINE}` }}>
        <DottedLeader label="世代" value={state.generation} />
        <DottedLeader label="年龄" value={`${state.age} 岁`} />
        <DottedLeader label="身高" value={`${state.height} cm`} />
        <DottedLeader label="面相" value={faceLabel} />
        <DottedLeader label="风格" value={fashionLabel} />
        {state.mbti && <DottedLeader label="MBTI" value={`${state.mbti} · ${mbtiLabel}`} valueColor={artistColor} />}
        {tagsLabel && <DottedLeader label="标签" value={tagsLabel} />}
        {state.vocalRange && <DottedLeader label="音域" value={state.vocalRange} />}
        {state.musicGenres.length > 0 && <DottedLeader label="曲风" value={`${state.musicGenres.length} 项`} />}
        {state.danceStyles.length > 0 && <DottedLeader label="舞种" value={`${state.danceStyles.length} 项`} />}
        {state.fandomName && <DottedLeader label="粉丝" value={state.fandomName} />}
        {fanColorHex && (
          <div className="flex items-center gap-2 text-[11px]" style={{ fontFamily: FONT_SANS }}>
            <span className="shrink-0" style={{ color: DIM, letterSpacing: "0.1em" }}>应援色</span>
            <span className="flex-1 mb-1" style={{ borderBottom: `1px dotted ${LINE}` }} />
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: fanColorHex }} />
          </div>
        )}
      </div>

      {/* 迷你雷达 */}
      <div className="relative" style={{ height: 160, paddingTop: 12, borderTop: `1px dashed ${LINE}` }}>
        <div className="absolute top-3 left-0">
          <SmallLabel>能力雷达</SmallLabel>
        </div>
        <div className="absolute inset-x-0 top-6 bottom-0">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke={LINE} />
              <PolarAngleAxis dataKey="subject" tick={{ fill: DIM, fontSize: 9 }} />
              <Radar dataKey="cap" stroke={LINE} fill="none" strokeWidth={1} strokeDasharray="3 3" />
              <Radar dataKey="value" stroke={artistColor} fill={artistColor} fillOpacity={0.2} strokeWidth={1.5} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 完成度 */}
      <div style={{ paddingTop: 16, borderTop: `1px dashed ${LINE}` }}>
        <div className="flex items-baseline justify-between mb-2">
          <SmallLabel>完成度</SmallLabel>
          <span className="tabular-nums" style={{ fontFamily: FONT_SANS, color: artistColor, fontSize: 14 }}>
            {String(completeness.pct).padStart(2, "0")}<span style={{ color: DIM, fontSize: 10 }}>%</span>
          </span>
        </div>
        <div className="relative h-[3px] bg-white/5">
          <motion.div
            className="absolute inset-y-0 left-0"
            style={{ background: artistColor }}
            animate={{ width: `${completeness.pct}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <p className="text-[10px] mt-2" style={{ color: DIM, fontFamily: FONT_SANS, letterSpacing: "0.04em" }}>
          已录入 {completeness.score} / {completeness.total} 项字段
        </p>
      </div>
    </div>
  );
};

export default IncubationWizardV2;
