import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, ArrowRight, Sparkles, Shuffle, Wand2, X,
  Mic2, Video, Star, Headphones, Zap, CheckCircle2, Loader2, Download, Undo2, Palette,
  Maximize2, Pipette, Share2, Copy, Link, RectangleHorizontal, Square, RectangleVertical, Check,
  Package, Play, Pause, Grid3X3, FileArchive, LayoutTemplate, History, ImageIcon, RotateCcw, Trash2, Save, Columns2, ArrowLeftRight, Upload, FileDown, Pencil, AlertCircle, Heart, BookmarkPlus, Search,
  Brain, Music2, Users2, ShieldOff, Trophy, Dices, Plus
} from 'lucide-react';
import { SkillTreePanel, SKILL_TREE_TOTAL_POINTS, computeSkillBonuses } from './SkillTreePanel';
import { DebutCeremony, computeRarity, type GachaRarity } from './DebutCeremony';
import JSZip from 'jszip';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { motion, AnimatePresence } from "motion/react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import type { Lang } from "../../translations";
import { TRANSLATIONS } from "../../translations";
import {
  type ArtistType, type TalentProfile, type DesignStyle, type ProfessionBackground,
  ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS, QUALITY_CONFIG, TALENT_LABELS,
  DESIGN_STYLE_CONFIG, DESIGN_STYLE_ORDER,
  PROFESSION_CONFIG, PROFESSION_ORDER,
  DEFAULT_CUSTOM_TAGS,
} from './ArtistTypes';
import { AppearanceForgeEmbed } from './AppearanceForge';
import type { ForgeResultData } from './AppearanceForge';
import { generateRandomForgeResult, FORGE_FACE_SLIDERS } from './AppearanceForge';
import { WizardInlineChat } from './WizardInlineChat';
import { IPTemplatePanel } from './IPTemplatePanel';
import type { SolutionId } from '../../data/ipPlatform';
import {
  SOLUTION_WIZARD_DEFAULTS, getPresetForSolution, readStoredPreset, writeStoredPreset,
  type SolutionPreset,
} from '../../data/ipSolutionPreset';

// ---- Draft Persistence ----
const WIZARD_DRAFT_LS_KEY = 'ai_incubator_wizard_draft_v2';
interface WizardDraft {
  state: WizardState;
  step: number;
  forgeResult: ForgeResultData | null;
  savedAt: number;
  artistName: string;
}
function loadDraft(): WizardDraft | null {
  try {
    const raw = localStorage.getItem(WIZARD_DRAFT_LS_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as WizardDraft;
    if (!d.artistName || Date.now() - d.savedAt > 7 * 24 * 3600000) return null;
    return d;
  } catch { return null; }
}
function saveDraft(d: WizardDraft) {
  try { localStorage.setItem(WIZARD_DRAFT_LS_KEY, JSON.stringify(d)); } catch {}
}
function clearDraft() {
  try { localStorage.removeItem(WIZARD_DRAFT_LS_KEY); } catch {}
}

// ---- Style Tag → Talent Boost Mapping ----
const STYLE_BOOST_MAP: Record<string, Partial<TalentProfile>> = {
  // English keys
  'Cyber Tattoo': { variety: 5, comedy: 3 },
  'Mech Limb': { dancing: 8, acting: 3 },
  'Holo Goggles': { acting: 5, hosting: 3 },
  'Neon Earring': { singing: 6, variety: 2 },
  'Data Facepaint': { hosting: 5, acting: 3 },
  'Quantum Collar': { singing: 4, comedy: 4 },
  'Prism Wings': { dancing: 7, variety: 4 },
  'Dark Cloak': { acting: 6, comedy: 2 },
  // Chinese keys
  '赛博纹身': { variety: 5, comedy: 3 },
  '机械义肢': { dancing: 8, acting: 3 },
  '全息护目镜': { acting: 5, hosting: 3 },
  '荧光耳饰': { singing: 6, variety: 2 },
  '数据面纹': { hosting: 5, acting: 3 },
  '量子项圈': { singing: 4, comedy: 4 },
  '光棱翅膀': { dancing: 7, variety: 4 },
  '暗黑斗篷': { acting: 6, comedy: 2 },
};

function computeStyleBoosts(tags: string[]): Partial<TalentProfile> {
  const boosts: Partial<TalentProfile> = {};
  for (const tag of tags) {
    const b = STYLE_BOOST_MAP[tag];
    if (b) {
      for (const [k, v] of Object.entries(b)) {
        boosts[k as keyof TalentProfile] = (boosts[k as keyof TalentProfile] || 0) + (v as number);
      }
    }
  }
  return boosts;
}

// ---- Canvas Card Rendering (shared by export & preview) ----
type CardTheme = 'cyber' | 'neon' | 'midnight' | 'crimson' | 'holo' | 'custom';
const CARD_THEMES: Record<CardTheme, {
  zh: string; en: string;
  bg: string; grid: string; accent1: string; accent2: string;
  tagBg: string; tagText: string; preview: string;
}> = {
  cyber: { zh: '赛博青紫', en: 'Cyber Teal', bg: '#0a0a0f', grid: 'rgba(6,182,212,0.06)', accent1: '#06b6d4', accent2: '#a855f7', tagBg: 'rgba(245,158,11,0.15)', tagText: '#fbbf24', preview: 'from-cyan-500/20 to-purple-500/20' },
  neon: { zh: '霓虹粉绿', en: 'Neon Pink', bg: '#0d0015', grid: 'rgba(236,72,153,0.06)', accent1: '#ec4899', accent2: '#22c55e', tagBg: 'rgba(34,197,94,0.15)', tagText: '#4ade80', preview: 'from-pink-500/20 to-green-500/20' },
  midnight: { zh: '午夜深蓝', en: 'Midnight Blue', bg: '#020617', grid: 'rgba(59,130,246,0.06)', accent1: '#3b82f6', accent2: '#8b5cf6', tagBg: 'rgba(139,92,246,0.15)', tagText: '#a78bfa', preview: 'from-blue-500/20 to-violet-500/20' },
  crimson: { zh: '绯红暗焰', en: 'Crimson Fire', bg: '#0f0000', grid: 'rgba(239,68,68,0.06)', accent1: '#ef4444', accent2: '#f59e0b', tagBg: 'rgba(239,68,68,0.15)', tagText: '#fca5a5', preview: 'from-red-500/20 to-amber-500/20' },
  holo: { zh: '全息幻彩', en: 'Holographic', bg: '#050510', grid: 'rgba(168,85,247,0.05)', accent1: '#c084fc', accent2: '#34d399', tagBg: 'rgba(192,132,252,0.15)', tagText: '#c4b5fd', preview: 'from-violet-500/20 to-emerald-500/20' },
  custom: { zh: '自定义配色', en: 'Custom Colors', bg: '#0a0a0f', grid: 'rgba(255,255,255,0.04)', accent1: '#06b6d4', accent2: '#a855f7', tagBg: 'rgba(255,255,255,0.1)', tagText: '#ffffff', preview: 'from-white/10 to-white/20' },
};

/** Build a dynamic custom theme from two user-chosen colors */
function buildCustomTheme(c1: string, c2: string): typeof CARD_THEMES.cyber {
  return {
    zh: '自定义配色', en: 'Custom Colors',
    bg: '#0a0a0f', grid: `${c1}0F`,
    accent1: c1, accent2: c2,
    tagBg: `${c1}26`, tagText: c1,
    preview: 'from-white/10 to-white/20',
  };
}

interface WatermarkConfig {
  enabled: boolean;
  mode: 'text' | 'logo';
  text: string;
  logoUrl: string | null;
  logoSize: number;
  position: 'tl' | 'tc' | 'tr' | 'cl' | 'cc' | 'cr' | 'bl' | 'bc' | 'br';
  opacity: number;
  fontSize: number;
  rotation: number;
  tiled: boolean;
}
const DEFAULT_WATERMARK: WatermarkConfig = {
  enabled: false, mode: 'text', text: '', logoUrl: null, logoSize: 48,
  position: 'br', opacity: 30, fontSize: 14, rotation: -15, tiled: false,
};

interface CardSnapshot {
  id: string; ts: number; label: string;
  theme: CardTheme; layout: CardLayout;
  watermark: WatermarkConfig;
  customColors: { c1: string; c2: string };
}
const MAX_SNAPSHOTS = 10;

interface CustomTemplate {
  id: string; ts: number; name: string; emoji: string;
  category: 'debut' | 'social' | 'promo' | 'event';
  theme: CardTheme; layout: CardLayout;
  watermark: WatermarkConfig;
}
const MAX_CUSTOM_TEMPLATES = 20;
const CUSTOM_TPL_LS_KEY = 'incubator_custom_tpl_v1';
const FAVORITE_LS_KEY = 'incubator_tpl_favorites_v1';
const USAGE_LS_KEY = 'incubator_tpl_usage_v1';
type TplSortMode = 'default' | 'most_used' | 'recent';
interface TplUsage { count: number; lastUsed: number; }
const CATEGORY_EMOJI: Record<CustomTemplate['category'], string> = { debut: 'DBT', social: 'SNS', promo: 'PRO', event: 'EVT' };

interface CardRenderOpts {
  name: string; type: string; typeIcon: string; level: string;
  talents: { label: string; value: number; cap: number }[];
  imageUrl: string | null; tags: string[];
  workshop: string; bio: string;
  theme?: CardTheme;
  layout?: CardLayout;
  watermark?: WatermarkConfig;
}

// ---- Card Template Presets ----
interface CardPreset {
  id: string; zh: string; en: string;
  theme: CardTheme; layout: CardLayout;
  emoji: string; desc_zh: string; desc_en: string;
  category: 'debut' | 'social' | 'promo' | 'event';
  watermark?: Partial<WatermarkConfig>;
}
const CARD_PRESETS: CardPreset[] = [
  { id: 'debut_poster', zh: '出道海报', en: 'Debut Poster', theme: 'cyber', layout: 'portrait', emoji: 'DBT', desc_zh: '经典竖版出道亮相', desc_en: 'Classic portrait debut reveal', category: 'debut' },
  { id: 'sns_square', zh: '社交名片', en: 'Social Card', theme: 'neon', layout: 'square', emoji: 'SNS', desc_zh: '霓虹方形适配Ins/微博', desc_en: 'Neon square for Instagram/Weibo', category: 'social' },
  { id: 'biz_card', zh: '商务名片', en: 'Business Card', theme: 'midnight', layout: 'landscape', emoji: 'BIZ', desc_zh: '午夜蓝横版专业风', desc_en: 'Midnight blue professional wide card', category: 'promo' },
  { id: 'fan_poster', zh: '粉丝应援', en: 'Fan Poster', theme: 'crimson', layout: 'portrait', emoji: 'FAN', desc_zh: '绯红竖版应援海报', desc_en: 'Crimson fan support poster', category: 'event' },
  { id: 'holo_promo', zh: '全息宣传', en: 'Holo Promo', theme: 'holo', layout: 'landscape', emoji: 'HLO', desc_zh: '全息幻彩横版宣发', desc_en: 'Holographic wide promo card', category: 'promo' },
  { id: 'neon_debut', zh: '霓虹出道', en: 'Neon Debut', theme: 'neon', layout: 'portrait', emoji: 'NDB', desc_zh: '粉绿撞色竖版海报', desc_en: 'Pink-green clash portrait poster', category: 'debut' },
  { id: 'cyber_social', zh: '赛博社交', en: 'Cyber Social', theme: 'cyber', layout: 'square', emoji: 'CYB', desc_zh: '赛博方形科技感', desc_en: 'Cyber square tech vibe', category: 'social' },
  { id: 'dark_wide', zh: '暗焰横幅', en: 'Dark Banner', theme: 'crimson', layout: 'landscape', emoji: 'DRK', desc_zh: '暗黑系横版banner', desc_en: 'Dark crimson wide banner', category: 'promo' },
  { id: 'midnight_square', zh: '深蓝社交', en: 'Midnight Social', theme: 'midnight', layout: 'square', emoji: 'MDN', desc_zh: '深蓝方形优雅风格', desc_en: 'Deep blue elegant square', category: 'social' },
  { id: 'holo_debut', zh: '幻彩出道', en: 'Holo Debut', theme: 'holo', layout: 'portrait', emoji: 'HDB', desc_zh: '全息竖版梦幻出道', desc_en: 'Holographic portrait dreamy debut', category: 'debut' },
  { id: 'cyber_banner', zh: '赛博横幅', en: 'Cyber Banner', theme: 'cyber', layout: 'landscape', emoji: 'CBN', desc_zh: '赛博横版科技宣传', desc_en: 'Cyber tech wide promo', category: 'promo', watermark: { enabled: true, mode: 'text', text: 'CYBER IDOL', opacity: 15, tiled: true } },
  { id: 'neon_event', zh: '霓虹活动', en: 'Neon Event', theme: 'neon', layout: 'landscape', emoji: 'NVT', desc_zh: '霓虹横版活动海报', desc_en: 'Neon wide event poster', category: 'event' },
  { id: 'crimson_square', zh: '烈焰方图', en: 'Crimson Square', theme: 'crimson', layout: 'square', emoji: 'CSQ', desc_zh: '绯红方形热血风格', desc_en: 'Crimson fiery square card', category: 'social' },
  { id: 'midnight_event', zh: '午夜派对', en: 'Midnight Party', theme: 'midnight', layout: 'portrait', emoji: 'MPT', desc_zh: '深蓝竖版活动邀请', desc_en: 'Midnight portrait party invite', category: 'event' },
];
const PRESET_CATEGORIES = [
  { id: 'all' as const, zh: '全部', en: 'All', emoji: 'ALL' },
  { id: 'debut' as const, zh: '出道', en: 'Debut', emoji: 'DBT' },
  { id: 'social' as const, zh: '社交', en: 'Social', emoji: 'SNS' },
  { id: 'promo' as const, zh: '宣传', en: 'Promo', emoji: 'PRO' },
  { id: 'event' as const, zh: '活动', en: 'Event', emoji: 'EVT' },
];

// ---- Card Layout System ----
type CardLayout = 'portrait' | 'landscape' | 'square';
const CARD_LAYOUTS: Record<CardLayout, { zh: string; en: string; w: number; h: number; icon: typeof RectangleVertical }> = {
  portrait:  { zh: '竖版海报', en: 'Portrait Poster', w: 600, h: 900, icon: RectangleVertical },
  landscape: { zh: '横版名片', en: 'Landscape Card', w: 900, h: 500, icon: RectangleHorizontal },
  square:    { zh: '方形社交', en: 'Square Social', w: 600, h: 600, icon: Square },
};

// ---- Shared Canvas Drawing Helpers ----
const TALENT_COLORS = ['#06b6d4', '#a855f7', '#ec4899', '#f59e0b', '#22c55e', '#ef4444'];

function drawCardBase(ctx: CanvasRenderingContext2D, W: number, H: number, thm: typeof CARD_THEMES.cyber) {
  ctx.fillStyle = thm.bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = thm.grid; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const topGrad = ctx.createLinearGradient(0, 0, W, 0);
  topGrad.addColorStop(0, thm.accent1); topGrad.addColorStop(1, thm.accent2);
  ctx.fillStyle = topGrad; ctx.fillRect(0, 0, W, 4);
  const btmGrad = ctx.createLinearGradient(0, 0, W, 0);
  btmGrad.addColorStop(0, thm.accent1); btmGrad.addColorStop(1, thm.accent2);
  ctx.fillStyle = btmGrad; ctx.fillRect(0, H - 3, W, 3);
}

function drawPortraitBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, icon: string, thm: typeof CARD_THEMES.cyber) {
  ctx.fillStyle = thm.accent1 + '15';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.fill();
  ctx.strokeStyle = thm.accent1 + '40'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.stroke();
  ctx.fillStyle = thm.accent1 + '60'; ctx.font = `${Math.round(w * 0.25)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.fillText(icon, x + w / 2, y + h / 2 + 10); ctx.textAlign = 'start';
}

function drawQRCode(ctx: CanvasRenderingContext2D, qrX: number, qrY: number, qrSize: number, seed: number, thm: typeof CARD_THEMES.cyber) {
  const cellSize = 4, qrGrid = 18;
  ctx.fillStyle = thm.accent1 + '20'; roundRect(ctx, qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 8); ctx.fill();
  ctx.strokeStyle = thm.accent1 + '40'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 8); ctx.stroke();
  for (let r = 0; r < qrGrid; r++) {
    for (let c = 0; c < qrGrid; c++) {
      const isFinder = (r < 7 && c < 7) || (r < 7 && c >= qrGrid - 7) || (r >= qrGrid - 7 && c < 7);
      const isFinderBorder = isFinder && (r === 0 || r === 6 || c === 0 || c === 6 || r === qrGrid - 1 || r === qrGrid - 7 || c === qrGrid - 1 || c === qrGrid - 7);
      const isFinderCore = isFinder && r >= 2 && r <= 4 && c >= 2 && c <= 4;
      const hash = ((seed * (r + 1) * 31 + (c + 1) * 17) % 100);
      const filled = isFinder ? (isFinderBorder || isFinderCore || (r <= 6 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6))) : hash < 45;
      if (filled) { ctx.fillStyle = thm.accent1; ctx.fillRect(qrX + c * cellSize, qrY + r * cellSize, cellSize, cellSize); }
    }
  }
  ctx.fillStyle = thm.accent1 + '80'; ctx.font = `7px "Inter", sans-serif`;
  ctx.textAlign = 'start'; ctx.fillText('SCAN TO VIEW', qrX - 4, qrY + qrSize + 14);
}

function drawTags(ctx: CanvasRenderingContext2D, startX: number, y: number, tags: string[], fontSize: number, thm: typeof CARD_THEMES.cyber) {
  let tagX = startX;
  ctx.font = `${fontSize}px "Inter", sans-serif`;
  tags.forEach(tag => {
    const tw = ctx.measureText(tag).width + 16;
    ctx.fillStyle = thm.tagBg; roundRect(ctx, tagX, y, tw, 22, 11); ctx.fill();
    ctx.fillStyle = thm.tagText; ctx.fillText(tag, tagX + 8, y + 15);
    tagX += tw + 6;
  });
}

function drawHexRadar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, talents: CardRenderOpts['talents'], thm: typeof CARD_THEMES.cyber, showCap = false) {
  ctx.strokeStyle = thm.accent1 + '12'; ctx.lineWidth = 1;
  for (let ring = 1; ring <= 3; ring++) {
    const rr = r * (ring / 3);
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) { const a = (Math.PI / 3) * i - Math.PI / 2; i === 0 ? ctx.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)) : ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }
    ctx.stroke();
  }
  // Axis lines
  ctx.strokeStyle = thm.accent1 + '08';
  for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i - Math.PI / 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); ctx.stroke(); }
  // Filled shape
  ctx.fillStyle = thm.accent1 + '20'; ctx.strokeStyle = thm.accent1; ctx.lineWidth = 2;
  ctx.beginPath();
  talents.forEach((t, i) => { const a = (Math.PI / 3) * i - Math.PI / 2; const rr = r * (t.value / 100); i === 0 ? ctx.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)) : ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); });
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // Cap outline
  if (showCap) {
    ctx.strokeStyle = thm.accent2 + '40'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath();
    talents.forEach((t, i) => { const a = (Math.PI / 3) * i - Math.PI / 2; const rr = r * (t.cap / 100); i === 0 ? ctx.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)) : ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); });
    ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
  }
  // Dots & labels
  talents.forEach((t, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const rr = r * (t.value / 100);
    ctx.fillStyle = TALENT_COLORS[i]; ctx.beginPath(); ctx.arc(cx + rr * Math.cos(a), cy + rr * Math.sin(a), 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6b7280'; ctx.font = `10px "Inter", sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(t.label, cx + (r + 16) * Math.cos(a), cy + (r + 16) * Math.sin(a) + 4);
  });
  ctx.textAlign = 'start';
}

// ---- Portrait Layout (600×900) ----
function renderPortraitCard(ctx: CanvasRenderingContext2D, W: number, H: number, opts: CardRenderOpts) {
  const thm = CARD_THEMES[opts.theme || 'cyber'];
  drawCardBase(ctx, W, H, thm);
  drawPortraitBox(ctx, 30, 40, 200, 260, opts.typeIcon, thm);

  ctx.fillStyle = '#ffffff'; ctx.font = `bold ${Math.round(W * 0.047)}px "Space Grotesk", sans-serif`;
  ctx.fillText(opts.name || '???', 250, 80);
  ctx.fillStyle = thm.accent1; ctx.font = `${Math.round(W * 0.023)}px "Inter", sans-serif`;
  ctx.fillText(`${opts.typeIcon} ${opts.type}  •  ${opts.level}`, 250, 108);

  ctx.fillStyle = '#9ca3af'; ctx.font = `${Math.round(W * 0.02)}px "Inter", sans-serif`;
  wrapText(ctx, opts.bio || '...', W * 0.53).forEach((line, i) => ctx.fillText(line, 250, 140 + i * 18));

  ctx.fillStyle = thm.accent1; ctx.font = `bold ${Math.round(W * 0.018)}px "Inter", sans-serif`;
  ctx.fillText(`⚙ ${opts.workshop}`, 250, 220);

  drawTags(ctx, 250, 240, opts.tags, Math.round(W * 0.017), thm);

  ctx.fillStyle = '#9ca3af'; ctx.font = `bold ${Math.round(W * 0.02)}px "Inter", sans-serif`;
  ctx.fillText('TALENT MATRIX', 30, 314);
  const barMaxW = W * 0.567;
  opts.talents.forEach((t, i) => {
    const y = 330 + i * 36;
    ctx.fillStyle = '#9ca3af'; ctx.font = `${Math.round(W * 0.018)}px "Inter", sans-serif`; ctx.fillText(t.label, 30, y + 14);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; roundRect(ctx, 140, y, barMaxW, 20, 4); ctx.fill();
    const valW = Math.max(4, (t.value / 100) * barMaxW);
    ctx.fillStyle = TALENT_COLORS[i % TALENT_COLORS.length]; roundRect(ctx, 140, y, valW, 20, 4); ctx.fill();
    const capX = 140 + (t.cap / 100) * barMaxW;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(capX, y); ctx.lineTo(capX, y + 20); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = `bold ${Math.round(W * 0.018)}px "Inter", sans-serif`;
    ctx.fillText(`${t.value}/${t.cap}`, W * 0.817, y + 14);
  });

  const footY = H - 100;
  ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(0, footY, W, 100);
  ctx.strokeStyle = thm.accent1 + '26'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, footY); ctx.lineTo(W, footY); ctx.stroke();
  ctx.fillStyle = '#4b5563'; ctx.font = `${Math.round(W * 0.017)}px "Inter", sans-serif`;
  ctx.fillText('AI ARTIST INCUBATION PLATFORM', 30, footY + 30);
  ctx.fillText(`Generated ${new Date().toLocaleDateString()}`, 30, footY + 48);
  const seed = opts.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  drawQRCode(ctx, W - 90, footY + 12, 72, seed, thm);
}

// ---- Landscape Layout (900×500) ----
function renderLandscapeCard(ctx: CanvasRenderingContext2D, W: number, H: number, opts: CardRenderOpts) {
  const thm = CARD_THEMES[opts.theme || 'cyber'];
  drawCardBase(ctx, W, H, thm);

  // Left panel: portrait + info
  drawPortraitBox(ctx, 24, 24, 232, 280, opts.typeIcon, thm);

  ctx.fillStyle = '#ffffff'; ctx.font = `bold 22px "Space Grotesk", sans-serif`;
  ctx.textAlign = 'center'; ctx.fillText(opts.name || '???', 140, 330);
  ctx.fillStyle = thm.accent1; ctx.font = `13px "Inter", sans-serif`;
  ctx.fillText(`${opts.typeIcon} ${opts.type}  •  ${opts.level}`, 140, 350);
  ctx.textAlign = 'start';

  ctx.fillStyle = '#9ca3af'; ctx.font = `11px "Inter", sans-serif`;
  wrapText(ctx, opts.bio || '...', 230).slice(0, 2).forEach((line, i) => { ctx.textAlign = 'center'; ctx.fillText(line, 140, 372 + i * 15); });
  ctx.textAlign = 'start';

  ctx.fillStyle = thm.accent1; ctx.font = `bold 10px "Inter", sans-serif`;
  const wsText = `⚙ ${opts.workshop}`;
  const wsW = ctx.measureText(wsText).width + 16;
  ctx.fillStyle = thm.accent1 + '15'; roundRect(ctx, 140 - wsW / 2, 405, wsW, 20, 10); ctx.fill();
  ctx.fillStyle = thm.accent1; ctx.fillText(wsText, 140 - wsW / 2 + 8, 418);

  drawTags(ctx, 24, 435, opts.tags.slice(0, 3), 10, thm);

  // Divider
  ctx.strokeStyle = thm.accent1 + '20'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(280, 20); ctx.lineTo(280, H - 20); ctx.stroke();

  // Right: talent bars
  const rightX = 300;
  ctx.fillStyle = '#9ca3af'; ctx.font = `bold 13px "Inter", sans-serif`;
  ctx.fillText('TALENT MATRIX', rightX, 44);

  const barMaxW = W - rightX - 130;
  opts.talents.forEach((t, i) => {
    const y = 60 + i * 34;
    ctx.fillStyle = '#9ca3af'; ctx.font = `12px "Inter", sans-serif`; ctx.fillText(t.label, rightX, y + 13);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; roundRect(ctx, rightX + 90, y, barMaxW, 18, 4); ctx.fill();
    const valW = Math.max(4, (t.value / 100) * barMaxW);
    ctx.fillStyle = TALENT_COLORS[i % TALENT_COLORS.length]; roundRect(ctx, rightX + 90, y, valW, 18, 4); ctx.fill();
    const capX = rightX + 90 + (t.cap / 100) * barMaxW;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(capX, y); ctx.lineTo(capX, y + 18); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 12px "Inter", sans-serif`;
    ctx.fillText(`${t.value}/${t.cap}`, W - 60, y + 13);
  });

  // Mini hexagonal radar
  drawHexRadar(ctx, rightX + (W - rightX) / 2, 335, 65, opts.talents, thm, false);

  // Footer strip
  const footY = H - 50;
  ctx.fillStyle = 'rgba(255,255,255,0.02)'; ctx.fillRect(0, footY, W, 50);
  ctx.strokeStyle = thm.accent1 + '15'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, footY); ctx.lineTo(W, footY); ctx.stroke();
  ctx.fillStyle = '#4b5563'; ctx.font = `10px "Inter", sans-serif`;
  ctx.fillText('AI ARTIST INCUBATION PLATFORM', 24, footY + 22);
  ctx.fillText(`Generated ${new Date().toLocaleDateString()}`, 24, footY + 36);
  const seed = opts.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  drawQRCode(ctx, W - 85, footY - 30, 60, seed, thm);
}

// ---- Square Layout (600×600) ----
function renderSquareCard(ctx: CanvasRenderingContext2D, W: number, H: number, opts: CardRenderOpts) {
  const thm = CARD_THEMES[opts.theme || 'cyber'];
  drawCardBase(ctx, W, H, thm);

  // Circular avatar
  const avatarR = 50, avatarCX = 70, avatarCY = 70;
  ctx.fillStyle = thm.accent1 + '15';
  ctx.beginPath(); ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = thm.accent1 + '40'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = thm.accent1 + '60'; ctx.font = `36px sans-serif`;
  ctx.textAlign = 'center'; ctx.fillText(opts.typeIcon, avatarCX, avatarCY + 12); ctx.textAlign = 'start';

  ctx.fillStyle = '#ffffff'; ctx.font = `bold 26px "Space Grotesk", sans-serif`;
  ctx.fillText(opts.name || '???', 140, 55);
  ctx.fillStyle = thm.accent1; ctx.font = `13px "Inter", sans-serif`;
  ctx.fillText(`${opts.typeIcon} ${opts.type}  •  ${opts.level}`, 140, 76);

  ctx.fillStyle = '#9ca3af'; ctx.font = `11px "Inter", sans-serif`;
  wrapText(ctx, opts.bio || '...', W - 160).slice(0, 2).forEach((line, i) => ctx.fillText(line, 140, 96 + i * 15));

  ctx.fillStyle = thm.accent1; ctx.font = `bold 10px "Inter", sans-serif`;
  ctx.fillText(`⚙ ${opts.workshop}`, 140, 130);

  // Accent line
  const accentGrad = ctx.createLinearGradient(30, 0, W - 30, 0);
  accentGrad.addColorStop(0, thm.accent1 + '40'); accentGrad.addColorStop(0.5, thm.accent2 + '40'); accentGrad.addColorStop(1, 'transparent');
  ctx.strokeStyle = accentGrad; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(30, 150); ctx.lineTo(W - 30, 150); ctx.stroke();

  drawTags(ctx, 30, 162, opts.tags, 10, thm);

  // Talent bars - two columns
  ctx.fillStyle = '#9ca3af'; ctx.font = `bold 12px "Inter", sans-serif`;
  ctx.fillText('TALENT MATRIX', 30, 208);

  const col1X = 30, col2X = W / 2 + 10;
  const barMaxW = W / 2 - 80;
  opts.talents.forEach((t, i) => {
    const isRight = i >= 3;
    const bx = isRight ? col2X : col1X;
    const by = 222 + (i % 3) * 40;

    ctx.fillStyle = '#9ca3af'; ctx.font = `10px "Inter", sans-serif`;
    ctx.fillText(t.label, bx, by + 10);
    const barY = by + 16;
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; roundRect(ctx, bx, barY, barMaxW, 14, 3); ctx.fill();
    const valW = Math.max(3, (t.value / 100) * barMaxW);
    ctx.fillStyle = TALENT_COLORS[i % TALENT_COLORS.length]; roundRect(ctx, bx, barY, valW, 14, 3); ctx.fill();
    const capX = bx + (t.cap / 100) * barMaxW;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(capX, barY); ctx.lineTo(capX, barY + 14); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 10px "Inter", sans-serif`;
    ctx.fillText(`${t.value}/${t.cap}`, bx + barMaxW + 6, barY + 11);
  });

  // Hex radar
  drawHexRadar(ctx, W / 2, 440, 80, opts.talents, thm, true);

  // Footer
  const footY = H - 55;
  ctx.fillStyle = 'rgba(255,255,255,0.02)'; ctx.fillRect(0, footY, W, 55);
  ctx.strokeStyle = thm.accent1 + '15'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, footY); ctx.lineTo(W, footY); ctx.stroke();
  ctx.fillStyle = '#4b5563'; ctx.font = `9px "Inter", sans-serif`;
  ctx.fillText('AI ARTIST INCUBATION PLATFORM', 30, footY + 20);
  ctx.fillText(`Generated ${new Date().toLocaleDateString()}`, 30, footY + 34);
  const seed = opts.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  drawQRCode(ctx, W - 82, footY - 25, 56, seed, thm);
}

/** Logo image cache for sync watermark rendering */
const _logoCache: { url: string | null; img: HTMLImageElement | null } = { url: null, img: null };
function getCachedLogo(url: string | null): HTMLImageElement | null {
  if (!url) return null;
  if (_logoCache.url === url && _logoCache.img?.complete) return _logoCache.img;
  if (_logoCache.url !== url) {
    const img = new Image();
    img.src = url;
    _logoCache.url = url;
    _logoCache.img = img;
  }
  return _logoCache.img?.complete ? _logoCache.img : null;
}

/** Get watermark anchor position */
function wmPos(W: number, H: number, pos: string, size: number): [number, number] {
  const pad = 16;
  const half = size / 2;
  const map: Record<string, [number, number]> = {
    tl: [pad, pad], tc: [W / 2 - half, pad], tr: [W - pad - size, pad],
    cl: [pad, H / 2 - half], cc: [W / 2 - half, H / 2 - half], cr: [W - pad - size, H / 2 - half],
    bl: [pad, H - pad - size], bc: [W / 2 - half, H - pad - size], br: [W - pad - size, H - pad - size],
  };
  return map[pos] || map.br;
}

/** Draw watermark overlay */
function drawWatermark(ctx: CanvasRenderingContext2D, W: number, H: number, wm: WatermarkConfig) {
  if (!wm.enabled) return;
  const isLogo = wm.mode === 'logo';
  const logoImg = isLogo ? getCachedLogo(wm.logoUrl) : null;
  if (isLogo && !logoImg) return; // logo not loaded yet
  if (!isLogo && !wm.text.trim()) return;

  ctx.save();
  ctx.globalAlpha = wm.opacity / 100;
  const rad = (wm.rotation * Math.PI) / 180;

  if (wm.tiled) {
    if (isLogo && logoImg) {
      const s = wm.logoSize;
      const stepX = s + 60; const stepY = s + 40;
      for (let y = -H; y < H * 2; y += stepY) {
        for (let x = -W; x < W * 2; x += stepX) {
          ctx.save(); ctx.translate(x, y); ctx.rotate(rad);
          ctx.drawImage(logoImg, 0, 0, s, s); ctx.restore();
        }
      }
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${wm.fontSize}px "Inter", sans-serif`;
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(wm.text).width;
      const stepX = tw + 60; const stepY = wm.fontSize * 3;
      for (let y = -H; y < H * 2; y += stepY) {
        for (let x = -W; x < W * 2; x += stepX) {
          ctx.save(); ctx.translate(x, y); ctx.rotate(rad);
          ctx.fillText(wm.text, 0, 0); ctx.restore();
        }
      }
    }
  } else {
    if (isLogo && logoImg) {
      const s = wm.logoSize;
      const [px, py] = wmPos(W, H, wm.position, s);
      ctx.translate(px + s / 2, py + s / 2); ctx.rotate(rad);
      ctx.drawImage(logoImg, -s / 2, -s / 2, s, s);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${wm.fontSize}px "Inter", sans-serif`;
      ctx.textBaseline = 'middle';
      const pad = 20;
      const posMap: Record<string, [number, number, CanvasTextAlign]> = {
        tl: [pad, pad + wm.fontSize / 2, 'left'], tc: [W / 2, pad + wm.fontSize / 2, 'center'], tr: [W - pad, pad + wm.fontSize / 2, 'right'],
        cl: [pad, H / 2, 'left'], cc: [W / 2, H / 2, 'center'], cr: [W - pad, H / 2, 'right'],
        bl: [pad, H - pad - wm.fontSize / 2, 'left'], bc: [W / 2, H - pad - wm.fontSize / 2, 'center'], br: [W - pad, H - pad - wm.fontSize / 2, 'right'],
      };
      const [px, py, align] = posMap[wm.position] || posMap.br;
      ctx.textAlign = align;
      ctx.translate(px, py); ctx.rotate(rad);
      ctx.fillText(wm.text, 0, 0);
    }
  }
  ctx.restore();
}

/** Renders the card — dispatches to layout-specific renderer */
function renderCardSync(ctx: CanvasRenderingContext2D, W: number, H: number, opts: CardRenderOpts) {
  const layout = opts.layout || 'portrait';
  if (layout === 'landscape') renderLandscapeCard(ctx, W, H, opts);
  else if (layout === 'square') renderSquareCard(ctx, W, H, opts);
  else renderPortraitCard(ctx, W, H, opts);
  // Watermark overlay (always last)
  if (opts.watermark) drawWatermark(ctx, W, H, opts.watermark);
}

type ExportFormat = 'png' | 'webp' | 'jpeg';
const EXPORT_FORMATS: Record<ExportFormat, { label: string; mime: string; ext: string; quality?: number }> = {
  png:  { label: 'PNG', mime: 'image/png', ext: 'png' },
  webp: { label: 'WebP', mime: 'image/webp', ext: 'webp', quality: 0.92 },
  jpeg: { label: 'JPEG', mime: 'image/jpeg', ext: 'jpg', quality: 0.95 },
};

/** Full export with image loading */
async function exportArtistCard(opts: CardRenderOpts, format: ExportFormat = 'png'): Promise<void> {
  const thm = CARD_THEMES[opts.theme || 'cyber'];
  const layoutDims = CARD_LAYOUTS[opts.layout || 'portrait'];
  const W = layoutDims.w, H = layoutDims.h;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Render base
  renderCardSync(ctx, W, H, opts);

  // Overlay real image if available
  if (opts.imageUrl) {
    try {
      const img = new Image(); img.crossOrigin = 'anonymous';
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = opts.imageUrl!; });
      const layout = opts.layout || 'portrait';
      let px: number, py: number, pw: number, ph: number;
      if (layout === 'landscape') { px = 24; py = 24; pw = 232; ph = 280; }
      else if (layout === 'square') { px = 20; py = 20; pw = 100; ph = 100; }
      else { px = 30; py = 40; pw = 200; ph = 260; }
      ctx.save();
      if (layout === 'square') {
        ctx.beginPath(); ctx.arc(px + pw / 2, py + ph / 2, 50, 0, Math.PI * 2); ctx.clip();
      } else {
        ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 16); ctx.clip();
      }
      ctx.drawImage(img, px, py, pw, ph);
      ctx.restore();
      ctx.strokeStyle = thm.accent1 + '66'; ctx.lineWidth = 2;
      if (layout === 'square') {
        ctx.beginPath(); ctx.arc(px + pw / 2, py + ph / 2, 50, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 16); ctx.stroke();
      }
    } catch { /* skip */ }
  }

  const fmt = EXPORT_FORMATS[format];
  const link = document.createElement('a');
  link.download = `${opts.name || 'artist'}-card.${fmt.ext}`;
  link.href = canvas.toDataURL(fmt.mime, fmt.quality);
  link.click();
}

/** Scanline + particle animation overlay */
function drawScanlineEffect(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, thm: typeof CARD_THEMES.cyber) {
  // Moving scanline
  const scanY = (time * 0.4) % (H + 40) - 20;
  const scanGrad = ctx.createLinearGradient(0, scanY - 20, 0, scanY + 20);
  scanGrad.addColorStop(0, 'transparent');
  scanGrad.addColorStop(0.5, thm.accent1 + '18');
  scanGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = scanGrad; ctx.fillRect(0, scanY - 20, W, 40);

  // Horizontal scan lines (CRT effect)
  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  for (let y = 0; y < H; y += 4) { ctx.fillRect(0, y, W, 1); }

  // Floating particles
  const seed = Math.floor(time / 16);
  ctx.fillStyle = thm.accent1 + '30';
  for (let i = 0; i < 12; i++) {
    const px = ((seed * 7 + i * 137) % W);
    const py = ((seed * 3 + i * 89 + Math.sin(time * 0.01 + i) * 30) % H);
    const size = 1 + (i % 3);
    ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill();
  }

  // Corner glitch blocks
  const glitchPhase = Math.floor(time / 200) % 8;
  if (glitchPhase < 2) {
    ctx.fillStyle = thm.accent1 + '10';
    const gx = (glitchPhase * 73 + seed * 11) % (W - 60);
    const gy = (glitchPhase * 47 + seed * 7) % (H - 10);
    ctx.fillRect(gx, gy, 40 + (seed % 30), 3);
  }

  // Edge glow pulse
  const pulse = Math.sin(time * 0.003) * 0.5 + 0.5;
  const edgeGrad = ctx.createLinearGradient(0, 0, 8, 0);
  edgeGrad.addColorStop(0, thm.accent1 + Math.round(pulse * 20).toString(16).padStart(2, '0'));
  edgeGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = edgeGrad; ctx.fillRect(0, 0, 8, H);
  const edgeGradR = ctx.createLinearGradient(W, 0, W - 8, 0);
  edgeGradR.addColorStop(0, thm.accent2 + Math.round(pulse * 20).toString(16).padStart(2, '0'));
  edgeGradR.addColorStop(1, 'transparent');
  ctx.fillStyle = edgeGradR; ctx.fillRect(W - 8, 0, 8, H);
}

/** Live mini canvas preview component with optional animation */
const CardPreviewCanvas = ({ opts, width = 180, animated = false }: { opts: CardRenderOpts; width?: number; animated?: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const layoutDims = CARD_LAYOUTS[opts.layout || 'portrait'];
  const W = layoutDims.w, H = layoutDims.h;
  const scale = width / W;
  const displayH = H * scale;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W; canvas.height = H;

    if (animated) {
      const thm = CARD_THEMES[opts.theme || 'cyber'];
      let startTime = performance.now();
      const tick = (now: number) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        renderCardSync(ctx, W, H, opts);
        drawScanlineEffect(ctx, W, H, now - startTime, thm);
        animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(animRef.current);
    } else {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      renderCardSync(ctx, W, H, opts);
    }
  }, [opts.theme, opts.layout, opts.name, opts.type, opts.bio, animated, JSON.stringify(opts.talents), JSON.stringify(opts.tags), JSON.stringify(opts.watermark)]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${Math.round(displayH)}px` }}
      className="rounded-lg border border-white/10 shadow-lg"
    />
  );
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(''); const lines: string[] = []; let cur = '';
  for (const w of words) {
    if (ctx.measureText(cur + w).width > maxW) { lines.push(cur); cur = w; } else { cur += w; }
    if (lines.length >= 3) break;
  }
  if (cur) lines.push(cur);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}

interface WizardState {
  name: string;
  type: ArtistType;
  bio: string;
  // ── Identity Builder (Plan C) ──
  designStyle: DesignStyle;
  profession: ProfessionBackground | null;
  initialTagIds: string[];
  // Appearance
  faceStyle: string;
  fashionStyle: string;
  age: number;
  height: number;
  bodyType: string;
  hairColor: string;
  // Personality / Emotion Spectrum
  sweetness: number;
  energy: number;
  mystery: number;
  confidence: number;
  extraPersona: number;
  mbti: string;
  emotionJoy: number;
  emotionIntensity: number;
  emotionWarmth: number;
  emotionEdge: number;
  speakingStyle: string[];
  personaTags: string[];
  // Vocal & Special Traits
  vocalRange: string;
  timbreTags: string[];
  primaryGenre: string;
  // Talents & Skill Tree
  talents: TalentProfile;
  subSkillPoints: Record<string, number>;
  // Fan Business
  supportColor: string;
  commercialExclusions: string[];
  fanAgeRange: string;
  fanGenderRatio: number;
  fanRegions: string[];
}

const INITIAL_STATE: WizardState = {
  name: '', type: 'singer', bio: '',
  // Identity Builder defaults
  designStyle: 'cyber_mecha',
  profession: null,
  initialTagIds: [],
  faceStyle: 'sweet', fashionStyle: 'modern', age: 20, height: 168,
  bodyType: '纤细', hairColor: '黑色',
  sweetness: 50, energy: 60, mystery: 40, confidence: 70, extraPersona: 50,
  mbti: '',
  emotionJoy: 60, emotionIntensity: 55, emotionWarmth: 65, emotionEdge: 40,
  speakingStyle: [], personaTags: [],
  vocalRange: '', timbreTags: [], primaryGenre: '',
  talents: { ...ARTIST_TYPE_CONFIG.singer.initialTalents },
  subSkillPoints: {},
  supportColor: '#06b6d4',
  commercialExclusions: [],
  fanAgeRange: '18-24', fanGenderRatio: 30, fanRegions: [],
};

const TEMPLATES: { id: string; type: ArtistType; zh: string; en: string; color: string }[] = [
  { id: 'cute', type: 'idol', zh: '甜美偶像', en: 'Cute Idol', color: 'border-pink-500/30 hover:border-pink-400/60' },
  { id: 'cool', type: 'singer', zh: '酷炫歌手', en: 'Cool Singer', color: 'border-cyan-500/30 hover:border-cyan-400/60' },
  { id: 'elegant', type: 'actor', zh: '优雅演员', en: 'Elegant Actor', color: 'border-purple-500/30 hover:border-purple-400/60' },
  { id: 'energetic', type: 'entertainer', zh: '活力综艺', en: 'Energetic Host', color: 'border-amber-500/30 hover:border-amber-400/60' },
  { id: 'mysterious', type: 'dancer', zh: '神秘舞者', en: 'Mysterious Dancer', color: 'border-green-500/30 hover:border-green-400/60' },
  { id: 'custom', type: 'singer', zh: '自定义', en: 'Custom', color: 'border-white/10 hover:border-white/30' },
];

const FACE_STYLES = [
  { id: 'sweet', zh: '甜美', en: 'Sweet' },
  { id: 'cool', zh: '酷帅', en: 'Cool' },
  { id: 'elegant', zh: '优雅', en: 'Elegant' },
  { id: 'cute', zh: '可爱', en: 'Cute' },
  { id: 'sharp', zh: '凌厉', en: 'Sharp' },
  { id: 'soft', zh: '温柔', en: 'Soft' },
];

const FASHION_STYLES = [
  { id: 'modern', zh: '现代潮流', en: 'Modern' },
  { id: 'retro', zh: '复古', en: 'Retro' },
  { id: 'cyberpunk', zh: '赛博朋克', en: 'Cyberpunk' },
  { id: 'casual', zh: '休闲', en: 'Casual' },
  { id: 'formal', zh: '正式', en: 'Formal' },
  { id: 'sporty', zh: '运动', en: 'Sporty' },
];

/* Slider component */
const ParamSlider = ({ label, value, onChange, color = 'cyan' }: { label: string; value: number; onChange: (v: number) => void; color?: string }) => (
  <div className="space-y-0.5">
    <div className="flex justify-between text-[10px]">
      <span className="text-gray-400">{label}</span>
      <span className={`font-semibold text-${color}-400`}>{value}</span>
    </div>
    <input type="range" min={0} max={100} value={value} onChange={e => onChange(+e.target.value)}
      className="w-full h-1 bg-gray-800 rounded-full appearance-none cursor-pointer accent-cyan-500
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-900 [&::-webkit-slider-thumb]:shadow" />
  </div>
);

export const IncubationWizard = ({ lang, onClose, onCreated, initialStep = 0, solutionId }: { lang: Lang; onClose: () => void; onCreated: () => void; initialStep?: number; solutionId?: SolutionId }) => {
  const zh = lang === 'zh';
  const t = TRANSLATIONS[lang].producer.incubator;
  const [step, setStep] = useState(initialStep);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  // Draft persistence
  const [pendingDraft, setPendingDraft] = useState<WizardDraft | null>(() => loadDraft());
  const [showDraftBanner, setShowDraftBanner] = useState(true);
  // IP template carried in from the homepage (solution, content modes, engines).
  const [ipPreset, setIpPreset] = useState<SolutionPreset>(() => {
    const stored = readStoredPreset();
    if (stored && (!solutionId || stored.solutionId === solutionId)) return stored;
    return getPresetForSolution(solutionId ?? 'ecosystem');
  });
  const applyTemplateDefaults = (preset: SolutionPreset) =>
    setState(s => ({ ...s, ...SOLUTION_WIZARD_DEFAULTS[preset.solutionId] }));
  const handlePresetChange = (next: SolutionPreset) => {
    const switched = next.solutionId !== ipPreset.solutionId;
    setIpPreset(next);
    writeStoredPreset(next);
    if (switched) applyTemplateDefaults(next);
  };
  // A fresh wizard (no draft to resume) starts from the template's identity defaults.
  useEffect(() => {
    if (!pendingDraft) applyTemplateDefaults(ipPreset);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [draftSavedFlash, setDraftSavedFlash] = useState(false);
  const [showCeremony, setShowCeremony] = useState(false);
  const [gachaRarity, setGachaRarity] = useState<GachaRarity>('N');
  const [gachaFlash, setGachaFlash] = useState(false);
  const [forgeResult, setForgeResult] = useState<ForgeResultData | null>(null);
  const [boostApplied, setBoostApplied] = useState(false);
  const [preBoostTalents, setPreBoostTalents] = useState<TalentProfile | null>(null);
  const [cardTheme, setCardTheme] = useState<CardTheme>('cyber');
  const [customColors, setCustomColors] = useState({ c1: '#ff6b6b', c2: '#4ecdc4' });
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [cardLayout, setCardLayout] = useState<CardLayout>('portrait');
  const [showShareModal, setShowShareModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [animatedPreview, setAnimatedPreview] = useState(false);
  const [showBatchExport, setShowBatchExport] = useState(false);
  const [batchThemes, setBatchThemes] = useState<Set<CardTheme>>(new Set(['cyber']));
  const [batchLayouts, setBatchLayouts] = useState<Set<CardLayout>>(new Set(['portrait']));
  const [batchProgress, setBatchProgress] = useState<{ total: number; done: number; active: boolean }>({ total: 0, done: 0, active: false });

  const toggleBatchTheme = (t: CardTheme) => setBatchThemes(s => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; });
  const toggleBatchLayout = (l: CardLayout) => setBatchLayouts(s => { const n = new Set(s); n.has(l) ? n.delete(l) : n.add(l); return n; });

  const [watermark, setWatermark] = useState<WatermarkConfig>({ ...DEFAULT_WATERMARK });
  const updateWM = (patch: Partial<WatermarkConfig>) => setWatermark(w => ({ ...w, ...patch }));
  const logoInputRef = useRef<HTMLInputElement>(null);
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateWM({ logoUrl: reader.result as string, mode: 'logo' });
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  const [batchMode, setBatchMode] = useState<'zip' | 'individual'>('zip');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [showTemplateLib, setShowTemplateLib] = useState(false);
  const [templateCat, setTemplateCat] = useState<'all' | 'debut' | 'social' | 'promo' | 'event'>('all');
  const filteredPresets = templateCat === 'all' ? CARD_PRESETS : CARD_PRESETS.filter(p => p.category === templateCat);
  const applyTemplate = (preset: CardPreset) => {
    setCardTheme(preset.theme);
    setCardLayout(preset.layout);
    if (preset.watermark) setWatermark(w => ({ ...w, ...preset.watermark }));
    setTplUsage(prev => ({ ...prev, [preset.id]: { count: (prev[preset.id]?.count || 0) + 1, lastUsed: Date.now() } }));
    setShowTemplateLib(false);
  };

  // ---- Custom Templates + Favorites (localStorage persisted) ----
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(() => {
    try { const v = localStorage.getItem(CUSTOM_TPL_LS_KEY); return v ? JSON.parse(v) : []; } catch { return []; }
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { const v = localStorage.getItem(FAVORITE_LS_KEY); return v ? JSON.parse(v) : []; } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem(CUSTOM_TPL_LS_KEY, JSON.stringify(customTemplates)); } catch {} }, [customTemplates]);
  useEffect(() => { try { localStorage.setItem(FAVORITE_LS_KEY, JSON.stringify(favorites)); } catch {} }, [favorites]);
  const toggleFavorite = (id: string) => setFavorites(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // ---- Template usage tracking + sort mode ----
  const [tplUsage, setTplUsage] = useState<Record<string, TplUsage>>(() => {
    try { const v = localStorage.getItem(USAGE_LS_KEY); return v ? JSON.parse(v) : {}; } catch { return {}; }
  });
  useEffect(() => { try { localStorage.setItem(USAGE_LS_KEY, JSON.stringify(tplUsage)); } catch {} }, [tplUsage]);
  const recordUsage = (id: string) => setTplUsage(prev => ({
    ...prev, [id]: { count: (prev[id]?.count || 0) + 1, lastUsed: Date.now() }
  }));
  const resetUsage = () => setTplUsage({});
  const [tplSort, setTplSort] = useState<TplSortMode>('default');
  const sortPresets = <T extends { id: string }>(list: T[]): T[] => {
    if (tplSort === 'default') return list;
    return [...list].sort((a, b) => {
      const ua = tplUsage[a.id], ub = tplUsage[b.id];
      if (tplSort === 'most_used') return (ub?.count || 0) - (ua?.count || 0);
      return (ub?.lastUsed || 0) - (ua?.lastUsed || 0);
    });
  };
  const totalUsage = Object.values(tplUsage).reduce((s, u) => s + u.count, 0);

  // ---- Smart Recommendations ----
  const [showRecs, setShowRecs] = useState(true);
  const recommendations = (() => {
    const now = Date.now();
    const DAY = 86400000;
    const scored: { preset: CardPreset; score: number; reasons: string[] }[] = [];
    for (const preset of CARD_PRESETS) {
      let score = 0;
      const reasons: string[] = [];
      const u = tplUsage[preset.id];
      if (u?.count) { score += Math.min(u.count, 10) * 8; reasons.push(zh ? `用过${u.count}次` : `${u.count}× used`); }
      if (u?.lastUsed) {
        const days = (now - u.lastUsed) / DAY;
        const recencyBoost = Math.max(0, 30 - days);
        score += recencyBoost;
        if (days < 1) reasons.push(zh ? '最近使用' : 'Recent');
      }
      if (favorites.includes(preset.id)) { score += 25; reasons.push(zh ? '已收藏' : 'Favorite'); }
      if (preset.theme === cardTheme) { score += 12; reasons.push(zh ? '主题匹配' : 'Theme match'); }
      if (preset.layout === cardLayout) { score += 8; reasons.push(zh ? '版式匹配' : 'Layout match'); }
      if (cardTheme === preset.theme && cardLayout === preset.layout) score -= 50; // demote already-active
      if (score > 0) scored.push({ preset, score, reasons });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, 4);
  })();
  const [showSaveTplDialog, setShowSaveTplDialog] = useState(false);
  const [newTplName, setNewTplName] = useState('');
  const [newTplCat, setNewTplCat] = useState<CustomTemplate['category']>('debut');
  const saveCustomTemplate = () => {
    const name = newTplName.trim() || `${CARD_THEMES[cardTheme].en} ${cardLayout}`;
    const tpl: CustomTemplate = {
      id: crypto.randomUUID(), ts: Date.now(), name,
      emoji: CATEGORY_EMOJI[newTplCat], category: newTplCat,
      theme: cardTheme, layout: cardLayout,
      watermark: { ...watermark, logoUrl: null },
    };
    setCustomTemplates(prev => [tpl, ...prev].slice(0, MAX_CUSTOM_TEMPLATES));
    setNewTplName(''); setShowSaveTplDialog(false);
  };
  const deleteCustomTemplate = (id: string) => setCustomTemplates(prev => prev.filter(t => t.id !== id));
  const cloneCustomTemplate = (tpl: CustomTemplate) => {
    const copy: CustomTemplate = { ...tpl, id: crypto.randomUUID(), ts: Date.now(), name: `${tpl.name} (${zh ? '副本' : 'copy'})` };
    setCustomTemplates(prev => [copy, ...prev].slice(0, MAX_CUSTOM_TEMPLATES));
  };
  const renameCustomTemplate = (id: string, name: string) => {
    setCustomTemplates(prev => prev.map(t => t.id === id ? { ...t, name } : t));
  };
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tpl: CustomTemplate } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingDraft, setRenamingDraft] = useState('');
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); };
  }, [ctxMenu]);
  const applyCustomTemplate = (tpl: CustomTemplate) => {
    setCardTheme(tpl.theme); setCardLayout(tpl.layout);
    setWatermark(w => ({ ...tpl.watermark, logoUrl: w.logoUrl }));
    setTplUsage(prev => ({ ...prev, [tpl.id]: { count: (prev[tpl.id]?.count || 0) + 1, lastUsed: Date.now() } }));
    setShowTemplateLib(false);
  };
  // ---- Search ----
  const tplSearchRef = useRef<HTMLInputElement>(null);
  const [tplSearch, setTplSearch] = useState('');
  const [focusIdx, setFocusIdx] = useState(-1);
  const tplQuery = tplSearch.trim().toLowerCase();
  const matchPreset = (p: CardPreset): boolean => {
    if (!tplQuery) return true;
    const haystack = [p.zh, p.en, p.desc_zh, p.desc_en, p.theme, p.layout, CARD_THEMES[p.theme].zh, CARD_THEMES[p.theme].en].join(' ').toLowerCase();
    return haystack.includes(tplQuery);
  };
  const matchCustom = (t: CustomTemplate): boolean => {
    if (!tplQuery) return true;
    const haystack = [t.name, t.theme, t.layout, t.category, CARD_THEMES[t.theme].zh, CARD_THEMES[t.theme].en].join(' ').toLowerCase();
    return haystack.includes(tplQuery);
  };
  const Highlight = ({ text }: { text: string }) => {
    if (!tplQuery) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(tplQuery);
    if (idx < 0) return <>{text}</>;
    return <>{text.slice(0, idx)}<mark className="bg-cyan-500/30 text-cyan-200 rounded-sm px-0.5">{text.slice(idx, idx + tplQuery.length)}</mark>{text.slice(idx + tplQuery.length)}</>;
  };
  const filteredCustom = (templateCat === 'all' ? customTemplates : customTemplates.filter(t => t.category === templateCat)).filter(matchCustom);
  const favoritePresets = templateCat === 'all'
    ? CARD_PRESETS.filter(p => favorites.includes(p.id))
    : CARD_PRESETS.filter(p => favorites.includes(p.id) && p.category === templateCat);

  // ---- Keyboard Shortcuts (template library) ----
  // Compute focused key (used for visual ring) - flat list: custom → favorites → built-in
  const _flatNavForFocus = [
    ...sortPresets(filteredCustom).map(tpl => `custom:${tpl.id}`),
    ...sortPresets(favoritePresets.filter(matchPreset)).map(p => `fav:${p.id}`),
    ...sortPresets(filteredPresets.filter(matchPreset)).map(p => `preset:${p.id}`),
  ];
  const focusedKey = focusIdx >= 0 && focusIdx < _flatNavForFocus.length ? _flatNavForFocus[focusIdx] : null;
  useEffect(() => {
    if (!focusedKey || !showTemplateLib) return;
    const el = document.querySelector(`[data-tpl-key="${focusedKey}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [focusedKey, showTemplateLib]);
  useEffect(() => {
    if (!showTemplateLib) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA';
      // Esc: clear search → close modal
      if (e.key === 'Escape') {
        if (tplSearch) { setTplSearch(''); setFocusIdx(-1); e.preventDefault(); return; }
        setShowTemplateLib(false); e.preventDefault(); return;
      }
      // / focus search
      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        tplSearchRef.current?.focus();
        tplSearchRef.current?.select();
        return;
      }
      // 1-5 category switch (only when not typing)
      if (!isTyping && /^[1-5]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const cat = PRESET_CATEGORIES[idx];
        if (cat) { setTemplateCat(cat.id); setFocusIdx(-1); e.preventDefault(); }
        return;
      }
      // Build flat nav list at handler time (always fresh)
      const customs = filteredCustom;
      const favs = favoritePresets.filter(matchPreset);
      const builtIns = sortPresets(filteredPresets.filter(matchPreset));
      const flat = [
        ...customs.map(tpl => ({ kind: 'custom' as const, tpl })),
        ...favs.map(preset => ({ kind: 'preset' as const, preset })),
        ...builtIns.map(preset => ({ kind: 'preset' as const, preset })),
      ];
      if (flat.length === 0) return;
      const cols = 2;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        let i = focusIdx < 0 ? 0 : focusIdx;
        if (e.key === 'ArrowDown') i = Math.min(flat.length - 1, i + cols);
        if (e.key === 'ArrowUp') i = Math.max(0, i - cols);
        if (e.key === 'ArrowRight') i = Math.min(flat.length - 1, i + 1);
        if (e.key === 'ArrowLeft') i = Math.max(0, i - 1);
        setFocusIdx(i);
        return;
      }
      if (e.key === 'Enter' && focusIdx >= 0 && focusIdx < flat.length) {
        e.preventDefault();
        const item = flat[focusIdx];
        if (item.kind === 'custom') applyCustomTemplate(item.tpl);
        else applyTemplate(item.preset);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showTemplateLib, tplSearch, focusIdx, templateCat, customTemplates, favorites, tplSort, tplUsage, cardTheme, cardLayout]);

  // ---- Custom Template Import / Export ----
  const tplImportRef = useRef<HTMLInputElement>(null);
  const [importToast, setImportToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const showToast = (type: 'success' | 'error', msg: string) => {
    setImportToast({ type, msg });
    setTimeout(() => setImportToast(null), 2800);
  };
  const exportCustomTemplate = (tpl: CustomTemplate) => {
    const data = { kind: 'incubator-custom-template', version: 1, templates: [tpl] };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `tpl-${tpl.name.replace(/\s+/g, '-')}-${tpl.id.slice(0, 6)}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const exportAllCustomTemplates = () => {
    if (customTemplates.length === 0) { showToast('error', zh ? '暂无自定义模板可导出' : 'No custom templates to export'); return; }
    const data = { kind: 'incubator-custom-template', version: 1, exportedAt: Date.now(), templates: customTemplates };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `custom-templates-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast('success', zh ? `已导出 ${customTemplates.length} 个模板` : `Exported ${customTemplates.length} templates`);
  };
  const isValidCustomTpl = (t: any): t is CustomTemplate =>
    !!t && typeof t.id === 'string' && typeof t.name === 'string'
    && CARD_THEMES[t.theme as CardTheme] && CARD_LAYOUTS[t.layout as CardLayout]
    && ['debut', 'social', 'promo', 'event'].includes(t.category)
    && t.watermark && typeof t.watermark === 'object';
  const importCustomTemplates = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const incoming: any[] = Array.isArray(data) ? data : Array.isArray(data.templates) ? data.templates : [data];
        const valid = incoming.filter(isValidCustomTpl);
        if (valid.length === 0) { showToast('error', zh ? '未找到有效模板数据' : 'No valid template data found'); return; }
        setCustomTemplates(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const fresh = valid
            .map((t: CustomTemplate): CustomTemplate => existingIds.has(t.id)
              ? { ...t, id: crypto.randomUUID(), ts: Date.now() }
              : { ...t, ts: t.ts || Date.now() })
            .map(t => ({ ...t, watermark: { ...t.watermark, logoUrl: null } }));
          return [...fresh, ...prev].slice(0, MAX_CUSTOM_TEMPLATES);
        });
        showToast('success', zh ? `已导入 ${valid.length} 个模板` : `Imported ${valid.length} templates`);
      } catch {
        showToast('error', zh ? 'JSON 文件解析失败' : 'Failed to parse JSON');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  // ---- Config History Snapshots ----
  const [snapshots, setSnapshots] = useState<CardSnapshot[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const saveSnapshot = (label?: string) => {
    const snap: CardSnapshot = {
      id: crypto.randomUUID(), ts: Date.now(),
      label: label || `${new Date().toLocaleTimeString()}`,
      theme: cardTheme, layout: cardLayout,
      watermark: { ...watermark }, customColors: { ...customColors },
    };
    setSnapshots(prev => [snap, ...prev].slice(0, MAX_SNAPSHOTS));
  };
  const restoreSnapshot = (snap: CardSnapshot) => {
    setCardTheme(snap.theme);
    setCardLayout(snap.layout);
    setWatermark({ ...snap.watermark });
    setCustomColors({ ...snap.customColors });
    setShowHistory(false);
  };
  const deleteSnapshot = (id: string) => setSnapshots(prev => prev.filter(s => s.id !== id));
  const [editingSnapId, setEditingSnapId] = useState<string | null>(null);
  const [editingSnapLabel, setEditingSnapLabel] = useState('');
  const startRename = (snap: CardSnapshot) => { setEditingSnapId(snap.id); setEditingSnapLabel(snap.label); };
  const commitRename = () => {
    if (editingSnapId && editingSnapLabel.trim()) {
      setSnapshots(prev => prev.map(s => s.id === editingSnapId ? { ...s, label: editingSnapLabel.trim() } : s));
    }
    setEditingSnapId(null);
  };
  const configImportRef = useRef<HTMLInputElement>(null);
  const exportConfig = () => {
    const data = { version: 1, theme: cardTheme, layout: cardLayout, watermark: { ...watermark, logoUrl: null }, customColors, snapshots: snapshots.map(s => ({ ...s, watermark: { ...s.watermark, logoUrl: null } })) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `card-config-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const importConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (data.theme && CARD_THEMES[data.theme as CardTheme]) setCardTheme(data.theme);
        if (data.layout && CARD_LAYOUTS[data.layout as CardLayout]) setCardLayout(data.layout);
        if (data.watermark) setWatermark(w => ({ ...w, ...data.watermark, logoUrl: w.logoUrl }));
        if (data.customColors) setCustomColors(data.customColors);
        if (Array.isArray(data.snapshots)) setSnapshots(data.snapshots.slice(0, MAX_SNAPSHOTS));
      } catch { /* ignore invalid JSON */ }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ---- A/B Compare Mode ----
  const [showCompare, setShowCompare] = useState(false);
  const [compareB, setCompareB] = useState<{ theme: CardTheme; layout: CardLayout; watermark: WatermarkConfig } | null>(null);
  const openCompare = () => {
    const allThemes = Object.keys(CARD_THEMES) as CardTheme[];
    const altTheme = allThemes.find(t => t !== cardTheme) || cardTheme;
    setCompareB({ theme: altTheme, layout: cardLayout, watermark: { ...watermark } });
    setShowCompare(true);
  };

  const applyPreset = (preset: CardPreset) => {
    setCardTheme(preset.theme);
    setCardLayout(preset.layout);
  };

  /** Render a single card to blob */
  const renderCardToBlob = async (theme: CardTheme, layout: CardLayout): Promise<Blob> => {
    const batchOpts: CardRenderOpts = { ...buildCardOpts(), theme, layout };
    const dims = CARD_LAYOUTS[layout];
    const canvas = document.createElement('canvas');
    canvas.width = dims.w; canvas.height = dims.h;
    const ctx = canvas.getContext('2d')!;
    renderCardSync(ctx, dims.w, dims.h, batchOpts);
    if (batchOpts.imageUrl) {
      try {
        const img = new Image(); img.crossOrigin = 'anonymous';
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = batchOpts.imageUrl!; });
        let px: number, py: number, pw: number, ph: number;
        if (layout === 'landscape') { px = 24; py = 24; pw = 232; ph = 280; }
        else if (layout === 'square') { px = 20; py = 20; pw = 100; ph = 100; }
        else { px = 30; py = 40; pw = 200; ph = 260; }
        ctx.save();
        if (layout === 'square') { ctx.beginPath(); ctx.arc(px + pw / 2, py + ph / 2, 50, 0, Math.PI * 2); ctx.clip(); }
        else { ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 16); ctx.clip(); }
        ctx.drawImage(img, px, py, pw, ph); ctx.restore();
      } catch { /* skip */ }
    }
    return new Promise<Blob>((res) => canvas.toBlob(b => res(b!), 'image/png'));
  };

  const runBatchExport = async () => {
    const themes = Array.from(batchThemes);
    const layouts = Array.from(batchLayouts);
    const total = themes.length * layouts.length;
    if (total === 0) return;
    setBatchProgress({ total, done: 0, active: true });
    const name = state.name || 'artist';

    if (batchMode === 'zip') {
      const zip = new JSZip();
      let done = 0;
      for (const theme of themes) {
        for (const layout of layouts) {
          const blob = await renderCardToBlob(theme, layout);
          zip.file(`${name}-${theme}-${layout}.png`, blob);
          done++;
          setBatchProgress({ total, done, active: true });
        }
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.download = `${name}-cards-${total}pack.zip`;
      link.href = URL.createObjectURL(content);
      link.click();
      URL.revokeObjectURL(link.href);
    } else {
      let done = 0;
      for (const theme of themes) {
        for (const layout of layouts) {
          const blob = await renderCardToBlob(theme, layout);
          const link = document.createElement('a');
          link.download = `${name}-${theme}-${layout}.png`;
          link.href = URL.createObjectURL(blob);
          link.click();
          URL.revokeObjectURL(link.href);
          done++;
          setBatchProgress({ total, done, active: true });
          await new Promise(r => setTimeout(r, 400));
        }
      }
    }
    setBatchProgress({ total, done: total, active: false });
  };

  // Generate a deterministic virtual share link
  const shareLink = `https://ai-incubator.app/card/${(state.name || 'artist').toLowerCase().replace(/\s+/g, '-')}-${Math.abs(state.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 9999).toString().padStart(4, '0')}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink).catch(() => {});
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const buildCardOpts = (): CardRenderOpts => {
    const skillBonuses = computeSkillBonuses(state.subSkillPoints);
    return {
      name: state.name,
      type: zh ? ARTIST_TYPE_LABELS[state.type].zh : ARTIST_TYPE_LABELS[state.type].en,
      typeIcon: typeConf.icon, level: 'Lv.1',
      talents: talentKeys.map(k => ({
        label: zh ? TALENT_LABELS[k].zh : TALENT_LABELS[k].en,
        value: Math.min(typeConf.talentCaps[k], state.talents[k] + (skillBonuses[k] || 0)),
        cap: typeConf.talentCaps[k],
      })),
      imageUrl: forgeResult?.image || null,
      tags: [
        ...(forgeResult?.styleTags || []),
        ...(state.personaTags.slice(0, 2)),
        ...(state.primaryGenre ? [state.primaryGenre] : []),
      ].slice(0, 5),
      workshop: zh ? typeConf.workshop.zh : typeConf.workshop.en,
      bio: state.bio,
      theme: cardTheme,
      layout: cardLayout,
      watermark,
    };
  };

  // Dynamically update CARD_THEMES.custom when custom colors change
  useEffect(() => {
    if (cardTheme === 'custom') {
      const ct = buildCustomTheme(customColors.c1, customColors.c2);
      Object.assign(CARD_THEMES.custom, ct);
    }
  }, [customColors, cardTheme]);

  // Auto-save draft on meaningful state changes
  useEffect(() => {
    if (!state.name && step === 0) return; // Don't save truly empty state
    const draft: WizardDraft = {
      state, step, forgeResult,
      savedAt: Date.now(), artistName: state.name || '(unnamed)',
    };
    saveDraft(draft);
    setDraftSavedFlash(true);
    const t = setTimeout(() => setDraftSavedFlash(false), 1200);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.name, state.type, state.bio, state.mbti, step,
      state.designStyle, state.profession, JSON.stringify(state.initialTagIds),
      JSON.stringify(state.talents), JSON.stringify(state.personaTags),
      JSON.stringify(state.speakingStyle), JSON.stringify(state.subSkillPoints),
      state.vocalRange, state.primaryGenre, state.supportColor, forgeResult]);

  // Derived accent color from selected design style (reactive)
  const currentAccent = DESIGN_STYLE_CONFIG[state.designStyle]?.accent || '#06b6d4';

  // Step completion checks
  const stepComplete = [
    state.name.length > 0 && !!state.designStyle,                      // 0 basic+identity
    !!forgeResult,                                                      // 1 appearance
    !!state.mbti || state.personaTags.length > 0,                      // 2 personality
    !!state.vocalRange || !!state.primaryGenre || state.timbreTags.length > 0, // 3 traits
    Object.values(state.subSkillPoints).reduce((s,v)=>s+v,0) >= 3,   // 4 skill tree
    !!state.supportColor,                                               // 5 fan biz
    true,                                                               // 6 preview (always accessible)
  ];
  const completedCount = stepComplete.slice(0, 6).filter(Boolean).length;

  const steps = [
    { label: t.step_basic,      icon: '01', emoji: 'SET' },
    { label: t.step_appearance, icon: '02', emoji: 'VIS' },
    { label: zh ? '个性光谱' : 'Personality', icon: '03', emoji: 'PER' },
    { label: zh ? '专属特质' : 'Traits',      icon: '04', emoji: 'TRT' },
    { label: zh ? '技能树'   : 'Skill Tree',  icon: '05', emoji: 'SKL' },
    { label: zh ? '粉丝商业' : 'Fan Biz',     icon: '06', emoji: 'BIZ' },
    { label: t.step_preview,    icon: '07', emoji: 'PRV' },
  ];

  const typeConf = ARTIST_TYPE_CONFIG[state.type];

  const updateType = (type: ArtistType) => {
    setState(s => ({ ...s, type, talents: { ...ARTIST_TYPE_CONFIG[type].initialTalents } }));
  };

  const randomize = () => {
    const types: ArtistType[] = ['singer', 'actor', 'entertainer', 'dancer', 'host', 'all_rounder', 'idol'];
    const rType = types[Math.floor(Math.random() * types.length)];
    const names = ['Pixel Dream', 'Nova X', 'Crystal Moon', 'Thunder Byte', 'Velvet Code', 'Cyber Rain', 'Neon Pulse', 'Echo Flux', 'Vega Zero', 'Iris Delta'];
    const mbtiTypes = ['INTJ','INFP','ENFJ','ENFP','INTP','ENTJ','ISFP','ESFP','ISTP','ESTP'];
    const speakingOptions = zh
      ? ['毒舌', '卖萌', '高冷', '接地气', '幽默', '霸气', '佛系']
      : ['Witty', 'Cute', 'Cool', 'Down-to-earth', 'Funny', 'Bold', 'Chill'];
    const personaOptions = zh
      ? ['女神型', '邻家感', '神秘系', '治愈系', '反差萌', '野心家']
      : ['Idol-type', 'Girl-next-door', 'Mysterious', 'Healing', 'Gap Moe', 'Ambitious'];
    const genres = zh
      ? ['电子/EDM', '国风/古风', 'R&B', '流行', '摇滚', '民谣', 'ACG']
      : ['EDM', 'C-Pop', 'R&B', 'Pop', 'Rock', 'Folk', 'ACG'];
    const supportColors = ['#06b6d4', '#f59e0b', '#ec4899', '#a855f7', '#10b981', '#ef4444', '#3b82f6'];

    // Gacha flash effect
    setGachaFlash(true);
    setTimeout(() => setGachaFlash(false), 600);

    const rng = () => Math.floor(Math.random() * 100);
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

    // Randomize sub-skills
    const newSubSkills: Record<string, number> = {};
    let pointsLeft = SKILL_TREE_TOTAL_POINTS;
    const skillIds = ['pitch','breath','vocal_range','emotion','dialogue','physical','power','flexibility','vibe','improv','control','eloquence','timing','reaction','character','atmosphere','meme_sense','camera_feel'];
    skillIds.sort(() => Math.random() - 0.5).forEach(id => {
      if (pointsLeft <= 0) return;
      const lvl = Math.min(3, Math.floor(Math.random() * (pointsLeft + 1)));
      if (lvl > 0) { newSubSkills[id] = lvl; pointsLeft -= lvl; }
    });

    const rDesignStyle = pick(DESIGN_STYLE_ORDER);
    const rProfession = pick(PROFESSION_ORDER);

    setState({
      ...INITIAL_STATE,
      name: pick(names),
      type: rType,
      designStyle: rDesignStyle,
      profession: rProfession,
      bio: zh ? '由AI随机生成的虚拟艺人，蓄势待发。' : 'AI-generated virtual artist, ready to debut.',
      sweetness: rng(), energy: rng(), mystery: rng(), confidence: rng(), extraPersona: rng(),
      mbti: pick(mbtiTypes),
      emotionJoy: rng(), emotionIntensity: rng(), emotionWarmth: rng(), emotionEdge: rng(),
      speakingStyle: [pick(speakingOptions), pick(speakingOptions)].filter((v, i, a) => a.indexOf(v) === i),
      personaTags: [pick(personaOptions)],
      vocalRange: pick(['bass', 'baritone', 'tenor', 'mezzo', 'soprano']),
      timbreTags: [pick(['磁性', '清亮', '沙哑', '少女音', '电子感'])],
      primaryGenre: pick(genres),
      talents: { ...ARTIST_TYPE_CONFIG[rType].initialTalents },
      subSkillPoints: newSubSkills,
      age: 16 + Math.floor(Math.random() * 14),
      height: 155 + Math.floor(Math.random() * 30),
      supportColor: pick(supportColors),
      fanAgeRange: pick(['13-18', '18-24', '25-35']),
      fanGenderRatio: Math.floor(Math.random() * 70),
      fanRegions: [pick(['一线城市', '二线城市', '全球粉丝'])],
    });
    setForgeResult(generateRandomForgeResult(rType, lang));
  };

  const handleCreate = () => {
    setCreating(true);
    setTimeout(() => {
      // Compute gacha rarity
      const talentVals = Object.values(state.talents);
      const avgTalent = talentVals.reduce((s, v) => s + v, 0) / talentVals.length;
      const primaryTalent = typeConf.primaryTalents.length > 0
        ? Math.max(...typeConf.primaryTalents.map(k => state.talents[k]))
        : avgTalent;
      const subSkillsUsed = Object.values(state.subSkillPoints).reduce((s, v) => s + v, 0);
      const rarity = computeRarity({
        avgTalent, primaryTalent,
        hasForge: !!forgeResult,
        bioLength: state.bio.length,
        subSkillsUsed,
        mbti: state.mbti,
      });
      setGachaRarity(rarity);
      setCreating(false);
      setShowCeremony(true);
      clearDraft(); // Clear saved draft on successful creation
    }, 1800);
  };

  const talentKeys = Object.keys(TALENT_LABELS) as (keyof TalentProfile)[];
  const radarData = talentKeys.map(k => ({
    subject: zh ? TALENT_LABELS[k].zh : TALENT_LABELS[k].en,
    value: state.talents[k],
    cap: typeConf.talentCaps[k],
  }));

  if (created) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="bg-gray-900 border border-white/10 rounded-2xl p-12 text-center max-w-md">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: .2 }}>
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
          </motion.div>
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>{t.success}</h2>
          {forgeResult && (
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-green-400/30 mx-auto mb-3">
              <img src={forgeResult.image} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <p className="text-gray-400 text-sm mb-2">{state.name} — {typeConf.icon} {zh ? ARTIST_TYPE_LABELS[state.type].zh : ARTIST_TYPE_LABELS[state.type].en}</p>
          <p className="text-gray-500 text-xs mb-6">{zh ? '你可以在MCN矩阵中查看和管理这个艺人' : 'You can view and manage this artist in the MCN Matrix'}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button variant="outline" size="sm"
              className="border-white/10 text-gray-400 hover:text-white gap-1"
              onClick={() => exportArtistCard(buildCardOpts(), exportFormat)}>
              <Download className="w-3.5 h-3.5" /> {zh ? `导出${EXPORT_FORMATS[exportFormat].label}` : `Export ${EXPORT_FORMATS[exportFormat].label}`}
            </Button>
            <Button variant="outline" size="sm"
              className="border-purple-500/20 text-purple-300 hover:bg-purple-500/10 gap-1"
              onClick={() => setShowShareModal(true)}>
              <Share2 className="w-3.5 h-3.5" /> {zh ? '分享' : 'Share'}
            </Button>
            <Button
              variant="outline" size="sm"
              className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 gap-1"
              onClick={() => {
                setState(INITIAL_STATE);
                setStep(0);
                setForgeResult(null);
                setCreated(false);
                setBoostApplied(false);
                setPreBoostTalents(null);
                clearDraft();
                setPendingDraft(null);
              }}
            >
              <Plus className="w-3.5 h-3.5" /> {zh ? '继续孵化新艺人' : 'Incubate Another'}
            </Button>
            <Button onClick={onCreated} className="bg-gradient-to-r from-cyan-500 to-purple-600">{zh ? '返回矩阵' : 'Back to Matrix'}</Button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <>
      <div
        className="flex rounded-xl border border-white/5 overflow-hidden bg-gray-900/20"
        style={{ height: 'calc(100vh - 90px)', minHeight: 520 }}
      >
        {/* ════════════════════════════════════
            LEFT: Vertical Step Sidebar
        ════════════════════════════════════ */}
        <aside className={`w-[56px] md:w-[196px] flex-shrink-0 flex flex-col border-r border-white/5 transition-all duration-300 ${gachaFlash ? 'bg-amber-500/5' : 'bg-black/30'}`}>
          {/* Brand header — desktop */}
          <div className="hidden md:flex items-center gap-2 px-3 py-3 border-b border-white/5">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-500"
              style={{ background: currentAccent + '25' }}>
              <Wand2 className="w-3.5 h-3.5 transition-colors duration-500" style={{ color: currentAccent }} />
            </div>
            <span className="text-xs font-bold tracking-tight bg-clip-text text-transparent whitespace-nowrap transition-all duration-500"
              style={{ backgroundImage: `linear-gradient(90deg, ${currentAccent}, #a855f7)`, fontFamily: 'var(--font-display)' }}>
              AI 孵化器
            </span>
            {completedCount > 0 && (
              <span className="ml-auto text-[9px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
                {completedCount}/6
              </span>
            )}
          </div>
          {/* Mobile: icon only header */}
          <div className="md:hidden flex items-center justify-center py-2.5 border-b border-white/5">
            <Wand2 className="w-4 h-4 text-cyan-400" />
          </div>

          {/* Steps */}
          <div className="flex-1 flex flex-col py-3 px-2 gap-0.5 overflow-y-auto">
            {steps.map((s, i) => {
              const isComplete = step > i;
              const isActive   = step === i;
              const isDone     = stepComplete[i]; // filled-in check
              return (
                <div key={i} className="flex flex-col items-center md:items-stretch">
                  <button
                    onClick={() => setStep(i)}
                    className={`relative flex items-center gap-2.5 px-2 py-2 rounded-lg transition-all duration-200 group w-full
                      ${isActive
                        ? 'bg-cyan-500/10 border border-cyan-500/20'
                        : isComplete
                          ? 'hover:bg-green-500/5 border border-transparent'
                          : 'hover:bg-white/[0.03] border border-transparent'
                      }`}
                  >
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-lg border border-cyan-400/40"
                        animate={{ opacity: [0.4, 0, 0.4] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                    {/* Circle */}
                    <div
                      className="w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300"
                      style={{
                        borderColor: isActive ? '#06b6d4' : isComplete ? '#22c55e60' : '#374151',
                        background:  isActive ? 'rgba(6,182,212,0.12)' : isComplete ? 'rgba(34,197,94,0.10)' : 'rgba(17,24,39,0.6)',
                        boxShadow:   isActive ? '0 0 10px rgba(6,182,212,0.45)' : isComplete ? '0 0 6px rgba(34,197,94,0.25)' : 'none',
                      }}
                    >
                      {isComplete ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <span className="text-[9px] font-mono font-bold" style={{ color: isActive ? '#67e8f9' : '#6b7280' }}>
                          {s.icon}
                        </span>
                      )}
                    </div>
                    {/* Label — desktop only */}
                    <div className="hidden md:flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <span
                          className="text-[11px] font-medium leading-tight truncate transition-colors"
                          style={{ color: isActive ? '#67e8f9' : isComplete ? 'rgba(74,222,128,0.8)' : '#6b7280' }}
                        >
                          <span className="font-mono text-[8px] text-gray-600">{s.emoji}</span> {s.label}
                        </span>
                        {/* Completion dot — only shows if filled but not "step > i" navigated past */}
                        {!isComplete && isDone && i !== 6 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 ml-auto"
                            style={{ boxShadow: '0 0 4px rgba(52,211,153,0.6)' }} />
                        )}
                      </div>
                      <span className="text-[9px] font-mono mt-0.5" style={{ color: isActive ? 'rgba(6,182,212,0.5)' : '#64748b' }}>
                        STEP {s.icon}
                      </span>
                    </div>
                    {/* Mobile: completion dot */}
                    {!isComplete && isDone && i !== 6 && (
                      <div className="absolute top-1 right-1 md:hidden w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"
                        style={{ boxShadow: '0 0 4px rgba(52,211,153,0.6)' }} />
                    )}
                  </button>

                  {/* Connector */}
                  {i < steps.length - 1 && (
                    <div className="flex justify-center my-0.5">
                      <div className="relative w-px overflow-hidden" style={{ height: 14, background: isComplete ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.04)' }}>
                        {(isComplete || isActive) && (
                          <motion.div
                            className="absolute w-full"
                            style={{
                              height: 8,
                              background: `linear-gradient(180deg, transparent, ${isComplete ? 'rgba(34,197,94,0.7)' : 'rgba(6,182,212,0.6)'}, transparent)`,
                            }}
                            animate={{ top: ['-100%', '200%'] }}
                            transition={{ duration: isComplete ? 1.4 : 2.2, repeat: Infinity, ease: 'linear' }}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Persistent character preview ── */}
          <AnimatePresence>
            {forgeResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="hidden md:block mx-3 mb-2 overflow-hidden"
              >
                <div className="relative rounded-xl overflow-hidden border border-white/[0.08]" style={{ aspectRatio: '3/4' }}>
                  <img src={forgeResult.image} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5">
                    <div className="text-[10px] font-bold text-white truncate" style={{ fontFamily: 'var(--font-display)' }}>
                      {state.name || '???'}
                    </div>
                    <div className="text-[8px] text-white/40 font-mono">{typeConf.icon} {zh ? ARTIST_TYPE_LABELS[state.type].zh : ARTIST_TYPE_LABELS[state.type].en}</div>
                  </div>
                  <div className="absolute top-1.5 right-1.5">
                    <button
                      onClick={() => setStep(1)}
                      className="w-5 h-5 rounded-md bg-black/50 border border-white/10 flex items-center justify-center text-gray-400 hover:text-cyan-400 transition"
                      title={zh ? '返回形象锻造' : 'Edit appearance'}
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  {/* scan line overlay */}
                  <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.015) 3px, rgba(255,255,255,0.015) 4px)' }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress footer */}
          <div className="px-3 pb-3 pt-2 border-t border-white/5 flex-shrink-0">
            <div className="hidden md:block space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-gray-600 uppercase tracking-wider">{zh ? '完成度' : 'Progress'}</span>
                <div className="flex items-center gap-1.5">
                  <AnimatePresence>
                    {draftSavedFlash && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                        className="text-[8px] text-emerald-400/70 font-mono">{zh ? '已存草稿' : 'Draft saved'}</motion.span>
                    )}
                  </AnimatePresence>
                  <span className="text-[9px] text-cyan-400 font-mono">{Math.round(((step + 1) / steps.length) * 100)}%</span>
                </div>
              </div>
              <div className="h-0.5 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #06b6d4, #a855f7)' }}
                  animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              {/* Step completion summary */}
              <div className="flex items-center gap-0.5 pt-0.5">
                {stepComplete.slice(0, 6).map((done, i) => (
                  <div key={i} className="flex-1 h-0.5 rounded-full transition-all duration-300"
                    style={{ background: done ? '#34d399' : i === step ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.05)' }} />
                ))}
              </div>
              <div className="text-[8px] text-gray-700">
                {completedCount}/6 {zh ? '步已填写' : 'steps filled'}
              </div>
            </div>
            <div className="md:hidden text-center">
              <span className="text-[9px] text-cyan-400 font-mono">{step + 1}<span className="text-gray-700">/{steps.length}</span></span>
            </div>
          </div>
        </aside>

        {/* ── AI Inline Chat — second column, between 流程列 and step content ── */}
        <div className="hidden lg:flex flex-col w-[230px] xl:w-[260px] flex-shrink-0 p-3">
          <WizardInlineChat lang={lang} step={step} />
        </div>

        {/* ════════════════════════════════════
            RIGHT: Main Content Panel
        ════════════════════════════════════ */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/10">
            <div>
              <h1 className="text-base font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{t.title}</h1>
              <p className="text-gray-500 text-[11px] font-light">{t.subtitle}</p>
            </div>
            <div className="flex gap-2 items-center">
              {/* New Artist button — always visible */}
              <Button
                size="sm"
                onClick={() => {
                  setState({ ...INITIAL_STATE, ...SOLUTION_WIZARD_DEFAULTS[ipPreset.solutionId] });
                  setStep(0);
                  setForgeResult(null);
                  setBoostApplied(false);
                  setPreBoostTalents(null);
                  clearDraft();
                  setShowDraftBanner(false);
                  setPendingDraft(null);
                }}
                className="gap-1 h-7 px-2.5 text-xs bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-300 hover:from-cyan-500/30 hover:to-purple-500/30 hover:text-cyan-200 transition-all"
              >
                <Plus className="w-3 h-3" />
                <span className="hidden sm:inline">{zh ? '孵化新艺人' : 'New Artist'}</span>
              </Button>
              <motion.div whileTap={{ scale: 0.95 }}
                animate={gachaFlash ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
                transition={{ duration: 0.4 }}>
                <Button variant="outline" size="sm" onClick={randomize}
                  className={`gap-1 transition-all duration-300 text-xs h-7 px-2 ${gachaFlash ? 'border-amber-500/60 text-amber-400 bg-amber-500/10' : 'border-white/10 text-gray-400 hover:text-white'}`}>
                  <Dices className="w-3 h-3" /> {zh ? 'GCH 盲盒' : 'GCH Gacha'}
                </Button>
              </motion.div>
              <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white h-7 w-7 p-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Scrollable step content — split: step area (left) + AI inline chat (right) */}
          <div className="flex-1 overflow-y-auto p-4">
            <div>
            {/* Draft Restore Banner */}
            <AnimatePresence>
              {pendingDraft && showDraftBanner && (
                <motion.div
                  initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }} transition={{ duration: 0.25 }}
                  className="mb-3 overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-amber-500/10 to-cyan-500/10 border border-amber-500/25 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                      <History className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-amber-300">
                        {zh ? '发现未完成的草稿' : 'Unfinished draft found'}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                        <span className="text-gray-400">{pendingDraft.artistName}</span>
                        {' · '}{zh ? `上次编辑：` : 'Last edited: '}
                        <span className="text-amber-400/70">
                          {new Date(pendingDraft.savedAt).toLocaleDateString(zh ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {' · '}{zh ? `第${pendingDraft.step + 1}步` : `Step ${pendingDraft.step + 1}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          setState(pendingDraft.state);
                          setStep(pendingDraft.step);
                          setForgeResult(pendingDraft.forgeResult);
                          setShowDraftBanner(false);
                          setPendingDraft(null);
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 transition flex items-center gap-1"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        {zh ? '恢复草稿' : 'Resume'}
                      </button>
                      <button
                        onClick={() => {
                          clearDraft();
                          setShowDraftBanner(false);
                          setPendingDraft(null);
                        }}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-white/5 transition"
                        title={zh ? '丢弃草稿，重新开始' : 'Discard draft and start fresh'}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {step === 0 && (
              <IPTemplatePanel lang={lang} preset={ipPreset} onChange={handlePresetChange} onApplyDefaults={() => applyTemplateDefaults(ipPreset)} />
            )}

            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: .18 }}>

          {/* STEP 0: Basic — 三栏式身份构建器 (Plan C) */}
          {step === 0 && (() => {
            // ── Style → Profession recommendation mapping ──
            const STYLE_PROF_RECS: Record<DesignStyle, ProfessionBackground[]> = {
              hyperreal:   ['influencer', 'designer'],
              anime:       ['artist', 'designer'],
              chinoiserie: ['artist', 'teacher'],
              cyber_mecha: ['scientist', 'designer'],
              y2k:         ['influencer', 'entrepreneur'],
              pixel:       ['scientist', 'entrepreneur'],
              dreamcore:   ['artist', 'chef'],
              gothic:      ['artist', 'lawyer'],
            };
            // ── Profession → bio placeholder hint ──
            const PROF_HINTS: Record<ProfessionBackground, { zh: string; en: string }> = {
              teacher:      { zh: '知识传播者，善用教学内容塑造权威，圈粉无数…', en: 'Knowledge sharer building authority through unique teaching style...' },
              entrepreneur: { zh: '商业领袖，凭借创业故事和商业洞察成为流量顶点…', en: 'Business leader building influence through startup stories & insights...' },
              lawyer:       { zh: '法律专家，以严谨逻辑和权威专业赢得受众信赖…', en: 'Legal expert gaining audience trust with authoritative knowledge...' },
              doctor:       { zh: '医疗专家，将健康科普变成最具公信力的内容出口…', en: 'Medical expert turning health knowledge into the most trusted content...' },
              athlete:      { zh: '体育健将，用竞技精神和活力形象点燃粉丝热情…', en: 'Sports champion igniting fan passion with competitive energy...' },
              influencer:   { zh: '社交达人，深谙平台算法与粉丝心理的流量操盘手…', en: 'Social star who masters algorithms and fan psychology effortlessly...' },
              artist:       { zh: '创作者，以敏锐审美感知和独特艺术表达征服市场…', en: 'Creator conquering markets with unique artistic expression & vision...' },
              scientist:    { zh: '研究者，用科技知识的权威光环缔造跨界顶流IP…', en: 'Researcher building cross-domain IP with scientific credibility...' },
              chef:         { zh: '美食专家，将烹饪内容打造成温暖治愈系流量入口…', en: 'Culinary expert turning cooking into heartwarming viral content...' },
              designer:     { zh: '设计师，用极致审美和创意视野塑造高辨识度个人品牌…', en: 'Designer crafting a high-recognition brand with aesthetic vision...' },
            };
            // ── Profession hex accent colors (for inline styles) ──
            const PROF_HEX: Record<ProfessionBackground, string> = {
              teacher: '#60a5fa', entrepreneur: '#fbbf24', lawyer: '#c084fc',
              doctor: '#4ade80', athlete: '#fb923c', influencer: '#f472b6',
              artist: '#e879f9', scientist: '#22d3ee', chef: '#f87171', designer: '#a78bfa',
            };

            const recProfessions = STYLE_PROF_RECS[state.designStyle] || [];
            const bioHint = state.profession
              ? (zh ? PROF_HINTS[state.profession].zh : PROF_HINTS[state.profession].en)
              : (zh ? '输入艺人的背景故事与个性描述…' : 'Enter artist background story and personality...');

            return (
              <div className="flex flex-col gap-3">

                {/* ═══ ROW 1: 基础信息 ═══ */}
                <div className="space-y-2.5">
                  <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3 space-y-3">
                    {/* Column header */}
                    <div className="flex items-center gap-2 pb-1.5 border-b border-white/5">
                      <span className="text-[9px] font-mono font-bold uppercase tracking-widest transition-colors duration-500"
                        style={{ color: currentAccent }}>01_BASIC</span>
                      <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${currentAccent}30, transparent)` }} />
                    </div>
                    {/* Name */}
                    <div>
                      <label className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-1 block">{t.name}</label>
                      <input value={state.name} onChange={e => setState(s => ({ ...s, name: e.target.value }))}
                        className="w-full bg-black/30 border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none transition-all duration-300"
                        style={{ borderColor: state.name ? currentAccent + '50' : 'rgba(255,255,255,0.08)' }}
                        placeholder={t.name_placeholder} />
                    </div>
                    {/* Bio with profession hint */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{t.bio}</label>
                        {state.profession && (
                          <motion.span initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
                            className="text-[9px] italic flex items-center gap-1"
                            style={{ color: PROF_HEX[state.profession] }}>
                            <span className="font-mono font-bold text-[9px]">{PROFESSION_CONFIG[state.profession].emoji}</span>
                            {zh ? '职业提示已激活' : 'Career hint active'}
                          </motion.span>
                        )}
                      </div>
                      <textarea value={state.bio} onChange={e => setState(s => ({ ...s, bio: e.target.value }))}
                        className="w-full bg-black/30 border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none transition-all duration-300 h-24 resize-none"
                        style={{ borderColor: state.profession ? (PROF_HEX[state.profession] + '35') : 'rgba(255,255,255,0.08)' }}
                        placeholder={bioHint} />
                    </div>
                    <Button variant="outline" size="sm"
                      className="text-xs h-6 px-2 w-full justify-center transition-all duration-300"
                      style={{ borderColor: currentAccent + '35', color: currentAccent }}>
                      {t.ai_suggest}
                    </Button>
                  </div>

                  {/* Identity Preview Card */}
                  <AnimatePresence>
                    {(state.designStyle || state.profession) && (
                      <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4 }}
                        className="bg-black/40 border rounded-xl p-3 space-y-2"
                        style={{ borderColor: currentAccent + '25' }}>
                        <p className="text-[8px] uppercase tracking-widest font-mono transition-colors duration-500"
                          style={{ color: currentAccent }}>
                          {zh ? '✦ 身份预览' : '✦ IDENTITY PREVIEW'}
                        </p>
                        {state.designStyle && (
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-md flex-shrink-0 bg-gradient-to-br ${DESIGN_STYLE_CONFIG[state.designStyle].gradient}`} />
                            <span className="text-xs text-gray-300 font-medium">
                              <span className="font-mono font-bold text-[9px]">{DESIGN_STYLE_CONFIG[state.designStyle].emoji}</span> {zh ? DESIGN_STYLE_CONFIG[state.designStyle].zh : DESIGN_STYLE_CONFIG[state.designStyle].en}
                            </span>
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full ml-auto flex-shrink-0 font-mono"
                              style={{ background: currentAccent + '20', color: currentAccent }}>
                              {zh ? '视觉' : 'STYLE'}
                            </span>
                          </div>
                        )}
                        {state.profession && (
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono font-bold flex-shrink-0">{PROFESSION_CONFIG[state.profession].emoji}</span>
                            <span className="text-xs text-gray-300 font-medium">
                              {zh ? PROFESSION_CONFIG[state.profession].zh : PROFESSION_CONFIG[state.profession].en}
                            </span>
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full ml-auto flex-shrink-0 font-mono bg-purple-500/20 text-purple-400">
                              {zh ? '职业' : 'PROF'}
                            </span>
                          </div>
                        )}
                        {state.initialTagIds.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1 border-t border-white/5">
                            {state.initialTagIds.map(id => {
                              const tag = DEFAULT_CUSTOM_TAGS.find(t => t.id === id);
                              return tag ? (
                                <span key={id} className="text-[9px] px-1.5 py-0.5 rounded-full"
                                  style={{ background: tag.color + '20', color: tag.color, border: `1px solid ${tag.color}40` }}>
                                  {tag.name}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ═══ ROW 2: 艺人类型 ═══ */}
                <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-white/5">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-purple-400">02_TYPE</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-purple-500/20 to-transparent" />
                  </div>
                  <p className="text-[9px] text-gray-600">{t.type}</p>
                  <div className="grid grid-cols-2 gap-1.5 flex-1">
                    {(Object.keys(ARTIST_TYPE_LABELS) as ArtistType[]).map(type => {
                      const conf = ARTIST_TYPE_CONFIG[type];
                      const selected = state.type === type;
                      return (
                        <motion.button key={type} whileTap={{ scale: 0.96 }}
                          onClick={() => updateType(type)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all duration-200
                            ${selected ? `${conf.bgColor} ${conf.borderColor}` : 'border-white/5 hover:border-white/15 hover:bg-white/[0.02]'}`}
                          style={selected ? { boxShadow: `0 0 14px ${DESIGN_STYLE_CONFIG[state.designStyle]?.accent || '#06b6d4'}25` } : {}}>
                          <span className="text-xl">{conf.icon}</span>
                          <span className={`text-[10px] font-semibold leading-tight ${selected ? conf.color : 'text-gray-400'}`}>
                            {zh ? ARTIST_TYPE_LABELS[type].zh : ARTIST_TYPE_LABELS[type].en}
                          </span>
                          <span className="text-[8px] text-gray-600 leading-tight">
                            {zh ? conf.workshop.zh : conf.workshop.en}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                  {/* Selected type info bar */}
                  <div className={`rounded-lg p-2 border text-[9px] ${typeConf.bgColor} ${typeConf.borderColor}`}>
                    <span className={typeConf.color}>{typeConf.icon} {zh ? ARTIST_TYPE_LABELS[state.type].zh : ARTIST_TYPE_LABELS[state.type].en}</span>
                    <span className="text-gray-500 ml-1">
                      {zh
                        ? `主属性：${typeConf.primaryTalents.map(k => TALENT_LABELS[k].zh).join('+')} · 工坊「${typeConf.workshop.zh}」`
                        : `Primary: ${typeConf.primaryTalents.map(k => TALENT_LABELS[k].en).join('+')} · ${typeConf.workshop.en}`}
                    </span>
                  </div>
                </div>

                {/* ═══ ROW 3: 身份构建器 ═══ */}
                <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3 space-y-3">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-white/5">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-widest transition-colors duration-500"
                      style={{ color: currentAccent }}>03_IDENTITY</span>
                    <div className="flex-1 h-px transition-all duration-500"
                      style={{ background: `linear-gradient(90deg, ${currentAccent}30, transparent)` }} />
                  </div>

                  {/* ── Design Style ── */}
                  <div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      {zh ? '视觉设计风格' : 'Visual Design Style'}
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {DESIGN_STYLE_ORDER.map(style => {
                        const conf = DESIGN_STYLE_CONFIG[style];
                        const selected = state.designStyle === style;
                        return (
                          <motion.button key={style} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.94 }}
                            onClick={() => setState(s => ({ ...s, designStyle: style }))}
                            className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg border text-center transition-all duration-300 overflow-hidden"
                            style={{
                              borderColor: selected ? conf.accent + '80' : 'rgba(255,255,255,0.05)',
                              boxShadow: selected ? `0 0 12px ${conf.accent}45, inset 0 0 8px ${conf.accent}12` : 'none',
                              background: selected ? `linear-gradient(135deg, ${conf.accent}18, transparent)` : 'transparent',
                            }}>
                            {/* Gradient swatch */}
                            <div className={`w-full h-5 rounded-sm bg-gradient-to-br ${conf.gradient} mb-0.5`} />
                            <span className="text-[7px] font-medium leading-tight transition-colors duration-300"
                              style={{ color: selected ? conf.accent : '#4b5563' }}>
                              {zh ? conf.zh : conf.en}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                    {state.designStyle && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="text-[9px] text-gray-600 mt-1.5 leading-relaxed">
                        {zh ? DESIGN_STYLE_CONFIG[state.designStyle].desc_zh : DESIGN_STYLE_CONFIG[state.designStyle].desc_en}
                      </motion.p>
                    )}
                  </div>

                  {/* ── Profession Background ── */}
                  <div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      {zh ? '职业背景身份' : 'Career Background'}
                      {recProfessions.length > 0 && (
                        <span className="ml-auto text-[8px] font-mono flex items-center gap-0.5 transition-colors duration-500"
                          style={{ color: currentAccent }}>
                          ✦ {zh ? '风格推荐' : 'Style Recs'}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {PROFESSION_ORDER.map(prof => {
                        const conf = PROFESSION_CONFIG[prof];
                        const selected = state.profession === prof;
                        const recommended = recProfessions.includes(prof);
                        const profHex = PROF_HEX[prof];
                        return (
                          <motion.button key={prof} whileTap={{ scale: 0.95 }}
                            onClick={() => setState(s => ({ ...s, profession: s.profession === prof ? null : prof }))}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-left transition-all duration-200
                              ${selected ? conf.bg : ''}`}
                            style={{
                              borderColor: selected
                                ? profHex + '60'
                                : recommended
                                  ? currentAccent + '35'
                                  : 'rgba(255,255,255,0.05)',
                              boxShadow: selected
                                ? `0 0 10px ${profHex}35`
                                : recommended
                                  ? `0 0 6px ${currentAccent}18`
                                  : 'none',
                              background: selected ? undefined : recommended ? currentAccent + '08' : 'transparent',
                            }}>
                            <span className="text-[9px] font-mono font-bold flex-shrink-0 w-6 text-center" style={{ color: conf.color.replace('text-', '') }}>{conf.emoji}</span>
                            <span className={`text-[9px] leading-tight font-medium transition-colors duration-200 flex-1 min-w-0
                              ${selected ? conf.color : recommended ? 'text-gray-300' : 'text-gray-500'}`}>
                              {zh ? conf.zh : conf.en}
                            </span>
                            {recommended && !selected && (
                              <span className="text-[7px] font-bold flex-shrink-0 transition-colors duration-500"
                                style={{ color: currentAccent }}>✦</span>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Initial Tags ── */}
                  <div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">
                      {zh ? '初始运营标签' : 'Initial Tags'}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {DEFAULT_CUSTOM_TAGS.map(tag => {
                        const sel = state.initialTagIds.includes(tag.id);
                        return (
                          <motion.button key={tag.id} whileTap={{ scale: 0.92 }}
                            onClick={() => setState(s => ({
                              ...s,
                              initialTagIds: sel
                                ? s.initialTagIds.filter(id => id !== tag.id)
                                : [...s.initialTagIds, tag.id],
                            }))}
                            className="px-2 py-0.5 rounded-full text-[10px] border transition-all duration-200"
                            style={{
                              borderColor: sel ? tag.color + '65' : 'rgba(255,255,255,0.06)',
                              background: sel ? tag.color + '22' : 'transparent',
                              color: sel ? tag.color : '#6b7280',
                              boxShadow: sel ? `0 0 8px ${tag.color}30` : 'none',
                            }}>
                            {tag.name}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>
            );
          })()}

          {/* STEP 1: Appearance */}
          {step === 1 && (
            <AppearanceForgeEmbed lang={lang} artistName={state.name} artistType={state.type} onForgeResult={setForgeResult} hideChat />
          )}

          {/* STEP 2: Personality Spectrum */}
          {step === 2 && (() => {
            const MBTI_GROUPS = [
              { name: zh ? '分析家' : 'Analysts', color: '#a855f7', types: ['INTJ','INTP','ENTJ','ENTP'] },
              { name: zh ? '外交家' : 'Diplomats', color: '#22c55e', types: ['INFJ','INFP','ENFJ','ENFP'] },
              { name: zh ? '守卫者' : 'Sentinels', color: '#3b82f6', types: ['ISTJ','ISFJ','ESTJ','ESFJ'] },
              { name: zh ? '探险家' : 'Explorers', color: '#f59e0b', types: ['ISTP','ISFP','ESTP','ESFP'] },
            ];
            const SPEAKING_TAGS = zh
              ? ['毒舌', '卖萌', '高冷', '接地气', '文艺范儿', '幽默段子', '霸气', '甜系', '佛系', '社牛', '傲娇', '温柔系', '反差萌', '元气满满']
              : ['Witty', 'Cute', 'Cool', 'Relatable', 'Artistic', 'Funny', 'Bold', 'Sweet', 'Chill', 'Extrovert', 'Tsundere', 'Gentle', 'Gap Moe', 'Energetic'];
            const PERSONA_TAGS = zh
              ? ['女神型', '邻家感', '神秘系', '纯爱战士', '野心家', '治愈系', '颜值担当', '全能型', '反差萌', '学霸人设', '国风气质', '运动少年', '叛逆系', '实力派']
              : ['Goddess', 'Girl-Next-Door', 'Mysterious', 'Pure Love', 'Ambitious', 'Healing', 'Visual', 'All-Rounder', 'Gap Moe', 'Scholar', 'Cultural', 'Athletic', 'Rebel', 'Powerhouse'];
            const toggleTag = (arr: string[], tag: string) =>
              arr.includes(tag) ? arr.filter(x => x !== tag) : [...arr, tag];
            return (
              <div className="grid lg:grid-cols-2 gap-3">
                {/* Left: MBTI + Emotion Spectrum */}
                <div className="space-y-2">
                  {/* MBTI */}
                  <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold">{zh ? 'MBTI 性格类型' : 'MBTI Personality'}</h3>
                      {state.mbti && <Badge className="ml-auto text-[10px] bg-purple-500/10 text-purple-300 border-purple-500/20">{state.mbti}</Badge>}
                    </div>
                    <div className="space-y-1">
                      {MBTI_GROUPS.map(g => (
                        <div key={g.name}>
                          <div className="text-[9px] font-medium mb-1" style={{ color: g.color }}>
                            {g.name}
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {g.types.map(type => (
                              <button key={type} onClick={() => setState(s => ({ ...s, mbti: s.mbti === type ? '' : type }))}
                                className={`px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all ${state.mbti === type ? 'text-white' : 'text-gray-500 border border-white/5 hover:border-white/15'}`}
                                style={state.mbti === type ? { backgroundColor: g.color + '25', borderWidth: 1, borderColor: g.color + '60', boxShadow: `0 0 8px ${g.color}40` } : {}}>
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Emotion Spectrum */}
                  <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold">{zh ? '情绪光谱' : 'Emotion Spectrum'}</h3>
                    </div>
                    {[
                      { key: 'emotionJoy' as const, zh: '喜悦感', en: 'Joy', color: 'amber' },
                      { key: 'emotionIntensity' as const, zh: '爆发力', en: 'Intensity', color: 'red' },
                      { key: 'emotionWarmth' as const, zh: '温暖度', en: 'Warmth', color: 'orange' },
                      { key: 'emotionEdge' as const, zh: '锋芒度', en: 'Edge', color: 'violet' },
                    ].map(({ key, zh: zhLabel, en, color }) => (
                      <ParamSlider key={key} label={zh ? zhLabel : en} value={state[key]} onChange={v => setState(s => ({ ...s, [key]: v }))} color={color} />
                    ))}
                    {/* Classic persona sliders */}
                    <div className="pt-1.5 border-t border-white/5 space-y-2">
                      <span className="text-[9px] text-gray-500">{zh ? '基础人设参数' : 'Base Persona'}</span>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                        <ParamSlider label={t.persona_sweetness} value={state.sweetness} onChange={v => setState(s => ({ ...s, sweetness: v }))} />
                        <ParamSlider label={t.persona_mystery} value={state.mystery} onChange={v => setState(s => ({ ...s, mystery: v }))} color="pink" />
                        {typeConf.extraPersona && (
                          <ParamSlider label={zh ? typeConf.extraPersona.zh : typeConf.extraPersona.en} value={state.extraPersona} onChange={v => setState(s => ({ ...s, extraPersona: v }))} color="green" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Speaking Style + Persona Tags */}
                <div className="space-y-2">
                  {/* Speaking Style */}
                  <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold">{zh ? '说话风格' : 'Speaking Style'}</h3>
                      <span className="ml-auto text-[9px] text-gray-600">{zh ? '可多选' : 'Multi-select'}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {SPEAKING_TAGS.map(tag => {
                        const active = state.speakingStyle.includes(tag);
                        return (
                          <motion.button key={tag} whileTap={{ scale: 0.95 }}
                            onClick={() => setState(s => ({ ...s, speakingStyle: toggleTag(s.speakingStyle, tag) }))}
                            className={`px-2 py-0.5 rounded-full text-[10px] border transition-all ${active ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300' : 'border-white/5 text-gray-500 hover:border-white/15 hover:text-gray-400'}`}
                            style={active ? { boxShadow: '0 0 6px rgba(6,182,212,0.3)' } : {}}>
                            {tag}
                          </motion.button>
                        );
                      })}
                    </div>
                    {state.speakingStyle.length > 0 && (
                      <p className="text-[9px] text-gray-600 -mt-1">{zh ? `已选 ${state.speakingStyle.length} 种` : `${state.speakingStyle.length} selected`}</p>
                    )}
                  </div>

                  {/* Persona Tags */}
                  <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold">{zh ? '人设标签' : 'Persona Tags'}</h3>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {PERSONA_TAGS.map(tag => {
                        const active = state.personaTags.includes(tag);
                        return (
                          <motion.button key={tag} whileTap={{ scale: 0.95 }}
                            onClick={() => setState(s => ({ ...s, personaTags: toggleTag(s.personaTags, tag) }))}
                            className={`px-2 py-0.5 rounded-full text-[10px] border transition-all ${active ? 'border-purple-500/40 bg-purple-500/15 text-purple-300' : 'border-white/5 text-gray-500 hover:border-white/15'}`}
                            style={active ? { boxShadow: '0 0 6px rgba(168,85,247,0.3)' } : {}}>
                            {tag}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Preview card */}
                  {(state.mbti || state.speakingStyle.length > 0 || state.personaTags.length > 0) && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-black/30 border border-purple-500/15 rounded-xl p-4 space-y-2">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{zh ? '个性档案预览' : 'Personality Preview'}</p>
                      {state.mbti && <p className="text-xs"><span className="text-gray-500">MBTI: </span><span className="text-purple-300 font-mono font-bold">{state.mbti}</span></p>}
                      {state.speakingStyle.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {state.speakingStyle.map(s => <span key={s} className="text-[10px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded">{s}</span>)}
                        </div>
                      )}
                      {state.personaTags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {state.personaTags.map(t => <span key={t} className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded">{t}</span>)}
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* STEP 3: Vocal Traits + Appearance Details */}
          {step === 3 && (() => {
            const VOCAL_RANGES = [
              { id: 'bass',     zh: '低音炮',   en: 'Bass',     desc_zh: '宇宙级深沉磁性', desc_en: 'Deep cosmic resonance',  color: '#6366f1', emoji: 'BAS' },
              { id: 'baritone', zh: '男中音',   en: 'Baritone', desc_zh: '磁性温暖主力唱',  desc_en: 'Warm magnetic tone',     color: '#3b82f6', emoji: 'BAR' },
              { id: 'tenor',    zh: '男高/女中', en: 'Tenor/Alto', desc_zh: '均衡饱满有厚度', desc_en: 'Balanced full-bodied',   color: '#06b6d4', emoji: 'TEN' },
              { id: 'mezzo',    zh: '次女高音', en: 'Mezzo',    desc_zh: '深邃迷人双向感',  desc_en: 'Deep and captivating',   color: '#a855f7', emoji: 'MEZ' },
              { id: 'soprano',  zh: '女高音',   en: 'Soprano',  desc_zh: '高亢纯净穿透力',  desc_en: 'Piercing clear high notes', color: '#ec4899', emoji: 'SOP' },
            ];
            const TIMBRE_TAGS = zh
              ? ['磁性', '清亮', '沙哑', '少女音', '电子感', '烟嗓', '气声', '古风韵味', '中性声线', '金属质感', '奶音', '低沉有力']
              : ['Magnetic', 'Clear', 'Raspy', 'Girly', 'Electronic', 'Smoky', 'Breathy', 'Classical', 'Neutral', 'Metallic', 'Soft', 'Powerful'];
            const GENRE_LIST = zh
              ? ['电子/EDM', '国风/古风', 'R&B', '流行Pop', '摇滚Rock', '民谣Folk', 'ACG', '嘻哈Hip-Hop', '爵士Jazz', '纯音乐', '布鲁斯', '金属Metal']
              : ['EDM', 'C-Pop/Folk', 'R&B', 'Pop', 'Rock', 'Folk', 'ACG', 'Hip-Hop', 'Jazz', 'Instrumental', 'Blues', 'Metal'];
            const BODY_TYPES = zh ? ['纤细', '健康', '运动型', '高挑', '娇小', '壮硕'] : ['Slim', 'Healthy', 'Athletic', 'Tall', 'Petite', 'Muscular'];
            const HAIR_COLORS = zh ? ['黑色', '棕色', '银白', '金色', '红色', '蓝紫', '彩色渐变', '白金'] : ['Black', 'Brown', 'Silver', 'Blonde', 'Red', 'Blue-Violet', 'Rainbow', 'Platinum'];
            const toggleTimbre = (tag: string) => setState(s => ({
              ...s, timbreTags: s.timbreTags.includes(tag) ? s.timbreTags.filter(x => x !== tag) : [...s.timbreTags, tag]
            }));
            return (
              <div className="grid lg:grid-cols-2 gap-3">
                {/* Left: Vocal Traits */}
                <div className="space-y-2">
                  {/* Vocal Range */}
                  <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold">{zh ? '音域范围' : 'Vocal Range'}</h3>
                    </div>
                    <div className="space-y-1">
                      {VOCAL_RANGES.map(vr => (
                        <button key={vr.id} onClick={() => setState(s => ({ ...s, vocalRange: s.vocalRange === vr.id ? '' : vr.id }))}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border text-left transition-all ${state.vocalRange === vr.id ? 'border-opacity-60' : 'border-white/5 hover:border-white/10'}`}
                          style={state.vocalRange === vr.id ? { borderColor: vr.color + '60', backgroundColor: vr.color + '12', boxShadow: `0 0 6px ${vr.color}20` } : {}}>
                          <span className="text-[9px] font-mono font-bold flex-shrink-0 w-8 text-center" style={{ color: vr.color }}>{vr.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-semibold" style={{ color: state.vocalRange === vr.id ? vr.color : undefined }}>
                              {zh ? vr.zh : vr.en}
                            </div>
                            <div className="text-[9px] text-gray-500 leading-tight">{zh ? vr.desc_zh : vr.desc_en}</div>
                          </div>
                          {state.vocalRange === vr.id && <Check className="w-3 h-3 flex-shrink-0" style={{ color: vr.color }} />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Primary Genre */}
                  <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold">{zh ? '主打曲风' : 'Primary Genre'}</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {GENRE_LIST.map(g => (
                        <button key={g} onClick={() => setState(s => ({ ...s, primaryGenre: s.primaryGenre === g ? '' : g }))}
                          className={`px-2 py-1.5 rounded-lg text-[10px] border text-center transition-all ${state.primaryGenre === g ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-white/5 text-gray-500 hover:border-white/15'}`}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Timbre + Appearance Details */}
                <div className="space-y-2">
                  {/* Timbre */}
                  <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold">{zh ? '音色特征' : 'Timbre Tags'}</h3>
                      <span className="ml-auto text-[9px] text-gray-600">{zh ? '可多选' : 'Multi-select'}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {TIMBRE_TAGS.map(tag => {
                        const active = state.timbreTags.includes(tag);
                        return (
                          <motion.button key={tag} whileTap={{ scale: 0.95 }}
                            onClick={() => toggleTimbre(tag)}
                            className={`px-2 py-0.5 rounded-full text-[10px] border transition-all ${active ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-white/5 text-gray-500 hover:border-white/15'}`}>
                            {tag}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Appearance Details */}
                  <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold">{zh ? '外貌细节' : 'Appearance Details'}</h3>
                    </div>
                    {/* Age & Height */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1.5">{zh ? '年龄' : 'Age'}: <span className="text-white">{state.age}</span></label>
                        <input type="range" min={14} max={45} value={state.age} onChange={e => setState(s => ({ ...s, age: +e.target.value }))}
                          className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer accent-cyan-500" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1.5">{zh ? '身高' : 'Height'}: <span className="text-white">{state.height}cm</span></label>
                        <input type="range" min={150} max={195} value={state.height} onChange={e => setState(s => ({ ...s, height: +e.target.value }))}
                          className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer accent-purple-500" />
                      </div>
                    </div>
                    {/* Body Type */}
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1.5">{zh ? '体型' : 'Body Type'}</label>
                      <div className="flex flex-wrap gap-1">
                        {BODY_TYPES.map(bt => (
                          <button key={bt} onClick={() => setState(s => ({ ...s, bodyType: bt }))}
                            className={`px-2 py-0.5 rounded-full text-[10px] border transition ${state.bodyType === bt ? 'border-pink-500/40 bg-pink-500/10 text-pink-300' : 'border-white/5 text-gray-500 hover:border-white/15'}`}>
                            {bt}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Hair Color */}
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1.5">{zh ? '发色' : 'Hair Color'}</label>
                      <div className="flex flex-wrap gap-1">
                        {HAIR_COLORS.map(hc => (
                          <button key={hc} onClick={() => setState(s => ({ ...s, hairColor: hc }))}
                            className={`px-2 py-0.5 rounded-full text-[10px] border transition ${state.hairColor === hc ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-white/5 text-gray-500 hover:border-white/15'}`}>
                            {hc}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Face & Fashion Styles */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1.5">{zh ? '面相风格' : 'Face Style'}</label>
                        <select value={state.faceStyle} onChange={e => setState(s => ({ ...s, faceStyle: e.target.value }))}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/40">
                          {[['sweet','甜美'],['cool','酷帅'],['elegant','优雅'],['cute','可爱'],['sharp','凌厉'],['soft','温柔']].map(([id, label]) => (
                            <option key={id} value={id}>{zh ? label : id.charAt(0).toUpperCase() + id.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1.5">{zh ? '时尚风格' : 'Fashion'}</label>
                        <select value={state.fashionStyle} onChange={e => setState(s => ({ ...s, fashionStyle: e.target.value }))}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/40">
                          {[['modern','现代潮流'],['retro','复古'],['cyberpunk','赛博朋克'],['casual','休闲'],['formal','正式'],['sporty','运动']].map(([id, label]) => (
                            <option key={id} value={id}>{zh ? label : id.charAt(0).toUpperCase() + id.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* STEP 4: Talent Skill Tree */}
          {step === 4 && (
            <div className="space-y-3">
              {/* Skill Tree */}
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3">
                <SkillTreePanel
                  lang={lang}
                  artistType={state.type}
                  talents={state.talents}
                  subSkillPoints={state.subSkillPoints}
                  onChange={pts => setState(s => ({ ...s, subSkillPoints: pts }))}
                />
              </div>

              {/* Classic talent sliders + radar */}
              <div className="grid lg:grid-cols-2 gap-3">
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3 space-y-2">
                <p className="text-[10px] text-gray-500">{t.talent_desc}</p>

                {/* Style Tag Boost Banner */}
                {forgeResult && forgeResult.styleTags.length > 0 && (() => {
                  const boosts = computeStyleBoosts(forgeResult.styleTags);
                  const hasBoosts = Object.keys(boosts).length > 0;
                  if (!hasBoosts) return null;
                  return (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-gradient-to-r from-amber-500/10 to-purple-500/10 border border-amber-500/20 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-amber-300 font-semibold">{zh ? '形象风格加成可用' : 'Style Tag Bonus Available'}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(boosts).map(([key, val]) => {
                          const lbl = TALENT_LABELS[key as keyof TalentProfile];
                          return (
                            <Badge key={key} className="text-[10px] bg-green-500/15 text-green-300 border-green-500/20">
                              {zh ? lbl.zh : lbl.en} +{val}
                            </Badge>
                          );
                        })}
                      </div>
                      <Button size="sm" variant="outline"
                        className="text-[10px] h-6 px-2 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                        onClick={() => {
                          setPreBoostTalents(state.talents);
                          setState(s => {
                            const newTalents = { ...s.talents };
                            for (const [key, val] of Object.entries(boosts)) {
                              const k = key as keyof TalentProfile;
                              const cap = typeConf.talentCaps[k];
                              newTalents[k] = Math.min(cap, (newTalents[k] || 0) + (val as number));
                            }
                            return { ...s, talents: newTalents };
                          });
                          setBoostApplied(true);
                        }}>
                        <Zap className="w-2.5 h-2.5 mr-1" /> {zh ? '应用加成' : 'Apply Bonus'}
                      </Button>
                      {boostApplied && preBoostTalents && (
                        <Button size="sm" variant="outline"
                          className="text-[10px] h-6 px-2 border-red-500/30 text-red-300 hover:bg-red-500/10"
                          onClick={() => {
                            setState(s => ({ ...s, talents: { ...preBoostTalents } }));
                            setBoostApplied(false);
                            setPreBoostTalents(null);
                          }}>
                          <Undo2 className="w-2.5 h-2.5 mr-1" /> {zh ? '撤销加成' : 'Undo Bonus'}
                        </Button>
                      )}
                    </motion.div>
                  );
                })()}

                {talentKeys.map(key => {
                  const lbl = TALENT_LABELS[key];
                  const val = state.talents[key];
                  const cap = typeConf.talentCaps[key];
                  const isPrimary = typeConf.primaryTalents.includes(key);
                  return (
                    <div key={key} className="space-y-0.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400 flex items-center gap-1">
                          {zh ? lbl.zh : lbl.en}
                          {isPrimary && <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />}
                        </span>
                        <span className="font-semibold" style={{ color: lbl.color }}>{val}<span className="text-gray-600">/{cap}</span></span>
                      </div>
                      <input type="range" min={0} max={cap} value={Math.min(val, cap)}
                        onChange={e => setState(s => ({ ...s, talents: { ...s.talents, [key]: +e.target.value } }))}
                        className="w-full h-1 bg-gray-800 rounded-full appearance-none cursor-pointer accent-cyan-500
                          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-900 [&::-webkit-slider-thumb]:shadow"
                        style={{ ['--tw-accent' as any]: lbl.color }} />
                    </div>
                  );
                })}
              </div>
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3">
                <h3 className="text-xs font-bold mb-2">{zh ? '能力雷达' : 'Talent Radar'}</h3>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                      <PolarGrid stroke="rgba(255,255,255,0.08)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 11 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Value" dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.25} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            </div>
          )}

          {/* STEP 5: Fan Business */}
          {step === 5 && (() => {
            const SUPPORT_COLORS = [
              { name: zh ? '霓虹青' : 'Neon Cyan',    hex: '#06b6d4' },
              { name: zh ? '幻彩紫' : 'Holo Violet',  hex: '#a855f7' },
              { name: zh ? '樱花粉' : 'Cherry Pink',  hex: '#f472b6' },
              { name: zh ? '荧光绿' : 'Neon Green',   hex: '#10b981' },
              { name: zh ? '金橙色' : 'Golden Orange', hex: '#f59e0b' },
              { name: zh ? '赛博蓝' : 'Cyber Blue',   hex: '#3b82f6' },
              { name: zh ? '炽热红' : 'Blaze Red',    hex: '#ef4444' },
              { name: zh ? '玫瑰金' : 'Rose Gold',    hex: '#e879f9' },
              { name: zh ? '幻白' : 'Holo White',     hex: '#e2e8f0' },
              { name: zh ? '星际黑' : 'Space Black',  hex: '#475569' },
            ];
            const EXCLUSIONS = zh
              ? ['烟草酒类', '博彩赌注', '医美整形', '消费金融', '竞争品牌', '成人内容', '政治相关', '暴力游戏', '高风险投资', '争议食品']
              : ['Tobacco/Alcohol', 'Gambling', 'Cosmetic Surgery', 'Loan Finance', 'Competing Brand', 'Adult Content', 'Political', 'Violent Games', 'High-Risk Investment', 'Controversial Food'];
            const AGE_RANGES = [
              { id: '13-17', zh: '学生群体 (13-17)', en: 'Students (13-17)' },
              { id: '18-24', zh: 'Z世代主力 (18-24)', en: 'Gen-Z Core (18-24)' },
              { id: '25-35', zh: '千禧一代 (25-35)', en: 'Millennial (25-35)' },
              { id: '35+',   zh: '白领精英 (35+)',   en: 'White-Collar (35+)' },
              { id: 'all',   zh: '全年龄段',          en: 'All Ages' },
            ];
            const REGIONS = zh
              ? ['一线城市', '二线城市', '三四线城市', '下沉市场', '海外华人', '全球粉丝']
              : ['Tier-1 City', 'Tier-2 City', 'Tier-3/4 City', 'Rural Markets', 'Overseas Chinese', 'Global Fans'];
            const toggleExclusion = (e: string) => setState(s => ({ ...s, commercialExclusions: s.commercialExclusions.includes(e) ? s.commercialExclusions.filter(x => x !== e) : [...s.commercialExclusions, e] }));
            const toggleRegion = (r: string) => setState(s => ({ ...s, fanRegions: s.fanRegions.includes(r) ? s.fanRegions.filter(x => x !== r) : [...s.fanRegions, r] }));

            // Predict fan portrait
            const predictFanPersona = () => {
              const { type, sweetness, energy, personaTags, fanAgeRange } = state;
              if (type === 'idol' && sweetness > 65) return zh ? '以18-24岁女性为主的应援型核心粉丝群，注重情感连接与周边消费' : 'Core female fans aged 18-24, focused on emotional connection and merch spending';
              if (type === 'singer' && energy > 60) return zh ? '音乐爱好者为主，跨年龄层分布，以流媒体消费和演唱会票务为核心变现' : 'Music enthusiasts across age groups, streaming and concert ticket focus';
              if (type === 'entertainer') return zh ? '泛娱乐粉丝，男女均衡，以广告植入和直播互动变现为主' : 'General entertainment fans, balanced gender, focused on ads and live interaction';
              if (type === 'dancer') return zh ? '舞蹈爱好者和艺术类受众为主，18-30岁为核心，注重内容质量' : 'Dance enthusiasts and art lovers, 18-30 core, quality-content driven';
              if (personaTags.includes('学霸人设') || personaTags.includes('Scholar')) return zh ? '知识消费型粉丝，偏向25-35岁，购买力强，愿意为高质量内容付费' : 'Knowledge-focused fans, 25-35, high purchasing power for premium content';
              return zh ? '综合型粉丝群体，具有多元化消费潜力和跨平台活跃度' : 'Diverse fan group with multi-platform activity and varied consumption potential';
            };

            return (
              <div className="grid lg:grid-cols-2 gap-3">
                {/* Left: Support Color + Commercial Exclusions */}
                <div className="space-y-2">
                  {/* Support Color */}
                  <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold">{zh ? '应援色' : 'Support Color'}</h3>
                    </div>
                    {/* Presets */}
                    <div className="grid grid-cols-5 gap-2">
                      {SUPPORT_COLORS.map(sc => (
                        <button key={sc.hex} title={sc.name}
                          onClick={() => setState(s => ({ ...s, supportColor: sc.hex }))}
                          className={`relative w-full aspect-square rounded-xl border-2 transition-all ${state.supportColor === sc.hex ? 'scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                          style={{
                            backgroundColor: sc.hex,
                            borderColor: state.supportColor === sc.hex ? sc.hex : 'transparent',
                            boxShadow: state.supportColor === sc.hex ? `0 0 12px ${sc.hex}70` : undefined,
                          }}>
                          {state.supportColor === sc.hex && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Check className="w-3 h-3 text-white drop-shadow" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    {/* Custom picker */}
                    <div className="flex items-center gap-3">
                      <label className="text-[10px] text-gray-500">{zh ? '自定义' : 'Custom'}</label>
                      <label className="relative w-10 h-10 rounded-xl overflow-hidden border-2 cursor-pointer hover:border-white/30 transition"
                        style={{ backgroundColor: state.supportColor, borderColor: state.supportColor + '80' }}>
                        <input type="color" value={state.supportColor}
                          onChange={e => setState(s => ({ ...s, supportColor: e.target.value }))}
                          className="absolute inset-0 opacity-0 cursor-pointer" />
                      </label>
                      <span className="text-xs font-mono text-gray-400">{state.supportColor}</span>
                      {/* Preview fan lightstick */}
                      <div className="ml-auto flex items-center gap-1">
                        <motion.div
                          className="w-3 h-8 rounded-full"
                          style={{ backgroundColor: state.supportColor }}
                          animate={{ opacity: [0.7, 1, 0.7], boxShadow: [`0 0 4px ${state.supportColor}60`, `0 0 10px ${state.supportColor}`, `0 0 4px ${state.supportColor}60`] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                        <span className="text-[9px] text-gray-600">{zh ? '应援棒' : 'Lightstick'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Commercial Exclusions */}
                  <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold">{zh ? '商业禁区' : 'Commercial Exclusions'}</h3>
                    </div>
                    <p className="text-[10px] text-gray-500">{zh ? '设定不可接受的代言品类，保护艺人品牌价值' : 'Set categories to exclude from brand deals'}</p>
                    <div className="flex flex-wrap gap-1">
                      {EXCLUSIONS.map(e => {
                        const active = state.commercialExclusions.includes(e);
                        return (
                          <motion.button key={e} whileTap={{ scale: 0.95 }}
                            onClick={() => toggleExclusion(e)}
                            className={`px-2 py-0.5 rounded-full text-[10px] border transition-all ${active ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-white/5 text-gray-500 hover:border-red-500/20'}`}>
                            {active ? 'BAN ' : ''}{e}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right: Fan Demographics + Portrait Prediction */}
                <div className="space-y-2">
                  {/* Fan Demographics */}
                  <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold">{zh ? '粉丝画像' : 'Fan Demographics'}</h3>
                    </div>
                    {/* Age Range */}
                    <div>
                      <label className="text-[9px] text-gray-500 block mb-1">{zh ? '核心年龄层' : 'Core Age Range'}</label>
                      <div className="grid grid-cols-2 gap-1">
                        {AGE_RANGES.map(ar => (
                          <button key={ar.id} onClick={() => setState(s => ({ ...s, fanAgeRange: ar.id }))}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] border text-left transition ${state.fanAgeRange === ar.id ? 'border-blue-500/30 bg-blue-500/10 text-blue-300' : 'border-white/5 text-gray-400 hover:border-white/10'}`}>
                            {state.fanAgeRange === ar.id && <Check className="w-2.5 h-2.5 text-blue-400 flex-shrink-0" />}
                            {zh ? ar.zh : ar.en}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Gender Ratio */}
                    <div>
                      <div className="flex justify-between text-[10px] mb-1.5">
                        <span className="text-pink-400">{zh ? '女性向' : 'Female'} {100 - state.fanGenderRatio}%</span>
                        <span className="text-blue-400">{zh ? '男性向' : 'Male'} {state.fanGenderRatio}%</span>
                      </div>
                      <div className="relative h-4 bg-gray-800 rounded-full overflow-hidden">
                        <motion.div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-pink-500 to-pink-400"
                          animate={{ width: `${100 - state.fanGenderRatio}%` }} transition={{ duration: 0.3 }} />
                        <motion.div className="absolute inset-y-0 right-0 rounded-full bg-gradient-to-l from-blue-500 to-blue-400"
                          animate={{ width: `${state.fanGenderRatio}%` }} transition={{ duration: 0.3 }} />
                      </div>
                      <input type="range" min={0} max={100} value={state.fanGenderRatio}
                        onChange={e => setState(s => ({ ...s, fanGenderRatio: +e.target.value }))}
                        className="w-full h-1 mt-2 bg-transparent appearance-none cursor-pointer" />
                    </div>
                    {/* Regions */}
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-2">{zh ? '主要粉丝地区' : 'Key Fan Regions'}</label>
                      <div className="flex flex-wrap gap-1">
                        {REGIONS.map(r => {
                          const active = state.fanRegions.includes(r);
                          return (
                            <button key={r} onClick={() => toggleRegion(r)}
                              className={`px-2 py-0.5 rounded-full text-[10px] border transition ${active ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-white/5 text-gray-500 hover:border-white/15'}`}>
                              {r}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Fan Portrait Prediction */}
                  <motion.div
                    key={`${state.type}-${state.sweetness}-${state.personaTags.join(',')}`}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-500/15 rounded-xl p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold">{zh ? 'AI粉丝画像预测' : 'AI Fan Portrait'}</h3>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">{predictFanPersona()}</p>
                    {/* Visual fan bars */}
                    <div className="space-y-2 pt-1">
                      {[
                        { label: zh ? '购买转化率' : 'Purchase Rate', value: Math.min(95, 30 + state.confidence * 0.4 + (state.type === 'idol' ? 20 : 0)) },
                        { label: zh ? '内容互动率' : 'Engagement Rate', value: Math.min(95, 20 + state.energy * 0.4 + state.emotionJoy * 0.3) },
                        { label: zh ? '私域转化率' : 'Private Domain Conv.', value: Math.min(95, 15 + state.sweetness * 0.3 + state.emotionWarmth * 0.3) },
                      ].map(({ label, value }) => (
                        <div key={label} className="space-y-0.5">
                          <div className="flex justify-between text-[9px]">
                            <span className="text-gray-500">{label}</span>
                            <span className="text-amber-400 font-mono">{Math.round(value)}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <motion.div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                              animate={{ width: `${value}%` }} transition={{ duration: 0.6 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </div>
            );
          })()}

          {/* STEP 6: Preview + Card Export */}
          {step === 6 && (
            <div className="max-w-3xl mx-auto space-y-3">
              {/* Readiness Dashboard */}
              {(() => {
                const items = [
                  { label: zh ? '艺名设定' : 'Stage Name', done: state.name.length > 0, icon: 'MIC', pts: 10 },
                  { label: zh ? '形象锻造' : 'Appearance', done: !!forgeResult, icon: 'SPK', pts: 15 },
                  { label: zh ? '简介撰写' : 'Bio', done: state.bio.length > 15, icon: 'DOC', pts: 10 },
                  { label: zh ? 'MBTI设定' : 'MBTI Set', done: !!state.mbti, icon: 'DNA', pts: 8 },
                  { label: zh ? '人设标签' : 'Persona Tags', done: state.personaTags.length > 0, icon: 'TAG', pts: 7 },
                  { label: zh ? '说话风格' : 'Speaking Style', done: state.speakingStyle.length > 0, icon: 'CHT', pts: 5 },
                  { label: zh ? '曲风/音色' : 'Vocal Traits', done: !!state.vocalRange || !!state.primaryGenre, icon: 'MUS', pts: 10 },
                  { label: zh ? '技能树' : 'Skill Tree', done: Object.values(state.subSkillPoints).reduce((s,v) => s+v, 0) >= 9, icon: 'TRE', pts: 15 },
                  { label: zh ? '应援色' : 'Support Color', done: !!state.supportColor, icon: 'PAL', pts: 10 },
                  { label: zh ? '商业禁区' : 'Exclusions', done: state.commercialExclusions.length > 0, icon: 'SHD', pts: 10 },
                ];
                const score = items.filter(i => i.done).reduce((s, i) => s + i.pts, 0);
                const maxScore = items.reduce((s, i) => s + i.pts, 0);
                const pct = Math.round((score / maxScore) * 100);
                const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#06b6d4';
                const grade = pct >= 90 ? (zh ? '出道就绪 ✦' : 'Debut Ready ✦') : pct >= 70 ? (zh ? '基本完整' : 'Almost Ready') : pct >= 40 ? (zh ? '继续完善' : 'Keep Going') : (zh ? '待完善' : 'Needs Work');
                return (
                  <div className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="relative w-14 h-14 flex-shrink-0">
                        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                          <circle cx="28" cy="28" r="22" stroke="rgba(255,255,255,0.06)" strokeWidth="5" fill="none" />
                          <motion.circle cx="28" cy="28" r="22" stroke={color} strokeWidth="5" fill="none"
                            strokeLinecap="round" strokeDasharray={`${2*Math.PI*22}`}
                            initial={{ strokeDashoffset: 2*Math.PI*22 }}
                            animate={{ strokeDashoffset: 2*Math.PI*22*(1-pct/100) }} transition={{ duration: 0.6 }}
                            style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-sm font-bold" style={{ color }}>{pct}</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{zh ? '出道就绪度' : 'Debut Readiness'}</span>
                          <Badge className="text-[10px]" style={{ backgroundColor: color + '20', color, borderColor: color + '40' }}>{grade}</Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{score}/{maxScore} pts · {items.filter(i => i.done).length}/{items.length} {zh ? '项已完成' : 'items done'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {items.map(item => (
                        <div key={item.label} className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg border text-center transition-all ${item.done ? 'border-green-500/20 bg-green-500/5' : 'border-white/5'}`}>
                          <span className="text-sm">{item.icon}</span>
                          <span className="text-[8px] leading-tight text-center" style={{ color: item.done ? '#4ade80' : '#4b5563' }}>{item.label}</span>
                          {item.done && <CheckCircle2 className="w-2.5 h-2.5 text-green-400 flex-shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Left: Summary */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      {/* Avatar: forged image or fallback */}
                      <div className="w-14 h-14 rounded-full overflow-hidden border border-white/10 flex-shrink-0 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 flex items-center justify-center">
                        {forgeResult ? (
                          <img src={forgeResult.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl">{typeConf.icon}</span>
                        )}
                      </div>
                      <div>
                        <h3 className="text-base font-bold" style={{ fontFamily: "var(--font-display)" }}>{state.name || '???'}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge className={`text-[10px] ${typeConf.bgColor} ${typeConf.color} border-0`}>{zh ? ARTIST_TYPE_LABELS[state.type].zh : ARTIST_TYPE_LABELS[state.type].en}</Badge>
                          <span className="text-[10px] text-gray-500">Lv.1</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{state.bio || (zh ? '暂无简介' : 'No bio yet')}</p>

                    {/* Personality / Trait Summary */}
                    {(state.mbti || state.personaTags.length > 0 || state.primaryGenre || state.supportColor) && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {state.mbti && (
                          <div className="bg-black/30 rounded-lg p-2 border border-white/5 flex items-center gap-1.5">
                            <Brain className="w-3 h-3 text-purple-400 flex-shrink-0" />
                            <span className="text-gray-500">MBTI:</span>
                            <span className="text-purple-300 font-mono font-bold">{state.mbti}</span>
                          </div>
                        )}
                        {state.primaryGenre && (
                          <div className="bg-black/30 rounded-lg p-2 border border-white/5 flex items-center gap-1.5">
                            <Music2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                            <span className="text-gray-500">{zh ? '曲风' : 'Genre'}:</span>
                            <span className="text-emerald-300 truncate">{state.primaryGenre}</span>
                          </div>
                        )}
                        {state.supportColor && (
                          <div className="bg-black/30 rounded-lg p-2 border border-white/5 flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: state.supportColor, boxShadow: `0 0 4px ${state.supportColor}` }} />
                            <span className="text-gray-500">{zh ? '应援色' : 'Support'}:</span>
                            <span className="font-mono text-gray-300" style={{ color: state.supportColor }}>{state.supportColor}</span>
                          </div>
                        )}
                        {state.personaTags.length > 0 && (
                          <div className="bg-black/30 rounded-lg p-2 border border-white/5 col-span-2">
                            <div className="flex flex-wrap gap-1">
                              {state.personaTags.slice(0,4).map(t => <span key={t} className="text-[9px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded">{t}</span>)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Appearance details from forge */}
                    {forgeResult && (
                      <div className="space-y-3 pt-2 border-t border-white/5">
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">{zh ? '锻造形象' : 'Forged Appearance'}</div>
                        {/* Forged portrait */}
                        <div className="relative rounded-xl overflow-hidden aspect-[3/4] max-w-[200px]">
                          <img src={forgeResult.image} alt="" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-2 flex items-end justify-between">
                            <Badge className="bg-white/10 text-[9px] border-0">{forgeResult.templateName || (zh ? '自定义' : 'Custom')}</Badge>
                          </div>
                          {/* Holographic border */}
                          <div className="absolute inset-0 rounded-xl pointer-events-none" style={{ boxShadow: 'inset 0 0 20px rgba(0,212,255,0.15), inset 0 0 40px rgba(168,85,247,0.08)' }} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {forgeResult.hair && (
                            <div className="bg-black/30 rounded-lg p-2.5 border border-white/5">
                              <span className="text-gray-500">{zh ? '发型' : 'Hair'}: </span>
                              <span className="text-pink-300">{forgeResult.hair}</span>
                            </div>
                          )}
                          {forgeResult.eyeColor && (
                            <div className="bg-black/30 rounded-lg p-2.5 border border-white/5">
                              <span className="text-gray-500">{zh ? '瞳色' : 'Eyes'}: </span>
                              <span className="text-blue-300">{forgeResult.eyeColor}</span>
                            </div>
                          )}
                        </div>
                        {forgeResult.styleTags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {forgeResult.styleTags.map(tag => (
                              <Badge key={tag} className="text-[10px] bg-amber-500/10 text-amber-300 border-amber-500/20">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* No forge result hint */}
                    {!forgeResult && (
                      <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3 text-xs text-amber-400/80">
                        {zh ? 'TIP 提示：返回步骤02「AI形象锻造炉」生成形象，预览将更完整' : 'TIP Tip: Go back to Step 02 "AI Appearance Forge" to generate an image for a richer preview'}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                        <span className="text-gray-500">{zh ? '年龄' : 'Age'}: </span><span className="text-white">{state.age}</span>
                      </div>
                      <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                        <span className="text-gray-500">{zh ? '身高' : 'Height'}: </span><span className="text-white">{state.height}cm</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-2">{zh ? '专属工坊' : 'Workshop'}</div>
                      <Badge className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/20">{zh ? typeConf.workshop.zh : typeConf.workshop.en}</Badge>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-2">{zh ? '变现路径' : 'Monetization'}</div>
                      <div className="flex flex-wrap gap-1">
                        {(zh ? typeConf.monetization.zh : typeConf.monetization.en).map(m => (
                          <Badge key={m} className="text-[10px] bg-white/5 text-gray-300 border-0">{m}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Right: Radar */}
                  <div className="space-y-4">
                    {/* Talent Radar */}
                    <div>
                      <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">{zh ? '才艺雷达' : 'Talent Radar'}</h4>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                            <PolarGrid stroke="rgba(255,255,255,0.08)" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 10 }} />
                            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar name="Value" dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.25} strokeWidth={2} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Face Parameters Radar (from forge) */}
                    {forgeResult && Object.keys(forgeResult.faceValues).length > 0 && (
                      <div>
                        <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">{zh ? '面部参数' : 'Face Parameters'}</h4>
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart
                              data={FORGE_FACE_SLIDERS.map(s => ({
                                subject: s[lang],
                                value: forgeResult.faceValues[s.id] ?? 50,
                              }))}
                              cx="50%" cy="50%" outerRadius="70%"
                            >
                              <PolarGrid stroke="rgba(255,255,255,0.08)" />
                              <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 10 }} />
                              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                              <Radar name="Face" dataKey="value" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} strokeWidth={2} />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-gray-500 text-center">{zh ? typeConf.previewScene.zh : typeConf.previewScene.en}</div>
                  </div>
                </div>

                {/* Template Presets */}
                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{zh ? '快速模板' : 'Quick Templates'}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 mb-1">
                    {CARD_PRESETS.map(preset => {
                      const active = cardTheme === preset.theme && cardLayout === preset.layout;
                      const thm = CARD_THEMES[preset.theme];
                      return (
                        <button key={preset.id} onClick={() => applyPreset(preset)}
                          className={`group relative flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-[10px] transition ${active ? 'border-white/20 bg-white/5 text-white ring-1 ring-white/10' : 'border-white/5 text-gray-500 hover:border-white/10 hover:bg-white/[0.02]'}`}>
                          <span className="text-[9px] font-mono font-bold text-gray-400">{preset.emoji}</span>
                          <span className="truncate w-full text-center">{zh ? preset.zh : preset.en}</span>
                          <div className="flex gap-0.5 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: thm.accent1 }} />
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: thm.accent2 }} />
                          </div>
                          {active && <div className="absolute top-1 right-1"><Check className="w-2.5 h-2.5 text-green-400" /></div>}
                          {/* Tooltip on hover */}
                          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 whitespace-nowrap bg-gray-900 border border-white/10 rounded px-1.5 py-0.5 text-[9px] text-gray-400 shadow-lg">
                            {zh ? preset.desc_zh : preset.desc_en}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Card Theme Picker + Live Preview */}
                <div className="mt-3 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{zh ? '导出卡片主题' : 'Card Export Theme'}</span>
                  </div>
                  <div className="flex gap-4">
                    {/* Theme buttons */}
                    <div className="flex flex-col gap-2 flex-1">
                      {(Object.keys(CARD_THEMES) as CardTheme[]).map(themeKey => {
                        const thm = CARD_THEMES[themeKey];
                        const active = cardTheme === themeKey;
                        return (
                          <button key={themeKey} onClick={() => setCardTheme(themeKey)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition ${active ? 'border-white/20 bg-white/5 text-white' : 'border-white/5 text-gray-500 hover:border-white/10'}`}>
                            <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${thm.preview} flex-shrink-0`}
                              style={{ boxShadow: active ? `0 0 8px ${thm.accent1}40` : 'none' }} />
                            <span>{zh ? thm.zh : thm.en}</span>
                            {active && <CheckCircle2 className="w-3 h-3 text-green-400 ml-auto" />}
                          </button>
                        );
                      })}
                    </div>
                    {/* Live Canvas Preview */}
                    <div className="flex-shrink-0">
                      <motion.div key={`${cardTheme}-${cardLayout}`} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
                        <button onClick={() => setFullscreenPreview(true)} className="relative group cursor-pointer">
                          <CardPreviewCanvas
                            width={160}
                            opts={{ ...buildCardOpts(), imageUrl: null }}
                            animated={animatedPreview}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <Maximize2 className="w-5 h-5 text-white drop-shadow-lg" />
                          </div>
                        </button>
                      </motion.div>
                      <p className="text-[10px] text-gray-600 text-center mt-1">{zh ? '点击放大预览' : 'Click to enlarge'}</p>
                    </div>
                  </div>

                  {/* Custom color pickers */}
                  <AnimatePresence>
                    {cardTheme === 'custom' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden">
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-500">{zh ? '主色' : 'Primary'}</span>
                            <label className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/10 cursor-pointer hover:border-white/30 transition" style={{ backgroundColor: customColors.c1 }}>
                              <input type="color" value={customColors.c1}
                                onChange={e => setCustomColors(c => ({ ...c, c1: e.target.value }))}
                                className="absolute inset-0 opacity-0 cursor-pointer" />
                            </label>
                            <span className="text-[10px] text-gray-600 font-mono">{customColors.c1}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-500">{zh ? '辅色' : 'Secondary'}</span>
                            <label className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/10 cursor-pointer hover:border-white/30 transition" style={{ backgroundColor: customColors.c2 }}>
                              <input type="color" value={customColors.c2}
                                onChange={e => setCustomColors(c => ({ ...c, c2: e.target.value }))}
                                className="absolute inset-0 opacity-0 cursor-pointer" />
                            </label>
                            <span className="text-[10px] text-gray-600 font-mono">{customColors.c2}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Card Layout Selector */}
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{zh ? '卡片版式' : 'Card Layout'}</span>
                    </div>
                    <div className="flex gap-2">
                      {(Object.keys(CARD_LAYOUTS) as CardLayout[]).map(layoutKey => {
                        const lay = CARD_LAYOUTS[layoutKey];
                        const active = cardLayout === layoutKey;
                        const Icon = lay.icon;
                        return (
                          <button key={layoutKey} onClick={() => setCardLayout(layoutKey)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition flex-1 ${active ? 'border-cyan-500/30 bg-cyan-500/5 text-cyan-400' : 'border-white/5 text-gray-500 hover:border-white/10'}`}>
                            <Icon className="w-3.5 h-3.5" />
                            <span>{zh ? lay.zh : lay.en}</span>
                            <span className="text-[10px] text-gray-600 ml-auto">{lay.w}x{lay.h}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Watermark Controls */}
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <button onClick={() => updateWM({ enabled: !watermark.enabled })}
                      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-xs transition mb-2 ${watermark.enabled ? 'border-orange-500/30 bg-orange-500/5 text-orange-400' : 'border-white/5 text-gray-500 hover:border-white/10'}`}>
                      <span className="text-sm">{watermark.enabled ? 'LCK' : 'ULK'}</span>
                      {zh ? (watermark.enabled ? '水印已开启' : '添加水印') : (watermark.enabled ? 'Watermark ON' : 'Add Watermark')}
                    </button>
                    <AnimatePresence>
                      {watermark.enabled && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-2.5">
                          {/* Mode toggle: text vs logo */}
                          <div className="grid grid-cols-2 gap-1">
                            <button onClick={() => updateWM({ mode: 'text' })}
                              className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] transition ${watermark.mode === 'text' ? 'border-orange-500/30 bg-orange-500/5 text-orange-400' : 'border-white/5 text-gray-600 hover:border-white/10'}`}>
                              <span>Aa</span> {zh ? '文字' : 'Text'}
                            </button>
                            <button onClick={() => updateWM({ mode: 'logo' })}
                              className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] transition ${watermark.mode === 'logo' ? 'border-orange-500/30 bg-orange-500/5 text-orange-400' : 'border-white/5 text-gray-600 hover:border-white/10'}`}>
                              <ImageIcon className="w-3 h-3" /> {zh ? 'Logo' : 'Logo'}
                            </button>
                          </div>

                          {watermark.mode === 'text' ? (
                            <>
                              <input type="text" value={watermark.text}
                                onChange={e => updateWM({ text: e.target.value })}
                                placeholder={zh ? '水印文字...' : 'Watermark text...'}
                                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/30" />
                              {/* Font size */}
                              <div>
                                <div className="flex justify-between text-[10px] mb-0.5">
                                  <span className="text-gray-500">{zh ? '字号' : 'Size'}</span>
                                  <span className="text-orange-400">{watermark.fontSize}px</span>
                                </div>
                                <input type="range" min={8} max={48} value={watermark.fontSize}
                                  onChange={e => updateWM({ fontSize: +e.target.value })}
                                  className="w-full h-1 bg-gray-800 rounded-full appearance-none cursor-pointer accent-orange-500" />
                              </div>
                            </>
                          ) : (
                            <>
                              {/* Logo upload */}
                              <input ref={logoInputRef} type="file" accept="image/png,image/svg+xml,image/webp" onChange={handleLogoUpload} className="hidden" />
                              <div className="flex items-center gap-2">
                                <button onClick={() => logoInputRef.current?.click()}
                                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-white/10 text-[10px] text-gray-500 hover:border-orange-500/20 hover:text-orange-400 transition">
                                  <ImageIcon className="w-3.5 h-3.5" />
                                  {watermark.logoUrl ? (zh ? '更换Logo' : 'Change Logo') : (zh ? '上传PNG/SVG' : 'Upload PNG/SVG')}
                                </button>
                                {watermark.logoUrl && (
                                  <div className="w-10 h-10 rounded-lg border border-white/10 bg-black/30 p-1 flex-shrink-0">
                                    <img src={watermark.logoUrl} alt="logo" className="w-full h-full object-contain" />
                                  </div>
                                )}
                              </div>
                              {watermark.logoUrl && (
                                <div>
                                  <div className="flex justify-between text-[10px] mb-0.5">
                                    <span className="text-gray-500">{zh ? 'Logo尺寸' : 'Logo Size'}</span>
                                    <span className="text-orange-400">{watermark.logoSize}px</span>
                                  </div>
                                  <input type="range" min={20} max={120} value={watermark.logoSize}
                                    onChange={e => updateWM({ logoSize: +e.target.value })}
                                    className="w-full h-1 bg-gray-800 rounded-full appearance-none cursor-pointer accent-orange-500" />
                                </div>
                              )}
                            </>
                          )}

                          {/* Position grid */}
                          <div>
                            <span className="text-[10px] text-gray-500 block mb-1">{zh ? '位置' : 'Position'}</span>
                            <div className="flex items-end gap-3">
                              <div className="grid grid-cols-3 gap-1 w-24">
                                {(['tl','tc','tr','cl','cc','cr','bl','bc','br'] as const).map(pos => (
                                  <button key={pos} onClick={() => updateWM({ position: pos, tiled: false })}
                                    className={`w-7 h-7 rounded border text-[8px] transition ${watermark.position === pos && !watermark.tiled ? 'border-orange-500/40 bg-orange-500/10 text-orange-400' : 'border-white/5 text-gray-600 hover:border-white/10'}`}>
                                    {pos.toUpperCase()}
                                  </button>
                                ))}
                              </div>
                              <button onClick={() => updateWM({ tiled: !watermark.tiled })}
                                className={`px-2 py-1.5 rounded border text-[10px] transition ${watermark.tiled ? 'border-orange-500/40 bg-orange-500/10 text-orange-400' : 'border-white/5 text-gray-600 hover:border-white/10'}`}>
                                {zh ? '平铺' : 'Tile'}
                              </button>
                            </div>
                          </div>
                          {/* Opacity */}
                          <div>
                            <div className="flex justify-between text-[10px] mb-0.5">
                              <span className="text-gray-500">{zh ? '透明度' : 'Opacity'}</span>
                              <span className="text-orange-400">{watermark.opacity}%</span>
                            </div>
                            <input type="range" min={5} max={100} value={watermark.opacity}
                              onChange={e => updateWM({ opacity: +e.target.value })}
                              className="w-full h-1 bg-gray-800 rounded-full appearance-none cursor-pointer accent-orange-500" />
                          </div>
                          {/* Rotation */}
                          <div>
                            <div className="flex justify-between text-[10px] mb-0.5">
                              <span className="text-gray-500">{zh ? '旋转' : 'Rotation'}</span>
                              <span className="text-orange-400">{watermark.rotation}°</span>
                            </div>
                            <input type="range" min={-45} max={45} value={watermark.rotation}
                              onChange={e => updateWM({ rotation: +e.target.value })}
                              className="w-full h-1 bg-gray-800 rounded-full appearance-none cursor-pointer accent-orange-500" />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Animation toggle + Action buttons */}
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                    <button onClick={() => setAnimatedPreview(a => !a)}
                      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-xs transition ${animatedPreview ? 'border-cyan-500/30 bg-cyan-500/5 text-cyan-400' : 'border-white/5 text-gray-500 hover:border-white/10'}`}>
                      {animatedPreview ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      {zh ? (animatedPreview ? '暂停赛博动效' : '启用赛博动效') : (animatedPreview ? 'Pause Cyber FX' : 'Enable Cyber FX')}
                      <span className="ml-auto text-[10px] text-gray-600">{zh ? '扫描线+粒子' : 'Scanline+Particles'}</span>
                    </button>
                    {/* Template Library + Export Format */}
                    <div className="flex gap-2">
                      <button onClick={() => setShowTemplateLib(true)}
                        className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-violet-500/20 text-xs text-violet-400 hover:bg-violet-500/5 transition">
                        <LayoutTemplate className="w-3.5 h-3.5" />
                        {zh ? '模板库' : 'Templates'}
                        <Badge className="ml-auto text-[9px] bg-violet-500/10 border-violet-500/20 text-violet-400 px-1 py-0">{CARD_PRESETS.length}</Badge>
                      </button>
                      <div className="flex rounded-lg border border-white/5 overflow-hidden">
                        {(Object.keys(EXPORT_FORMATS) as ExportFormat[]).map(fmt => (
                          <button key={fmt} onClick={() => setExportFormat(fmt)}
                            className={`px-2 py-1.5 text-[10px] transition ${exportFormat === fmt ? 'bg-white/10 text-white' : 'text-gray-600 hover:text-gray-400'}`}>
                            {EXPORT_FORMATS[fmt].label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Button variant="outline" size="sm"
                        className="border-purple-500/20 text-purple-300 hover:bg-purple-500/10 gap-1"
                        onClick={() => setShowShareModal(true)}>
                        <Share2 className="w-3.5 h-3.5" />
                        {zh ? '分享' : 'Share'}
                      </Button>
                      <Button variant="outline" size="sm"
                        className="border-amber-500/20 text-amber-300 hover:bg-amber-500/10 gap-1"
                        onClick={() => setShowBatchExport(true)}>
                        <Package className="w-3.5 h-3.5" />
                        {zh ? '批量' : 'Batch'}
                      </Button>
                      <Button variant="outline" size="sm"
                        className="border-sky-500/20 text-sky-300 hover:bg-sky-500/10 gap-1"
                        onClick={openCompare}>
                        <Columns2 className="w-3.5 h-3.5" />
                        {zh ? '对比' : 'A/B'}
                      </Button>
                    </div>

                    {/* Snapshot save + history toggle */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm"
                        className="border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/10 gap-1.5"
                        onClick={() => saveSnapshot()}>
                        <Save className="w-3.5 h-3.5" />
                        {zh ? '保存快照' : 'Save Snap'}
                      </Button>
                      <Button variant="outline" size="sm"
                        className={`gap-1.5 ${showHistory ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400' : 'border-white/10 text-gray-400 hover:text-white'}`}
                        onClick={() => setShowHistory(h => !h)}>
                        <History className="w-3.5 h-3.5" />
                        {zh ? `历史 (${snapshots.length})` : `History (${snapshots.length})`}
                      </Button>
                    </div>

                    {/* History panel */}
                    <AnimatePresence>
                      {showHistory && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          {/* Import/Export toolbar */}
                          <div className="mt-2 flex gap-1.5 mb-1.5">
                            <input ref={configImportRef} type="file" accept=".json" onChange={importConfig} className="hidden" />
                            <button onClick={exportConfig}
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-white/5 text-[10px] text-gray-500 hover:border-emerald-500/20 hover:text-emerald-400 transition">
                              {zh ? '导出配置' : 'Export JSON'}
                            </button>
                            <button onClick={() => configImportRef.current?.click()}
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-dashed border-white/5 text-[10px] text-gray-500 hover:border-emerald-500/20 hover:text-emerald-400 transition">
                              {zh ? '导入配置' : 'Import JSON'}
                            </button>
                          </div>
                          <div className="rounded-xl border border-white/5 bg-black/20 max-h-48 overflow-y-auto">
                            {snapshots.length === 0 ? (
                              <div className="px-3 py-4 text-center text-[10px] text-gray-600">
                                {zh ? '暂无快照，点击"保存快照"记录当前配置' : 'No snapshots yet. Click "Save Snap" to record current config.'}
                              </div>
                            ) : (
                              snapshots.map((snap, i) => {
                                const thm = CARD_THEMES[snap.theme];
                                const isEditing = editingSnapId === snap.id;
                                return (
                                  <div key={snap.id}
                                    className={`flex items-center gap-2 px-3 py-2 border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02] transition ${i === 0 ? 'bg-emerald-500/[0.02]' : ''}`}>
                                    <div className="flex-shrink-0 flex gap-0.5">
                                      <div className="w-2 h-2 rounded-full" style={{ background: thm.accent1 }} />
                                      <div className="w-2 h-2 rounded-full" style={{ background: thm.accent2 }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[10px] text-gray-400 truncate">
                                        {zh ? thm.zh : thm.en} · {snap.layout}
                                        {snap.watermark.enabled && ' · LCK'}
                                      </div>
                                      {isEditing ? (
                                        <input autoFocus value={editingSnapLabel}
                                          onChange={e => setEditingSnapLabel(e.target.value)}
                                          onBlur={commitRename}
                                          onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingSnapId(null); }}
                                          className="w-full text-[9px] bg-black/40 border border-emerald-500/20 rounded px-1 py-0.5 text-emerald-300 outline-none" />
                                      ) : (
                                        <div className="text-[9px] text-gray-600 cursor-pointer hover:text-gray-400 transition flex items-center gap-1"
                                          onClick={() => startRename(snap)}>
                                          {snap.label} <Pencil className="w-2 h-2 opacity-0 group-hover:opacity-100" />
                                        </div>
                                      )}
                                    </div>
                                    <button onClick={() => startRename(snap)}
                                      className="flex-shrink-0 p-1 rounded hover:bg-white/5 text-gray-600 hover:text-gray-400 transition"
                                      title={zh ? '重命名' : 'Rename'}>
                                      <Pencil className="w-2.5 h-2.5" />
                                    </button>
                                    <button onClick={() => restoreSnapshot(snap)}
                                      className="flex-shrink-0 p-1 rounded hover:bg-emerald-500/10 text-gray-500 hover:text-emerald-400 transition"
                                      title={zh ? '恢复' : 'Restore'}>
                                      <RotateCcw className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => deleteSnapshot(snap.id)}
                                      className="flex-shrink-0 p-1 rounded hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition"
                                      title={zh ? '删除' : 'Delete'}>
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          )}
              </motion.div>
            </AnimatePresence>
            </div>{/* end step content */}

          </div>{/* end scrollable area */}

          {/* Navigation Buttons — sticky footer */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-white/5 bg-black/10">
        {/* Readiness Score (compact) */}
        {(() => {
          const checks = [
            state.name.length > 0,
            !!forgeResult,
            state.bio.length > 15,
            !!state.mbti,
            state.speakingStyle.length > 0,
            state.personaTags.length > 0,
            !!state.vocalRange || !!state.primaryGenre,
            Object.values(state.subSkillPoints).reduce((s,v) => s+v, 0) >= 6,
            !!state.supportColor,
            state.commercialExclusions.length > 0,
          ];
          const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
          const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#6b7280';
          return (
            <div className="flex items-center gap-2">
              <div className="relative w-8 h-8">
                <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                  <circle cx="16" cy="16" r="13" stroke="rgba(255,255,255,0.05)" strokeWidth="3" fill="none" />
                  <motion.circle cx="16" cy="16" r="13" stroke={color} strokeWidth="3" fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 13}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 13 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 13 * (1 - score / 100) }}
                    transition={{ duration: 0.5 }} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold" style={{ color }}>{score}</span>
              </div>
              <span className="text-[10px] text-gray-500">{zh ? '就绪度' : 'Readiness'}</span>
            </div>
          );
        })()}

        <div className="flex items-center gap-2">
          {step > 0 && (
            <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)}
              className="border-white/10 text-gray-400 hover:text-white gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> {zh ? '上一步' : 'Back'}
            </Button>
          )}
          {step < steps.length - 1 ? (
            <Button size="sm" onClick={() => setStep(s => s + 1)}
              className="bg-gradient-to-r from-cyan-500/80 to-purple-600/80 hover:opacity-90 gap-1">
              {zh ? '下一步' : 'Next'} <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleCreate} disabled={creating || !state.name}
              className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 gap-1.5 disabled:opacity-50">
              {creating ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {zh ? '孵化中...' : 'Incubating...'}</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> {zh ? 'CEL 正式出道！' : 'CEL Make Debut!'}</>
              )}
            </Button>
          )}
        </div>{/* end buttons row */}
          </div>{/* end nav footer */}
        </div>{/* end right panel */}
      </div>{/* end outer flex */}

      {/* Modals (fixed overlay — rendered outside height-constrained panel) */}
      {/* Debut Ceremony Modal */}
      <AnimatePresence>
        {showCeremony && (
          <DebutCeremony
            lang={lang}
            artistName={state.name}
            artistType={zh ? ARTIST_TYPE_LABELS[state.type].zh : ARTIST_TYPE_LABELS[state.type].en}
            artistIcon={typeConf.icon}
            forgeImageUrl={forgeResult?.image || null}
            rarity={gachaRarity}
            onExport={() => exportArtistCard(buildCardOpts(), exportFormat)}
            onShare={() => { setShowCeremony(false); setShowShareModal(true); }}
            onGoToMatrix={() => { setShowCeremony(false); setCreated(true); }}
          />
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md"
            onClick={() => setShowShareModal(false)}>
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.85, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-[420px] max-w-[90vw]"
              onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{zh ? '分享艺人卡片' : 'Share Artist Card'}</h3>
                </div>
                <button onClick={() => setShowShareModal(false)} className="text-gray-500 hover:text-white transition"><X className="w-4 h-4" /></button>
              </div>

              {/* Card mini preview */}
              <div className="flex justify-center mb-4">
                <CardPreviewCanvas width={120} opts={buildCardOpts()} />
              </div>

              {/* Share link */}
              <div className="mb-4">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">{zh ? '分享链接' : 'Share Link'}</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-cyan-400 font-mono truncate">
                    <Link className="w-3 h-3 inline mr-1.5 text-gray-500" />{shareLink}
                  </div>
                  <Button size="sm" variant="outline"
                    className={`border-white/10 gap-1 text-xs flex-shrink-0 transition ${linkCopied ? 'text-green-400 border-green-500/30' : 'text-gray-400 hover:text-white'}`}
                    onClick={handleCopyLink}>
                    {linkCopied ? <><Check className="w-3 h-3" /> {zh ? '已复制' : 'Copied'}</> : <><Copy className="w-3 h-3" /> {zh ? '复制' : 'Copy'}</>}
                  </Button>
                </div>
              </div>

              {/* Social platforms */}
              <div className="mb-4">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 block">{zh ? '分享到社交平台' : 'Share to Social'}</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'twitter', label: 'X / Twitter', color: 'bg-gray-800 hover:bg-gray-700', icon: 'X' },
                    { id: 'wechat', label: zh ? '微信' : 'WeChat', color: 'bg-green-900/40 hover:bg-green-800/40', icon: 'WCT' },
                    { id: 'weibo', label: zh ? '微博' : 'Weibo', color: 'bg-red-900/40 hover:bg-red-800/40', icon: 'WBO' },
                    { id: 'discord', label: 'Discord', color: 'bg-indigo-900/40 hover:bg-indigo-800/40', icon: 'DSC' },
                  ].map(p => (
                    <button key={p.id}
                      className={`${p.color} rounded-lg p-3 text-center transition border border-white/5 hover:border-white/15`}
                      onClick={() => {
                        // Simulated share action
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      }}>
                      <div className="text-lg mb-1">{p.icon}</div>
                      <div className="text-[10px] text-gray-400">{p.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Embed code */}
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">{zh ? '嵌入代码' : 'Embed Code'}</label>
                <div className="bg-black/40 border border-white/10 rounded-lg p-2.5 text-[10px] text-gray-500 font-mono break-all select-all">
                  {`<iframe src="${shareLink}/embed" width="${CARD_LAYOUTS[cardLayout].w / 2}" height="${CARD_LAYOUTS[cardLayout].h / 2}" frameborder="0"></iframe>`}
                </div>
              </div>

              {/* Footer note */}
              <p className="text-[10px] text-gray-600 text-center mt-4">{zh ? '* 分享链接为虚拟演示链接，暂不支持真实访问' : '* Share links are virtual demo links, not publicly accessible yet'}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch Export Modal */}
      <AnimatePresence>
        {showBatchExport && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md"
            onClick={() => !batchProgress.active && setShowBatchExport(false)}>
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.85, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-[480px] max-w-[90vw]"
              onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{zh ? '批量导出卡片' : 'Batch Export Cards'}</h3>
                </div>
                <button onClick={() => !batchProgress.active && setShowBatchExport(false)} className="text-gray-500 hover:text-white transition"><X className="w-4 h-4" /></button>
              </div>

              {/* Theme selection */}
              <div className="mb-4">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 block">{zh ? '选择主题' : 'Select Themes'}</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(CARD_THEMES) as CardTheme[]).filter(t => t !== 'custom').map(themeKey => {
                    const thm = CARD_THEMES[themeKey];
                    const active = batchThemes.has(themeKey);
                    return (
                      <button key={themeKey} onClick={() => toggleBatchTheme(themeKey)}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-[11px] transition ${active ? 'border-white/20 bg-white/5 text-white' : 'border-white/5 text-gray-500 hover:border-white/10'}`}>
                        <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${thm.preview} flex-shrink-0`} />
                        <span className="truncate">{zh ? thm.zh : thm.en}</span>
                        {active && <Check className="w-3 h-3 text-green-400 ml-auto flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Layout selection */}
              <div className="mb-4">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 block">{zh ? '选择版式' : 'Select Layouts'}</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(CARD_LAYOUTS) as CardLayout[]).map(layoutKey => {
                    const lay = CARD_LAYOUTS[layoutKey];
                    const active = batchLayouts.has(layoutKey);
                    const Icon = lay.icon;
                    return (
                      <button key={layoutKey} onClick={() => toggleBatchLayout(layoutKey)}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-[11px] transition ${active ? 'border-cyan-500/30 bg-cyan-500/5 text-cyan-400' : 'border-white/5 text-gray-500 hover:border-white/10'}`}>
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{zh ? lay.zh : lay.en}</span>
                        {active && <Check className="w-3 h-3 text-green-400 ml-auto flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Export mode toggle */}
              <div className="mb-4">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 block">{zh ? '导出方式' : 'Export Mode'}</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button onClick={() => setBatchMode('zip')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] transition ${batchMode === 'zip' ? 'border-amber-500/30 bg-amber-500/5 text-amber-400' : 'border-white/5 text-gray-500 hover:border-white/10'}`}>
                    <FileArchive className="w-3.5 h-3.5" />
                    <span>{zh ? 'ZIP压缩包' : 'ZIP Archive'}</span>
                    {batchMode === 'zip' && <Check className="w-3 h-3 text-green-400 ml-auto" />}
                  </button>
                  <button onClick={() => setBatchMode('individual')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] transition ${batchMode === 'individual' ? 'border-amber-500/30 bg-amber-500/5 text-amber-400' : 'border-white/5 text-gray-500 hover:border-white/10'}`}>
                    <Download className="w-3.5 h-3.5" />
                    <span>{zh ? '逐张下载' : 'Individual Files'}</span>
                    {batchMode === 'individual' && <Check className="w-3 h-3 text-green-400 ml-auto" />}
                  </button>
                </div>
              </div>

              {/* Preview matrix */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Grid3X3 className="w-3 h-3 text-gray-500" />
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                    {zh ? `预览矩阵 (${batchThemes.size} × ${batchLayouts.size} = ${batchThemes.size * batchLayouts.size} 张)` : `Preview Matrix (${batchThemes.size} × ${batchLayouts.size} = ${batchThemes.size * batchLayouts.size} cards)`}
                  </span>
                </div>
                <div className="bg-black/30 rounded-lg p-3 border border-white/5 max-h-[180px] overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    {Array.from(batchThemes).flatMap(theme =>
                      Array.from(batchLayouts).map(layout => (
                        <div key={`${theme}-${layout}`} className="relative">
                          <CardPreviewCanvas width={80} opts={{ ...buildCardOpts(), theme, layout, imageUrl: null }} />
                          <div className="absolute bottom-0.5 left-0.5 right-0.5">
                            <div className="bg-black/70 rounded text-[7px] text-gray-400 text-center px-1 py-0.5 truncate backdrop-blur-sm">
                              {(zh ? CARD_THEMES[theme].zh : CARD_THEMES[theme].en).split(' ')[0]} · {zh ? CARD_LAYOUTS[layout].zh : CARD_LAYOUTS[layout].en}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {batchThemes.size === 0 || batchLayouts.size === 0 ? (
                    <p className="text-xs text-gray-600 text-center py-4">{zh ? '请至少选择一个主题和一个版式' : 'Select at least one theme and one layout'}</p>
                  ) : null}
                </div>
              </div>

              {/* Progress bar */}
              {batchProgress.active && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-gray-400">{zh ? '正在导出...' : 'Exporting...'}</span>
                    <span className="text-cyan-400 font-mono">{batchProgress.done}/{batchProgress.total}</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </motion.div>
              )}

              {/* Export button */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm"
                  className="flex-1 border-white/10 text-gray-400 hover:text-white"
                  disabled={batchProgress.active}
                  onClick={() => setShowBatchExport(false)}>
                  {zh ? '取消' : 'Cancel'}
                </Button>
                <Button size="sm"
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 gap-1.5 disabled:opacity-50"
                  disabled={batchProgress.active || batchThemes.size === 0 || batchLayouts.size === 0}
                  onClick={runBatchExport}>
                  {batchProgress.active ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {zh ? '导出中...' : 'Exporting...'}</>
                  ) : (
                    <><Download className="w-3.5 h-3.5" /> {zh ? `导出 ${batchThemes.size * batchLayouts.size} 张卡片` : `Export ${batchThemes.size * batchLayouts.size} Cards`}</>
                  )}
                </Button>
              </div>

              {/* Completion toast */}
              {batchProgress.done === batchProgress.total && batchProgress.total > 0 && !batchProgress.active && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-3 bg-green-500/10 border border-green-500/20 rounded-lg p-2.5 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-green-300">{zh ? `已完成 ${batchProgress.total} 张卡片导出！` : `Successfully exported ${batchProgress.total} cards!`}</span>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Card Preview Modal */}
      <AnimatePresence>
        {fullscreenPreview && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md"
            onClick={() => setFullscreenPreview(false)}>
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative"
              onClick={e => e.stopPropagation()}>
              <CardPreviewCanvas
                width={360}
                opts={{ ...buildCardOpts(), imageUrl: null }}
                animated={animatedPreview}
              />
              {/* Floating action buttons */}
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex gap-3">
                <Button size="sm" variant="outline"
                  className="border-white/20 text-white hover:bg-white/10 gap-1 text-xs backdrop-blur-sm"
                  onClick={() => exportArtistCard(buildCardOpts(), exportFormat)}>
                  <Download className="w-3.5 h-3.5" /> {zh ? `下载${EXPORT_FORMATS[exportFormat].label}` : `Download ${EXPORT_FORMATS[exportFormat].label}`}
                </Button>
                <Button size="sm" variant="outline"
                  className="border-purple-500/20 text-purple-300 hover:bg-purple-500/10 gap-1 text-xs backdrop-blur-sm"
                  onClick={() => { setFullscreenPreview(false); setShowShareModal(true); }}>
                  <Share2 className="w-3.5 h-3.5" /> {zh ? '分享' : 'Share'}
                </Button>
                <Button size="sm" variant="outline"
                  className="border-white/20 text-white hover:bg-white/10 gap-1 text-xs backdrop-blur-sm"
                  onClick={() => setFullscreenPreview(false)}>
                  <X className="w-3.5 h-3.5" /> {zh ? '关闭' : 'Close'}
                </Button>
              </div>
              {/* Theme name badge */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                <Badge className="text-xs bg-black/60 text-white border-white/10 backdrop-blur-sm">
                  {zh ? CARD_THEMES[cardTheme].zh : CARD_THEMES[cardTheme].en}
                </Badge>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Template Library Modal */}
      <AnimatePresence>
        {showTemplateLib && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md"
            onClick={() => setShowTemplateLib(false)}>
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.85, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-gray-900 border border-white/10 rounded-2xl p-6 w-[680px] max-w-[95vw] max-h-[85vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="w-4 h-4 text-violet-400" />
                  <h3 className="text-sm" style={{ fontFamily: 'var(--font-display)' }}>{zh ? '卡片模板库' : 'Card Template Library'}</h3>
                  <Badge className="text-[9px] bg-violet-500/10 border-violet-500/20 text-violet-400">{CARD_PRESETS.length} {zh ? '内置' : 'built-in'}</Badge>
                  {customTemplates.length > 0 && (
                    <Badge className="text-[9px] bg-pink-500/10 border-pink-500/20 text-pink-400">{customTemplates.length} {zh ? '自定义' : 'custom'}</Badge>
                  )}
                  {favorites.length > 0 && (
                    <Badge className="text-[9px] bg-rose-500/10 border-rose-500/20 text-rose-400 flex items-center gap-1"><Heart className="w-2.5 h-2.5 fill-current" />{favorites.length}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowSaveTplDialog(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-pink-500/10 border border-pink-500/20 text-pink-400 hover:bg-pink-500/20 text-[10px] transition">
                    <BookmarkPlus className="w-3 h-3" />
                    {zh ? '保存当前为模板' : 'Save as Template'}
                  </button>
                  <button onClick={() => tplImportRef.current?.click()}
                    title={zh ? '从 JSON 导入模板' : 'Import templates from JSON'}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white text-[10px] transition">
                    <Upload className="w-3 h-3" />
                    {zh ? '导入' : 'Import'}
                  </button>
                  <button onClick={exportAllCustomTemplates}
                    title={zh ? '导出全部自定义模板' : 'Export all custom templates'}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white text-[10px] transition">
                    <FileDown className="w-3 h-3" />
                    {zh ? '导出' : 'Export'}
                  </button>
                  <input ref={tplImportRef} type="file" accept="application/json" className="hidden" onChange={importCustomTemplates} />
                  <button onClick={() => setShowTemplateLib(false)} className="text-gray-500 hover:text-white transition"><X className="w-4 h-4" /></button>
                </div>
              </div>
              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                <input
                  ref={tplSearchRef}
                  value={tplSearch}
                  onChange={e => { setTplSearch(e.target.value); setFocusIdx(-1); }}
                  placeholder={zh ? '搜索模板… (按 / 聚焦)' : 'Search templates… (press / to focus)'}
                  className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-16 py-1.5 text-xs outline-none focus:border-cyan-500/40 transition placeholder:text-gray-600" />
                <kbd className="absolute right-8 top-1/2 -translate-y-1/2 text-[9px] text-gray-600 border border-white/10 rounded px-1 py-0.5 bg-black/40 pointer-events-none">/</kbd>
                {tplSearch && (
                  <button onClick={() => setTplSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              {/* Category tabs */}
              <div className="flex gap-1.5 mb-3">
                {PRESET_CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setTemplateCat(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1 ${templateCat === cat.id ? 'bg-violet-500/10 border border-violet-500/20 text-violet-400' : 'border border-white/5 text-gray-500 hover:border-white/10'}`}>
                    <span className="font-mono text-[9px]">{cat.emoji}</span> {zh ? cat.zh : cat.en}
                  </button>
                ))}
              </div>
              {/* Sort + usage stats row */}
              <div className="flex items-center justify-between mb-4 gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-gray-500">{zh ? '排序' : 'Sort'}</span>
                  {(['default', 'most_used', 'recent'] as const).map(mode => (
                    <button key={mode} onClick={() => setTplSort(mode)}
                      className={`px-2 py-1 rounded-md text-[10px] transition ${tplSort === mode ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400' : 'border border-white/5 text-gray-500 hover:border-white/10'}`}>
                      {mode === 'default' ? (zh ? '默认' : 'Default') : mode === 'most_used' ? (zh ? '最常用' : 'Most Used') : (zh ? '最近用' : 'Recent')}
                    </button>
                  ))}
                </div>
                {totalUsage > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-600">{zh ? '总使用' : 'Total uses'}: <span className="text-cyan-400">{totalUsage}</span></span>
                    <button onClick={resetUsage}
                      className="text-[9px] text-gray-600 hover:text-red-400 transition flex items-center gap-0.5"
                      title={zh ? '清除使用统计' : 'Reset usage stats'}>
                      <RotateCcw className="w-2.5 h-2.5" />
                      {zh ? '清除' : 'Reset'}
                    </button>
                  </div>
                )}
              </div>
              {/* Template grid */}
              <div className="flex-1 overflow-y-auto pr-1">
                {/* Smart Recommendations Section */}
                {recommendations.length > 0 && showRecs && (
                  <div className="mb-4 p-3 rounded-xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/5 via-violet-500/5 to-pink-500/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span className="text-[10px] uppercase tracking-wider bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">{zh ? '为你推荐' : 'Recommended for You'}</span>
                      <span className="text-[9px] text-gray-600">{zh ? '基于使用习惯' : 'based on your usage'}</span>
                      <button onClick={() => setShowRecs(false)}
                        className="ml-auto text-gray-600 hover:text-gray-400 transition" title={zh ? '隐藏推荐' : 'Hide recommendations'}>
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {recommendations.map(({ preset, score, reasons }) => {
                        const thm = CARD_THEMES[preset.theme];
                        return (
                          <button key={preset.id} onClick={() => applyTemplate(preset)}
                            className="group relative flex gap-2 p-2 rounded-lg border border-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition text-left">
                            <div className="flex-shrink-0">
                              <CardPreviewCanvas width={56} opts={{ ...buildCardOpts(), theme: preset.theme, layout: preset.layout, imageUrl: null }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className="text-xs">{preset.emoji}</span>
                                <span className="text-[11px] text-gray-300 truncate">{zh ? preset.zh : preset.en}</span>
                                <span className="ml-auto text-[8px] text-cyan-400/60 tabular-nums">{score}</span>
                              </div>
                              <div className="flex flex-wrap gap-0.5">
                                {reasons.slice(0, 2).map((r, i) => (
                                  <span key={i} className="px-1 rounded text-[8px] bg-white/5 text-gray-500" style={{ borderLeft: `2px solid ${thm.accent1}40` }}>{r}</span>
                                ))}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {recommendations.length === 0 && totalUsage === 0 && (
                  <div className="mb-4 p-3 rounded-xl border border-dashed border-white/5 text-center">
                    <Sparkles className="w-4 h-4 text-gray-700 mx-auto mb-1" />
                    <p className="text-[10px] text-gray-600">{zh ? '使用几次模板后，这里会出现智能推荐 ✨' : 'Use a few templates and smart picks will appear here ✨'}</p>
                  </div>
                )}
                {/* Custom Templates Section */}
                {filteredCustom.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BookmarkPlus className="w-3 h-3 text-pink-400" />
                      <span className="text-[10px] uppercase tracking-wider text-pink-400/80">{zh ? '我的模板' : 'My Templates'}</span>
                      <span className="text-[9px] text-gray-600">{filteredCustom.length}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {sortPresets(filteredCustom).map(tpl => {
                        const thm = CARD_THEMES[tpl.theme];
                        const lay = CARD_LAYOUTS[tpl.layout];
                        const isActive = cardTheme === tpl.theme && cardLayout === tpl.layout;
                        return (
                          <div key={tpl.id} data-tpl-key={`custom:${tpl.id}`}
                            onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, tpl }); }}
                            className={`group relative flex gap-3 p-3 rounded-xl border text-left transition ${isActive ? 'border-pink-500/30 bg-pink-500/5' : 'border-pink-500/10 hover:border-pink-500/20 hover:bg-white/[0.02]'} ${focusedKey === `custom:${tpl.id}` ? 'ring-2 ring-cyan-400/60' : ''}`}>
                            <button onClick={() => applyCustomTemplate(tpl)} className="flex-shrink-0">
                              <CardPreviewCanvas width={80} opts={{ ...buildCardOpts(), theme: tpl.theme, layout: tpl.layout, watermark: tpl.watermark, imageUrl: null }} />
                            </button>
                            <button onClick={() => applyCustomTemplate(tpl)} className="flex-1 min-w-0 text-left">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-sm">{tpl.emoji}</span>
                                {renamingId === tpl.id ? (
                                  <input
                                    autoFocus value={renamingDraft}
                                    onClick={e => e.stopPropagation()}
                                    onChange={e => setRenamingDraft(e.target.value)}
                                    onBlur={() => { if (renamingDraft.trim()) renameCustomTemplate(tpl.id, renamingDraft.trim()); setRenamingId(null); }}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') { if (renamingDraft.trim()) renameCustomTemplate(tpl.id, renamingDraft.trim()); setRenamingId(null); }
                                      if (e.key === 'Escape') setRenamingId(null);
                                    }}
                                    className="flex-1 bg-black/60 border border-pink-500/30 rounded px-1.5 py-0.5 text-[11px] outline-none" />
                                ) : (
                                  <span className="text-xs text-gray-300 truncate"><Highlight text={tpl.name} /></span>
                                )}
                                {tplUsage[tpl.id]?.count > 0 && (
                                  <span className="px-1 rounded text-[8px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">×{tplUsage[tpl.id].count}</span>
                                )}
                                {isActive && <CheckCircle2 className="w-3 h-3 text-pink-400 ml-auto flex-shrink-0" />}
                              </div>
                              <p className="text-[10px] text-gray-600 mb-2">{new Date(tpl.ts).toLocaleDateString()}</p>
                              <div className="flex gap-1 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded text-[9px] border border-white/5 text-gray-500 flex items-center gap-0.5">
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: thm.accent1 }} />
                                  {zh ? thm.zh : thm.en}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[9px] border border-white/5 text-gray-500">{zh ? lay.zh : lay.en}</span>
                                {tpl.watermark.enabled && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] border border-orange-500/15 text-orange-500/60">WM</span>
                                )}
                              </div>
                            </button>
                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                              <button onClick={(e) => { e.stopPropagation(); exportCustomTemplate(tpl); }}
                                title={zh ? '导出此模板' : 'Export this template'}
                                className="text-gray-500 hover:text-cyan-400 transition">
                                <FileDown className="w-3 h-3" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); deleteCustomTemplate(tpl.id); }}
                                title={zh ? '删除' : 'Delete'}
                                className="text-gray-500 hover:text-red-400 transition">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Favorites Section */}
                {favoritePresets.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="w-3 h-3 text-rose-400 fill-current" />
                      <span className="text-[10px] uppercase tracking-wider text-rose-400/80">{zh ? '收藏' : 'Favorites'}</span>
                      <span className="text-[9px] text-gray-600">{favoritePresets.length}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {sortPresets(favoritePresets.filter(matchPreset)).map(preset => {
                        const thm = CARD_THEMES[preset.theme];
                        const lay = CARD_LAYOUTS[preset.layout];
                        const isActive = cardTheme === preset.theme && cardLayout === preset.layout;
                        return (
                          <div key={preset.id} data-tpl-key={`fav:${preset.id}`}
                            className={`group relative flex gap-3 p-3 rounded-xl border text-left transition ${isActive ? 'border-rose-500/30 bg-rose-500/5' : 'border-rose-500/10 hover:border-rose-500/20 hover:bg-white/[0.02]'} ${focusedKey === `fav:${preset.id}` ? 'ring-2 ring-cyan-400/60' : ''}`}>
                            <button onClick={() => applyTemplate(preset)} className="flex-shrink-0">
                              <CardPreviewCanvas width={80} opts={{ ...buildCardOpts(), theme: preset.theme, layout: preset.layout, imageUrl: null }} />
                            </button>
                            <button onClick={() => applyTemplate(preset)} className="flex-1 min-w-0 text-left">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-sm">{preset.emoji}</span>
                                <span className="text-xs text-gray-300"><Highlight text={zh ? preset.zh : preset.en} /></span>
                                {tplUsage[preset.id]?.count > 0 && (
                                  <span className="px-1 rounded text-[8px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">×{tplUsage[preset.id].count}</span>
                                )}
                                {isActive && <CheckCircle2 className="w-3 h-3 text-rose-400 ml-auto" />}
                              </div>
                              <p className="text-[10px] text-gray-600 mb-2">{zh ? preset.desc_zh : preset.desc_en}</p>
                              <div className="flex gap-1">
                                <span className="px-1.5 py-0.5 rounded text-[9px] border border-white/5 text-gray-500 flex items-center gap-0.5">
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: thm.accent1 }} />
                                  {zh ? thm.zh : thm.en}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[9px] border border-white/5 text-gray-500">{zh ? lay.zh : lay.en}</span>
                              </div>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); toggleFavorite(preset.id); }}
                              className="absolute top-2 right-2 text-rose-400 hover:text-rose-300 transition">
                              <Heart className="w-3 h-3 fill-current" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Built-in Presets Section */}
                {(filteredCustom.length > 0 || favoritePresets.length > 0) && (
                  <div className="flex items-center gap-2 mb-2">
                    <LayoutTemplate className="w-3 h-3 text-violet-400" />
                    <span className="text-[10px] uppercase tracking-wider text-violet-400/80">{zh ? '内置模板' : 'Built-in Templates'}</span>
                    <span className="text-[9px] text-gray-600">{filteredPresets.length}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {sortPresets(filteredPresets.filter(matchPreset)).map(preset => {
                    const thm = CARD_THEMES[preset.theme];
                    const lay = CARD_LAYOUTS[preset.layout];
                    const isActive = cardTheme === preset.theme && cardLayout === preset.layout;
                    const isFav = favorites.includes(preset.id);
                    const usage = tplUsage[preset.id];
                    return (
                      <div key={preset.id} data-tpl-key={`preset:${preset.id}`}
                        className={`group relative flex gap-3 p-3 rounded-xl border text-left transition ${isActive ? 'border-violet-500/30 bg-violet-500/5' : 'border-white/5 hover:border-white/10 hover:bg-white/[0.02]'} ${focusedKey === `preset:${preset.id}` ? 'ring-2 ring-cyan-400/60' : ''}`}>
                        <button onClick={() => applyTemplate(preset)} className="flex-shrink-0">
                          <CardPreviewCanvas width={80} opts={{ ...buildCardOpts(), theme: preset.theme, layout: preset.layout, imageUrl: null }} />
                        </button>
                        <button onClick={() => applyTemplate(preset)} className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-sm">{preset.emoji}</span>
                            <span className="text-xs text-gray-300"><Highlight text={zh ? preset.zh : preset.en} /></span>
                            {usage && usage.count > 0 && (
                              <span className="px-1 rounded text-[8px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400" title={zh ? `已使用 ${usage.count} 次` : `Used ${usage.count}×`}>×{usage.count}</span>
                            )}
                            {isActive && <CheckCircle2 className="w-3 h-3 text-violet-400 ml-auto" />}
                          </div>
                          <p className="text-[10px] text-gray-600 mb-2">{zh ? preset.desc_zh : preset.desc_en}</p>
                          <div className="flex gap-1">
                            <span className="px-1.5 py-0.5 rounded text-[9px] border border-white/5 text-gray-500 flex items-center gap-0.5">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: thm.accent1 }} />
                              {zh ? thm.zh : thm.en}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] border border-white/5 text-gray-500">
                              {zh ? lay.zh : lay.en}
                            </span>
                            {preset.watermark && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] border border-orange-500/15 text-orange-500/60">LCK</span>
                            )}
                          </div>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(preset.id); }}
                          className={`absolute top-2 right-2 transition ${isFav ? 'text-rose-400' : 'text-gray-600 opacity-0 group-hover:opacity-100 hover:text-rose-300'}`}
                          title={isFav ? (zh ? '取消收藏' : 'Unfavorite') : (zh ? '收藏' : 'Favorite')}>
                          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                {/* No-results state */}
                {tplQuery && filteredPresets.filter(matchPreset).length === 0 && filteredCustom.length === 0 && favoritePresets.filter(matchPreset).length === 0 && (
                  <div className="text-center py-10">
                    <Search className="w-5 h-5 text-gray-700 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">{zh ? '未找到匹配的模板' : 'No matching templates'}</p>
                    <p className="text-[10px] text-gray-600 mt-1">"<span className="text-cyan-400">{tplSearch}</span>"</p>
                    <button onClick={() => setTplSearch('')}
                      className="mt-3 px-3 py-1 rounded-md text-[10px] border border-white/10 text-gray-400 hover:bg-white/5 transition">
                      {zh ? '清除搜索' : 'Clear search'}
                    </button>
                  </div>
                )}
              </div>
              {/* Context Menu */}
              {ctxMenu && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{ left: Math.min(ctxMenu.x, window.innerWidth - 180), top: Math.min(ctxMenu.y, window.innerHeight - 180) }}
                  className="fixed z-[70] w-[170px] bg-gray-900 border border-pink-500/20 rounded-lg shadow-2xl py-1 backdrop-blur-md">
                  <button
                    onClick={() => { applyCustomTemplate(ctxMenu.tpl); setCtxMenu(null); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-pink-500/10 hover:text-pink-300 transition">
                    <Check className="w-3 h-3" /> {zh ? '应用此模板' : 'Apply Template'}
                  </button>
                  <button
                    onClick={() => { cloneCustomTemplate(ctxMenu.tpl); setCtxMenu(null); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-300 transition">
                    <Copy className="w-3 h-3" /> {zh ? '克隆为副本' : 'Clone as Copy'}
                  </button>
                  <button
                    onClick={() => { setRenamingId(ctxMenu.tpl.id); setRenamingDraft(ctxMenu.tpl.name); setCtxMenu(null); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-violet-500/10 hover:text-violet-300 transition">
                    <Pencil className="w-3 h-3" /> {zh ? '重命名' : 'Rename'}
                  </button>
                  <button
                    onClick={() => { exportCustomTemplate(ctxMenu.tpl); setCtxMenu(null); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-300 transition">
                    <FileDown className="w-3 h-3" /> {zh ? '导出 JSON' : 'Export JSON'}
                  </button>
                  <div className="border-t border-white/5 my-1" />
                  <button
                    onClick={() => { deleteCustomTemplate(ctxMenu.tpl.id); setCtxMenu(null); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-500/10 transition">
                    <Trash2 className="w-3 h-3" /> {zh ? '删除' : 'Delete'}
                  </button>
                </div>
              )}
              {/* Keyboard hints footer */}
              <div className="mt-3 pt-2 border-t border-white/5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-gray-600">
                <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded border border-white/10 bg-black/40 text-gray-400">/</kbd>{zh ? '搜索' : 'search'}</span>
                <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded border border-white/10 bg-black/40 text-gray-400">1-5</kbd>{zh ? '分类' : 'category'}</span>
                <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded border border-white/10 bg-black/40 text-gray-400">↑↓←→</kbd>{zh ? '导航' : 'navigate'}</span>
                <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded border border-white/10 bg-black/40 text-gray-400">↵</kbd>{zh ? '应用' : 'apply'}</span>
                <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded border border-white/10 bg-black/40 text-gray-400">Esc</kbd>{zh ? '关闭' : 'close'}</span>
                {customTemplates.length > 0 && (
                  <span className="ml-auto text-pink-400/60">{zh ? '提示：右键自定义模板可显示菜单' : 'Tip: right-click custom templates for menu'}</span>
                )}
              </div>
              {/* Import / Export Toast */}
              <AnimatePresence>
                {importToast && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}
                    className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-3 py-2 rounded-lg border backdrop-blur-md flex items-center gap-2 text-[11px] ${
                      importToast.type === 'success'
                        ? 'bg-green-500/10 border-green-500/30 text-green-300'
                        : 'bg-red-500/10 border-red-500/30 text-red-300'
                    }`}>
                    {importToast.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {importToast.msg}
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Save Custom Template inline dialog */}
              <AnimatePresence>
                {showSaveTplDialog && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-2xl"
                    onClick={() => setShowSaveTplDialog(false)}>
                    <motion.div
                      initial={{ scale: 0.9, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 10 }}
                      className="bg-gray-900 border border-pink-500/20 rounded-xl p-5 w-[360px]"
                      onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2 mb-4">
                        <BookmarkPlus className="w-4 h-4 text-pink-400" />
                        <span className="text-sm" style={{ fontFamily: 'var(--font-display)' }}>{zh ? '保存为自定义模板' : 'Save as Custom Template'}</span>
                      </div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">{zh ? '名称' : 'Name'}</label>
                      <input
                        autoFocus value={newTplName} onChange={e => setNewTplName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveCustomTemplate(); }}
                        placeholder={zh ? '例如：我的出道海报' : 'e.g. My Debut Poster'}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs mb-3 outline-none focus:border-pink-500/40" />
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">{zh ? '分类' : 'Category'}</label>
                      <div className="flex gap-1.5 mb-4">
                        {(['debut', 'social', 'promo', 'event'] as const).map(cat => (
                          <button key={cat} onClick={() => setNewTplCat(cat)}
                            className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] transition flex items-center justify-center gap-1 ${newTplCat === cat ? 'bg-pink-500/10 border border-pink-500/30 text-pink-400' : 'border border-white/5 text-gray-500 hover:border-white/10'}`}>
                            <span>{CATEGORY_EMOJI[cat]}</span>
                            {zh ? PRESET_CATEGORIES.find(c => c.id === cat)?.zh : PRESET_CATEGORIES.find(c => c.id === cat)?.en}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowSaveTplDialog(false)}
                          className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-gray-400 hover:bg-white/5 transition">
                          {zh ? '取消' : 'Cancel'}
                        </button>
                        <button onClick={saveCustomTemplate}
                          className="px-3 py-1.5 rounded-lg text-xs bg-pink-500/20 border border-pink-500/30 text-pink-300 hover:bg-pink-500/30 transition flex items-center gap-1">
                          <Save className="w-3 h-3" />
                          {zh ? '保存' : 'Save'}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* A/B Compare Modal */}
      <AnimatePresence>
        {showCompare && compareB && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md"
            onClick={() => setShowCompare(false)}>
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-[90vw] max-w-[900px]"
              onClick={e => e.stopPropagation()}>
              {/* Close */}
              <button onClick={() => setShowCompare(false)}
                className="absolute -top-10 right-0 text-gray-400 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
              {/* Title + Diff Summary */}
              <div className="text-center mb-4">
                <span className="text-sm text-gray-300">{zh ? 'A/B 方案对比' : 'A/B Comparison'}</span>
                {/* Diff badges */}
                {(() => {
                  const diffs: { label: string; a: string; b: string }[] = [];
                  if (cardTheme !== compareB.theme) diffs.push({ label: zh ? '主题' : 'Theme', a: zh ? CARD_THEMES[cardTheme].zh : CARD_THEMES[cardTheme].en, b: zh ? CARD_THEMES[compareB.theme].zh : CARD_THEMES[compareB.theme].en });
                  if (cardLayout !== compareB.layout) diffs.push({ label: zh ? '版式' : 'Layout', a: cardLayout, b: compareB.layout });
                  if (watermark.enabled !== compareB.watermark.enabled) diffs.push({ label: zh ? '水印' : 'Watermark', a: watermark.enabled ? 'ON' : 'OFF', b: compareB.watermark.enabled ? 'ON' : 'OFF' });
                  else if (watermark.enabled && compareB.watermark.enabled) {
                    if (watermark.mode !== compareB.watermark.mode) diffs.push({ label: zh ? '水印模式' : 'WM Mode', a: watermark.mode, b: compareB.watermark.mode });
                    if (watermark.opacity !== compareB.watermark.opacity) diffs.push({ label: zh ? '水印透明度' : 'WM Opacity', a: `${watermark.opacity}%`, b: `${compareB.watermark.opacity}%` });
                    if (watermark.position !== compareB.watermark.position) diffs.push({ label: zh ? '水印位置' : 'WM Position', a: watermark.position.toUpperCase(), b: compareB.watermark.position.toUpperCase() });
                  }
                  if (diffs.length === 0) return <p className="text-[10px] text-green-500/60 mt-1">{zh ? '✓ 两方案完全相同' : '✓ Both configs are identical'}</p>;
                  return (
                    <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                      {diffs.map((d, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-500/15 bg-amber-500/5 text-[9px]">
                          <AlertCircle className="w-2.5 h-2.5 text-amber-500/50" />
                          <span className="text-gray-500">{d.label}:</span>
                          <span className="text-cyan-400">{d.a}</span>
                          <span className="text-gray-600">→</span>
                          <span className="text-purple-400">{d.b}</span>
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>
              {/* Side by side cards */}
              <div className="flex gap-6 justify-center items-start">
                {/* Side A: current */}
                <div className="flex flex-col items-center gap-3">
                  <Badge className="bg-cyan-500/10 border-cyan-500/20 text-cyan-400">A — {zh ? '当前方案' : 'Current'}</Badge>
                  <CardPreviewCanvas
                    width={280}
                    opts={{ ...buildCardOpts(), imageUrl: null }}
                    animated={false}
                  />
                  <div className="flex flex-wrap gap-1 justify-center">
                    <Badge className="text-[10px] bg-black/40 border-white/5 text-gray-400">
                      {zh ? CARD_THEMES[cardTheme].zh : CARD_THEMES[cardTheme].en}
                    </Badge>
                    <Badge className="text-[10px] bg-black/40 border-white/5 text-gray-400">{cardLayout}</Badge>
                    {watermark.enabled && <Badge className="text-[10px] bg-orange-500/10 border-orange-500/20 text-orange-400">LCK</Badge>}
                  </div>
                </div>

                {/* Divider with swap */}
                <div className="flex flex-col items-center gap-2 pt-16">
                  <div className="w-px h-24 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                  <button onClick={() => {
                    // Swap A and B
                    const currentA = { theme: cardTheme, layout: cardLayout, watermark: { ...watermark } };
                    setCardTheme(compareB.theme);
                    setCardLayout(compareB.layout);
                    setWatermark({ ...compareB.watermark });
                    setCompareB(currentA);
                  }}
                    className="p-2 rounded-full border border-white/10 hover:border-sky-500/30 hover:bg-sky-500/5 text-gray-500 hover:text-sky-400 transition"
                    title={zh ? '交换A/B' : 'Swap A/B'}>
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>
                  <div className="w-px h-24 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                </div>

                {/* Side B: alternate */}
                <div className="flex flex-col items-center gap-3">
                  <Badge className="bg-purple-500/10 border-purple-500/20 text-purple-400">B — {zh ? '对比方案' : 'Alternate'}</Badge>
                  <CardPreviewCanvas
                    width={280}
                    opts={{ ...buildCardOpts(), theme: compareB.theme, layout: compareB.layout, watermark: compareB.watermark, imageUrl: null }}
                    animated={false}
                  />
                  {/* B theme picker */}
                  <div className="flex flex-wrap gap-1 justify-center">
                    {(Object.keys(CARD_THEMES) as CardTheme[]).map(tk => {
                      const thm = CARD_THEMES[tk];
                      const active = compareB.theme === tk;
                      return (
                        <button key={tk} onClick={() => setCompareB(b => b ? { ...b, theme: tk } : b)}
                          className={`w-6 h-6 rounded-full border transition flex-shrink-0 ${active ? 'border-white/30 scale-110' : 'border-white/5 hover:border-white/15'}`}
                          style={{ background: `linear-gradient(135deg, ${thm.accent1}, ${thm.accent2})` }}
                          title={zh ? thm.zh : thm.en} />
                      );
                    })}
                  </div>
                  {/* B layout picker */}
                  <div className="flex gap-1">
                    {(Object.keys(CARD_LAYOUTS) as CardLayout[]).map(lk => {
                      const lay = CARD_LAYOUTS[lk];
                      const Icon = lay.icon;
                      const active = compareB.layout === lk;
                      return (
                        <button key={lk} onClick={() => setCompareB(b => b ? { ...b, layout: lk } : b)}
                          className={`px-2 py-1 rounded border text-[10px] flex items-center gap-1 transition ${active ? 'border-purple-500/30 bg-purple-500/5 text-purple-400' : 'border-white/5 text-gray-600 hover:border-white/10'}`}>
                          <Icon className="w-3 h-3" /> {zh ? lay.zh : lay.en}
                        </button>
                      );
                    })}
                  </div>
                  {/* Load snapshot into B */}
                  {snapshots.length > 0 && (
                    <div className="flex flex-wrap gap-1 justify-center">
                      <span className="text-[9px] text-gray-600 w-full text-center mb-0.5">{zh ? '从快照加载' : 'Load snapshot'}:</span>
                      {snapshots.slice(0, 5).map(snap => (
                        <button key={snap.id}
                          onClick={() => setCompareB({ theme: snap.theme, layout: snap.layout, watermark: { ...snap.watermark } })}
                          className="px-1.5 py-0.5 rounded border border-white/5 text-[9px] text-gray-500 hover:border-purple-500/20 hover:text-purple-400 transition flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: CARD_THEMES[snap.theme].accent1 }} />
                          {snap.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Apply B as current */}
                  <Button size="sm" className="bg-gradient-to-r from-purple-500 to-pink-600 hover:opacity-90 gap-1 text-xs mt-1"
                    onClick={() => {
                      setCardTheme(compareB.theme);
                      setCardLayout(compareB.layout);
                      setWatermark({ ...compareB.watermark });
                      setShowCompare(false);
                    }}>
                    <Check className="w-3.5 h-3.5" /> {zh ? '采用B方案' : 'Apply B'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );
};