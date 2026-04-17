// ─────────────────────────────────────────────────────────────────────────────
// ArtistTypes.ts — 兼容垫片（COMPAT SHIM）
// ─────────────────────────────────────────────────────────────────────────────
// 真实定义在：
//   - 类型 / 枚举：  @/types/artist
//   - 静态配置：    @/constants/artist-config   （纯中文）
//   - Mock 数据：   @/mocks/artists
//
// 历史组件以 `typeConf.workshop.zh`、`ARTIST_TYPE_LABELS[t].en` 形式访问常量。
// 为了渐进式迁移，本文件把新的"纯中文"常量包装回老的 `{ zh, en }` 形态；
// 运行时 en 字段回落到中文值。
//
// **新代码请直接从 @/types / @/constants / @/mocks 导入，不要通过本文件。**
// 本垫片在所有组件迁移完毕后可删除。
// ─────────────────────────────────────────────────────────────────────────────

import {
  ARTIST_TYPE_CONFIG as RAW_TYPE_CONFIG,
  ARTIST_TYPE_LABELS as RAW_TYPE_LABELS,
  QUALITY_CONFIG as RAW_QUALITY_CONFIG,
  STATUS_CONFIG as RAW_STATUS_CONFIG,
  TALENT_LABELS as RAW_TALENT_LABELS,
  DOMAINS_8 as RAW_DOMAINS_8,
} from "@/constants/artist-config";
import type { ArtistTypeConfig } from "@/constants/artist-config";
import type {
  Artist,
  ArtistStatus,
  ArtistType,
  ArtistQuality,
  TalentKey,
  TalentProfile,
  ArtistStats,
} from "@/types/artist";

// ── 类型 re-export（Quality 别名保持向后兼容） ───────────────────────────────
export type {
  Artist,
  ArtistStatus,
  ArtistType,
  TalentKey,
  TalentProfile,
  ArtistStats,
};
export type Quality = ArtistQuality;

// ── 中文字段 → { zh, en } 包装器 ─────────────────────────────────────────────
const toZhEn = (s: string) => ({ zh: s, en: s });
const toZhEnArr = (arr: string[]) => ({ zh: arr, en: arr });

type LegacyTypeConfig = Omit<
  ArtistTypeConfig,
  "workshop" | "templates" | "contentFormats" | "monetization" | "primaryDomains" | "previewScene" | "extraPersona"
> & {
  workshop: { zh: string; en: string };
  templates: { zh: string[]; en: string[] };
  contentFormats: { zh: string[]; en: string[] };
  monetization: { zh: string[]; en: string[] };
  primaryDomains: { zh: string[]; en: string[] };
  previewScene: { zh: string; en: string };
  extraPersona?: { zh: string; en: string };
};

export type TypeConfig = LegacyTypeConfig;

export const ARTIST_TYPE_CONFIG: Record<ArtistType, LegacyTypeConfig> = Object.fromEntries(
  (Object.entries(RAW_TYPE_CONFIG) as [ArtistType, ArtistTypeConfig][]).map(([key, c]) => [
    key,
    {
      icon: c.icon,
      primaryTalents: c.primaryTalents,
      secondaryTalents: c.secondaryTalents,
      initialTalents: c.initialTalents,
      talentCaps: c.talentCaps,
      color: c.color,
      bgColor: c.bgColor,
      borderColor: c.borderColor,
      workshop: toZhEn(c.workshop),
      templates: toZhEnArr(c.templates),
      contentFormats: toZhEnArr(c.contentFormats),
      monetization: toZhEnArr(c.monetization),
      primaryDomains: toZhEnArr(c.primaryDomains),
      previewScene: toZhEn(c.previewScene),
      extraPersona: c.extraPersona ? toZhEn(c.extraPersona) : undefined,
    },
  ]),
) as Record<ArtistType, LegacyTypeConfig>;

export const ARTIST_TYPE_LABELS: Record<ArtistType, { zh: string; en: string }> = Object.fromEntries(
  (Object.entries(RAW_TYPE_LABELS) as [ArtistType, string][]).map(([k, v]) => [k, toZhEn(v)]),
) as Record<ArtistType, { zh: string; en: string }>;

export const QUALITY_CONFIG: Record<Quality, { zh: string; en: string; color: string; border: string; bg: string }> =
  Object.fromEntries(
    (Object.entries(RAW_QUALITY_CONFIG) as [Quality, typeof RAW_QUALITY_CONFIG[Quality]][]).map(([k, v]) => [
      k,
      { zh: v.label, en: v.label, color: v.color, border: v.border, bg: v.bg },
    ]),
  ) as Record<Quality, { zh: string; en: string; color: string; border: string; bg: string }>;

export const STATUS_CONFIG: Record<ArtistStatus, { zh: string; en: string; color: string; dot: string }> =
  Object.fromEntries(
    (Object.entries(RAW_STATUS_CONFIG) as [ArtistStatus, typeof RAW_STATUS_CONFIG[ArtistStatus]][]).map(([k, v]) => [
      k,
      { zh: v.label, en: v.label, color: v.color, dot: v.dot },
    ]),
  ) as Record<ArtistStatus, { zh: string; en: string; color: string; dot: string }>;

export const TALENT_LABELS: Record<TalentKey, { zh: string; en: string; color: string }> = Object.fromEntries(
  (Object.entries(RAW_TALENT_LABELS) as [TalentKey, typeof RAW_TALENT_LABELS[TalentKey]][]).map(([k, v]) => [
    k,
    { zh: v.label, en: v.label, color: v.color },
  ]),
) as Record<TalentKey, { zh: string; en: string; color: string }>;

export const DOMAINS_8 = RAW_DOMAINS_8.map((d) => ({
  id: d.id,
  zh: d.label,
  en: d.label,
  color: d.color,
  bg: d.bg,
}));

// ── Mock 数据 re-export ──────────────────────────────────────────────────────
export { MOCK_ARTISTS } from "@/mocks/artists";
